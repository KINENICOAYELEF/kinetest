import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { generateDynamicPatientPrompt, getInterviewRubric, getVoiceForPersona } from '../utils/patientPrompts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const VoicePatientSimulator = () => {
    const navigate = useNavigate();
    
    // Setup states
    const [hasStarted, setHasStarted] = useState(false);
    const [selectedArea, setSelectedArea] = useState('Aleatoria');
    const [selectedDifficulty, setSelectedDifficulty] = useState('Intermedio');
    const [selectedGender, setSelectedGender] = useState('Aleatorio');
    const [selectedAge, setSelectedAge] = useState('Aleatorio');
    const [selectedFormality, setSelectedFormality] = useState('Aleatorio');
    const [customGoal, setCustomGoal] = useState('');
    const [generatingFeedback, setGeneratingFeedback] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [sessionSeconds, setSessionSeconds] = useState(0);

    const systemInstruction = generateDynamicPatientPrompt(
        selectedArea, selectedDifficulty, selectedGender, selectedAge, selectedFormality, customGoal
    );
    const voiceName = getVoiceForPersona(selectedGender, selectedAge);

    const { connect, disconnect, connectionState, transcript, isSpeaking, volume, isMicOpen, toggleMic } = useGeminiLive({
        systemInstruction, voiceName
    });

    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll transcript
    useEffect(() => {
        if (transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcript]);

    // Session timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (connectionState === 'connected') {
            interval = setInterval(() => setSessionSeconds(s => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [connectionState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => { disconnect(); };
    }, [disconnect]);

    const handleStart = async () => {
        setHasStarted(true);
        setSessionSeconds(0);
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

- Evalúa SOLO lo que aparece en la transcripción.
- **TOLERANCIA A ERRORES DE MICRÓFONO (STT)**: Si una palabra del kinesiólogo no tiene sentido (ej: "vi la tele") pero fonéticamente suena a una pregunta clínica lógica (ej: "te duele"), dale el punto por bueno. NO penalices por errores del motor de voz.
- Sé riguroso pero justo.
- Usa la escala de notas chilena: 1.0-3.9 reprobado, 4.0 aprobatorio mínimo, 5.0-5.9 bueno, 6.0-6.5 muy bueno, 6.6-7.0 excelente.`;

            const result = await model.generateContent(req);
            setFeedback(result.response.text());
        } catch (e) {
            console.error("Feedback generation error:", e);
            setFeedback("Error al generar el feedback. Revisa tu conexión o la API key.");
        } finally {
            setGeneratingFeedback(false);
        }
    };

    const handleReset = () => {
        window.location.reload();
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // ─── RENDER ──────────────────────────────────────────────────────────

    return (
        <div className="container" style={{ maxWidth: 900, paddingBottom: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ background: 'none', WebkitTextFillColor: 'white', textAlign: 'left', margin: 0 }}>
                    🎤 Paciente Virtual 
                </h1>
                {connectionState === 'connected' && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                            ⏱ {formatTime(sessionSeconds)}
                        </span>
                        <span style={{ height: 10, width: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'pulsate 1.5s infinite' }}></span>
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem' }}>En vivo</span>
                    </div>
                )}
            </div>

            <p style={{ color: 'var(--text-muted)' }}>
                Practica tu entrevista clínica en tiempo real.
            </p>

            {!hasStarted ? (
                /* ═══════ SETUP SCREEN ═══════ */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginTop: 30 }}>
                    <div className="fadeIn" style={{ background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                        <h2 style={{ color: 'var(--primary)', marginTop: 0, marginBottom: 25 }}>⚙️ Configura tu caso clínico</h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                            <div>
                                <label style={labelStyle}>Área corporal</label>
                                <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} style={selectStyle}>
                                    <option value="Aleatoria">Aleatoria</option>
                                    <option value="Hombro">Hombro</option>
                                    <option value="Rodilla">Rodilla</option>
                                    <option value="Columna Lumbar">Columna Lumbar</option>
                                    <option value="Columna Cervical">Columna Cervical</option>
                                    <option value="Tobillo/Pie">Tobillo/Pie</option>
                                    <option value="Cadera">Cadera</option>
                                    <option value="Codo/Muñeca">Codo/Muñeca</option>
                                    <option value="Caso Deportivo">Caso Deportivo</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Dificultad</label>
                                <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)} style={selectStyle}>
                                    <option value="Básico">Básico (Cooperador)</option>
                                    <option value="Intermedio">Intermedio (Normal)</option>
                                    <option value="Avanzado">Avanzado (Difícil)</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Género del Paciente</label>
                                <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} style={selectStyle}>
                                    <option value="Aleatorio">Aleatorio</option>
                                    <option value="Mujer">Mujer</option>
                                    <option value="Hombre">Hombre</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Edad</label>
                                <select value={selectedAge} onChange={(e) => setSelectedAge(e.target.value)} style={selectStyle}>
                                    <option value="Aleatorio">Aleatoria</option>
                                    <option value="Joven">Joven</option>
                                    <option value="Adulto">Adulto</option>
                                    <option value="Adulto Mayor">Adulto Mayor</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Formalidad</label>
                                <select value={selectedFormality} onChange={(e) => setSelectedFormality(e.target.value)} style={selectStyle}>
                                    <option value="Aleatorio">Aleatorio</option>
                                    <option value="Formal">Formal (Usted)</option>
                                    <option value="Natural">Natural</option>
                                    <option value="Informal">Informal (Tú)</option>
                                </select>
                            </div>
                        </div>

                        <label style={labelStyle}>Descripción específica (Opcional)</label>
                        <textarea 
                            value={customGoal}
                            onChange={(e) => setCustomGoal(e.target.value)}
                            placeholder="Ej: Karateca de 20 años con dolor de rodilla tras kumite..."
                            style={{
                                width: '100%', height: 60, padding: 12, borderRadius: 10,
                                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                                color: 'white', resize: 'none', fontFamily: 'inherit', fontSize: '0.9rem'
                            }}
                        />

                        <button 
                            onClick={handleStart} 
                            style={{ width: '100%', padding: 18, marginTop: 25, fontSize: '1.1rem', background: 'var(--primary)', fontWeight: 'bold' }}
                        >
                            🎤 Iniciar Entrevista Virtual
                        </button>
                    </div>

                    {/* Guide sidebar */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.03)', padding: 25, borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                        <h3 style={{ fontSize: '0.95rem', color: '#10b981', marginTop: 0 }}>💡 Guía de la Entrevista</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 15 }}>Sigue esta ruta para no omitir puntos críticos:</p>
                        <ul style={{ color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 18, fontSize: '0.82rem' }}>
                            <li style={{ marginBottom: 8 }}><strong>Rapport Inicial:</strong> Saluda, preséntate y explica cómo será la sesión.</li>
                            <li style={{ marginBottom: 8 }}><strong>Motivo Abierto:</strong> "Cuéntame, ¿qué lo trae por acá?".</li>
                            <li style={{ marginBottom: 8 }}><strong>Filtro Específico:</strong> Localización, inicio (agudo vs gradual), intensidad de 1 a 10.</li>
                            <li style={{ marginBottom: 8 }}><strong>Banderas Rojas:</strong> Descarta hormigueos, pérdida de peso, trauma extremo.</li>
                            <li><strong>Antecedentes:</strong> Cirugías, patologías crónicas, uso de medicamentos.</li>
                        </ul>
                    </div>
                </div>
            ) : (
                /* ═══════ INTERVIEW SCREEN ═══════ */
                <div className="fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20 }}>
                    
                    {/* TOP BAR: Sphere + Controls (always visible) */}
                    <div style={{ 
                        background: 'rgba(255,255,255,0.03)', padding: '15px 20px', borderRadius: 20, 
                        border: '1px solid var(--glass-border)', 
                        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                        position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        backgroundColor: 'rgba(15, 15, 30, 0.95)'
                    }}>
                        {/* Mini Sphere */}
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
                            background: connectionState === 'connected' 
                                ? (isSpeaking ? 'radial-gradient(circle, #6366f1 0%, transparent 70%)' : 'rgba(255,255,255,0.05)') 
                                : 'rgba(255,255,255,0.02)',
                            border: `3px solid ${connectionState === 'connected' ? (isSpeaking ? '#6366f1' : 'var(--text-muted)') : '#333'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s ease',
                            boxShadow: isSpeaking ? `0 0 ${15 + (volume * 300)}px #6366f1` : 'none',
                            transform: `scale(${connectionState === 'connected' ? 1 + (volume * 0.8) : 1})`
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>
                                {connectionState === 'connected' ? (isSpeaking ? '🗣️' : (isMicOpen ? '🎧' : '💤')) : '⏳'}
                            </span>
                        </div>

                        {/* Status text */}
                        <div style={{ flex: 1, minWidth: 120 }}>
                            {connectionState === 'connecting' && <p style={{ color: 'var(--accent)', margin: 0 }}>Conectando...</p>}
                            {connectionState === 'connected' && (
                                <p style={{ 
                                    color: isSpeaking ? '#6366f1' : (isMicOpen ? '#10b981' : 'var(--text-muted)'), 
                                    fontWeight: 'bold', margin: 0, fontSize: '0.9rem' 
                                }}>
                                    {isSpeaking ? 'El paciente habla...' : (isMicOpen ? '🔴 Micrófono abierto' : 'Micrófono apagado')}
                                </p>
                            )}
                            {connectionState === 'disconnected' && <p style={{ color: 'var(--error)', margin: 0 }}>Sesión Terminada</p>}
                        </div>

                        {/* Buttons */}
                        {connectionState === 'connected' && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button 
                                    onClick={toggleMic}
                                    style={{ 
                                        padding: '10px 20px', 
                                        background: isMicOpen ? '#10b981' : 'var(--primary)', 
                                        color: 'white', borderRadius: 12, fontWeight: 'bold', fontSize: '0.85rem',
                                        boxShadow: isMicOpen ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                                        transition: 'all 0.2s ease',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {isMicOpen ? '⏸️ Silenciar' : '🎙️ Activar Micro'}
                                </button>
                                <button onClick={disconnect} style={{ 
                                    padding: '10px 16px', background: 'rgba(244, 67, 54, 0.15)', 
                                    border: '1px solid #f44336', color: '#fba9a9', borderRadius: 12, fontSize: '0.85rem',
                                    whiteSpace: 'nowrap'
                                }}>
                                    ⛔ Finalizar
                                </button>
                            </div>
                        )}

                        {connectionState === 'disconnected' && transcript.length > 2 && !feedback && (
                            <button onClick={handleGenerateFeedback} disabled={generatingFeedback} style={{ 
                                padding: '10px 20px', background: 'var(--accent)', color: 'white', 
                                borderRadius: 12, fontWeight: 'bold', fontSize: '0.85rem',
                                whiteSpace: 'nowrap'
                            }}>
                                {generatingFeedback ? '🧠 Evaluando...' : '📊 Generar Feedback'}
                            </button>
                        )}
                    </div>

                    {/* MAIN CONTENT: Transcript or Feedback */}
                    <div style={{ 
                        background: 'rgba(0,0,0,0.2)', padding: 25, borderRadius: 20, 
                        border: '1px solid var(--glass-border)', 
                        display: 'flex', flexDirection: 'column',
                        minHeight: 'calc(100vh - 300px)'
                    }}>
                        {feedback ? (
                            <div className="fadeIn">
                                <h3 style={{ color: 'var(--primary)', margin: '0 0 20px 0' }}>🧑‍🏫 Evaluación Clínica</h3>
                                <div style={{ 
                                    lineHeight: 1.7, fontSize: '0.9rem', color: 'var(--text-main)',
                                    maxHeight: 'calc(100vh - 400px)', overflowY: 'auto', paddingRight: 10
                                }}>
                                    {feedback.split('\n').map((line, idx) => {
                                        if (line.startsWith('##')) {
                                            return <h4 key={idx} style={{ color: 'var(--accent)', marginTop: 20, marginBottom: 5 }}>{line.replace(/^#+\s*/, '')}</h4>;
                                        }
                                        if (line.includes('✅')) return <p key={idx} style={{ margin: '3px 0', color: '#10b981' }}>{line}</p>;
                                        if (line.includes('❌')) return <p key={idx} style={{ margin: '3px 0', color: '#ef4444' }}>{line}</p>;
                                        if (line.includes('⚠️')) return <p key={idx} style={{ margin: '3px 0', color: '#f59e0b' }}>{line}</p>;
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
                                <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: 12, fontSize: '1rem' }}>
                                    📝 Transcripción
                                </h3>
                                <div style={{ 
                                    flex: 1, overflowY: 'auto', 
                                    display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 8 
                                }}>
                                    {transcript.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 50, fontStyle: 'italic' }}>
                                            La transcripción aparecerá aquí...
                                        </p>
                                    ) : (
                                        transcript.map((msg, i) => (
                                            <div key={i} style={{ 
                                                background: msg.role === 'model' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.05)',
                                                padding: 12, borderRadius: 10, 
                                                borderLeft: `4px solid ${msg.role === 'model' ? 'var(--primary)' : 'var(--text-muted)'}`,
                                                alignSelf: msg.role === 'model' ? 'flex-start' : 'flex-end',
                                                maxWidth: '90%'
                                            }}>
                                                <small style={{ color: msg.role === 'model' ? 'var(--primary)' : 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 'bold', fontSize: '0.75rem' }}>
                                                    {msg.role === 'model' ? '🩺 Paciente' : '👤 Tú (Kine)'}
                                                </small>
                                                <span style={{ lineHeight: 1.4, fontSize: '0.9rem' }}>
                                                    {msg.text}
                                                </span>
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

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 5
};

const selectStyle: React.CSSProperties = {
    width: '100%', padding: 10, borderRadius: 8,
    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
    color: 'white', fontSize: '0.9rem', outline: 'none'
};
