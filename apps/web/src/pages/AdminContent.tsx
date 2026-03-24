import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface Question {
    question_id: string;
    content: string;
    options: { text: string; isCorrect: boolean }[];
    rationale: string;
    difficulty: number;
    tags: string[];
    family_id?: string;
    status?: string;
    unit_id?: string;
}

export const AdminContent = () => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'approved' | 'rejected'>('draft');
    const navigate = useNavigate();

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'questions'));
            const data = snap.docs.map(d => ({
                question_id: d.id,
                ...d.data(),
                status: d.data().status || 'approved' // Fallback for old ones
            } as Question));
            setQuestions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'questions', id), { status: newStatus });
            setQuestions(prev => prev.map(q => q.question_id === id ? { ...q, status: newStatus } : q));
        } catch (e) {
            console.error("Error updating status:", e);
            alert("Error al actualizar el estado de la pregunta.");
        }
    };

    const filtered = questions.filter(q => filterStatus === 'all' || q.status === filterStatus);
    
    // Stats
    const countDrafts = questions.filter(q => q.status === 'draft').length;
    const countApproved = questions.filter(q => q.status === 'approved').length;
    
    if (loading) return <div className="container"><p>Cargando banco de preguntas...</p></div>;

    return (
        <div className="container" style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ marginBottom: 0 }}>Gestión de Contenido</h1>
                <button onClick={() => navigate('/admin')} style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>Volver</button>
            </div>
            
            <p style={{ marginTop: 10 }}>Modera y aprueba las preguntas generadas por NotebookLM.</p>

            <div style={{ display: 'flex', gap: 10, margin: '30px 0', overflowX: 'auto', paddingBottom: 10 }}>
                <button 
                    onClick={() => setFilterStatus('draft')}
                    style={{ background: filterStatus === 'draft' ? '#f59e0b' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                >
                    Pendientes ({countDrafts})
                </button>
                <button 
                    onClick={() => setFilterStatus('approved')}
                    style={{ background: filterStatus === 'approved' ? 'var(--accent)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                >
                    Aprobadas ({countApproved})
                </button>
                <button 
                    onClick={() => setFilterStatus('rejected')}
                    style={{ background: filterStatus === 'rejected' ? '#f87171' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                >
                    Rechazadas
                </button>
                <button 
                    onClick={() => setFilterStatus('all')}
                    style={{ background: filterStatus === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                >
                    Todas ({questions.length})
                </button>
            </div>

            <div className="flex-col" style={{ gap: 20 }}>
                {filtered.map(q => (
                    <div key={q.question_id} style={{ background: 'rgba(255,255,255,0.02)', padding: 25, borderRadius: 16, border: `1px solid ${q.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : q.status === 'rejected' ? 'rgba(248, 113, 113, 0.3)' : '#f59e0b'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span>Unidad: {q.unit_id || 'Global'}</span>
                            <span style={{ 
                                padding: '2px 8px', borderRadius: 12, fontWeight: 'bold',
                                background: q.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : q.status === 'rejected' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: q.status === 'approved' ? '#10b981' : q.status === 'rejected' ? '#f87171' : '#f59e0b'
                            }}>
                                {q.status?.toUpperCase()}
                            </span>
                        </div>
                        
                        <p style={{ color: 'white', fontWeight: 500, fontSize: '1.1rem' }}>{q.content}</p>
                        
                        <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(250px, 1fr)', gap: 10 }}>
                            {q.options.map((opt, i) => (
                                <div key={i} style={{ 
                                    padding: 12, borderRadius: 8, fontSize: '0.9rem',
                                    border: `1px solid ${opt.isCorrect ? 'var(--accent)' : 'var(--glass-border)'}`,
                                    background: opt.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)' 
                                }}>
                                    {opt.isCorrect && '✅ '} {opt.text}
                                </div>
                            ))}
                        </div>
                        
                        <div style={{ marginTop: 15, fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                            <strong>Racional:</strong> {q.rationale || 'Sin justificación provista.'}
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            {q.status !== 'approved' && (
                                <button onClick={() => updateStatus(q.question_id, 'approved')} style={{ background: 'var(--accent)', padding: '10px' }}>
                                    ✓ Aprobar
                                </button>
                            )}
                            {q.status !== 'draft' && (
                                <button onClick={() => updateStatus(q.question_id, 'draft')} style={{ background: '#f59e0b', padding: '10px' }}>
                                    ✎ Poner en Revisión (Draft)
                                </button>
                            )}
                            {q.status !== 'rejected' && (
                                <button onClick={() => updateStatus(q.question_id, 'rejected')} style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', padding: '10px' }}>
                                    ✗ Rechazar
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No hay preguntas en esta categoría.
                    </div>
                )}
            </div>
        </div>
    );
};
