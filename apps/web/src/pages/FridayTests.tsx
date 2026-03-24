import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { calculateChileanGrade } from '../utils/gradeCalculator';
import { selectAdaptiveQuestions, TagMastery, Question as AdaptiveQuestion } from '../utils/adaptiveEngine';

interface Question extends AdaptiveQuestion {
  question_id: string;
  content: string;
  options: { text: string; isCorrect: boolean }[];
  rationale: string;
  learning_pearl?: string;
  tags: string[];
  difficulty: number;
  family_id?: string;
  status?: string;
}

export const FridayTests = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    
    const [testType, setTestType] = useState<'A' | 'B' | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [timeLeft, setTimeLeft] = useState(45 * 60);
    const [finished, setFinished] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{ score: number; grade: number } | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startTest = async (type: 'A' | 'B') => {
        if (!currentUser) return;
        setLoading(true);
        setTestType(type);

        try {
            // 1. Fetch Mastery
            const mRef = collection(db, 'users', currentUser.uid, 'tag_mastery');
            const mSnap = await getDocs(mRef);
            const mData: Record<string, TagMastery> = {};
            mSnap.docs.forEach(d => { mData[d.id] = d.data() as TagMastery; });

            // 2. Fetch all questions (Viernes uses whole bank)
            const qSnap = await getDocs(collection(db, 'questions'));
            const allQ = qSnap.docs.map(d => ({ question_id: d.id, ...d.data() } as Question));

            // 3. Adaptive selection (40 questions, unique families)
            const approvedQ = allQ.filter(q => q.status === 'approved' || q.status === undefined);
            const selected = selectAdaptiveQuestions(approvedQ, mData, 40, true);
            setQuestions(selected);

            // Start Timer
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current!);
                        handleSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (finished || !currentUser || !testType) return;
        setFinished(true);
        if (timerRef.current) clearInterval(timerRef.current);

        let correct = 0;
        questions.forEach((q, i) => {
            if (answers[i] !== undefined && q.options[answers[i]].isCorrect) correct++;
        });

        const percent = Math.round((correct / questions.length) * 100);
        const grade = calculateChileanGrade(percent);

        try {
            // Save Friday Result
            await addDoc(collection(db, 'sessions'), {
                uid: currentUser.uid,
                mode: 'friday',
                testType,
                score: percent,
                grade,
                startedAt: serverTimestamp(),
                endedAt: serverTimestamp(),
                status: 'completed'
            });

            setResults({ score: percent, grade });
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="container"><p>Preparando tu examen de viernes...</p></div>;

    if (!testType) {
        return (
            <div className="container">
                <h1>📅 Viernes de Evaluación</h1>
                <p>Hoy toca demostrar lo aprendido durante el ciclo. Debes completar ambos tests para obtener tu certificación semanal.</p>
                <div className="flex-col" style={{ gap: 16 }}>
                    <button 
                        onClick={() => startTest('A')}
                    >
                        Iniciar Test A
                    </button>
                    <button 
                        onClick={() => startTest('B')}
                        style={{ background: 'var(--secondary)' }}
                    >
                        Iniciar Test B
                    </button>
                </div>
            </div>
        );
    }

    if (finished && results) {
        return (
            <div className="container">
                <h1>Test {testType} Completado</h1>
                <div style={{ fontSize: '3rem', margin: '30px 0', fontWeight: 'bold' }}>
                    Nota: <span style={{ color: results.grade >= 4.0 ? 'var(--accent)' : '#f87171' }}>{results.grade}</span>
                </div>
                <button onClick={() => navigate('/home')}>Volver al Panel de Inicio</button>
            </div>
        );
    }

    const q = questions[currentIndex];

    return (
        <div className="container" style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Test {testType} • Pregunta {currentIndex + 1} de 40</span>
                <span style={{ fontWeight: 'bold', color: timeLeft < 300 ? '#f87171' : 'white' }}>
                    ⌛ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '30px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                <h3 style={{ textAlign: 'left', background: 'none', WebkitTextFillColor: 'white', lineHeight: '1.4', margin: 0 }}>{q?.content}</h3>
                
                <div className="flex-col" style={{ gap: 12, marginTop: 24 }}>
                    {q?.options.map((opt, i) => (
                        <button
                            key={i}
                            onClick={() => setAnswers({ ...answers, [currentIndex]: i })}
                            style={{ 
                                padding: '16px', 
                                textAlign: 'left', 
                                border: '1px solid', 
                                borderColor: answers[currentIndex] === i ? 'var(--primary)' : 'var(--glass-border)',
                                background: answers[currentIndex] === i ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                                color: answers[currentIndex] === i ? 'white' : 'var(--text-muted)',
                                borderRadius: '12px',
                                fontSize: '0.95rem'
                            }}
                        >
                            {opt.text}
                        </button>
                    ))}
                </div>
                
                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <button 
                        disabled={currentIndex === 0} 
                        onClick={() => setCurrentIndex(prev => prev - 1)}
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
                    >
                        Anterior
                    </button>
                    {currentIndex < 39 ? (
                        <button onClick={() => setCurrentIndex(prev => prev + 1)}>Siguiente</button>
                    ) : (
                        <button onClick={() => handleSubmit()} style={{ background: 'var(--accent)' }}>Finalizar Test</button>
                    )}
                </div>
            </div>
        </div>
    );
};
