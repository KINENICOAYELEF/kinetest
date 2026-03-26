import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
    question_type?: string;
}

export const AdminContent = () => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'approved' | 'rejected'>('draft');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Question | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkProcessing, setBulkProcessing] = useState(false);
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

    const deleteQuestion = async (id: string) => {
        if (!window.confirm("¿Estás seguro de que quieres eliminar esta pregunta permanentemente?")) return;
        try {
            await deleteDoc(doc(db, 'questions', id));
            setQuestions(prev => prev.filter(q => q.question_id !== id));
            setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        } catch (e) {
            console.error("Error deleting:", e);
            alert("Error al eliminar la pregunta.");
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

    // === BULK OPERATIONS ===
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const selectAllVisible = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(q => q.question_id)));
        }
    };

    const bulkApprove = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`¿Aprobar ${selectedIds.size} preguntas seleccionadas?`)) return;
        setBulkProcessing(true);
        try {
            for (const id of selectedIds) {
                await updateDoc(doc(db, 'questions', id), { status: 'approved' });
            }
            setQuestions(prev => prev.map(q => selectedIds.has(q.question_id) ? { ...q, status: 'approved' } : q));
            setSelectedIds(new Set());
            alert(`✅ ${selectedIds.size} preguntas aprobadas exitosamente.`);
        } catch (e) {
            console.error("Error in bulk approve:", e);
            alert("Error durante la aprobación masiva.");
        } finally {
            setBulkProcessing(false);
        }
    };

    const bulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`⚠️ ¿ELIMINAR PERMANENTEMENTE ${selectedIds.size} preguntas? Esta acción NO se puede deshacer.`)) return;
        setBulkProcessing(true);
        try {
            for (const id of selectedIds) {
                await deleteDoc(doc(db, 'questions', id));
            }
            setQuestions(prev => prev.filter(q => !selectedIds.has(q.question_id)));
            setSelectedIds(new Set());
            alert(`🗑️ ${selectedIds.size} preguntas eliminadas.`);
        } catch (e) {
            console.error("Error in bulk delete:", e);
            alert("Error durante la eliminación masiva.");
        } finally {
            setBulkProcessing(false);
        }
    };

    const filtered = questions.filter(q => filterStatus === 'all' || q.status === filterStatus);
    const countDrafts = questions.filter(q => q.status === 'draft').length;
    const countApproved = questions.filter(q => q.status === 'approved').length;
    const countRejected = questions.filter(q => q.status === 'rejected').length;
    
    if (loading) return <div className="container"><p>Cargando banco de preguntas...</p></div>;

    return (
        <div className="container" style={{ maxWidth: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ marginBottom: 0 }}>Gestión de Contenido</h1>
                <button onClick={() => navigate('/admin')} style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>Volver</button>
            </div>
            
            <p style={{ marginTop: 10 }}>Revisa, edita y aprueba el contenido pedagógico.</p>

            {/* FILTER TABS */}
            <div style={{ display: 'flex', gap: 10, margin: '30px 0 15px', overflowX: 'auto', paddingBottom: 10 }}>
                <button 
                    onClick={() => { setFilterStatus('draft'); setSelectedIds(new Set()); }}
                    style={{ background: filterStatus === 'draft' ? '#f59e0b' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                >
                    Pendientes ({countDrafts})
                </button>
                <button 
                    onClick={() => { setFilterStatus('approved'); setSelectedIds(new Set()); }}
                    style={{ background: filterStatus === 'approved' ? 'var(--accent)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                >
                    Aprobadas ({countApproved})
                </button>
                {countRejected > 0 && (
                    <button 
                        onClick={() => { setFilterStatus('rejected'); setSelectedIds(new Set()); }}
                        style={{ background: filterStatus === 'rejected' ? '#f87171' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                    >
                        Rechazadas ({countRejected})
                    </button>
                )}
                <button 
                    onClick={() => { setFilterStatus('all'); setSelectedIds(new Set()); }}
                    style={{ background: filterStatus === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
                >
                    Todas ({questions.length})
                </button>
            </div>

            {/* BULK ACTION BAR */}
            <div style={{ 
                display: 'flex', gap: 10, padding: 16, marginBottom: 20,
                background: selectedIds.size > 0 ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                borderRadius: 12, border: `1px solid ${selectedIds.size > 0 ? 'var(--primary)' : 'var(--glass-border)'}`,
                alignItems: 'center', flexWrap: 'wrap' as const
            }}>
                <button 
                    onClick={selectAllVisible} 
                    style={{ background: 'rgba(255,255,255,0.1)', width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}
                >
                    {selectedIds.size === filtered.length && filtered.length > 0 ? '⬜ Deseleccionar Todo' : `☑️ Seleccionar Todo (${filtered.length})`}
                </button>
                
                {selectedIds.size > 0 && (
                    <>
                        <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            {selectedIds.size} seleccionadas
                        </span>
                        <button 
                            onClick={bulkApprove} disabled={bulkProcessing}
                            style={{ background: 'var(--accent)', width: 'auto', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 'bold' }}
                        >
                            ✓ Aprobar Seleccionadas
                        </button>
                        <button 
                            onClick={bulkDelete} disabled={bulkProcessing}
                            style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                            ✗ Eliminar Seleccionadas
                        </button>
                    </>
                )}
            </div>

            {/* QUESTION CARDS */}
            <div className="flex-col" style={{ gap: 20 }}>
                {filtered.map(q => (
                    <div key={q.question_id} style={{ 
                        background: selectedIds.has(q.question_id) ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)', 
                        padding: 25, borderRadius: 16, 
                        border: `1px solid ${selectedIds.has(q.question_id) ? 'var(--primary)' : q.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : q.status === 'rejected' ? 'rgba(248, 113, 113, 0.3)' : '#f59e0b'}` 
                    }}>
                        
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
                                <div className="form-group" style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--primary)' }}>Justificación Clínica (Interpretación)</label>
                                    <textarea 
                                        value={editForm.rationale}
                                        onChange={(e) => setEditForm({ ...editForm, rationale: e.target.value })}
                                        style={{ width: '100%', minHeight: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 12, color: 'white', fontSize: '0.95rem' }}
                                    />
                                </div>
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
                            <div className="card-content">
                                {/* TOP ROW: Checkbox + Actions */}
                                <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(q.question_id)}
                                        onChange={() => toggleSelect(q.question_id)}
                                        style={{ width: 20, height: 20, cursor: 'pointer' }}
                                    />
                                    {q.status !== 'approved' && (
                                        <button onClick={() => updateStatus(q.question_id, 'approved')} style={{ background: 'var(--accent)', flex: 2, padding: '12px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            ✓ Aprobar
                                        </button>
                                    )}
                                    <button onClick={() => startEditing(q)} style={{ background: 'rgba(255,255,255,0.1)', flex: 1, padding: '12px' }}>
                                        ✎ Editar
                                    </button>
                                    <button onClick={() => deleteQuestion(q.question_id)} style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', flex: 1, padding: '12px' }}>
                                        ✗ Borrar
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' as const, gap: 5 }}>
                                    <span>{q.question_id} | {q.unit_id || 'Global'} | {q.question_type || 'sin tipo'}</span>
                                    <span style={{ 
                                        padding: '2px 8px', borderRadius: 12, fontWeight: 'bold',
                                        background: q.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : q.status === 'rejected' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                        color: q.status === 'approved' ? '#10b981' : q.status === 'rejected' ? '#f87171' : '#f59e0b'
                                    }}>
                                        {q.status?.toUpperCase()}
                                    </span>
                                </div>
                                
                                <p style={{ color: 'white', fontWeight: 500, fontSize: '1rem', marginBottom: 15 }}>{q.content}</p>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {q.options.map((opt, i) => (
                                        <div key={i} style={{ 
                                            padding: 10, borderRadius: 8, fontSize: '0.85rem',
                                            border: `1px solid ${opt.isCorrect ? 'var(--accent)' : 'var(--glass-border)'}`,
                                            background: opt.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)' 
                                        }}>
                                            {opt.isCorrect && '✅ '} {opt.text || '⚠️ [VACÍA]'}
                                        </div>
                                    ))}
                                </div>

                                {q.hints && q.hints.length > 0 && (
                                    <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#f59e0b' }}>
                                        <strong>Pistas:</strong>
                                        <ul style={{ margin: '5px 0', paddingLeft: 20 }}>
                                            {q.hints.map((h, idx) => <li key={idx}>{h}</li>)}
                                        </ul>
                                    </div>
                                )}
                                
                                <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>
                                    <strong>Justificación:</strong> {q.rationale ? q.rationale.slice(0, 200) + (q.rationale.length > 200 ? '...' : '') : '⚠️ Sin justificación'}
                                    {q.learning_pearl && (
                                        <div style={{ marginTop: 6, color: 'var(--accent)', fontWeight: 'bold' }}>
                                            💡 {q.learning_pearl}
                                        </div>
                                    )}
                                </div>
                            </div>
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
