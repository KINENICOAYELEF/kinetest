import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { calculateChileanGrade } from '../utils/gradeCalculator';
import { selectAdaptiveQuestions, calculateNextMastery, TagMastery } from '../utils/adaptiveEngine';
import { shuffleArray } from '../utils/shuffle';

interface Question {
  question_id: string;
  content: string;
  options: { text: string; isCorrect: boolean }[];
  rationale: string;
  learning_pearl?: string;
  tags: string[];
  family_id?: string;
  difficulty: number;
  status?: string;
}

const SECONDS_PER_QUESTION = 90;
const EXAM_QUESTIONS = 40;
const PASS_THRESHOLD = 85;

export const UnitExam = () => {
  const { unitId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [examFinished, setExamFinished] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; percent: number; grade: number } | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<any[][]>([]);
  
  // Immediate feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishExamRef = useRef<() => void>(() => {});

  const startQuestionTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setQuestionTimeLeft(SECONDS_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setQuestionTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto-advance when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Handle time expiry — auto advance
  useEffect(() => {
    if (questionTimeLeft === 0 && !examFinished && !showFeedback) {
      // Time expired without answering — advance
      handleAutoAdvance();
    }
  }, [questionTimeLeft, examFinished, showFeedback]);

  const handleAutoAdvance = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowFeedback(false);
      startQuestionTimer();
    } else {
      finishExamRef.current();
    }
  };

  useEffect(() => {
    const startExam = async () => {
      if (!currentUser || !unitId) return;

      try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          uid: currentUser.uid,
          unitId,
          mode: 'exam',
          startedAt: serverTimestamp(),
        });
        setSessionId(sessionRef.id);

        // Fetch User Tag Mastery
        const masteryRef = collection(db, 'users', currentUser.uid, 'tag_mastery');
        const mSnapshot = await getDocs(masteryRef);
        const mData: Record<string, TagMastery> = {};
        mSnapshot.docs.forEach(d => { mData[d.id] = d.data() as TagMastery; });

        // Fetch all approved questions for this unit
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

        // Only approved questions
        const approvedQuestions = allQuestions.filter(q => q.status === 'approved' || q.status === undefined);
        const selected = selectAdaptiveQuestions(approvedQuestions, mData, EXAM_QUESTIONS);
        setQuestions(selected);
        
        // Prepare shuffled options
        const shuffled = selected.map(q => shuffleArray(q.options));
        setShuffledOptions(shuffled);
        
        // Start per-question timer
        startQuestionTimer();

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
    if (examFinished || showFeedback) return;
    if (timerRef.current) clearInterval(timerRef.current);
    
    setSelectedOption(optionIndex);
    setAnswers({ ...answers, [currentIndex]: optionIndex });
    setShowFeedback(true);
    
    // Auto-advance after 2.5 seconds of showing feedback
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setShowFeedback(false);
        startQuestionTimer();
      } else {
        finishExamRef.current();
      }
    }, 2500);
  };

  const finishExam = useCallback(async () => {
    if (examFinished || !currentUser || !sessionId) return;
    setExamFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    setLoading(true);

    // Calculate Results
    let correctCount = 0;
    questions.forEach((_, idx) => {
        const selectedIndex = answers[idx];
        if (selectedIndex !== undefined) {
            const selectedOpt = shuffledOptions[idx][selectedIndex];
            if (selectedOpt.isCorrect) correctCount++;
        }
    });

    const total = questions.length;
    const percent = Math.round((correctCount / total) * 100);
    const grade = calculateChileanGrade(percent);
    const passed = percent >= PASS_THRESHOLD;

    setResults({ score: correctCount, total, percent, grade });

    try {
        // Save results to mastery
        const masteryRef = doc(db, 'users', currentUser.uid, 'mastery', unitId!);
        
        await setDoc(masteryRef, {
            unitId,
            lastScore: percent,
            lastGrade: grade,
            passed,
            updatedAt: serverTimestamp(),
        }, { merge: true });

        // ADAPTIVE UPDATE: Update Tag Mastery and Family Mastery
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const selected = answers[i];
            const isCorrect = selected !== undefined && shuffledOptions[i][selected]?.isCorrect;

            if (q.tags) {
                for (const tag of q.tags) {
                    const tagDocRef = doc(db, 'users', currentUser.uid, 'tag_mastery', tag);
                    const currentTM = (await getDoc(tagDocRef)).data() as TagMastery | undefined;
                    const updatedTM = calculateNextMastery(currentTM, isCorrect, q.difficulty || 3);
                    await setDoc(tagDocRef, updatedTM);
                }
            }

            if (q.family_id) {
                const familyDocRef = doc(db, 'users', currentUser.uid, 'family_mastery', q.family_id);
                const currentFM = (await getDoc(familyDocRef)).data() as TagMastery | undefined;
                const updatedFM = calculateNextMastery(currentFM, isCorrect, q.difficulty || 3);
                await setDoc(familyDocRef, updatedFM);
            }
        }

        // Update Session
        await setDoc(doc(db, 'sessions', sessionId), {
            endedAt: serverTimestamp(),
            score: percent,
            grade: grade,
            passed,
            status: 'completed'
        }, { merge: true });

    } catch (error) {
        console.error("Error saving exam results:", error);
    } finally {
        setLoading(false);
    }
  }, [examFinished, currentUser, sessionId, questions, answers, shuffledOptions, unitId]);

  // Keep ref in sync
  useEffect(() => {
    finishExamRef.current = finishExam;
  }, [finishExam]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading && !examFinished) return <div className="container"><p>Cargando examen oficial...</p></div>;
  if (questions.length === 0) return (
    <div className="container">
      <p>No hay preguntas aprobadas disponibles para esta unidad.</p>
      <button onClick={() => navigate('/home')}>Volver al inicio</button>
    </div>
  );

  // === RESULTS SCREEN ===
  if (examFinished && results) {
    const passed = results.percent >= PASS_THRESHOLD;
    return (
      <div className="container" style={{ maxWidth: 600 }}>
        <h1>Examen Finalizado</h1>
        <div className="flex-col" style={{ gap: 10, margin: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)' }}>Puntaje: {results.score} de {results.total}</p>
            <p style={{ color: 'var(--text-muted)' }}>Porcentaje: {results.percent}%</p>
            <p style={{ color: 'var(--text-muted)' }}>Umbral requerido: {PASS_THRESHOLD}%</p>
            <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: passed ? 'var(--accent)' : '#f87171' }}>
                {results.grade}
            </div>
            <p style={{ fontWeight: 600, fontSize: '1.2rem', color: passed ? 'var(--accent)' : '#f87171' }}>
                {passed ? '¡EXAMEN APROBADO! 🎉' : 'NO ALCANZASTE EL UMBRAL'}
            </p>
            {!passed && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 10 }}>
                    Necesitas {PASS_THRESHOLD}% para aprobar. Sigue practicando en el Modo Tutor y vuelve a intentarlo. 
                    Las preguntas serán diferentes en cada intento.
                </p>
            )}
        </div>
        <div className="flex-col" style={{ gap: 12 }}>
          <button onClick={() => navigate('/units')} style={{ background: 'var(--accent)' }}>Volver al Listado de Unidades</button>
          {!passed && (
            <button onClick={() => window.location.reload()} style={{ background: 'var(--primary)' }}>
              Reintentar con Preguntas Nuevas
            </button>
          )}
        </div>
      </div>
    );
  }

  // === EXAM QUESTION SCREEN ===
  const currentQuestion = questions[currentIndex];
  const isTimeCritical = questionTimeLeft <= 15;
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      {/* STICKY HEADER */}
      <div style={{ 
          position: 'sticky', 
          top: 0, 
          background: 'rgba(10, 10, 15, 0.95)', 
          backdropFilter: 'blur(10px)',
          padding: '16px 0', 
          borderBottom: '1px solid var(--glass-border)', 
          zIndex: 100,
          marginBottom: 30
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Pregunta {currentIndex + 1} de {questions.length}
          </span>
          
          {/* Per-question timer */}
          <div style={{ 
              color: isTimeCritical ? '#f87171' : 'white', 
              fontWeight: 'bold',
              fontSize: '1.5rem',
              padding: '6px 16px',
              borderRadius: 10,
              background: isTimeCritical ? 'rgba(248, 113, 113, 0.15)' : 'rgba(255,255,255,0.05)',
              border: `2px solid ${isTimeCritical ? '#f87171' : 'var(--glass-border)'}`,
              animation: isTimeCritical ? 'pulse 1s infinite' : 'none',
              minWidth: 70,
              textAlign: 'center' as const
          }}>
              {formatTime(questionTimeLeft)}
          </div>
          
          <button onClick={() => finishExamRef.current()} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', padding: 0, color: '#f87171' }}>
            Entregar
          </button>
        </div>
        
        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${progressPercent}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* QUESTION CARD */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 16, border: '1px solid var(--glass-border)', minHeight: '300px' }}>
        <h3 style={{ textAlign: 'left', background: 'none', WebkitTextFillColor: 'white', lineHeight: '1.4', margin: 0 }}>{currentQuestion.content}</h3>
        
        <div className="flex-col" style={{ gap: 12, marginTop: 24 }}>
          {shuffledOptions[currentIndex]?.map((opt: any) => {
            const isCorrect = opt.isCorrect;
            const isSelected = selectedOption !== null && shuffledOptions[currentIndex][selectedOption] === opt;
            let borderColor = 'var(--glass-border)';
            let bg = 'rgba(255,255,255,0.02)';
            let textColor = 'var(--text-muted)';

            if (showFeedback) {
              if (isCorrect) { borderColor = 'var(--accent)'; bg = 'rgba(16, 185, 129, 0.15)'; textColor = 'white'; }
              else if (isSelected) { borderColor = '#f87171'; bg = 'rgba(248, 113, 113, 0.15)'; textColor = 'white'; }
            } else if (isSelected) {
              borderColor = 'var(--primary)'; bg = 'rgba(99, 102, 241, 0.1)'; textColor = 'white';
            }

            return (
              <button
                key={opt.text}
                onClick={() => handleSelectOption(shuffledOptions[currentIndex].indexOf(opt))}
                disabled={showFeedback}
                style={{
                  padding: 16,
                  textAlign: 'left' as const,
                  border: `2px solid ${borderColor}`,
                  background: bg,
                  color: textColor,
                  borderRadius: 12,
                  cursor: showFeedback ? 'default' : 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s',
                  opacity: showFeedback && !isCorrect && !isSelected ? 0.5 : 1
                }}
              >
                {showFeedback && isCorrect && '✅ '}
                {showFeedback && isSelected && !isCorrect && '❌ '}
                {opt.text}
              </button>
            );
          })}
        </div>

        {/* IMMEDIATE FEEDBACK */}
        {showFeedback && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)' }}>
            <p style={{ color: selectedOption !== null && shuffledOptions[currentIndex][selectedOption]?.isCorrect ? 'var(--accent)' : '#f87171', fontWeight: 'bold', margin: '0 0 8px 0' }}>
              {selectedOption !== null && shuffledOptions[currentIndex][selectedOption]?.isCorrect ? '¡Correcto!' : 'Incorrecto'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              {currentQuestion.rationale?.slice(0, 200)}...
            </p>
            {currentQuestion.learning_pearl && (
              <p style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 'bold', marginTop: 8 }}>
                💡 {currentQuestion.learning_pearl}
              </p>
            )}
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: 8 }}>Avanzando automáticamente...</p>
          </div>
        )}
      </div>
    </div>
  );
};
