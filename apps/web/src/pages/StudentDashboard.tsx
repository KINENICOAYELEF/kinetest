import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { getComplianceData, DailyCompliance, calculateCompliancePercentage } from '../utils/complianceTracker';
import { TagMastery } from '../utils/adaptiveEngine';

export const StudentDashboard = () => {
    const { currentUser } = useAuth();
    const [compliance, setCompliance] = useState<DailyCompliance[]>([]);
    const [mastery, setMastery] = useState<Record<string, TagMastery>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!currentUser) return;
            
            // 1. Compliance (Last 7 days)
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 6);
            const compData = await getComplianceData(currentUser.uid, start, end);
            setCompliance(compData);

            // 2. Mastery
            const mRef = collection(db, 'users', currentUser.uid, 'tag_mastery');
            const mSnap = await getDocs(mRef);
            const mData: Record<string, TagMastery> = {};
            mSnap.docs.forEach(d => { mData[d.id] = d.data() as TagMastery; });
            setMastery(mData);

            setLoading(false);
        };
        fetchStats();
    }, [currentUser]);

    if (loading) return <div className="container"><p>Cargando tus estadísticas...</p></div>;

    const complianceScore = calculateCompliancePercentage(compliance);

    return (
        <div className="container" style={{ maxWidth: 900 }}>
            <h1>Mi Progreso 📈</h1>

            <div className="flex-col" style={{ gap: 20 }}>
                
                {/* Compliance Card */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 25, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ margin: 0, textAlign: 'left', background: 'none', WebkitTextFillColor: 'var(--text-muted)', fontSize: '1rem' }}>Cumplimiento Semanal</h3>
                    <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: complianceScore > 70 ? 'var(--accent)' : '#ffa000', margin: '10px 0' }}>
                        {complianceScore}%
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {compliance.map(d => (
                            <div 
                                key={d.date} 
                                title={`${d.date}: ${d.isCompliant ? 'Cumplido' : 'No cumplido'}`}
                                style={{ 
                                    width: 12, 
                                    height: 12, 
                                    borderRadius: 3, 
                                    background: d.isCompliant ? 'var(--accent)' : 'rgba(255,255,255,0.1)' 
                                }} 
                            />
                        ))}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>Días con ≥18 respuestas o ≥12 min en tutor.</p>
                </div>

                {/* Mastery Card */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 25, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ margin: 0, textAlign: 'left', background: 'none', WebkitTextFillColor: 'var(--text-muted)', fontSize: '1rem' }}>Dominio por Categorías</h3>
                    <div style={{ marginTop: 20 }} className="flex-col">
                        {Object.entries(mastery).slice(0, 5).map(([tag, data]) => (
                            <div key={tag} style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                                    <span>{tag}</span>
                                    <span style={{ color: 'var(--primary)' }}>{Math.round(data.score * 100)}%</span>
                                </div>
                                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${data.score * 100}%`, 
                                        background: data.score > 0.7 ? 'var(--accent)' : 'var(--primary)',
                                        borderRadius: 10,
                                        boxShadow: `0 0 10px ${data.score > 0.7 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`
                                    }} />
                                </div>
                            </div>
                        ))}
                        {Object.keys(mastery).length === 0 && <p style={{ fontSize: '0.9rem' }}>Aún no hay datos de dominio.</p>}
                    </div>
                </div>

            </div>

             {/* Detailed Mastery Table */}
             <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)', padding: 25, borderRadius: 16, border: '1px solid var(--glass-border)', overflowX: 'auto' }}>
                <h3 style={{ margin: 0, textAlign: 'left', background: 'none', WebkitTextFillColor: 'white', fontSize: '1.2rem', marginBottom: 15 }}>Detalle de Skills</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '10px 5px' }}>Etiqueta</th>
                            <th>Dominio</th>
                            <th>Racha</th>
                            <th>Repaso</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(mastery).map(([tag, data]) => (
                            <tr key={tag} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px 5px' }}><strong>{tag}</strong></td>
                                <td style={{ color: 'var(--primary)' }}>{Math.round(data.score * 100)}%</td>
                                <td>{data.streak} 🔥</td>
                                <td style={{ fontSize: '0.8rem' }}>{data.nextDueAt ? new Date(data.nextDueAt).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <button onClick={() => window.history.back()} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', margin: '20px auto 0' }}>
               ← Volver
            </button>
        </div>
    );
};
