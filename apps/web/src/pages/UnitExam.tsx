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
        const selected = selectAdaptiveQuestions(allQuestions, mData, 40, true);
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

  if (loading && !examFinished) return <div style={{ padding: 20 }}>Cargando examen...</div>;
  if (questions.length === 0) return <div style={{ padding: 20 }}>No hay preguntas para esta unidad. <button onClick={() => navigate('/home')}>Volver</button></div>;

  if (examFinished && results) {
    return (
      <div style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
        <h1>Examen Finalizado</h1>
        <div style={{ fontSize: '1.5rem', margin: '20px 0' }}>
            <p>Puntaje: {results.score} / {results.total}</p>
            <p>Porcentaje: {results.percent}%</p>
            <h2 style={{ color: results.grade >= 4.0 ? 'green' : 'red', fontSize: '3rem' }}>
                Nota: {results.grade}
            </h2>
        </div>
        <button 
            onClick={() => navigate('/units')}
            style={{ padding: '15px 30px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
            Volver a Unidades
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isWarningTime = timeLeft <= 5 * 60; // 5 minutes left (40m mark)

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ 
          position: 'sticky', 
          top: 0, 
          background: 'white', 
          padding: '10px 0', 
          borderBottom: '1px solid #eee', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
      }}>
        <span>Pregunta {currentIndex + 1} de {questions.length}</span>
        <div style={{ 
            color: isWarningTime ? 'red' : 'black', 
            fontWeight: 'bold',
            fontSize: '1.2rem',
            padding: '5px 10px',
            borderRadius: 4,
            background: isWarningTime ? '#ffebee' : 'transparent'
        }}>
            Tiempo restante: {formatTime(timeLeft)}
        </div>
        <button onClick={finishExam} style={{ background: '#ff9800', color: 'white', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: 4 }}>Entregar Examen</button>
      </div>

      <div style={{ marginTop: 30, minHeight: '300px' }}>
        <h2>{currentQuestion.content}</h2>
        
        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          {currentQuestion.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelectOption(i)}
              style={{
                padding: 15,
                textAlign: 'left',
                border: '2px solid',
                borderColor: answers[currentIndex] === i ? '#2196f3' : '#ddd',
                borderRadius: 8,
                background: answers[currentIndex] === i ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
        <button 
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
            style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
            Anterior
        </button>
        <div>
            {currentIndex < questions.length - 1 ? (
                <button 
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    style={{ padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                    Siguiente
                </button>
            ) : (
                <button 
                    onClick={finishExam}
                    style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                    Finalizar y Entregar
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
