import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { calculateChileanGrade } from '../utils/gradeCalculator';
import { selectAdaptiveQuestions, calculateNextMastery, TagMastery } from '../utils/adaptiveEngine';

interface Question {
  question_id: string;
  content: string;
  options: { text: string; isCorrect: boolean }[];
  rationale: string;
  tags: string[];
  family_id?: string;
  difficulty: number;
  status?: string;
}

export const UnitExam = () => {
  const { unitId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(45 * 60); // 45 minutes
  const [examFinished, setExamFinished] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; percent: number; grade: number } | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const startExam = async () => {
      if (!currentUser || !unitId) return;

      try {
        // 1. Create session doc
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          uid: currentUser.uid,
          unitId,
          mode: 'exam',
          startedAt: serverTimestamp(),
        });
        setSessionId(sessionRef.id);

        // 2. Fetch User Tag Mastery
        const masteryRef = collection(db, 'users', currentUser.uid, 'tag_mastery');
        const mSnapshot = await getDocs(masteryRef);
        const mData: Record<string, TagMastery> = {};
        mSnapshot.docs.forEach(d => { mData[d.id] = d.data() as TagMastery; });

        // 3. Fetch all questions for this unit
        const q = query(collection(db, 'questions'), where('unit_id', '==', unitId));
        const querySnapshot = await getDocs(q);
        const allQuestions = querySnapshot.docs.map(doc => ({
          question_id: doc.id,
          ...doc.data()
        })) as Question[];

        if (allQuestions.length === 0) {
            setLoading(false);
            return;
        }

        // 4. ADAPTIVE SELECTION with UNIQUE FAMILIES
        const approvedQuestions = allQuestions.filter(q => q.status === 'approved' || q.status === undefined);
        const selected = selectAdaptiveQuestions(approvedQuestions, mData, 40, true);
        setQuestions(selected);
        
        // Start Timer
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    finishExam();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

      } catch (error) {
        console.error("Error starting exam:", error);
      } finally {
        setLoading(false);
      }
    };

    startExam();

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [unitId, currentUser]);

  const handleSelectOption = (optionIndex: number) => {
    if (examFinished) return;
    setAnswers({ ...answers, [currentIndex]: optionIndex });
  };

  const finishExam = async () => {
    if (examFinished || !currentUser || !sessionId) return;
    setExamFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    setLoading(true);

    // Calculate Results
    let correctCount = 0;
    questions.forEach((q, idx) => {
        const selected = answers[idx];
        if (selected !== undefined && q.options[selected].isCorrect) {
            correctCount++;
        }
    });

    const total = questions.length;
    const percent = Math.round((correctCount / total) * 100);
    const grade = calculateChileanGrade(percent);

    setResults({ score: correctCount, total, percent, grade });

    try {
        // 1. Save results to mastery
        const masteryRef = doc(db, 'users', currentUser.uid, 'mastery', unitId!);
        
        await setDoc(masteryRef, {
            unitId,
            lastScore: percent,
            lastGrade: grade,
            updatedAt: serverTimestamp(),
        }, { merge: true });

        // 2. ADAPTIVE UPDATE: Update Tag Mastery and Family Mastery for each question
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const selected = answers[i];
            const isCorrect = selected !== undefined && q.options[selected].isCorrect;

            // Update Tags
            if (q.tags) {
                for (const tag of q.tags) {
                    const tagDocRef = doc(db, 'users', currentUser.uid, 'tag_mastery', tag);
                    const currentTM = (await getDoc(tagDocRef)).data() as TagMastery | undefined;
                    const updatedTM = calculateNextMastery(currentTM, isCorrect, q.difficulty || 3);
                    await setDoc(tagDocRef, updatedTM);
                }
            }

            // Update Family
            if (q.family_id) {
                const familyDocRef = doc(db, 'users', currentUser.uid, 'family_mastery', q.family_id);
                const currentFM = (await getDoc(familyDocRef)).data() as TagMastery | undefined;
                const updatedFM = calculateNextMastery(currentFM, isCorrect, q.difficulty || 3);
                await setDoc(familyDocRef, updatedFM);
            }
        }

        // 3. Update Session doc
        await setDoc(doc(db, 'sessions', sessionId), {
            endedAt: serverTimestamp(),
            score: percent,
            grade: grade,
            status: 'completed'
        }, { merge: true });

    } catch (error) {
        console.error("Error saving exam results:", error);
    } finally {
        setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading && !examFinished) return <div className="container"><p>Cargando examen oficial...</p></div>;
  if (questions.length === 0) return (
    <div className="container">
      <p>No hay preguntas disponibles para esta unidad.</p>
      <button onClick={() => navigate('/home')}>Volver al inicio</button>
    </div>
  );

  if (examFinished && results) {
    return (
      <div className="container" style={{ maxWidth: 600 }}>
        <h1>Examen Finalizado</h1>
        <div className="flex-col" style={{ gap: 10, margin: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)' }}>Puntaje: {results.score} de {results.total}</p>
            <p style={{ color: 'var(--text-muted)' }}>Porcentaje: {results.percent}%</p>
            <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: results.grade >= 4.0 ? 'var(--accent)' : '#f87171' }}>
                {results.grade}
            </div>
            <p style={{ fontWeight: 600, color: results.grade >= 4.0 ? 'var(--accent)' : '#f87171' }}>
                {results.grade >= 4.0 ? '¡UNIDAD APROBADA!' : 'UNIDAD REPROBADA'}
            </p>
        </div>
        <button onClick={() => navigate('/units')}>Volver al Listado de Unidades</button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isWarningTime = timeLeft <= 300; // 5 minutes left

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div style={{ 
          position: 'sticky', 
          top: 0, 
          background: 'rgba(10, 10, 15, 0.8)', 
          backdropFilter: 'blur(10px)',
          padding: '16px 0', 
          borderBottom: '1px solid var(--glass-border)', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          marginBottom: 30
      }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pregunta {currentIndex + 1} de {questions.length}</span>
        <div style={{ 
            color: isWarningTime ? '#f87171' : 'white', 
            fontWeight: 'bold',
            fontSize: '1.3rem',
            padding: '4px 12px',
            borderRadius: 8,
            background: isWarningTime ? 'rgba(248, 113, 113, 0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isWarningTime ? 'rgba(248, 113, 113, 0.2)' : 'var(--glass-border)'}`
        }}>
            {formatTime(timeLeft)}
        </div>
        <button onClick={finishExam} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', padding: 0 }}>
          Entregar
        </button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 16, border: '1px solid var(--glass-border)', minHeight: '300px' }}>
        <h3 style={{ textAlign: 'left', background: 'none', WebkitTextFillColor: 'white', lineHeight: '1.4', margin: 0 }}>{currentQuestion.content}</h3>
        
        <div className="flex-col" style={{ gap: 12, marginTop: 24 }}>
          {currentQuestion.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelectOption(i)}
              style={{
                padding: 16,
                textAlign: 'left',
                border: '1px solid',
                borderColor: answers[currentIndex] === i ? 'var(--primary)' : 'var(--glass-border)',
                background: answers[currentIndex] === i ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                color: answers[currentIndex] === i ? 'white' : 'var(--text-muted)',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <button 
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
            style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
        >
            Anterior
        </button>
        {currentIndex < questions.length - 1 ? (
            <button onClick={() => setCurrentIndex(currentIndex + 1)}>
                Siguiente
            </button>
        ) : (
            <button onClick={finishExam} style={{ background: 'var(--accent)' }}>
                Finalizar y Entregar
            </button>
        )}
      </div>
    </div>
  );
};
