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

    if (loading) return <div style={{ padding: 20 }}>Cargando datos del curso...</div>;

    return (
        <div style={{ padding: 20 }}>
            <h1>Dashboard Administrador \ud83d\udcbb</h1>
            
            <div style={{ marginTop: 30, background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8f9fa' }}>
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
                            <tr key={s.uid} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: 15 }}>
                                    <strong>{s.email}</strong>
                                </td>
                                <td>
                                    {Object.entries(s.unitGrades).map(([id, g]) => (
                                        <span key={id} style={{ margin: '0 5px', padding: '2px 5px', background: '#e3f2fd', borderRadius: 4, fontSize: '0.8rem' }}>
                                            {id}: {g}
                                        </span>
                                    ))}
                                </td>
                                <td>{s.fridayResults.find(r => r.type === 'A')?.grade || '-'}</td>
                                <td>{s.fridayResults.find(r => r.type === 'B')?.grade || '-'}</td>
                                <td>
                                    <button style={{ fontSize: '0.8rem' }}>Ver Detalle</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
