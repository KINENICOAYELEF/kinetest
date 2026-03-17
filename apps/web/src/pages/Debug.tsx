import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export const Debug = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const [counts, setCounts] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const collections = ['units', 'questions', 'cases', 'config'];
                const newCounts: { [key: string]: number } = {};
                
                for (const col of collections) {
                    const snapshot = await getDocs(collection(db, col));
                    newCounts[col] = snapshot.size;
                }
                
                setCounts(newCounts);
            } catch (error) {
                console.error('Error fetching debug counts:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userProfile?.role === 'admin') {
            fetchCounts();
        }
    }, [userProfile]);

    if (userProfile?.role !== 'admin') {
        return (
            <div className="container" style={{ textAlign: 'center', padding: 50 }}>
                <h1>Acceso Denegado</h1>
                <p>Esta página es exclusiva para administradores.</p>
                <button onClick={() => navigate('/home')} className="primary-btn">Volver al Inicio</button>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: 800 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 40, borderRadius: 24, border: '1px solid var(--glass-border)' }}>
                <h1 style={{ marginBottom: 30 }}>🛠️ Panel de Diagnóstico (Debug)</h1>
                
                <section style={{ marginBottom: 40 }}>
                    <h3>👤 Estado de Usuario</h3>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 20, borderRadius: 12, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        <p><strong>UID:</strong> {currentUser?.uid}</p>
                        <p><strong>Email:</strong> {currentUser?.email}</p>
                        <p><strong>Rol en Firestore:</strong> <span style={{ color: userProfile?.role === 'admin' ? '#4ade80' : '#f87171' }}>{userProfile?.role}</span></p>
                        <p><strong>Group ID:</strong> {userProfile?.groupId || 'N/A'}</p>
                    </div>
                </section>

                <section style={{ marginBottom: 40 }}>
                    <h3>📊 Conteos de Firestore (Real-time)</h3>
                    {loading ? (
                        <p>Cargando conteos...</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20 }}>
                            {Object.entries(counts).map(([name, count]) => (
                                <div key={name} style={{ 
                                    background: 'rgba(255,255,255,0.05)', 
                                    padding: 20, 
                                    borderRadius: 16, 
                                    textAlign: 'center', 
                                    border: count > 0 ? '1px solid #4ade80' : '1px solid #f87171',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <h4 style={{ margin: 0, textTransform: 'capitalize', color: 'var(--text-muted)' }}>{name}</h4>
                                    <div style={{ 
                                        fontSize: '2.5rem', 
                                        fontWeight: 'bold', 
                                        marginTop: 10,
                                        color: count > 0 ? '#fff' : '#f87171'
                                    }}>{count}</div>
                                    <p style={{ margin: '5px 0 0', fontSize: '0.8rem', opacity: 0.6 }}>
                                        {count > 0 ? '✅ Datos Cargados' : '❌ Vacío'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <div style={{ display: 'flex', gap: 15 }}>
                    <button onClick={() => window.location.reload()} className="primary-btn" style={{ flex: 1 }}>Actualizar Datos</button>
                    <button onClick={() => navigate('/admin')} className="secondary-btn" style={{ flex: 1 }}>Volver al Panel Admin</button>
                </div>
            </div>
        </div>
    );
};
