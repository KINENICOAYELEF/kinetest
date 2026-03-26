import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Unit {
  unit_id: string;
  title: string;
  description: string;
}

interface Mastery {
  lastGrade?: number;
  lastScore?: number;
  attemptsCount?: number;
  passed?: boolean;
  finalPassed?: boolean;
  finalGrade?: number;
  finalScore?: number;
}

export const UnitSelection = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [masteryData, setMasteryData] = useState<Record<string, Mastery>>({});
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        // 1. Fetch Units
        const q = query(
          collection(db, 'units'), 
          where('isActive', '==', true),
          orderBy('order', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const unitsData = querySnapshot.docs.map(doc => ({
          unit_id: doc.id,
          ...doc.data()
        })) as Unit[];
        setUnits(unitsData);

        // 2. Fetch Mastery for current student
        const masteryRef = collection(db, 'users', currentUser.uid, 'mastery');
        const masterySnapshot = await getDocs(masteryRef);
        const mData: Record<string, Mastery> = {};
        
        // Also check sessions collection for current user to count attempts
        // For simplicity, we'll use a count field in mastery if it exists, 
        // or count 'exam' sessions in the next phase.
        // Let's count 'exam' sessions for this student/unit from sessions collection.
        const sessionsQ = query(
            collection(db, 'sessions'), 
            where('uid', '==', currentUser.uid),
            where('mode', '==', 'exam'),
            where('status', '==', 'completed')
        );
        const sessSnapshot = await getDocs(sessionsQ);
        const counts: Record<string, number> = {};
        sessSnapshot.docs.forEach(d => {
            const uId = d.data().unitId;
            counts[uId] = (counts[uId] || 0) + 1;
        });

        masterySnapshot.docs.forEach(doc => {
          mData[doc.id] = {
              ...doc.data(),
              attemptsCount: counts[doc.id] || 0
          };
        });
        
        // For units with no mastery doc yet but with sessions
        unitsData.forEach(u => {
            if (!mData[u.unit_id]) {
                mData[u.unit_id] = { attemptsCount: counts[u.unit_id] || 0 };
            }
        });

        setMasteryData(mData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  if (loading) return <div className="container"><p>Cargando unidades...</p></div>;

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <h1>Módulos de Aprendizaje</h1>
      <div className="flex-col" style={{ gap: 20 }}>
        {units.map((unit) => {
          const mastery = masteryData[unit.unit_id] || { attemptsCount: 0 };
          const remainingAttempts = 2 - (mastery.attemptsCount || 0);
          const hasPassed = (mastery.lastGrade || 0) >= 4.0;

          return (
            <div 
              key={unit.unit_id} 
              style={{ 
                padding: '24px', 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              <div>
                <h3 style={{ margin: 0, textAlign: 'left', background: 'none', WebkitTextFillColor: 'white' }}>{unit.title}</h3>
                <p style={{ margin: '8px 0', fontSize: '14px' }}>{unit.description}</p>
                {mastery.lastGrade && (
                    <div style={{ 
                        display: 'inline-block', 
                        padding: '6px 12px', 
                        borderRadius: 8, 
                        background: hasPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                        color: hasPassed ? '#34d399' : '#f87171', 
                        fontWeight: 'bold',
                        fontSize: '12px',
                        border: `1px solid ${hasPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                    }}>
                        Última Nota: {mastery.lastGrade} ({mastery.lastScore}%)
                    </div>
                )}
              </div>

              <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                  gap: 10 
              }}>
                <button 
                  onClick={() => navigate(`/tutor/${unit.unit_id}`)}
                  style={{ background: '#7c3aed', fontSize: '13px', padding: '10px' }}
                >
                  Modo Tutor 👨‍🏫
                </button>
                <button 
                  onClick={() => navigate(`/case/${unit.unit_id}`)}
                  style={{ background: '#059669', fontSize: '13px', padding: '10px' }}
                >
                  Casos Clínicos 🏥
                </button>
                <button 
                  onClick={() => navigate(`/practice/${unit.unit_id}`)}
                  style={{ background: '#2563eb', fontSize: '13px', padding: '10px' }}
                >
                  Practicar Libre
                </button>
                
                <div className="flex-col" style={{ gap: 4 }}>
                    <button 
                        disabled={mastery.passed && (remainingAttempts <= 0)} // If passed, they can still access final
                        onClick={() => {
                            if (mastery.passed && !mastery.finalPassed) {
                                navigate(`/final-exam/${unit.unit_id}`);
                            } else {
                                navigate(`/exam/${unit.unit_id}`);
                            }
                        }}
                        style={{ 
                            background: mastery.finalPassed ? 'var(--accent)' : mastery.passed ? '#f59e0b' : (remainingAttempts > 0 ? 'var(--secondary)' : '#334155'), 
                            cursor: (remainingAttempts > 0 || mastery.passed) ? 'pointer' : 'not-allowed',
                            fontSize: '13px',
                            padding: '10px',
                            fontWeight: mastery.passed ? 'bold' : 'normal'
                        }}
                    >
                        {mastery.finalPassed ? '⭐ Unidad Certificada' : mastery.passed ? '🏆 Rendir Examen Final' : 'Rendir Examen Parcial'}
                    </button>
                    {!mastery.passed && (
                      <small style={{ 
                          textAlign: 'center', 
                          fontSize: '11px',
                          color: remainingAttempts <= 0 ? '#f87171' : 'var(--text-muted)' 
                      }}>
                          {remainingAttempts > 0 
                              ? `Intentos: ${remainingAttempts}` 
                              : 'Sin intentos / Necesitas aprobar'}
                      </small>
                    )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button 
        onClick={() => navigate('/home')} 
        className="link-btn"
        style={{ background: 'none', border: 'none', width: 'auto', margin: '30px auto 0' }}
      >
        ← Volver al Inicio
      </button>
    </div>
  );
};
