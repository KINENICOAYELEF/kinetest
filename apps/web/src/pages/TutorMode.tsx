import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { selectAdaptiveQuestions, updateTagMastery, TagMastery, selectVariant } from '../utils/adaptiveEngine';
import { shuffleArray } from '../utils/shuffle';

interface TutorCard {
    id: string;
    title: string;
    content: string;
    tag: string;
}

interface Question {
    question_id: string;
    content: string;
    options: { text: string; isCorrect: boolean }[];
    rationale: string;
    learning_pearl?: string;
    difficulty: number;
    tags: string[];
    family_id?: string;
    hints?: string[];
    status?: string;
    unit_id?: string;
}

export const TutorMode = () => {
    const { unitId } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [tutorCards, setTutorCards] = useState<TutorCard[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'card' | 'quiz' | 'remediation'>('card');
    
    // Quiz State
    const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [userMastery, setUserMastery] = useState<Record<string, TagMastery>>({});
    
    // Remediation State
    const [remediationQuestion, setRemediationQuestion] = useState<Question | null>(null);

    useEffect(() => {
        const initTutor = async () => {
            if (!currentUser || !unitId) return;
            try {
                // 1. Session
                const sRef = await addDoc(collection(db, 'sessions'), {
                    uid: currentUser.uid,
                    unitId,
                    mode: 'tutor',
                    startedAt: serverTimestamp()
                });
                setSessionId(sRef.id);

                // 2. Mastery
                const mRef = collection(db, 'users', currentUser.uid, 'tag_mastery');
                const mSnap = await getDocs(mRef);
                const mData: Record<string, TagMastery> = {};
                mSnap.docs.forEach(d => { mData[d.id] = d.data() as TagMastery; });
                setUserMastery(mData);

                // 3. Tutor Cards (as subcollection of units or just data)
                const cardsSnap = await getDocs(collection(db, 'units', unitId, 'tutor_cards'));
                const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TutorCard));
                setTutorCards(cards);

                // 4. Questions (Filter only approved)
                const qSnap = await getDocs(query(collection(db, 'questions'), where('unit_id', '==', unitId)));
                const questions = qSnap.docs
                    .map(d => ({ question_id: d.id, ...d.data() } as Question))
                    .filter(q => q.status === 'approved' || q.status === undefined); // undefined fallback for old data
                setAllQuestions(questions);

            } catch (e) {
                console.error("Error loading tutor mode:", e);
            } finally {
                setLoading(false);
            }
        };
        initTutor();
    }, [unitId, currentUser]);

    const startQuizForCard = () => {
        const currentCard = tutorCards[currentCardIndex];
        // Filter questions by card tag
        const tagQuestions = allQuestions.filter(q => q.tags?.includes(currentCard.tag));
        // Use adaptive selection for the microquiz (3-5 questions)
        const selected = selectAdaptiveQuestions(tagQuestions, userMastery, 3);
        setQuizQuestions(selected);
        setCurrentQuizIndex(0);
        setViewMode('quiz');
        setSelectedOption(null);
        setShowFeedback(false);
        setHintsUsed(0);
    };

    const handleAnswer = async (index: number) => {
        if (showFeedback || !currentUser || !sessionId) return;
        const question = viewMode === 'remediation' ? remediationQuestion! : quizQuestions[currentQuizIndex];
        const isCorrect = question.options[index].isCorrect;
        
        setSelectedOption(index);
        setShowFeedback(true);

        // Penalty logic for hints
        let scoreMultiplier = 1.0;
        if (hintsUsed === 1) scoreMultiplier = 0.8;
        if (hintsUsed === 2) scoreMultiplier = 0.6;
        if (hintsUsed >= 3) scoreMultiplier = 0.4;

        try {
            // Save attempt
            await addDoc(collection(db, 'users', currentUser.uid, 'attempts'), {
                questionId: question.question_id,
                sessionId,
                isCorrect,
                hintsUsed,
                scoreMultiplier,
                timestamp: serverTimestamp()
            });

            // Update Mastery
            if (question.tags) {
                for (const tag of question.tags) {
                    const currentM = userMastery[tag];
                    const updatedM = updateTagMastery(currentM, isCorrect, question.difficulty || 3);
                    await setDoc(doc(db, 'users', currentUser.uid, 'tag_mastery', tag), updatedM);
                    userMastery[tag] = updatedM;
                }
            }
        } catch (e) { console.error(e); }
    };

    const nextStep = () => {
        if (viewMode === 'remediation') {
            // After remediation, go back to normal quiz flow
            setRemediationQuestion(null);
            if (currentQuizIndex < quizQuestions.length - 1) {
                setCurrentQuizIndex(currentQuizIndex + 1);
                setViewMode('quiz');
                setSelectedOption(null);
                setShowFeedback(false);
                setHintsUsed(0);
            } else {
                finishCard();
            }
            return;
        }

        const question = quizQuestions[currentQuizIndex];
        const lastCorrect = selectedOption !== null && question.options[selectedOption].isCorrect;

        if (!lastCorrect) {
            // FAILED -> REMEDIATION
            const variant = selectVariant(question, allQuestions);
            if (variant) {
                setRemediationQuestion(variant);
                setViewMode('remediation');
                setSelectedOption(null);
                setShowFeedback(false);
                setHintsUsed(0);
                return;
            }
        }

        if (currentQuizIndex < quizQuestions.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
            setSelectedOption(null);
            setShowFeedback(false);
            setHintsUsed(0);
        } else {
            finishCard();
        }
    };

    const finishCard = async () => {
        if (currentCardIndex < tutorCards.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
            setViewMode('card');
        } else {
            // All cards finished
            if (sessionId) {
                await setDoc(doc(db, 'sessions', sessionId), {
                    status: 'completed',
                    endedAt: serverTimestamp()
                }, { merge: true });
            }
            navigate('/units');
        }
    };

    if (loading) return <div className="container"><p>Cargando Tutor...</p></div>;
    if (tutorCards.length === 0) return (
        <div className="container">
            <p>No hay contenido disponible para esta unidad.</p>
            <button onClick={() => navigate('/units')}>Volver al listado</button>
        </div>
    );

    const currentCard = tutorCards[currentCardIndex];
    const currentQuestion = viewMode === 'remediation' ? remediationQuestion! : quizQuestions[currentQuizIndex];
    const [shuffledOptions, setShuffledOptions] = useState<any[]>([]);

    useEffect(() => {
        if (currentQuestion?.options) {
            setShuffledOptions(shuffleArray(currentQuestion.options));
        }
    }, [currentQuestion]);

    return (
        <div className="container" style={{ maxWidth: 800 }}>
            {viewMode === 'card' ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 40, borderRadius: 20, border: '1px solid var(--glass-border)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'var(--primary)' }} />
                    <small style={{ color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px' }}>TEMA {currentCardIndex + 1}</small>
                    <h1 style={{ marginTop: 10, textAlign: 'left', background: 'none', WebkitTextFillColor: 'white' }}>{currentCard.title}</h1>
                    <div style={{ fontSize: '1.2rem', lineHeight: '1.6', color: 'var(--text-muted)', margin: '30px 0' }}>
                        {currentCard.content}
                    </div>
                    <button onClick={startQuizForCard}>
                        Entendido, hagamos el Microquiz
                    </button>
                </div>
            ) : (
                <div className="flex-col" style={{ gap: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>Microquiz: Pregunta {currentQuizIndex + 1} de {quizQuestions.length}</span>
                        {viewMode === 'remediation' && (
                            <span style={{ 
                                background: 'rgba(251, 192, 45, 0.1)', 
                                color: '#fbc02d', 
                                padding: '4px 10px', 
                                borderRadius: 10, 
                                fontWeight: 'bold', 
                                border: '1px solid rgba(251, 192, 45, 0.2)',
                                fontSize: '0.75rem'
                            }}>
                                ⚠️ Remediación
                            </span>
                        )}
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                        {viewMode === 'remediation' && (
                            <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: 15, borderRadius: 10, marginBottom: 24, border: '1px solid rgba(99, 102, 241, 0.1)', fontSize: '0.9rem' }}>
                                <strong>💡 Refuerzo:</strong> {tutorCards[currentCardIndex].title}
                            </div>
                        )}
                        <h3 style={{ textAlign: 'left', background: 'none', WebkitTextFillColor: 'white', lineHeight: '1.4', margin: 0 }}>{currentQuestion.content}</h3>

                        {/* HINTS SECTION */}
                        {!showFeedback && currentQuestion.hints && hintsUsed < currentQuestion.hints.length && (
                            <div style={{ margin: '24px 0' }}>
                                <button 
                                    onClick={() => setHintsUsed(prev => prev + 1)}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', fontSize: '0.85rem', width: 'auto', padding: '10px 20px' }}
                                >
                                    💡 Ver Pista ({hintsUsed + 1}/{currentQuestion.hints.length})
                                </button>
                                {hintsUsed > 0 && (
                                    <div style={{ marginTop: 12, padding: 16, background: 'rgba(251, 192, 45, 0.05)', borderRadius: 10, border: '1px solid rgba(251, 192, 45, 0.1)', color: '#fbc02d', fontSize: '0.9rem' }}>
                                        {currentQuestion.hints.slice(0, hintsUsed).map((h, i) => (
                                            <p key={i} style={{ margin: '4px 0', color: 'inherit' }}>• {h}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex-col" style={{ gap: 12, marginTop: 24 }}>
                            {shuffledOptions.map((opt, i) => {
                                const isCorrect = opt.isCorrect;
                                const isSelected = selectedOption !== null && shuffledOptions[selectedOption] === opt;
                                let borderColor = 'var(--glass-border)';
                                let bg = 'rgba(255,255,255,0.02)';
                                let color = 'var(--text-muted)';

                                if (showFeedback) {
                                    if (isCorrect) { borderColor = 'var(--accent)'; bg = 'rgba(16, 185, 129, 0.1)'; color = 'white'; }
                                    else if (isSelected) { borderColor = '#f44336'; bg = 'rgba(244, 67, 54, 0.1)'; color = 'white'; }
                                } else if (isSelected) {
                                    borderColor = 'var(--primary)'; bg = 'rgba(99, 102, 241, 0.1)'; color = 'white';
                                }

                                return (
                                    <button
                                        key={opt.text}
                                        onClick={() => handleAnswer(shuffledOptions.indexOf(opt))}
                                        disabled={showFeedback}
                                        style={{ padding: 16, textAlign: 'left', border: '1px solid', borderColor, borderRadius: 12, background: bg, color, cursor: showFeedback ? 'default' : 'pointer', fontSize: '0.95rem' }}
                                    >
                                        {opt.text}
                                    </button>
                                );
                            })}
                        </div>

                        {showFeedback && (
                            <div style={{ marginTop: 25, animation: 'fadeIn 0.5s' }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                                <h4 style={{ color: selectedOption !== null && currentQuestion.options[selectedOption].isCorrect ? 'var(--accent)' : '#f87171', marginBottom: 10 }}>
                                    {selectedOption !== null && currentQuestion.options[selectedOption].isCorrect ? '¡Excelente Razonamiento!' : 'Oportunidad de Aprendizaje'}
                                </h4>
                                <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>{currentQuestion.rationale}</p>
                                
                                {currentQuestion.learning_pearl && (
                                    <div style={{ marginTop: 15, padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, border: '1px dashed var(--accent)', display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <span style={{ fontSize: '1.2rem' }}>💡</span>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                                            Perla Clínica: {currentQuestion.learning_pearl}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <button onClick={nextStep} style={{ marginTop: 20 }}>Continuar</button>
                        </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
