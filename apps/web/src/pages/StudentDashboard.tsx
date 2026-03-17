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

    if (loading) return <div style={{ padding: 20 }}>Cargando tus estad\u00edsticas...</div>;

    const complianceScore = calculateCompliancePercentage(compliance);

    return (
        <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
            <h1 style={{ marginBottom: 30 }}>Mi Progreso \ud83d\udcc8</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                
                {/* Compliance Card */}
                <div style={{ background: 'white', padding: 25, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: 0, color: '#666' }}>Cumplimiento Semanal</h3>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: complianceScore > 70 ? '#4caf50' : '#ffa000', margin: '15px 0' }}>
                        {complianceScore}%
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {compliance.map(d => (
                            <div 
                                key={d.date} 
                                title={`${d.date}: ${d.isCompliant ? 'Cumplido' : 'No cumplido'}`}
                                style={{ 
                                    width: 15, 
                                    height: 15, 
                                    borderRadius: 3, 
                                    background: d.isCompliant ? '#4caf50' : '#eee' 
                                }} 
                            />
                        ))}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#999', marginTop: 10 }}>D\u00edas con {'>'}=18 respuestas o {'>'}=12 min en tutor.</p>
                </div>

                {/* Mastery Summary */}
                <div style={{ background: 'white', padding: 25, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: 0, color: '#666' }}>Dominio por Categor\u00edas</h3>
                    <div style={{ marginTop: 20 }}>
                        {Object.entries(mastery).slice(0, 5).map(([tag, data]) => (
                            <div key={tag} style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 4 }}>
                                    <span>{tag}</span>
                                    <span>{Math.round(data.score * 100)}%</span>
                                </div>
                                <div style={{ height: 8, background: '#eee', borderRadius: 4 }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${data.score * 100}%`, 
                                        background: data.score > 0.7 ? '#4caf50' : '#2196f3',
                                        borderRadius: 4 
                                    }} />
                                </div>
                            </div>
                        ))}
                        {Object.keys(mastery).length === 0 && <p>A\u00fan no hay datos de dominio.</p>}
                    </div>
                </div>

            </div>

             {/* Detailed Mastery Table */}
             <div style={{ marginTop: 40, background: 'white', padding: 25, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3>Detalle de Skills</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                            <th style={{ padding: '10px 5px' }}>Etiqueta</th>
                            <th>Dominio</th>
                            <th>Racha</th>
                            <th>Siguiente Repaso</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(mastery).map(([tag, data]) => (
                            <tr key={tag} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <td style={{ padding: '12px 5px' }}><strong>{tag}</strong></td>
                                <td>{Math.round(data.score * 100)}%</td>
                                <td>{data.streak} \ud83d\udd25</td>
                                <td>{data.nextDueAt ? new Date(data.nextDueAt).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
