import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where, getCountFromServer } from 'firebase/firestore';
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
  passed?: boolean;
  finalPassed?: boolean;
  finalGrade?: number;
  finalScore?: number;
  masteredQuestions?: string[];
}

export const UnitSelection = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [masteryData, setMasteryData] = useState<Record<string, Mastery>>({});
  const [unitTotals, setUnitTotals] = useState<Record<string, number>>({});
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

        // 2. Fetch total questions count per unit
        const countsPromises = unitsData.map(async (u) => {
            const cQ = query(collection(db, 'questions'), where('unit_id', '==', u.unit_id), where('status', '==', 'approved'));
            const cSnap = await getCountFromServer(cQ);
            return { id: u.unit_id, count: cSnap.data().count };
        });
        const unitCounts = await Promise.all(countsPromises);
        const totalCountMap = unitCounts.reduce((acc, curr) => {
            acc[curr.id] = curr.count;
            return acc;
        }, {} as Record<string, number>);
        setUnitTotals(totalCountMap);

        // 3. Fetch Mastery for current student
        const masteryRef = collection(db, 'users', currentUser.uid, 'mastery');
        const masterySnapshot = await getDocs(masteryRef);
        const mData: Record<string, Mastery> = {};
        
        masterySnapshot.docs.forEach(doc => {
          mData[doc.id] = doc.data() as Mastery;
        });
        
        // For units with no mastery doc yet
        unitsData.forEach(u => {
            if (!mData[u.unit_id]) {
                mData[u.unit_id] = {};
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
      <p style={{ color: 'var(--text-muted)', marginBottom: 30 }}>
        Completa el 85% de cobertura respondiendo correctamente las preguntas en cualquier modo para habilitar el Examen Final.
      </p>

      <div className="flex-col" style={{ gap: 20 }}>
        {units.map((unit) => {
          const mastery = masteryData[unit.unit_id] || {};
          const totalQuestions = unitTotals[unit.unit_id] || 0;
          const masteredCount = mastery.masteredQuestions?.length || 0;
          
          let coveragePerc = 0;
          if (totalQuestions > 0) {
              coveragePerc = Math.min(100, (masteredCount / totalQuestions) * 100);
          }
          const isCoverageMet = coveragePerc >= 85;

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
                gap: 20
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, textAlign: 'left', background: 'none', WebkitTextFillColor: 'white' }}>{unit.title}</h3>
                    {mastery.finalPassed && (
                        <div style={{ background: 'var(--accent)', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 'bold' }}>
                            ⭐ CERTIFICADA
                        </div>
                    )}
                </div>
                <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-muted)' }}>{unit.description}</p>
                
                {/* Coverage Progress Bar */}
                <div style={{ marginTop: 15 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Cobertura de Unidad (Mínimo 85%)</span>
                        <span style={{ fontWeight: 'bold', color: isCoverageMet ? 'var(--accent)' : 'white' }}>
                            {masteredCount} / {totalQuestions} ({coveragePerc.toFixed(1)}%)
                        </span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ 
                            height: '100%', 
                            width: `${coveragePerc}%`, 
                            background: isCoverageMet ? 'var(--accent)' : 'var(--primary)', 
                            transition: 'width 0.5s ease' 
                        }} />
                    </div>
                </div>
              </div>

              <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
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
                <button 
                  onClick={() => navigate(`/exam/${unit.unit_id}`)}
                  style={{ background: 'var(--secondary)', fontSize: '13px', padding: '10px' }}
                >
                  Examen Parcial
                </button>
              </div>

              {/* Final Exam Section */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 15, marginTop: 5, textAlign: 'center' }}>
                  {mastery.finalPassed ? (
                      <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          🏆 Aprobaste el Examen Final con nota {mastery.finalGrade} ({mastery.finalScore}%)
                      </div>
                  ) : (
                      <button 
                          disabled={!isCoverageMet}
                          onClick={() => navigate(`/final-exam/${unit.unit_id}`)}
                          style={{ 
                              background: isCoverageMet ? '#f59e0b' : 'rgba(255,255,255,0.05)', 
                              cursor: isCoverageMet ? 'pointer' : 'not-allowed',
                              color: isCoverageMet ? 'white' : 'var(--text-muted)',
                              border: isCoverageMet ? 'none' : '1px dashed var(--glass-border)',
                              fontSize: '14px',
                              padding: '12px',
                              width: '100%',
                              fontWeight: isCoverageMet ? 'bold' : 'normal'
                          }}
                      >
                          {isCoverageMet ? '🚀 Rendir Examen Final (Desbloqueado)' : '🔒 Examen Final (Requiere 85% de cobertura)'}
                      </button>
                  )}
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
