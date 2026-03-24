import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface Question {
    question_id: string;
    content: string;
    options: { text: string; isCorrect: boolean }[];
    rationale: string;
    learning_pearl?: string;
    hints?: string[];
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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Question | null>(null);
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
                status: d.data().status || 'approved'
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
            alert("Error al actualizar el estado.");
        }
    };

    const startEditing = (q: Question) => {
        setEditingId(q.question_id);
        setEditForm({ ...q, hints: q.hints || ['', '', ''] });
    };

    const saveEdit = async () => {
        if (!editForm || !editingId) return;
        try {
            const { question_id, ...dataToSave } = editForm;
            await updateDoc(doc(db, 'questions', editingId), dataToSave as any);
            setQuestions(prev => prev.map(q => q.question_id === editingId ? editForm : q));
            setEditingId(null);
            setEditForm(null);
        } catch (e) {
            console.error("Error saving:", e);
            alert("Error al guardar cambios.");
        }
    };

    const filtered = questions.filter(q => filterStatus === 'all' || q.status === filterStatus);
    const countDrafts = questions.filter(q => q.status === 'draft').length;
    const countApproved = questions.filter(q => q.status === 'approved').length;
    
    if (loading) return <div className="container"><p>Cargando banco de preguntas...</p></div>;

    return (
        <div className="container" style={{ maxWidth: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ marginBottom: 0 }}>Gestión de Contenido</h1>
                <button onClick={() => navigate('/admin')} style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>Volver</button>
            </div>
            
            <p style={{ marginTop: 10 }}>Revisa, edita y aprueba el contenido pedagógico.</p>

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
                        
                        {editingId === q.question_id && editForm ? (
                            <div className="flex-col" style={{ gap: 15 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Contenido de la Pregunta</label>
                                <textarea 
                                    value={editForm.content} 
                                    onChange={e => setEditForm({...editForm, content: e.target.value})}
                                    style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--glass-border)', padding: 15, borderRadius: 8, minHeight: 100 }}
                                />
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                                    {editForm.options.map((opt, i) => (
                                        <div key={i} className="flex-col" style={{ gap: 5 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <label style={{ fontSize: '0.75rem' }}>Opción {i + 1} {opt.isCorrect ? '(CORRECTA)' : ''}</label>
                                                <input 
                                                    type="checkbox" 
                                                    checked={opt.isCorrect} 
                                                    onChange={e => {
                                                        const newOpts = [...editForm.options];
                                                        newOpts.forEach((o, idx) => o.isCorrect = (idx === i ? e.target.checked : false));
                                                        setEditForm({...editForm, options: newOpts});
                                                    }}
                                                />
                                            </div>
                                            <input 
                                                value={opt.text} 
                                                onChange={e => {
                                                    const newOpts = [...editForm.options];
                                                    newOpts[i].text = e.target.value;
                                                    setEditForm({...editForm, options: newOpts});
                                                }}
                                                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', padding: 10, borderRadius: 8 }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <label style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Pistas (Progresivas)</label>
                                {editForm.hints?.map((h, i) => (
                                    <input 
                                        key={i}
                                        placeholder={`Pista ${i+1}`}
                                        value={h}
                                        onChange={e => {
                                            const newHints = [...(editForm.hints || [])];
                                            newHints[i] = e.target.value;
                                            setEditForm({...editForm, hints: newHints});
                                        }}
                                        style={{ background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--glass-border)', padding: 10, borderRadius: 8 }}
                                    />
                                ))}

                                <label style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Racional (Explicación)</label>
                                <textarea 
                                    value={editForm.rationale} 
                                    onChange={e => setEditForm({...editForm, rationale: e.target.value})}
                                    style={{ background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--glass-border)', padding: 12, borderRadius: 8, minHeight: 80 }}
                                />

                                <label style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Perla Clínica</label>
                                <input 
                                    value={editForm.learning_pearl || ''} 
                                    onChange={e => setEditForm({...editForm, learning_pearl: e.target.value})}
                                    style={{ background: 'rgba(16, 185, 129, 0.05)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: 10, borderRadius: 8 }}
                                />

                                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                    <button onClick={saveEdit} style={{ background: 'var(--accent)', flex: 1 }}>Guardar Cambios</button>
                                    <button onClick={() => setEditingId(null)} style={{ background: 'rgba(255,255,255,0.05)', flex: 1 }}>Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <>
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

                                {q.hints && q.hints.length > 0 && (
                                    <div style={{ marginTop: 15, fontSize: '0.8rem', color: '#f59e0b' }}>
                                        <strong>Pistas:</strong>
                                        <ul style={{ margin: '5px 0', paddingLeft: 20 }}>
                                            {q.hints.map((h, idx) => <li key={idx}>{h}</li>)}
                                        </ul>
                                    </div>
                                )}
                                
                                <div style={{ marginTop: 15, fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                                    <strong>Racional:</strong> {q.rationale || 'Sin justificación provista.'}
                                    {q.learning_pearl && (
                                        <div style={{ marginTop: 8, color: 'var(--accent)', fontWeight: 'bold' }}>
                                            💡 Perla: {q.learning_pearl}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                                    <button onClick={() => startEditing(q)} style={{ background: 'rgba(255,255,255,0.1)', flex: 1 }}>
                                        ✎ Editar
                                    </button>
                                    {q.status !== 'approved' && (
                                        <button onClick={() => updateStatus(q.question_id, 'approved')} style={{ background: 'var(--accent)', flex: 2 }}>
                                            ✓ Aprobar
                                        </button>
                                    )}
                                    {q.status !== 'rejected' && (
                                        <button onClick={() => updateStatus(q.question_id, 'rejected')} style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', flex: 1 }}>
                                            ✗ Rechazar
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
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
