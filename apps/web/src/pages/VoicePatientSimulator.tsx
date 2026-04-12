import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { getPatientPromptForUnit, getInterviewRubric } from '../utils/patientPrompts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const VoicePatientSimulator = () => {
    const { unitId } = useParams();
    const navigate = useNavigate();
    
    // Setup states
    const [hasStarted, setHasStarted] = useState(false);
    const [customGoal, setCustomGoal] = useState('');
    
    const [generatingFeedback, setGeneratingFeedback] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    // Merge base prompt with user's custom goal if provided
    const baseInstruction = getPatientPromptForUnit(unitId || 'default');
    const systemInstruction = customGoal.trim() !== '' 
        ? `${baseInstruction}\n\nOBJETIVO ESPECÍFICO DEL ESTUDIANTE PARA ESTA SESIÓN:\nEl estudiante ha indicado que quiere practicar lo siguiente: "${customGoal}".\nPor favor, adapta tus respuestas sutilmente para darle la oportunidad de practicar esto, o sé un poco más reticente si su objetivo es practicar cómo sacar información difícil.`
        : baseInstruction;

    const { connect, disconnect, connectionState, transcript, isSpeaking, volume } = useGeminiLive({
        systemInstruction
    });

    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcript]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const handleStart = async () => {
        setHasStarted(true);
        await connect();
    };

    const handleGenerateFeedback = async () => {
        disconnect();
        setGeneratingFeedback(true);
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const formattedTranscript = transcript.map(t => `${t.role === 'user' ? 'Kinesiólogo(a)' : 'Paciente'}: ${t.text}`).join('\n');
            const rubric = getInterviewRubric();
            
            const req = `${rubric}

--- TRANSCRIPCIÓN DE LA ENTREVISTA ---
${formattedTranscript}
--- FIN DE TRANSCRIPCIÓN ---

IMPORTANTE: 
- Evalúa SOLO lo que aparece en la transcripción.
- Si una palabra o frase del kinesiólogo no tiene sentido (posible error de reconocimiento de voz), ignórala y no la penalices.
- Sé riguroso pero justo. Un estudiante que pregunta bien las cosas debe ser reconocido.
- Usa la escala de notas chilena: 1.0-3.9 reprobado, 4.0 aprobatorio mínimo, 5.0-5.9 bueno, 6.0-6.5 muy bueno, 6.6-7.0 excelente.`;

            const result = await model.generateContent(req);
            setFeedback(result.response.text());
        } catch (e) {
            console.error("Feedback generation error:", e);
            setFeedback("Error al generar el feedback. Revisa tu plan mensual o conexión de IA.");
        } finally {
            setGeneratingFeedback(false);
        }
    };

    const handleReset = () => {
        setFeedback(null);
        setHasStarted(false);
        setCustomGoal('');
        // Transcript is handled inside the hook, it will conceptually be a new session.
        // If they start again, the hook's transcript will append, so we actually need to reload or clear it.
        // Let's just reload the component logic or refresh the page for a clean slate.
        window.location.reload();
    };

    return (
        <div className="container" style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ background: 'none', WebkitTextFillColor: 'white', textAlign: 'left', margin: 0 }}>
                    🎤 Paciente Virtual 
                </h1>
                {connectionState === 'connected' && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ height: 10, width: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'pulsate 1.5s infinite' }}></span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>En vivo</span>
                    </div>
                )}
            </div>

            <p style={{ color: 'var(--text-muted)' }}>
                Practica tu entrevista clínica en tiempo real.
            </p>

            {!hasStarted ? (
                <div className="fadeIn" style={{ marginTop: 30, background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                    <h2 style={{ color: 'var(--primary)', marginTop: 0 }}>📝 Preparación de la Entrevista</h2>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 30, marginTop: 20 }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>Instrucciones Clínicas:</h3>
                            <ul style={{ color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 20 }}>
                                <li><strong>Prepara el escenario:</strong> Saluda cordialmente y explícale al paciente qué van a hacer.</li>
                                <li><strong>De Abierto a Cerrado:</strong> Comienza con preguntas amplias ("¿Qué lo trae por aquí?") y luego afina ("¿Ese dolor al agacharse, es punzante?").</li>
                                <li><strong>Escucha activa:</strong> Si el paciente menciona un miedo o una molestia importante, valídalo antes de saltar a la siguiente pregunta técnica.</li>
                                <li><strong>No olvides seguridad:</strong> Revisa siempre banderas rojas relevantes antes de pasar a la evaluación física.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>Personaliza tu Práctica (Opcional):</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                ¿Hay algo específico que quieras entrenar hoy? Escríbelo y el paciente adaptará sus respuestas para desafiarte en esa área.
                            </p>
                            <textarea 
                                value={customGoal}
                                onChange={(e) => setCustomGoal(e.target.value)}
                                placeholder="Ej: Quiero practicar cómo indagar sobre banderas rojas reumatológicas, o cómo tratar a un paciente muy ansioso..."
                                style={{
                                    width: '100%', height: 100, padding: 15, borderRadius: 10,
                                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                                    color: 'white', resize: 'none', fontFamily: 'inherit'
                                }}
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleStart} 
                        style={{ width: '100%', padding: 20, marginTop: 30, fontSize: '1.1rem', background: 'var(--primary)' }}
                    >
                        🚪 Entrar al Box (Iniciar Entrevista)
                    </button>
                </div>
            ) : (
                <div className="fadeIn" style={{ display: 'flex', gap: 20, marginTop: 30, flexDirection: 'row', flexWrap: 'wrap' }}>
                    
                    {/* LEFT PANEL: Controls & Visualizer */}
                    <div style={{ flex: 1, minWidth: 300, background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 20, border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        
                        {/* Visualizer Sphere */}
                        <div style={{
                            width: 150, height: 150, borderRadius: '50%',
                            background: connectionState === 'connected' 
                                          ? (isSpeaking ? 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' : 'rgba(255,255,255,0.05)') 
                                          : 'rgba(255,255,255,0.02)',
                            border: `4px solid ${connectionState === 'connected' ? (isSpeaking ? 'var(--primary)' : 'var(--text-muted)') : '#333'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s ease',
                            boxShadow: (isSpeaking || volume > 0.05) ? `0 0 ${20 + (volume * 500)}px var(--primary)` : 'none',
                            transform: `scale(${connectionState === 'connected' ? 1 + (volume * 1.5) : 1})`
                        }}>
                            <span style={{ fontSize: '3rem', opacity: connectionState === 'connected' ? 1 : 0.3 }}>
                                {connectionState === 'connected' ? (isSpeaking ? '🗣️' : '🎧') : '💤'}
                            </span>
                        </div>

                        <div style={{ marginTop: 20, textAlign: 'center', height: 40 }}>
                            {connectionState === 'connecting' && <p style={{ color: 'var(--accent)' }}>Conectando...</p>}
                            {connectionState === 'connected' && (
                               <p style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>
                                   {isSpeaking ? 'El paciente está hablando...' : 'Te está prestando atención. ¡Habla!'}
                               </p>
                            )}
                            {connectionState === 'disconnected' && <p style={{ color: 'var(--error)' }}>Desconectado</p>}
                        </div>

                        <div style={{ display: 'flex', gap: 15, marginTop: 30, width: '100%' }}>
                            {connectionState === 'disconnected' && !feedback && (
                                <button onClick={handleStart} style={{ flex: 1, padding: 15, background: 'var(--primary)', color: 'white' }}>
                                    📞 Reconectar
                                </button>
                            )}
                            
                            {(connectionState === 'connected' || connectionState === 'connecting') && (
                                <button onClick={disconnect} style={{ flex: 1, padding: 15, background: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', color: '#fba9a9' }}>
                                    ⛔ Finalizar Entrevista
                                </button>
                            )}
                        </div>

                        {transcript.length > 2 && connectionState === 'disconnected' && !feedback && (
                            <button onClick={handleGenerateFeedback} disabled={generatingFeedback} style={{ marginTop: 15, width: '100%', padding: 15, background: 'var(--accent)', color: 'white' }}>
                                {generatingFeedback ? '🧠 Evaluando...' : '📊 Generar Feedback del Tutor'}
                            </button>
                        )}
                    </div>

                    {/* RIGHT PANEL: Transcript or Feedback */}
                    <div style={{ flex: 1.5, minWidth: 350, background: 'rgba(0,0,0,0.2)', padding: 30, borderRadius: 20, border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
                        
                        {feedback ? (
                            <div className="fadeIn">
                                <h3 style={{ color: 'var(--primary)', margin: '0 0 20px 0' }}>🧑‍🏫 Evaluación Clínica</h3>
                                <div style={{ 
                                    lineHeight: 1.7, fontSize: '0.9rem', color: 'var(--text-main)',
                                    maxHeight: 500, overflowY: 'auto', paddingRight: 10
                                }}>
                                    {feedback.split('\n').map((line, idx) => {
                                        if (line.startsWith('##')) {
                                            return <h4 key={idx} style={{ color: 'var(--accent)', marginTop: 20, marginBottom: 5 }}>{line.replace(/^#+\s*/, '')}</h4>;
                                        }
                                        if (line.includes('✅')) {
                                            return <p key={idx} style={{ margin: '3px 0', color: '#10b981' }}>{line}</p>;
                                        }
                                        if (line.includes('❌')) {
                                            return <p key={idx} style={{ margin: '3px 0', color: '#ef4444' }}>{line}</p>;
                                        }
                                        if (line.includes('⚠️')) {
                                            return <p key={idx} style={{ margin: '3px 0', color: '#f59e0b' }}>{line}</p>;
                                        }
                                        if (line.toLowerCase().includes('nota') && /[1-7]\.[0-9]/.test(line)) {
                                            return <p key={idx} style={{ 
                                                margin: '15px 0', padding: '12px 20px', 
                                                background: 'rgba(99,102,241,0.15)', borderRadius: 12, 
                                                fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)',
                                                border: '1px solid var(--primary)'
                                            }}>{line}</p>;
                                        }
                                        if (line.startsWith('**') || line.includes('**')) {
                                            return <p key={idx} style={{ margin: '4px 0', fontWeight: 'bold' }}>{line.replace(/\*\*/g, '')}</p>;
                                        }
                                        if (line.trim() === '') return <br key={idx} />;
                                        return <p key={idx} style={{ margin: '4px 0' }}>{line}</p>;
                                    })}
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                                    <button onClick={handleReset} style={{ flex: 1, background: 'var(--primary)' }}>
                                        🔄 Nueva Entrevista
                                    </button>
                                    <button onClick={() => navigate('/units')} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                                        Volver al Panel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: 15 }}>
                                    Transcripción
                                </h3>
                                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400, display: 'flex', flexDirection: 'column', gap: 15, paddingRight: 10 }}>
                                    {transcript.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 50, fontStyle: 'italic' }}>
                                            La transcripción de la entrevista aparecerá aquí...
                                        </p>
                                    ) : (
                                        transcript.map((msg, i) => (
                                            <div key={i} style={{ 
                                                background: msg.role === 'model' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.05)',
                                                padding: 15, borderRadius: 10, 
                                                borderLeft: `4px solid ${msg.role === 'model' ? 'var(--primary)' : 'var(--text-muted)'}`,
                                                alignSelf: msg.role === 'model' ? 'flex-start' : 'flex-end',
                                                maxWidth: '85%'
                                            }}>
                                                <small style={{ color: msg.role === 'model' ? 'var(--primary)' : 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 'bold' }}>
                                                    {msg.role === 'model' ? 'Paciente' : 'Tú (Kine)'}
                                                </small>
                                                <span style={{ lineHeight: 1.4, fontSize: '0.95rem' }}>{msg.text}</span>
                                            </div>
                                        ))
                                    )}
                                    <div ref={transcriptEndRef} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
