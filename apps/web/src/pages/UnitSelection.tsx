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
        const q = query(collection(db, 'units'), orderBy('order', 'asc'));
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

  if (loading) return <div style={{ padding: 20 }}>Cargando unidades...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h1>M\u00f3dulos de Aprendizaje</h1>
      <div style={{ display: 'grid', gap: 20, marginTop: 20 }}>
        {units.map((unit) => {
          const mastery = masteryData[unit.unit_id] || { attemptsCount: 0 };
          const remainingAttempts = 2 - (mastery.attemptsCount || 0);
          const hasPassed = (mastery.lastGrade || 0) >= 4.0;

          return (
            <div 
              key={unit.unit_id} 
              style={{ 
                padding: 20, 
                border: '1px solid #ddd', 
                borderRadius: 8, 
                background: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 10px 0' }}>{unit.title}</h3>
                <p style={{ margin: '0 0 10px 0', color: '#666' }}>{unit.description}</p>
                {mastery.lastGrade && (
                    <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: hasPassed ? '#e8f5e9' : '#ffebee', color: hasPassed ? 'green' : 'red', fontWeight: 'bold' }}>
                        Nota: {mastery.lastGrade} ({mastery.lastScore}%)
                    </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200, alignItems: 'flex-end' }}>
                <button 
                  onClick={() => navigate(`/tutor/${unit.unit_id}`)}
                  style={{ width: '100%', padding: '10px', background: '#f3e5f5', color: '#7b1fa2', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Modo Tutor \ud83d\udc68\u200d\ud83c\udfeb
                </button>
                <button 
                  onClick={() => navigate(`/case/${unit.unit_id}`)}
                  style={{ width: '100%', padding: '10px', background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Casos Cl\u00ednicos \ud83c\udfe5
                </button>
                <button 
                  onClick={() => navigate(`/practice/${unit.unit_id}`)}
                  style={{ width: '100%', padding: '10px', background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Practicar
                </button>
                
                <div style={{ width: '100%', textAlign: 'center' }}>
                    <button 
                        disabled={remainingAttempts <= 0}
                        onClick={() => navigate(`/exam/${unit.unit_id}`)}
                        style={{ 
                            width: '100%', 
                            padding: '10px', 
                            background: remainingAttempts > 0 ? '#4CAF50' : '#ccc', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: 4, 
                            cursor: remainingAttempts > 0 ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold'
                        }}
                    >
                        Rendir Examen
                    </button>
                    <small style={{ color: remainingAttempts === 0 ? 'red' : '#888' }}>
                        {remainingAttempts > 0 
                            ? `Intentos restantes: ${remainingAttempts}` 
                            : 'Has agotado tus intentos'}
                    </small>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button 
        onClick={() => navigate('/home')} 
        style={{ marginTop: 30, padding: '10px 20px', background: 'none', border: '1px solid #ccc', cursor: 'pointer' }}
      >
        Volver al Inicio
      </button>
    </div>
  );
};
