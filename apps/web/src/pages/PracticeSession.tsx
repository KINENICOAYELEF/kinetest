import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { selectAdaptiveQuestions, updateTagMastery, TagMastery } from '../utils/adaptiveEngine';

interface Question {
  question_id: string;
  content: string;
  options: { text: string; isCorrect: boolean }[];
  rationale: string;
  difficulty: number;
  tags: string[];
  family_id?: string;
}

export const PracticeSession = () => {
  const { unitId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [userMastery, setUserMastery] = useState<Record<string, TagMastery>>({});

  useEffect(() => {
    const startSession = async () => {
      if (!currentUser || !unitId) return;

      try {
        // 1. Create session doc
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          uid: currentUser.uid,
          unitId,
          mode: 'practice',
          startedAt: serverTimestamp(),
        });
        setSessionId(sessionRef.id);

        // 2. Fetch User Tag Mastery
        const masteryRef = collection(db, 'users', currentUser.uid, 'tag_mastery');
        const mSnapshot = await getDocs(masteryRef);
        const mData: Record<string, TagMastery> = {};
        mSnapshot.docs.forEach(d => {
            mData[d.id] = d.data() as TagMastery;
        });
        setUserMastery(mData);

        // 3. Fetch questions for this unit
        const q = query(collection(db, 'questions'), where('unit_id', '==', unitId));
        const querySnapshot = await getDocs(q);
        const allQuestions = querySnapshot.docs.map(doc => ({
          question_id: doc.id,
          ...doc.data()
        })) as Question[];

        // 4. ADAPTIVE SELECTION
        const selected = selectAdaptiveQuestions(allQuestions, mData, 20);
        setQuestions(selected);
        
        setStartTime(Date.now());
      } catch (error) {
        console.error("Error starting session:", error);
      } finally {
        setLoading(false);
      }
    };

    startSession();
  }, [unitId, currentUser]);

  const handleAnswer = async (index: number) => {
    if (showFeedback || !currentUser || !sessionId) return;

    const endTime = Date.now();
    const timeSpentSec = Math.floor((endTime - startTime) / 1000);
    const question = questions[currentIndex];
    const isCorrect = question.options[index].isCorrect;

    setSelectedOption(index);
    setShowFeedback(true);

    try {
      // 1. Save attempt
      await addDoc(collection(db, 'users', currentUser.uid, 'attempts'), {
        questionId: question.question_id,
        sessionId,
        answerIndex: index,
        isCorrect,
        timeSpentSec,
        timestamp: serverTimestamp()
      });

      // 2. ADAPTIVE UPDATE: Update Tag Mastery and Family Mastery
      if (question.tags) {
          for (const tag of question.tags) {
              const currentM = userMastery[tag];
              const updatedM = updateTagMastery(currentM, isCorrect, question.difficulty || 3);
              await setDoc(doc(db, 'users', currentUser.uid, 'tag_mastery', tag), updatedM);
              userMastery[tag] = updatedM;
          }
      }

      if (question.family_id) {
          const familyTag = `family_${question.family_id}`;
          const currentFM = userMastery[familyTag];
          const updatedFM = updateTagMastery(currentFM, isCorrect, question.difficulty || 3);
          await setDoc(doc(db, 'users', currentUser.uid, 'family_mastery', question.family_id), updatedFM);
          userMastery[familyTag] = updatedFM;
      }
    } catch (error) {
      console.error("Error saving attempt/mastery:", error);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setShowFeedback(false);
      setStartTime(Date.now());
    } else {
      finishSession();
    }
  };

  const finishSession = async () => {
    if (sessionId) {
      await setDoc(doc(db, 'sessions', sessionId), { endedAt: serverTimestamp() }, { merge: true });
    }
    navigate('/home');
  };

  if (loading) return <div className="container"><p>Iniciando sesión de práctica...</p></div>;
  if (questions.length === 0) return (
    <div className="container">
      <p>No hay preguntas disponibles para esta unidad.</p>
      <button onClick={() => navigate('/home')}>Volver al inicio</button>
    </div>
  );

  const currentQuestion = questions[currentIndex];

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <span>Práctica • Pregunta {currentIndex + 1} de {questions.length}</span>
        <button onClick={finishSession} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', padding: 0, color: '#f87171' }}>
          Salir
        </button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
        <h3 style={{ textAlign: 'left', background: 'none', WebkitTextFillColor: 'white', lineHeight: '1.4', margin: 0 }}>{currentQuestion.content}</h3>
        
        <div className="flex-col" style={{ gap: 12, marginTop: 24 }}>
          {currentQuestion.options.map((opt, i) => {
            let borderColor = 'var(--glass-border)';
            let bg = 'rgba(255,255,255,0.02)';
            let color = 'var(--text-muted)';

            if (showFeedback) {
              if (opt.isCorrect) { borderColor = 'var(--accent)'; bg = 'rgba(16, 185, 129, 0.1)'; color = 'white'; }
              else if (selectedOption === i) { borderColor = '#f87171'; bg = 'rgba(248, 113, 113, 0.1)'; color = 'white'; }
            } else if (selectedOption === i) {
              borderColor = 'var(--primary)'; bg = 'rgba(99, 102, 241, 0.1)'; color = 'white';
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={showFeedback}
                style={{
                  padding: 16,
                  textAlign: 'left',
                  border: '1px solid',
                  borderColor,
                  borderRadius: 12,
                  background: bg,
                  color,
                  cursor: showFeedback ? 'default' : 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div style={{ marginTop: 32, padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
            <h4 style={{ color: currentQuestion.options[selectedOption!].isCorrect ? 'var(--accent)' : '#f87171', marginTop: 0, fontSize: '1.1rem' }}>
              {currentQuestion.options[selectedOption!].isCorrect ? '¡Excelente! Correcto' : 'Ups, respuesta incorrecta'}
            </h4>
            <p style={{ margin: '12px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}><strong>Explicación:</strong> {currentQuestion.rationale}</p>
            <button onClick={nextQuestion} style={{ marginTop: 10 }}>
              {currentIndex < questions.length - 1 ? 'Siguiente Pregunta' : 'Finalizar Sesión'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
