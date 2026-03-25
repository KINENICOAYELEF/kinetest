import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface Unit {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  order: number;
}

export const AdminUnits = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const q = query(collection(db, 'units'), orderBy('order', 'asc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as Unit[];
        setUnits(data);
      } catch (e) {
        console.error("Error fetching units:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchUnits();
  }, []);

  const toggleVisibility = async (unitId: string, currentStatus: boolean) => {
    try {
      const unitRef = doc(db, 'units', unitId);
      await updateDoc(unitRef, { isActive: !currentStatus });
      setUnits(prev => prev.map(u => u.id === unitId ? { ...u, isActive: !currentStatus } : u));
    } catch (e) {
      console.error("Error toggling visibility:", e);
      alert("Error al actualizar la visibilidad");
    }
  };

  if (loading) return <div className="container"><p>Cargando unidades...</p></div>;

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <h1>Gestión de Unidades 🗂️</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 30 }}>
        Activa o desactiva las unidades para controlar qué ven los estudiantes.
      </p>

      <div className="flex-col" style={{ gap: 16 }}>
        {units.map(unit => (
          <div 
            key={unit.id}
            style={{ 
              padding: 20, 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: 16, 
              border: '1px solid var(--glass-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{unit.title}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {unit.id}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                color: unit.isActive ? '#10b981' : '#f87171',
                background: unit.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                padding: '4px 8px',
                borderRadius: 6
              }}>
                {unit.isActive ? 'PUBLICADO' : 'OCULTO'}
              </span>
              
              <button 
                onClick={() => toggleVisibility(unit.id, unit.isActive)}
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '0.8rem', 
                  background: unit.isActive ? '#f87171' : '#10b981',
                  minWidth: 100
                }}
              >
                {unit.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/admin')} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', margin: '30px auto 0' }}>
        ← Volver al Panel
      </button>
    </div>
  );
};
