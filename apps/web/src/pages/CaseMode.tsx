import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface CaseNode {
    node_id: string;
    narrative: string;
    reveal?: string;
    question_id?: string;
    next_rules?: Record<number, string>; // Maps option index to next node_id
    next_node_id?: string; // For linear steps
}

interface Case {
    case_id: string;
    title: string;
    description: string;
    type: 'linear' | 'branched';
    nodes: CaseNode[];
    soap_schema?: {
        subjective: string[];
        objective: string[];
        assessment: string[];
        plan: string[];
    };
}

interface Question {
    question_id: string;
    content: string;
    options: { text: string; isCorrect: boolean }[];
    rationale: string;
}

export const CaseMode = () => {
    const { unitId } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [cases, setCases] = useState<Case[]>([]);
    const [currentCase, setCurrentCase] = useState<Case | null>(null);
    const [currentNode, setCurrentNode] = useState<CaseNode | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    
    const [viewMode, setViewMode] = useState<'selection' | 'intro' | 'node' | 'reveal' | 'soap'>('selection');
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    
    // SOAP State
    const [soapAnswers, setSoapAnswers] = useState<Record<string, string[]>>({
        subjective: [],
        objective: [],
        assessment: [],
        plan: []
    });

    useEffect(() => {
        const fetchCases = async () => {
            if (!unitId) return;
            try {
                const q = query(collection(db, 'cases'), where('unit_id', '==', unitId));
                const snap = await getDocs(q);
                const loadedCases = snap.docs.map(d => ({ case_id: d.id, ...d.data() } as Case));
                setCases(loadedCases);
            } catch (e) {
                console.error("Error fetching cases:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchCases();
    }, [unitId]);

    const startCase = async (c: Case) => {
        if (!currentUser) return;
        setLoading(true);
        setCurrentCase(c);
        
        try {
            const sRef = await addDoc(collection(db, 'case_sessions'), {
                uid: currentUser.uid,
                caseId: c.case_id,
                unitId,
                startedAt: serverTimestamp(),
                status: 'in_progress'
            });
            setSessionId(sRef.id);
            
            if (c.nodes && c.nodes.length > 0) {
                setCurrentNode(c.nodes[0]);
                setViewMode('intro');
            } else {
                alert("Este caso no tiene nodos configurados.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const enterNode = async (node: CaseNode) => {
        setCurrentNode(node);
        setSelectedOption(null);
        setCurrentQuestion(null);

        if (node.question_id) {
            const qDoc = await getDoc(doc(db, 'questions', node.question_id));
            if (qDoc.exists()) {
                setCurrentQuestion({ question_id: qDoc.id, ...qDoc.data() } as Question);
            }
        }
        setViewMode('node');
    };

    const handleAnswer = async (index: number) => {
        if (selectedOption !== null || !currentUser || !sessionId) return;
        setSelectedOption(index);
        
        // Save attempt
        const isCorrect = currentQuestion?.options[index].isCorrect ?? true;
        await addDoc(collection(db, 'users', currentUser.uid, 'attempts'), {
            caseId: currentCase?.case_id,
            nodeId: currentNode?.node_id,
            sessionId,
            questionId: currentNode?.question_id,
            isCorrect,
            timestamp: serverTimestamp(),
            mode: 'case'
        });

        if (currentNode?.reveal) {
            setViewMode('reveal');
        } else {
            advanceNode(index);
        }
    };

    const advanceNode = (lastChoice?: number) => {
        if (!currentCase || !currentNode) return;

        let nextId = currentNode.next_node_id;
        if (lastChoice !== undefined && currentNode.next_rules) {
            nextId = currentNode.next_rules[lastChoice] || nextId;
        }

        if (nextId) {
            const nextNode = currentCase.nodes.find(n => n.node_id === nextId);
            if (nextNode) {
                enterNode(nextNode);
                return;
            }
        }

        // No next node -> SOAP or Finish
        if (currentCase.soap_schema) {
            setViewMode('soap');
        } else {
            finishCase();
        }
    };

    const finishCase = async () => {
        if (!sessionId || !currentUser) return;
        setLoading(true);
        try {
            await setDoc(doc(db, 'case_sessions', sessionId), {
                status: 'completed',
                endedAt: serverTimestamp(),
                soapAnswers
            }, { merge: true });
            
            // Navigate back
            navigate(`/units`);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSoapSelection = (category: string, value: string) => {
        setSoapAnswers(prev => {
            const current = prev[category] || [];
            if (current.includes(value)) {
                return { ...prev, [category]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [category]: [...current, value] };
            }
        });
    };

    if (loading) return <div style={{ padding: 20 }}>Cargando...</div>;

    if (viewMode === 'selection') {
        return (
            <div className="container" style={{ maxWidth: 800 }}>
                <h1>Casos Clínicos</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: 30 }}>Entrénate con escenarios reales y toma decisiones clínicas.</p>
                <div className="flex-col" style={{ gap: 20 }}>
                    {cases.map(c => (
                        <div key={c.case_id} style={{ background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                            <h3 style={{ margin: 0, textAlign: 'left', background: 'none', WebkitTextFillColor: 'white' }}>{c.title}</h3>
                            <p style={{ margin: '12px 0', fontSize: '0.95rem', color: 'var(--text-muted)' }}>{c.description.slice(0, 150)}...</p>
                            <button onClick={() => startCase(c)} style={{ width: 'auto', padding: '10px 24px' }}>
                                Iniciar Caso
                            </button>
                        </div>
                    ))}
                    {cases.length === 0 && <p style={{ textAlign: 'center', padding: '40px 0' }}>No hay casos clínicos disponibles para esta unidad.</p>}
                </div>
                <button onClick={() => navigate('/units')} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', margin: '30px auto' }}>
                    ← Volver al listado
                </button>
            </div>
        );
    }

    if (viewMode === 'intro') {
        return (
            <div className="container" style={{ maxWidth: 700 }}>
                <h1 style={{ background: 'none', WebkitTextFillColor: 'var(--primary)', marginBottom: 20 }}>{currentCase?.title}</h1>
                <div style={{ fontSize: '1.2rem', margin: '30px 0', textAlign: 'left', lineHeight: '1.8', color: 'var(--text-main)', background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                    {currentCase?.description}
                </div>
                <button 
                    onClick={() => enterNode(currentCase!.nodes[0])}
                    style={{ fontSize: '1.1rem', padding: '18px 48px', borderRadius: 40 }}
                >
                    Comenzar Simulación
                </button>
            </div>
        );
    }

    if (viewMode === 'node' || viewMode === 'reveal') {
        return (
            <div className="container" style={{ maxWidth: 800 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 40, borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '1.15rem', lineHeight: '1.7', color: 'var(--text-main)', margin: 0 }}>
                        {currentNode?.narrative}
                    </p>

                    {currentQuestion && (
                        <div style={{ marginTop: 40, borderTop: '1px solid var(--glass-border)', paddingTop: 30 }}>
                            <h3 style={{ textAlign: 'left', background: 'none', WebkitTextFillColor: 'white', marginBottom: 20 }}>{currentQuestion.content}</h3>
                            <div className="flex-col" style={{ gap: 12 }}>
                                {currentQuestion.options.map((opt, i) => {
                                    const isSelected = selectedOption === i;
                                    const isCorrect = opt.isCorrect;
                                    let borderColor = 'var(--glass-border)';
                                    let bg = 'rgba(255,255,255,0.02)';
                                    let color = 'var(--text-muted)';
                                    
                                    if (selectedOption !== null) {
                                        if (isCorrect) { borderColor = 'var(--accent)'; bg = 'rgba(16, 185, 129, 0.1)'; color = 'white'; }
                                        else if (isSelected) { borderColor = '#f87171'; bg = 'rgba(248, 113, 113, 0.1)'; color = 'white'; }
                                    } else if (isSelected) {
                                        borderColor = 'var(--primary)'; bg = 'rgba(99, 102, 241, 0.1)'; color = 'white';
                                    }

                                    return (
                                        <button 
                                            key={i}
                                            onClick={() => handleAnswer(i)}
                                            disabled={selectedOption !== null}
                                            style={{ padding: '16px', textAlign: 'left', border: '1px solid', borderColor, borderRadius: 12, background: bg, color, cursor: selectedOption !== null ? 'default' : 'pointer', fontSize: '0.95rem' }}
                                        >
                                            {opt.text}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'reveal' && (
                        <div style={{ marginTop: 40, background: 'rgba(251, 192, 45, 0.05)', padding: 24, borderRadius: 16, border: '1px solid rgba(251, 192, 45, 0.1)' }}>
                            <h4 style={{ margin: 0, color: '#fbc02d', letterSpacing: '1px', fontSize: '0.9rem' }}>🔍 HALLAZGOS / REVELACIÓN</h4>
                            <p style={{ margin: '16px 0', color: 'white', lineHeight: '1.6' }}>{currentNode?.reveal}</p>
                            <button 
                                onClick={() => advanceNode(selectedOption!)}
                                style={{ background: '#fbc02d', color: 'black', width: 'auto', padding: '10px 24px' }}
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {selectedOption !== null && !currentNode?.reveal && (
                         <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center' }}>
                            <button 
                                onClick={() => advanceNode(selectedOption!)}
                                style={{ width: 'auto', padding: '12px 32px' }}
                            >
                                Siguiente Paso →
                            </button>
                         </div>
                    )}
                </div>
            </div>
        );
    }

    if (viewMode === 'soap') {
        const schema = currentCase?.soap_schema!;
        return (
            <div className="container" style={{ maxWidth: 1000 }}>
                <h1>Resumen SOAP Final</h1>
                <p style={{ color: 'var(--text-muted)' }}>Selecciona los elementos que resumen correctamente este caso clínico.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 40 }}>
                    {Object.entries(schema).map(([key, options]) => (
                        <div key={key} style={{ background: 'rgba(255,255,255,0.02)', padding: 25, borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                            <h3 style={{ textTransform: 'capitalize', textAlign: 'left', background: 'none', WebkitTextFillColor: 'var(--primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: 15, marginBottom: 20 }}>
                                {key === 'subjective' ? '📎 S: Subjetivo' : 
                                 key === 'objective' ? '🔍 O: Objetivo' : 
                                 key === 'assessment' ? '⚖️ A: Apreciación' : 
                                 '📋 P: Plan'}
                            </h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {options.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => toggleSoapSelection(key, opt)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: 20,
                                            border: '1px solid',
                                            borderColor: soapAnswers[key].includes(opt) ? 'var(--primary)' : 'var(--glass-border)',
                                            background: soapAnswers[key].includes(opt) ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                                            color: soapAnswers[key].includes(opt) ? 'white' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            width: 'auto',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ textAlign: 'center', marginTop: 50 }}>
                    <button 
                        onClick={finishCase}
                        style={{ padding: '18px 60px', borderRadius: 12, background: 'var(--accent)' }}
                    >
                        Finalizar y Guardar Caso
                    </button>
                </div>
            </div>
        );
    }

    return null;
};
