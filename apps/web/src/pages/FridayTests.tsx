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
  tags: string[];
  difficulty: number;
  family_id?: string;
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
            const selected = selectAdaptiveQuestions(allQ, mData, 40, true);
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

    if (loading) return <div style={{ padding: 20 }}>Preparando examen...</div>;

    if (!testType) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <h1>\ud83d\uddd3\ufe0f Viernes de Evaluaci\u00f3n</h1>
                <p>Hoy toca demostrar lo aprendido durante el ciclo. Debes completar ambos tests.</p>
                <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 30 }}>
                    <button 
                        onClick={() => startTest('A')}
                        style={{ padding: '20px 40px', background: '#1976d2', color: 'white', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                        Iniciar Test A
                    </button>
                    <button 
                        onClick={() => startTest('B')}
                        style={{ padding: '20px 40px', background: '#7b1fa2', color: 'white', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                        Iniciar Test B
                    </button>
                </div>
            </div>
        );
    }

    if (finished && results) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <h1>Test {testType} Completado</h1>
                <div style={{ fontSize: '2rem', margin: '20px 0' }}>
                    Nota: <span style={{ color: results.grade >= 4.0 ? 'green' : 'red' }}>{results.grade}</span>
                </div>
                <button onClick={() => navigate('/home')} style={{ padding: '10px 20px' }}>Volver al Inicio</button>
            </div>
        );
    }

    const q = questions[currentIndex];

    return (
        <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <span>Test {testType} - Pregunta {currentIndex + 1}/40</span>
                <span style={{ fontWeight: 'bold' }}>Tiempo: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
            </div>

            <div style={{ background: 'white', padding: 30, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <h2>{q?.content}</h2>
                <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
                    {q?.options.map((opt, i) => (
                        <button
                            key={i}
                            onClick={() => setAnswers({ ...answers, [currentIndex]: i })}
                            style={{ 
                                padding: 15, 
                                textAlign: 'left', 
                                border: '2px solid', 
                                borderColor: answers[currentIndex] === i ? '#1976d2' : '#eee',
                                background: answers[currentIndex] === i ? '#f1f8ff' : 'white',
                                borderRadius: 8,
                                cursor: 'pointer'
                            }}
                        >
                            {opt.text}
                        </button>
                    ))}
                </div>
                
                <div style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between' }}>
                    <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(prev => prev - 1)}>Anterior</button>
                    {currentIndex < 39 ? (
                        <button onClick={() => setCurrentIndex(prev => prev + 1)} style={{ background: '#1976d2', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 4 }}>Siguiente</button>
                    ) : (
                        <button onClick={() => handleSubmit()} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 4 }}>Finalizar Test</button>
                    )}
                </div>
            </div>
        </div>
    );
};
