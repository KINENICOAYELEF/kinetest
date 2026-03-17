import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { selectAdaptiveQuestions, updateTagMastery, TagMastery, selectVariant } from '../utils/adaptiveEngine';

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
    difficulty: number;
    tags: string[];
    family_id?: string;
    hints?: string[];
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

                // 4. Questions
                const qSnap = await getDocs(query(collection(db, 'questions'), where('unit_id', '==', unitId)));
                const questions = qSnap.docs.map(d => ({ question_id: d.id, ...d.data() } as Question));
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

    if (loading) return <div style={{ padding: 20 }}>Cargando Tutor...</div>;
    if (tutorCards.length === 0) return <div style={{ padding: 20 }}>No hay contenido disponible para esta unidad. <button onClick={() => navigate('/units')}>Volver</button></div>;

    const currentCard = tutorCards[currentCardIndex];
    const currentQuestion = viewMode === 'remediation' ? remediationQuestion! : quizQuestions[currentQuizIndex];

    return (
        <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
            {viewMode === 'card' ? (
                <div style={{ background: 'white', padding: 30, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <small style={{ color: '#1976d2', fontWeight: 'bold' }}>TEMA {currentCardIndex + 1}</small>
                    <h1 style={{ marginTop: 10 }}>{currentCard.title}</h1>
                    <div style={{ fontSize: '1.2rem', lineHeight: '1.6', color: '#333', margin: '20px 0' }}>
                        {currentCard.content}
                    </div>
                    <button 
                        onClick={startQuizForCard}
                        style={{ background: '#1976d2', color: 'white', border: 'none', padding: '15px 30px', borderRadius: 8, cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                    >
                        Entendido, hagamos el Microquiz
                    </button>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <span>Microquiz: Pregunta {currentQuizIndex + 1} de {quizQuestions.length}</span>
                        {viewMode === 'remediation' && <span style={{ background: '#fff9c4', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold', border: '1px solid #fbc02d' }}>\u26a0\ufe0f Remediaci\u00f3n</span>}
                    </div>

                    <div style={{ background: 'white', padding: 30, borderRadius: 12, border: '1px solid #eee' }}>
                        {viewMode === 'remediation' && (
                            <div style={{ background: '#e3f2fd', padding: 15, borderRadius: 8, marginBottom: 20 }}>
                                <strong>💡 Refuerzo:</strong> {tutorCards[currentCardIndex].content.slice(0, 100)}...
                            </div>
                        )}
                        <h2>{currentQuestion.content}</h2>

                        {/* HINTS SECTION */}
                        {!showFeedback && currentQuestion.hints && hintsUsed < currentQuestion.hints.length && (
                            <div style={{ margin: '20px 0' }}>
                                <button 
                                    onClick={() => setHintsUsed(prev => prev + 1)}
                                    style={{ background: '#f5f5f5', border: '1px solid #ccc', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}
                                >
                                    \ud83d\udca1 Ver Pista ({hintsUsed + 1}/{currentQuestion.hints.length})
                                </button>
                                {hintsUsed > 0 && (
                                    <div style={{ marginTop: 10, padding: 10, background: '#fff9c4', borderRadius: 4 }}>
                                        {currentQuestion.hints.slice(0, hintsUsed).map((h, i) => (
                                            <p key={i} style={{ margin: '5px 0' }}>\u2022 {h}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
                            {currentQuestion.options.map((opt, i) => {
                                const isCorrect = opt.isCorrect;
                                const isSelected = selectedOption === i;
                                let borderColor = '#ddd';
                                let bg = 'white';

                                if (showFeedback) {
                                    if (isCorrect) { borderColor = '#4caf50'; bg = '#e8f5e9'; }
                                    else if (isSelected) { borderColor = '#f44336'; bg = '#ffebee'; }
                                } else if (isSelected) {
                                    borderColor = '#1976d2'; bg = '#e3f2fd';
                                }

                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleAnswer(i)}
                                        disabled={showFeedback}
                                        style={{ padding: 15, textAlign: 'left', border: '2px solid', borderColor, borderRadius: 8, background: bg, cursor: showFeedback ? 'default' : 'pointer' }}
                                    >
                                        {opt.text}
                                    </button>
                                );
                            })}
                        </div>

                        {showFeedback && (
                            <div style={{ marginTop: 20, padding: 20, background: '#f5f5f5', borderRadius: 8 }}>
                                <h3 style={{ margin: 0 }}>Explicaci\u00f3n:</h3>
                                <p style={{ margin: '10px 0' }}>{currentQuestion.rationale}</p>
                                <button 
                                    onClick={nextStep}
                                    style={{ background: '#4caf50', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    Continuar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
