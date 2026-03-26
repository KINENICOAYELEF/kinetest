import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';

interface Unit {
    unit_id: string;
    title: string;
}

interface StudentStats {
    uid: string;
    email: string;
    role: string;
    assignedUnits: string[];
    complianceScore: number;
    globalGrade: number;
    unitGrades: Record<string, number>;
    fridayResults: { type: string; grade: number }[];
}

export const AdminDashboard = () => {
    const [students, setStudents] = useState<StudentStats[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllStats = async () => {
            try {
                // 0. Fetch all active units
                const uq = query(collection(db, 'units'), where('isActive', '==', true), orderBy('order', 'asc'));
                const unitsSnap = await getDocs(uq);
                const allUnits = unitsSnap.docs.map(d => ({ unit_id: d.id, title: d.data().title })) as Unit[];
                setUnits(allUnits);

                // 1. Fetch all users
                const usersSnap = await getDocs(collection(db, 'users'));
                
                const stats: StudentStats[] = [];

                for (const userDoc of usersSnap.docs) {
                    const userData = userDoc.data();
                    const uid = userDoc.id;
                    const role = userData.role;

                    // Skip admin from the list
                    if (role === 'admin') continue;

                    const assignedUnits = userData.assignedUnits || [];

                    // Fetch unit grades
                    const mSnap = await getDocs(collection(db, 'users', uid, 'mastery'));
                    const unitGrades: Record<string, number> = {};
                    let sumPassedGrades = 0;
                    
                    mSnap.docs.forEach(d => { 
                        const mData = d.data();
                        if (mData.finalPassed) {
                            unitGrades[d.id] = mData.finalGrade || 0;
                        }
                    });

                    // Calculate Global Grade based on assigned units
                    let globalGrade = 0;
                    if (assignedUnits.length > 0) {
                        for (const uId of assignedUnits) {
                            // If unit is certified, add its grade; else add 1.0 (minimum grade)
                            sumPassedGrades += (unitGrades[uId] || 1.0);
                        }
                        globalGrade = Number((sumPassedGrades / assignedUnits.length).toFixed(1));
                    }

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
                        role,
                        assignedUnits,
                        complianceScore: 0, // Simplified for now
                        globalGrade,
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

    const approveUser = async (uid: string) => {
        try {
            await updateDoc(doc(db, 'users', uid), { role: 'student' });
            setStudents(prev => prev.map(s => s.uid === uid ? { ...s, role: 'student' } : s));
        } catch (e) {
            console.error("Error approving:", e);
        }
    };

    const deleteUser = async (uid: string) => {
        if (!window.confirm("¿Seguro que deseas rechazar/eliminar este usuario?")) return;
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'users', uid));
            setStudents(prev => prev.filter(s => s.uid !== uid));
        } catch (e) {
            console.error("Error deleting:", e);
        }
    };

    const toggleUnitAssignment = async (uid: string, unitId: string) => {
        const student = students.find(s => s.uid === uid);
        if (!student) return;

        let newAssigned = [...student.assignedUnits];
        if (newAssigned.includes(unitId)) {
            newAssigned = newAssigned.filter(id => id !== unitId);
        } else {
            newAssigned.push(unitId);
        }

        try {
            await updateDoc(doc(db, 'users', uid), { assignedUnits: newAssigned });
            setStudents(prev => prev.map(s => {
                if (s.uid !== uid) return s;
                
                // Recalculate global grade optimistically
                let sumPassedGrades = 0;
                let globalGrade = 0;
                if (newAssigned.length > 0) {
                    for (const uId of newAssigned) {
                        sumPassedGrades += (s.unitGrades[uId] || 1.0);
                    }
                    globalGrade = Number((sumPassedGrades / newAssigned.length).toFixed(1));
                }
                
                return { ...s, assignedUnits: newAssigned, globalGrade };
            }));
        } catch (e) {
            console.error("Error toggling unit:", e);
            alert("Error al actualizar la asignación de unidades.");
        }
    };

    if (loading) return <div className="container"><p>Cargando datos del curso...</p></div>;

    return (
        <div className="container" style={{ maxWidth: 1200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ marginBottom: 0 }}>Dashboard Administrador 💻</h1>
                <button onClick={() => window.history.back()} style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>Volver</button>
            </div>
            
            <p style={{ marginTop: 10, color: 'var(--text-muted)' }}>Asigna unidades a los alumnos y revisa su Nota Global (calculada estrictamente sobre las unidades asignadas).</p>

            <div style={{ marginTop: 30, background: 'rgba(255,255,255,0.03)', borderRadius: 16, overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
                <table style={{ minWidth: 1000, width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                        <tr style={{ textAlign: 'left' }}>
                            <th style={{ padding: 15 }}>Estudiante</th>
                            <th>Estado</th>
                            <th>Nota Global</th>
                            <th>Unidades Asignadas (Activar/Desactivar)</th>
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
                                    {s.role === 'pending' ? (
                                        <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 'bold' }}>PENDIENTE</span>
                                    ) : (
                                        <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>ACTIVO</span>
                                    )}
                                </td>
                                <td>
                                    {s.role === 'pending' || s.assignedUnits.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>N/A</span> : (
                                        <div style={{ 
                                            display: 'inline-block',
                                            padding: '4px 10px', 
                                            background: s.globalGrade >= 4.0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(248, 113, 113, 0.15)', 
                                            color: s.globalGrade >= 4.0 ? '#10b981' : '#f87171', 
                                            borderRadius: 8, 
                                            fontWeight: 'bold',
                                            border: `1px solid ${s.globalGrade >= 4.0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`
                                        }}>
                                            {s.globalGrade.toFixed(1)}
                                        </div>
                                    )}
                                </td>
                                <td>
                                    {s.role === 'pending' ? <span style={{ color: 'var(--text-muted)' }}>Aprueba al usuario primero</span> : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {units.map((unit) => {
                                                const isAssigned = s.assignedUnits.includes(unit.unit_id);
                                                const certifiedGrade = s.unitGrades[unit.unit_id];
                                                
                                                return (
                                                    <div 
                                                        key={unit.unit_id} 
                                                        onClick={() => toggleUnitAssignment(s.uid, unit.unit_id)}
                                                        style={{ 
                                                            padding: '4px 8px', 
                                                            border: `1px solid ${isAssigned ? 'var(--primary)' : 'var(--glass-border)'}`,
                                                            background: isAssigned ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                                                            color: isAssigned ? 'white' : 'var(--text-muted)',
                                                            borderRadius: 6, 
                                                            fontSize: '0.75rem', 
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            transition: 'all 0.2s',
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        <div style={{ 
                                                            width: 12, height: 12, 
                                                            borderRadius: 2, 
                                                            border: '1px solid',
                                                            borderColor: isAssigned ? 'var(--primary)' : 'var(--glass-border)',
                                                            background: isAssigned ? 'var(--primary)' : 'transparent',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            {isAssigned && <span style={{ color: 'white', fontSize: '8px' }}>✓</span>}
                                                        </div>
                                                        {unit.title}
                                                        {isAssigned && certifiedGrade && (
                                                            <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>({certifiedGrade})</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </td>
                                <td style={{ textAlign: 'center' }}>{s.fridayResults.find(r => r.type === 'A')?.grade || '-'}</td>
                                <td style={{ textAlign: 'center' }}>{s.fridayResults.find(r => r.type === 'B')?.grade || '-'}</td>
                                <td style={{ padding: 10, display: 'flex', gap: 5 }}>
                                    {s.role === 'pending' && (
                                        <button onClick={() => approveUser(s.uid)} style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--accent)' }}>Aprobar</button>
                                    )}
                                    <button onClick={() => deleteUser(s.uid)} style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'transparent', border: '1px solid #f87171', color: '#f87171' }}>✗</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
