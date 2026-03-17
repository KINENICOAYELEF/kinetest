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
            <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
                <h1>Casos Cl\u00ednicos</h1>
                <div style={{ display: 'grid', gap: 20, marginTop: 20 }}>
                    {cases.map(c => (
                        <div key={c.case_id} style={{ border: '1px solid #ddd', padding: 20, borderRadius: 12, background: 'white' }}>
                            <h3>{c.title}</h3>
                            <p>{c.description.slice(0, 150)}...</p>
                            <button 
                                onClick={() => startCase(c)}
                                style={{ background: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer' }}
                            >
                                Iniciar Caso
                            </button>
                        </div>
                    ))}
                    {cases.length === 0 && <p>No hay casos cl\u00ednicos disponibles para esta unidad.</p>}
                </div>
                <button onClick={() => navigate('/units')} style={{ marginTop: 20 }}>Volver</button>
            </div>
        );
    }

    if (viewMode === 'intro') {
        return (
            <div style={{ padding: 40, maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
                <h1 style={{ color: '#2e7d32' }}>{currentCase?.title}</h1>
                <div style={{ fontSize: '1.2rem', margin: '30px 0', textAlign: 'left', lineHeight: '1.6' }}>
                    {currentCase?.description}
                </div>
                <button 
                    onClick={() => enterNode(currentCase!.nodes[0])}
                    style={{ background: '#1976d2', color: 'white', border: 'none', padding: '15px 40px', borderRadius: 30, fontSize: '1.1rem', cursor: 'pointer' }}
                >
                    Comenzar Simulaci\u00f3n
                </button>
            </div>
        );
    }

    if (viewMode === 'node' || viewMode === 'reveal') {
        return (
            <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
                <div style={{ background: 'white', padding: 30, borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem', lineHeight: '1.5', color: '#333' }}>
                        {currentNode?.narrative}
                    </p>

                    {currentQuestion && (
                        <div style={{ marginTop: 30, borderTop: '2px solid #f5f5f5', paddingTop: 20 }}>
                            <h3>{currentQuestion.content}</h3>
                            <div style={{ display: 'grid', gap: 10, marginTop: 15 }}>
                                {currentQuestion.options.map((opt, i) => {
                                    const isSelected = selectedOption === i;
                                    const isCorrect = opt.isCorrect;
                                    let borderColor = '#ddd';
                                    let bg = 'white';
                                    
                                    if (selectedOption !== null) {
                                        if (isCorrect) { borderColor = '#4caf50'; bg = '#e8f5e9'; }
                                        else if (isSelected) { borderColor = '#f44336'; bg = '#ffebee'; }
                                    } else if (isSelected) {
                                        borderColor = '#1976d2'; bg = '#e3f2fd';
                                    }

                                    return (
                                        <button 
                                            key={i}
                                            onClick={() => handleAnswer(i)}
                                            disabled={selectedOption !== null}
                                            style={{ padding: 15, textAlign: 'left', border: '2px solid', borderColor, borderRadius: 8, background: bg, cursor: selectedOption !== null ? 'default' : 'pointer' }}
                                        >
                                            {opt.text}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'reveal' && (
                        <div style={{ marginTop: 30, background: '#fff9c4', padding: 20, borderRadius: 8 }}>
                            <h4 style={{ margin: 0, color: '#f57f17' }}> HALLAZGOS / REVELACI\u00d3N </h4>
                            <p style={{ margin: '10px 0' }}>{currentNode?.reveal}</p>
                            <button 
                                onClick={() => advanceNode(selectedOption!)}
                                style={{ background: '#f57f17', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {selectedOption !== null && !currentNode?.reveal && (
                         <div style={{ marginTop: 20 }}>
                            <button 
                                onClick={() => advanceNode(selectedOption!)}
                                style={{ background: '#4caf50', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 4, cursor: 'pointer' }}
                            >
                                Siguiente Paso
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
            <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
                <h1 style={{ textAlign: 'center' }}>Resumen SOAP Final</h1>
                <p style={{ textAlign: 'center', color: '#666' }}>Selecciona los elementos que resumen correctamente este caso cl\u00ednico.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginTop: 30 }}>
                    {Object.entries(schema).map(([key, options]) => (
                        <div key={key} style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #eee' }}>
                            <h3 style={{ textTransform: 'capitalize', color: '#1976d2', borderBottom: '2px solid #e3f2fd', paddingBottom: 10 }}>
                                {key === 'subjective' ? '\uf4dd S: Subjetivo' : 
                                 key === 'objective' ? '\ud83d\udd0d O: Objetivo' : 
                                 key === 'assessment' ? '\u2696\ufe0f A: Apreciaci\u00f3n' : 
                                 '\ud83d\udccb P: Plan'}
                            </h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 15 }}>
                                {options.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => toggleSoapSelection(key, opt)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 20,
                                            border: '1px solid',
                                            borderColor: soapAnswers[key].includes(opt) ? '#1976d2' : '#ccc',
                                            background: soapAnswers[key].includes(opt) ? '#e3f2fd' : 'white',
                                            color: soapAnswers[key].includes(opt) ? '#1976d2' : '#666',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ textAlign: 'center', marginTop: 40 }}>
                    <button 
                        onClick={finishCase}
                        style={{ padding: '15px 40px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
                    >
                        Finalizar y Guardar Caso
                    </button>
                </div>
            </div>
        );
    }

    return null;
};
