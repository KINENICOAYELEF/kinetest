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

  if (loading) return <div style={{ padding: 20 }}>Iniciando sesi\u00f3n...</div>;
  if (questions.length === 0) return <div style={{ padding: 20 }}>No hay preguntas disponibles en esta unidad. <button onClick={() => navigate('/home')}>Volver</button></div>;

  const currentQuestion = questions[currentIndex];

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
        <span>Pregunta {currentIndex + 1} de {questions.length}</span>
        <button onClick={finishSession} style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Salir</button>
      </div>

      <div style={{ marginBottom: 30 }}>
        <h2>{currentQuestion.content}</h2>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {currentQuestion.options.map((opt, i) => {
          let bgColor = 'white';
          if (showFeedback) {
            if (opt.isCorrect) bgColor = '#e8f5e9';
            else if (selectedOption === i) bgColor = '#ffebee';
          }

          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={showFeedback}
              style={{
                padding: 15,
                textAlign: 'left',
                border: '1px solid #ddd',
                borderRadius: 8,
                background: bgColor,
                cursor: showFeedback ? 'default' : 'pointer',
                fontSize: '1rem'
              }}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {showFeedback && (
        <div style={{ marginTop: 20, padding: 15, background: '#f0f4f8', borderRadius: 8 }}>
          <h4 style={{ color: currentQuestion.options[selectedOption!].isCorrect ? 'green' : 'red', marginTop: 0 }}>
            {currentQuestion.options[selectedOption!].isCorrect ? '¡Correcto!' : 'Incorrecto'}
          </h4>
          <p><strong>Explicaci\u00f3n:</strong> {currentQuestion.rationale}</p>
          <button onClick={nextQuestion} style={{ marginTop: 10, padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            {currentIndex < questions.length - 1 ? 'Siguiente' : 'Finalizar'}
          </button>
        </div>
      )}
    </div>
  );
};
