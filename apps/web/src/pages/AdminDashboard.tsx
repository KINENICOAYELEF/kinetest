import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface StudentStats {
    uid: string;
    email: string;
    complianceScore: number;
    unitGrades: Record<string, number>;
    fridayResults: { type: string; grade: number }[];
}

export const AdminDashboard = () => {
    const [students, setStudents] = useState<StudentStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllStats = async () => {
            try {
                // 1. Fetch all students
                const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
                
                const stats: StudentStats[] = [];

                for (const userDoc of usersSnap.docs) {
                    const userData = userDoc.data();
                    const uid = userDoc.id;

                    // Fetch unit grades
                    const mSnap = await getDocs(collection(db, 'users', uid, 'mastery'));
                    const unitGrades: Record<string, number> = {};
                    mSnap.docs.forEach(d => { unitGrades[d.id] = d.data().lastGrade || 0; });

                    // Fetch friday sessions
                    const fSnap = await getDocs(query(
                        collection(db, 'sessions'), 
                        where('uid', '==', uid), 
                        where('mode', '==', 'friday')
                    ));
                    const fridayResults = fSnap.docs.map(d => ({
                        type: d.data().testType,
                        grade: d.data().grade
                    }));

                    stats.push({
                        uid,
                        email: userData.email,
                        complianceScore: 0, // Simplified for now
                        unitGrades,
                        fridayResults
                    });
                }
                setStudents(stats);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchAllStats();
    }, []);

    if (loading) return <div className="container"><p>Cargando datos del curso...</p></div>;

    return (
        <div className="container" style={{ maxWidth: 1000 }}>
            <h1>Dashboard Administrador 💻</h1>
            
            <div style={{ marginTop: 30, background: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                        <tr style={{ textAlign: 'left' }}>
                            <th style={{ padding: 15 }}>Estudiante</th>
                            <th>Notas Unidad</th>
                            <th>Viernes A</th>
                            <th>Viernes B</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.uid} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: 15 }}>
                                    <strong>{s.email}</strong>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {Object.entries(s.unitGrades).map(([id, g]) => (
                                            <span key={id} style={{ padding: '2px 6px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                                                {id}: {g}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{s.fridayResults.find(r => r.type === 'A')?.grade || '-'}</td>
                                <td style={{ textAlign: 'center' }}>{s.fridayResults.find(r => r.type === 'B')?.grade || '-'}</td>
                                <td style={{ padding: 10 }}>
                                    <button style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>Ver Detalle</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <button onClick={() => window.history.back()} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', margin: '30px auto 0' }}>
               ← Volver
            </button>
        </div>
    );
};
