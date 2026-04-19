import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useGeminiText } from '../hooks/useGeminiText';
import { CASE_GENERATION_PROMPT, buildEvaluationPrompt, buildAuditorCasePrompt } from '../utils/clinicalPrompts';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────
interface CaseData {
    paciente: {
        nombre: string; edad: number; sexo: string;
        ocupacion: string; deporte: string; motivo_consulta: string;
    };
    anamnesis: {
        mecanismo: string; evolucion: string; dolor_eva: number;
        patron_dolor: string; tratamientos_previos: string;
        banderas_amarillas: string[]; comorbilidades: string[];
    };
    evaluacion_fisica: {
        observacion: string;
        rom_activo: Record<string, string>;
        rom_pasivo: Record<string, string>;
        fuerza_muscular: Record<string, string>;
        tests_especiales: { nombre: string; resultado: string; interpretacion: string }[];
        palpacion: string; funcional: string;
    };
    deficiencias_clave: string[];
    fase_actual: string;
    dificultad: string;
}

interface Especifico {
    texto: string;
    operacionales: string[];
}

interface StudentResponse {
    diagnostico: string;
    objetivoGeneral: string;
    especificos: Especifico[];
    pronostico: number;
    justificacionPronostico: string;
}

interface AuditorError {
    tipo: string;
    ubicacion: string;
    explicacion: string;
    correccion: string;
    found?: boolean;
}

type Level = 1 | 2 | 3;
type Phase = 'menu' | 'loading' | 'working' | 'evaluating' | 'results';

// ─── Constants ────────────────────────────────────
const TOTAL_TIME = 600; // 10 minutes in seconds

// ─── Component ────────────────────────────────────
export const ClinicalReasoning = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const { generate, loading: aiLoading } = useGeminiText({ parseJson: true });

    // State
    const [level, setLevel] = useState<Level>(1);
    const [phase, setPhase] = useState<Phase>('menu');
    const [caseData, setCaseData] = useState<CaseData | null>(null);
    const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
    const [results, setResults] = useState<any>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Student response state
    const [diagnostico, setDiagnostico] = useState('');
    const [objGeneral, setObjGeneral] = useState('');
    const [especificos, setEspecificos] = useState<Especifico[]>([{ texto: '', operacionales: [''] }]);
    const [pronostico, setPronostico] = useState(5);
    const [justificacion, setJustificacion] = useState('');

    // Auditor mode state
    const [auditorData, setAuditorData] = useState<any>(null);
    const [foundErrors, setFoundErrors] = useState<boolean[]>([false, false, false]);
    const [auditorNotes, setAuditorNotes] = useState<string[]>(['', '', '']);

    // ─── Timer ────────────────────────────────────
    useEffect(() => {
        if (phase === 'working' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(t => {
                    if (t <= 1) {
                        clearInterval(timerRef.current!);
                        handleSubmit();
                        return 0;
                    }
                    return t - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // ─── Generate Case ────────────────────────────
    const startSession = useCallback(async (selectedLevel: Level) => {
        setLevel(selectedLevel);
        setPhase('loading');
        resetForm();

        if (selectedLevel === 3) {
            // Auditor mode: generate case WITH errors
            const data = await generate(buildAuditorCasePrompt());
            if (data && data.caso) {
                setAuditorData(data);
                setCaseData(data.caso);
                setFoundErrors([false, false, false]);
                setAuditorNotes(['', '', '']);
            }
        } else {
            // Normal mode: generate clean case
            const data = await generate(CASE_GENERATION_PROMPT);
            if (data) setCaseData(data);
        }

        setTimeLeft(TOTAL_TIME);
        setPhase('working');
    }, [generate]);

    const resetForm = () => {
        setDiagnostico('');
        setObjGeneral('');
        setEspecificos([{ texto: '', operacionales: [''] }]);
        setPronostico(5);
        setJustificacion('');
        setResults(null);
    };

    // ─── Submit & Evaluate ────────────────────────
    const handleSubmit = useCallback(async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('evaluating');

        if (level === 3 && auditorData) {
            // Auditor mode: grade locally based on errors found
            const correctFinds = auditorData.errores_ocultos.filter((_: any, i: number) => foundErrors[i] && auditorNotes[i].length > 10).length;
            const nota = 1.0 + (correctFinds / 3) * 6.0;
            setResults({
                nota: Math.min(7.0, Math.max(1.0, Number(nota.toFixed(1)))),
                errores_encontrados: correctFinds,
                errores_totales: 3,
                detalle: auditorData.errores_ocultos.map((err: AuditorError, i: number) => ({
                    ...err,
                    alumno_detecto: foundErrors[i],
                    nota_alumno: auditorNotes[i],
                })),
            });
            setPhase('results');
        } else {
            // Build student response and send to AI for evaluation
            const response: StudentResponse = {
                diagnostico,
                objetivoGeneral: objGeneral,
                especificos,
                pronostico,
                justificacionPronostico: justificacion,
            };

            const evalResult = await generate(buildEvaluationPrompt(caseData, response));
            setResults(evalResult);
            setPhase('results');

            // Save to Firestore
            if (userProfile?.uid) {
                try {
                    await addDoc(collection(db, 'clinical_reasoning_sessions'), {
                        uid: userProfile.uid,
                        level,
                        caseData,
                        response,
                        results: evalResult,
                        timeUsed: TOTAL_TIME - timeLeft,
                        createdAt: serverTimestamp(),
                    });
                } catch (e) { console.error('Error saving session:', e); }
            }
        }
    }, [level, auditorData, foundErrors, auditorNotes, diagnostico, objGeneral, especificos, pronostico, justificacion, caseData, generate, timeLeft, userProfile]);

    // ─── Específicos Management ───────────────────
    const addEspecifico = () => setEspecificos(prev => [...prev, { texto: '', operacionales: [''] }]);
    const removeEspecifico = (idx: number) => setEspecificos(prev => prev.filter((_, i) => i !== idx));
    const updateEspecificoTexto = (idx: number, texto: string) =>
        setEspecificos(prev => prev.map((e, i) => i === idx ? { ...e, texto } : e));
    const addOperacional = (espIdx: number) =>
        setEspecificos(prev => prev.map((e, i) => i === espIdx ? { ...e, operacionales: [...e.operacionales, ''] } : e));
    const removeOperacional = (espIdx: number, opIdx: number) =>
        setEspecificos(prev => prev.map((e, i) => i === espIdx ? { ...e, operacionales: e.operacionales.filter((_, j) => j !== opIdx) } : e));
    const updateOperacional = (espIdx: number, opIdx: number, val: string) =>
        setEspecificos(prev => prev.map((e, i) => i === espIdx ? { ...e, operacionales: e.operacionales.map((o, j) => j === opIdx ? val : o) } : e));

    // ─── Styles ───────────────────────────────────
    const glassCard: React.CSSProperties = {
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
        borderRadius: 16, padding: 20, marginBottom: 16,
    };
    const timerStyle: React.CSSProperties = {
        position: 'fixed', top: 16, right: 16, zIndex: 999,
        background: timeLeft <= 60 ? 'rgba(239,68,68,0.9)' : 'rgba(99,102,241,0.9)',
        color: 'white', padding: '10px 20px', borderRadius: 12, fontWeight: 'bold',
        fontSize: '1.3rem', fontFamily: 'monospace',
        boxShadow: timeLeft <= 60 ? '0 0 20px rgba(239,68,68,0.5)' : '0 4px 15px rgba(0,0,0,0.3)',
        animation: timeLeft <= 30 ? 'pulse 0.5s infinite alternate' : 'none',
        transition: 'all 0.3s ease',
    };
    const sectionTitle: React.CSSProperties = {
        fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)',
        textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8,
    };
    const textArea: React.CSSProperties = {
        width: '100%', minHeight: 80, padding: 14, background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--glass-border)', borderRadius: 10, color: 'white',
        fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical' as const,
    };
    const chipStyle = (active: boolean): React.CSSProperties => ({
        display: 'inline-block', padding: '6px 14px', borderRadius: 20,
        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', userSelect: 'none' as const,
        background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? 'var(--primary)' : 'var(--glass-border)'}`,
        color: active ? 'white' : 'var(--text-muted)', transition: 'all 0.2s',
    });

    // ─── RENDER: Menu ─────────────────────────────
    if (phase === 'menu') {
        return (
            <div className="container" style={{ maxWidth: 600 }}>
                <h1>🧠 Razonamiento Clínico</h1>
                <p style={{ textAlign: 'center' }}>Diagnóstico, Objetivos y Pronóstico — Casos MSK/Deportivos generados por IA</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 30 }}>
                    <div onClick={() => startSession(1)} style={{ ...glassCard, cursor: 'pointer', borderColor: 'var(--primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '2rem' }}>🏗️</span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', background: 'none', WebkitTextFillColor: 'white', textAlign: 'left' }}>
                                    Nivel 1: El Andamio
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                    Guías visuales + tarjetas por deficiencia. Para aprender la estructura.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div onClick={() => startSession(2)} style={{ ...glassCard, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '2rem' }}>🌳</span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', background: 'none', WebkitTextFillColor: 'white', textAlign: 'left' }}>
                                    Nivel 2: Constructor Libre
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                    Árbol dinámico sin guías. Crea los objetivos que necesites.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div onClick={() => startSession(3)} style={{ ...glassCard, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '2rem' }}>🔍</span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', background: 'none', WebkitTextFillColor: 'white', textAlign: 'left' }}>
                                    Nivel 3: Auditor Clínico
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                    Encuentra y corrige 3 errores en el plan de otro practicante.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={() => navigate('/home')} style={{ marginTop: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                    ← Volver al Inicio
                </button>
            </div>
        );
    }

    // ─── RENDER: Loading ──────────────────────────
    if (phase === 'loading' || (phase === 'working' && !caseData)) {
        return (
            <div className="container" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: 20, animation: 'pulse 1s infinite alternate' }}>🧠</div>
                <h2>Generando caso clínico...</h2>
                <p>La IA está creando un paciente aleatorio MSK/Deportivo</p>
                <div style={{ width: 200, height: 4, background: 'var(--glass-border)', borderRadius: 2, margin: '20px auto', overflow: 'hidden' }}>
                    <div style={{ width: '60%', height: '100%', background: 'var(--primary)', borderRadius: 2, animation: 'loading 1.5s ease-in-out infinite' }} />
                </div>
            </div>
        );
    }

    const renderText = (text: string) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => (
            <span key={i}>
                {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>;
                    }
                    return <span key={j}>{part}</span>;
                })}
                <br />
            </span>
        ));
    };

    // ─── RENDER: Results ──────────────────────────
    if (phase === 'results' && results) {
        const isAuditor = level === 3;

        return (
            <div className="container" style={{ maxWidth: 700 }}>
                <h1>{isAuditor ? '🔍 Resultado Auditoría' : '📊 Resultado'}</h1>

                {/* Nota */}
                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <div style={{
                        display: 'inline-block', padding: '20px 40px', borderRadius: 20,
                        background: results.nota >= 4.0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        border: `2px solid ${results.nota >= 4.0 ? '#10b981' : '#ef4444'}`,
                    }}>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: results.nota >= 4.0 ? '#10b981' : '#ef4444' }}>
                            {results.nota?.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {isAuditor
                                ? `${results.errores_encontrados}/3 errores detectados`
                                : `${results.puntos_obtenidos}/${results.puntos_maximos} puntos`
                            }
                        </div>
                    </div>
                </div>

                {/* Desglose */}
                {!isAuditor && results.desglose && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(results.desglose).map(([key, val]: [string, any]) => (
                            <div key={key} style={glassCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                    <span style={{
                                        fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                                        background: val.puntos / val.maximo >= 0.7 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                        color: val.puntos / val.maximo >= 0.7 ? '#10b981' : '#ef4444',
                                        fontSize: '0.85rem',
                                    }}>
                                        {val.puntos}/{val.maximo}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                                    {renderText(val.feedback)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Auditor details */}
                {isAuditor && results.detalle && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {results.detalle.map((err: any, i: number) => (
                            <div key={i} style={{ ...glassCard, borderColor: err.alumno_detecto ? '#10b981' : '#ef4444' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: err.alumno_detecto ? '#10b981' : '#ef4444', marginBottom: 6 }}>
                                    {err.alumno_detecto ? '✅ Detectado' : '❌ No detectado'}
                                </div>
                                <p style={{ fontWeight: 600, margin: '0 0 4px', fontSize: '0.95rem' }}>Error: {err.tipo}</p>
                                <p style={{ fontSize: '0.85rem', margin: '0 0 4px' }}>📍 {err.ubicacion}</p>
                                <p style={{ fontSize: '0.85rem', margin: '0 0 4px' }}>💡 {err.explicacion}</p>
                                <p style={{ fontSize: '0.85rem', margin: 0, color: '#10b981' }}>✏️ Corrección: {err.correccion}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Feedback general */}
                {!isAuditor && results.fortalezas && (
                    <div style={{ ...glassCard, marginTop: 20, borderColor: '#10b981' }}>
                        <div style={sectionTitle}>✅ Fortalezas</div>
                        {results.fortalezas.map((f: string, i: number) => (
                            <div key={i} style={{ fontSize: '0.85rem', margin: '4px 0' }}>• {renderText(f)}</div>
                        ))}
                    </div>
                )}
                {!isAuditor && results.errores_criticos && (
                    <div style={{ ...glassCard, borderColor: '#ef4444' }}>
                        <div style={{ ...sectionTitle, color: '#ef4444' }}>❌ Errores Críticos</div>
                        {results.errores_criticos.map((e: string, i: number) => (
                            <div key={i} style={{ fontSize: '0.85rem', margin: '4px 0' }}>• {renderText(e)}</div>
                        ))}
                    </div>
                )}
                {!isAuditor && results.consejo_final && (
                    <div style={{ ...glassCard, borderColor: 'var(--primary)', background: 'rgba(99,102,241,0.05)' }}>
                        <div style={sectionTitle}>💡 Consejo</div>
                        <div style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>{renderText(results.consejo_final)}</div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button onClick={() => setPhase('menu')} style={{ flex: 1 }}>
                        Nuevo Caso
                    </button>
                    <button onClick={() => navigate('/home')} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    // ─── RENDER: Evaluating ───────────────────────
    if (phase === 'evaluating') {
        return (
            <div className="container" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: 20, animation: 'pulse 1s infinite alternate' }}>📋</div>
                <h2>Evaluando tu plan...</h2>
                <p>El supervisor IA está revisando tu trabajo con lupa</p>
            </div>
        );
    }

    // ─── RENDER: Working (Level 3 = Auditor) ──────
    if (phase === 'working' && level === 3 && caseData && auditorData) {
        return (
            <div className="container" style={{ maxWidth: 800 }}>
                <div style={timerStyle}>⏱ {formatTime(timeLeft)}</div>

                <h2 style={{ fontSize: '1.2rem' }}>🔍 Auditoría Clínica</h2>
                <p style={{ fontSize: '0.85rem', marginBottom: 20 }}>
                    Revisa el plan de abajo. Tiene <strong>3 errores clínicos ocultos</strong>. Encuéntralos y corrígelos.
                </p>

                {/* Case summary */}
                <div style={{ ...glassCard, borderColor: 'var(--primary)' }}>
                    <div style={sectionTitle}>Paciente</div>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>
                        {caseData.paciente.nombre}, {caseData.paciente.edad} años, {caseData.paciente.sexo}.
                        {caseData.paciente.ocupacion}. {caseData.paciente.deporte !== 'ninguno' ? `Deporte: ${caseData.paciente.deporte}.` : ''}
                    </p>
                    <p style={{ fontSize: '0.9rem', margin: '8px 0 0', fontStyle: 'italic' }}>"{caseData.paciente.motivo_consulta}"</p>
                </div>

                {/* Plan to audit */}
                <div style={{ ...glassCard, background: 'rgba(245,158,11,0.05)', borderColor: '#f59e0b' }}>
                    <div style={{ ...sectionTitle, color: '#f59e0b' }}>Plan del Practicante (a auditar)</div>

                    <div style={{ marginBottom: 12 }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Diagnóstico:</strong>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0', padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                            {auditorData.plan_con_errores.diagnostico}
                        </p>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Objetivo General:</strong>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0', padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                            {auditorData.plan_con_errores.objetivo_general}
                        </p>
                    </div>
                    {auditorData.plan_con_errores.especificos?.map((esp: any, i: number) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Obj. Específico {i + 1}:</strong>
                            <p style={{ fontSize: '0.9rem', margin: '4px 0', padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                                {esp.texto}
                            </p>
                            {esp.operacionales?.map((op: string, j: number) => (
                                <p key={j} style={{ fontSize: '0.85rem', margin: '2px 0 2px 20px', color: 'var(--text-muted)' }}>
                                    → Op {j + 1}: {op}
                                </p>
                            ))}
                        </div>
                    ))}
                    <div>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pronóstico:</strong>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0', padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                            {auditorData.plan_con_errores.pronostico} ({auditorData.plan_con_errores.pronostico_valor}/10)
                        </p>
                    </div>
                </div>

                {/* Error finders */}
                <div style={sectionTitle}>📝 Marca los 3 errores que encontraste</div>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{ ...glassCard, borderColor: foundErrors[i] ? '#10b981' : 'var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div
                                onClick={() => setFoundErrors(prev => prev.map((v, idx) => idx === i ? !v : v))}
                                style={{
                                    width: 24, height: 24, borderRadius: 6, cursor: 'pointer',
                                    border: `2px solid ${foundErrors[i] ? '#10b981' : 'var(--glass-border)'}`,
                                    background: foundErrors[i] ? 'rgba(16,185,129,0.2)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.8rem', fontWeight: 700, color: '#10b981',
                                }}
                            >
                                {foundErrors[i] && '✓'}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Error {i + 1}</span>
                        </div>
                        <textarea
                            value={auditorNotes[i]}
                            onChange={e => setAuditorNotes(prev => prev.map((n, idx) => idx === i ? e.target.value : n))}
                            placeholder="Describe el error que encontraste y cómo lo corregirías..."
                            style={{ ...textArea, minHeight: 60 }}
                        />
                    </div>
                ))}

                <button onClick={handleSubmit} disabled={aiLoading}
                    style={{ marginTop: 10, background: 'var(--accent)' }}>
                    📨 Enviar Auditoría
                </button>
            </div>
        );
    }

    // ─── RENDER: Working (Level 1 & 2) ────────────
    if (phase === 'working' && caseData) {
        return (
            <div className="container" style={{ maxWidth: 800 }}>
                {/* Timer */}
                <div style={timerStyle}>⏱ {formatTime(timeLeft)}</div>

                <h2 style={{ fontSize: '1.2rem' }}>
                    {level === 1 ? '🏗️ Nivel 1: Andamio' : '🌳 Nivel 2: Constructor Libre'}
                </h2>

                {/* ─── Case Display ─── */}
                <div style={{ ...glassCard, borderColor: 'var(--primary)' }}>
                    <div style={sectionTitle}>👤 Paciente</div>
                    <p style={{ fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>
                        {caseData.paciente.nombre}, {caseData.paciente.edad} años ({caseData.paciente.sexo})
                    </p>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}>
                        {caseData.paciente.ocupacion} {caseData.paciente.deporte !== 'ninguno' ? `| Deporte: ${caseData.paciente.deporte}` : ''}
                    </p>
                    <p style={{ fontSize: '0.9rem', margin: '8px 0 0', fontStyle: 'italic', color: 'white' }}>
                        "{caseData.paciente.motivo_consulta}"
                    </p>
                </div>

                <div style={glassCard}>
                    <div style={sectionTitle}>📋 Anamnesis</div>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}><strong>Mecanismo:</strong> {caseData.anamnesis.mecanismo}</p>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}><strong>Evolución:</strong> {caseData.anamnesis.evolucion}</p>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}><strong>EVA:</strong> {caseData.anamnesis.dolor_eva}/10</p>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}><strong>Patrón:</strong> {caseData.anamnesis.patron_dolor}</p>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}><strong>Tratamientos previos:</strong> {caseData.anamnesis.tratamientos_previos}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {caseData.anamnesis.banderas_amarillas.map((b, i) => (
                            <span key={i} style={chipStyle(true)}>⚠️ {b}</span>
                        ))}
                        {caseData.anamnesis.comorbilidades.map((c, i) => (
                            <span key={i} style={chipStyle(false)}>🏥 {c}</span>
                        ))}
                    </div>
                </div>

                <div style={glassCard}>
                    <div style={sectionTitle}>🔬 Evaluación Física</div>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}><strong>Observación:</strong> {caseData.evaluacion_fisica.observacion}</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                        {Object.keys(caseData.evaluacion_fisica.rom_activo).length > 0 && (
                            <div>
                                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ROM Activo:</strong>
                                {Object.entries(caseData.evaluacion_fisica.rom_activo).map(([k, v]) => (
                                    <p key={k} style={{ fontSize: '0.8rem', margin: '2px 0' }}>{k}: {v}</p>
                                ))}
                            </div>
                        )}
                        {Object.keys(caseData.evaluacion_fisica.fuerza_muscular).length > 0 && (
                            <div>
                                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fuerza (Daniels):</strong>
                                {Object.entries(caseData.evaluacion_fisica.fuerza_muscular).map(([k, v]) => (
                                    <p key={k} style={{ fontSize: '0.8rem', margin: '2px 0' }}>{k}: {v}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    {caseData.evaluacion_fisica.tests_especiales.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                            <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tests Especiales:</strong>
                            {caseData.evaluacion_fisica.tests_especiales.map((t, i) => (
                                <p key={i} style={{ fontSize: '0.8rem', margin: '2px 0' }}>
                                    {t.nombre}: <span style={{ color: t.resultado === 'positivo' ? '#ef4444' : '#10b981', fontWeight: 600 }}>{t.resultado}</span>
                                    {t.interpretacion && ` — ${t.interpretacion}`}
                                </p>
                            ))}
                        </div>
                    )}
                    <p style={{ fontSize: '0.85rem', margin: '8px 0 4px' }}><strong>Palpación:</strong> {caseData.evaluacion_fisica.palpacion}</p>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0' }}><strong>Funcional:</strong> {caseData.evaluacion_fisica.funcional}</p>
                </div>

                {/* Phase badge */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <span style={{
                        padding: '6px 16px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
                        background: 'rgba(99,102,241,0.15)', border: '1px solid var(--primary)', color: 'var(--primary)',
                    }}>
                        Fase: {caseData.fase_actual?.toUpperCase()}
                    </span>
                </div>

                {/* ─── Level 1: Scaffolded Form ─── */}
                {level === 1 && (
                    <>
                        {/* Deficiencies chips (scaffolding) */}
                        <div style={{ ...glassCard, borderColor: '#f59e0b', background: 'rgba(245,158,11,0.05)' }}>
                            <div style={{ ...sectionTitle, color: '#f59e0b' }}>🎯 Deficiencias Clave Identificadas</div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                Tu diagnóstico y objetivos deben cubrir TODAS estas deficiencias:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {caseData.deficiencias_clave.map((d, i) => (
                                    <span key={i} style={{ ...chipStyle(true), background: 'rgba(245,158,11,0.15)', borderColor: '#f59e0b', color: '#fbbf24' }}>
                                        {d}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ─── Diagnosis ─── */}
                <div style={glassCard}>
                    <div style={sectionTitle}>1. Diagnóstico Kinesiológico (CIF)</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                        Deficiencia → Limitación de Actividad → Restricción de Participación
                    </p>
                    <textarea
                        value={diagnostico}
                        onChange={e => setDiagnostico(e.target.value)}
                        placeholder="Ej: Deficiencia de ROM y fuerza en rotadores externos del hombro derecho, que limita alcance funcional sobre cabeza y restringe participación en actividades laborales de carga aérea..."
                        style={{ ...textArea, minHeight: 100 }}
                    />
                </div>

                {/* ─── Objetivo General ─── */}
                <div style={glassCard}>
                    <div style={sectionTitle}>2. Objetivo General</div>
                    {level === 1 ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                            Recuerda: debe ser SMART — Específico, Medible, Alcanzable, Relevante, con Tiempo
                        </p>
                    ) : null}
                    <textarea
                        value={objGeneral}
                        onChange={e => setObjGeneral(e.target.value)}
                        placeholder="Ej: Recuperar ROM de flexión glenohumeral activa a ≥160° y fuerza de RE a grado 4+/5 en 8 semanas, para retomar actividades laborales de carga sobre cabeza sin dolor (<2 EVA)."
                        style={textArea}
                    />
                </div>

                {/* ─── Objetivos Específicos + Operacionales ─── */}
                <div style={glassCard}>
                    <div style={sectionTitle}>3. Objetivos Específicos y Operacionales</div>

                    {level === 1 && (
                        <p style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: 12 }}>
                            💡 Crea al menos 1 objetivo específico por cada deficiencia identificada arriba.
                            Y para cada específico, agrega los operacionales (lo que harás en la sesión de hoy).
                        </p>
                    )}

                    {especificos.map((esp, espIdx) => (
                        <div key={espIdx} style={{
                            padding: 16, marginBottom: 12, borderRadius: 12,
                            background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)' }}>
                                    OE {espIdx + 1}
                                </span>
                                {especificos.length > 1 && (
                                    <span onClick={() => removeEspecifico(espIdx)} style={{ cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem' }}>✕ Eliminar</span>
                                )}
                            </div>
                            <textarea
                                value={esp.texto}
                                onChange={e => updateEspecificoTexto(espIdx, e.target.value)}
                                placeholder="Ej: Disminuir dolor de hombro de EVA 7 a EVA ≤3 en reposo en 3 semanas"
                                style={{ ...textArea, minHeight: 50 }}
                            />

                            {/* Operacionales */}
                            <div style={{ marginLeft: 16, marginTop: 8, borderLeft: '2px solid rgba(99,102,241,0.3)', paddingLeft: 12 }}>
                                {esp.operacionales.map((op, opIdx) => (
                                    <div key={opIdx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10, minWidth: 30 }}>
                                            OO {opIdx + 1}
                                        </span>
                                        <textarea
                                            value={op}
                                            onChange={e => updateOperacional(espIdx, opIdx, e.target.value)}
                                            placeholder="Ej: Aplicar crioterapia 15 min + ejercicios isométricos de RE 3x10 a intensidad sub-dolor (EVA ≤4)"
                                            style={{ ...textArea, minHeight: 40, flex: 1 }}
                                        />
                                        {esp.operacionales.length > 1 && (
                                            <span onClick={() => removeOperacional(espIdx, opIdx)}
                                                style={{ cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', marginTop: 10 }}>✕</span>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => addOperacional(espIdx)}
                                    style={{ width: 'auto', padding: '4px 12px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--primary)', marginTop: 4 }}>
                                    + Agregar Operacional
                                </button>
                            </div>
                        </div>
                    ))}

                    <button onClick={addEspecifico}
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981' }}>
                        + Nuevo Objetivo Específico
                    </button>
                </div>

                {/* ─── Pronóstico ─── */}
                <div style={glassCard}>
                    <div style={sectionTitle}>4. Pronóstico</div>
                    
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <span style={{
                            fontWeight: 800, fontSize: '1.5rem',
                            color: pronostico >= 7 ? '#10b981' : pronostico >= 4 ? '#f59e0b' : '#ef4444',
                        }}>
                            {pronostico}/10
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {pronostico >= 7 ? 'Favorable' : pronostico >= 4 ? 'Regular' : 'Desfavorable'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                        <span style={{ fontSize: '0.8rem', color: '#ef4444', minWidth: 70 }}>Desfavorable</span>
                        <input
                            type="range" min={1} max={10} value={pronostico}
                            onChange={e => setPronostico(Number(e.target.value))}
                            style={{ flex: 1, margin: 0, padding: 0 }}
                        />
                        <span style={{ fontSize: '0.8rem', color: '#10b981', minWidth: 70, textAlign: 'right' }}>Favorable</span>
                    </div>
                    
                    <textarea
                        value={justificacion}
                        onChange={e => setJustificacion(e.target.value)}
                        placeholder="Justifica tu pronóstico considerando: factores biológicos (tipo de tejido, fase, severidad), banderas amarillas (psicosociales), y factores contextuales..."
                        style={{ ...textArea, minHeight: 70 }}
                    />
                </div>

                {/* Submit */}
                <button onClick={handleSubmit} disabled={aiLoading || !diagnostico || !objGeneral}
                    style={{ background: 'var(--accent)', marginTop: 10, fontSize: '1.1rem' }}>
                    📨 Enviar Plan para Evaluación
                </button>
            </div>
        );
    }

    return null;
};
