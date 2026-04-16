import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { generateDynamicPatientPrompt, getInterviewRubric, getVoiceForPersona } from '../utils/patientPrompts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const VoicePatientSimulator = () => {
    const navigate = useNavigate();
    
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
    const [feedbackTab, setFeedbackTab] = useState<'feedback' | 'transcript'>('feedback');

    const systemInstruction = generateDynamicPatientPrompt(
        selectedArea, selectedDifficulty, selectedGender, selectedAge, selectedFormality, customGoal
    );
    const voiceName = getVoiceForPersona(selectedGender, selectedAge);

    const { connect, disconnect, connectionState, transcript, isSpeaking, volume, isMicOpen, toggleMic } = useGeminiLive({
        systemInstruction, voiceName
    });

    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcript]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (connectionState === 'connected') {
            interval = setInterval(() => setSessionSeconds(s => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [connectionState]);

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

            const formattedTranscript = transcript.map(t => 
                `${t.role === 'user' ? 'Kinesiólogo(a)' : 'Paciente'}: ${t.text}`
            ).join('\n');
            const rubric = getInterviewRubric();
            
            const result = await model.generateContent(`${rubric}

--- TRANSCRIPCIÓN ---
${formattedTranscript}
--- FIN ---`);
            setFeedback(result.response.text());
        } catch (e) {
            console.error("Feedback error:", e);
            setFeedback("Error al generar feedback. Revisa tu conexión.");
        } finally {
            setGeneratingFeedback(false);
        }
    };

    const handleReset = () => window.location.reload();

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // ─── Transcript rendering ──────────────────────────────────────
    const renderTranscript = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transcript.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40, fontStyle: 'italic' }}>
                    La transcripción aparecerá aquí...
                </p>
            ) : (
                transcript.map((msg, i) => (
                    <div key={i} style={{ 
                        background: msg.role === 'model' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)',
                        padding: 10, borderRadius: 8, 
                        borderLeft: `3px solid ${msg.role === 'model' ? 'var(--primary)' : 'var(--text-muted)'}`,
                        maxWidth: '95%', alignSelf: msg.role === 'model' ? 'flex-start' : 'flex-end'
                    }}>
                        <small style={{ color: msg.role === 'model' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.7rem' }}>
                            {msg.role === 'model' ? '🩺 Paciente' : '👤 Tú (Kine)'}
                        </small>
                        <p style={{ margin: '4px 0 0', lineHeight: 1.4, fontSize: '0.85rem' }}>{msg.text}</p>
                    </div>
                ))
            )}
            <div ref={transcriptEndRef} />
        </div>
    );

    // ─── RENDER ──────────────────────────────────────────────────────

    return (
        <div className="container" style={{ maxWidth: 700, paddingBottom: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <h1 style={{ background: 'none', WebkitTextFillColor: 'white', textAlign: 'left', margin: 0, fontSize: '1.4rem' }}>
                    🎤 Paciente Virtual
                </h1>
                {connectionState === 'connected' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>⏱ {formatTime(sessionSeconds)}</span>
                        <span style={{ height: 8, width: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>En vivo</span>
                    </div>
                )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>Practica tu entrevista clínica en tiempo real.</p>

            {!hasStarted ? (
                /* ═══ SETUP ═══ */
                <div className="fadeIn" style={{ background: 'rgba(255,255,255,0.03)', padding: 25, borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                    <h2 style={{ color: 'var(--primary)', marginTop: 0, marginBottom: 20, fontSize: '1.1rem' }}>⚙️ Configura tu caso</h2>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 15 }}>
                        <Sel label="Área" value={selectedArea} onChange={setSelectedArea} options={[
                            'Aleatoria','Hombro','Rodilla','Columna Lumbar','Columna Cervical','Tobillo/Pie','Cadera','Codo/Muñeca','Caso Deportivo'
                        ]} />
                        <Sel label="Dificultad" value={selectedDifficulty} onChange={setSelectedDifficulty} options={['Básico','Intermedio','Avanzado']} />
                        <Sel label="Género" value={selectedGender} onChange={setSelectedGender} options={['Aleatorio','Mujer','Hombre']} />
                        <Sel label="Edad" value={selectedAge} onChange={setSelectedAge} options={['Aleatorio','Joven','Adulto','Adulto Mayor']} />
                        <Sel label="Formalidad" value={selectedFormality} onChange={setSelectedFormality} options={['Aleatorio','Formal','Natural','Informal']} />
                    </div>

                    <label style={labelStyle}>Descripción específica (Opcional)</label>
                    <textarea 
                        value={customGoal} onChange={(e) => setCustomGoal(e.target.value)}
                        placeholder="Ej: Karateca de 20 años con dolor de rodilla tras kumite..."
                        style={{ width: '100%', height: 50, padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', resize: 'none', fontFamily: 'inherit', fontSize: '0.85rem' }}
                    />

                    <button onClick={handleStart} style={{ width: '100%', padding: 16, marginTop: 20, fontSize: '1rem', background: 'var(--primary)', fontWeight: 'bold' }}>
                        🎤 Iniciar Entrevista
                    </button>
                </div>
            ) : (
                /* ═══ INTERVIEW ═══ */
                <div className="fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    
                    {/* STICKY HEADER */}
                    <div style={{ 
                        background: 'rgba(15,15,30,0.95)', padding: '12px 16px', borderRadius: 16, 
                        border: '1px solid var(--glass-border)', 
                        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                        position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(10px)'
                    }}>
                        {/* Sphere */}
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                            background: isSpeaking ? 'radial-gradient(circle, #6366f1, transparent 70%)' : 'rgba(255,255,255,0.05)',
                            border: `3px solid ${isSpeaking ? '#6366f1' : (isMicOpen ? '#10b981' : '#444')}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s ease',
                            boxShadow: isSpeaking ? `0 0 ${12 + volume * 200}px #6366f1` : 'none',
                            transform: `scale(${1 + volume * 0.5})`
                        }}>
                            <span style={{ fontSize: '1.2rem' }}>
                                {connectionState !== 'connected' ? '⏳' : isSpeaking ? '🗣️' : (isMicOpen ? '🎧' : '🔇')}
                            </span>
                        </div>

                        {/* Status */}
                        <div style={{ flex: 1, minWidth: 80 }}>
                            <p style={{ 
                                margin: 0, fontSize: '0.8rem', fontWeight: 'bold',
                                color: isSpeaking ? '#6366f1' : isMicOpen ? '#10b981' : 'var(--text-muted)' 
                            }}>
                                {connectionState === 'connecting' ? 'Conectando...' : 
                                 connectionState === 'disconnected' ? 'Sesión Terminada' :
                                 isSpeaking ? 'Paciente habla...' : isMicOpen ? '🔴 Micro abierto' : 'Micro apagado'}
                            </p>
                        </div>

                        {/* Buttons */}
                        {connectionState === 'connected' && (
                            <>
                                <button onClick={toggleMic} style={{ 
                                    padding: '8px 14px', background: isMicOpen ? '#10b981' : 'var(--primary)', 
                                    color: 'white', borderRadius: 10, fontWeight: 'bold', fontSize: '0.8rem',
                                    boxShadow: isMicOpen ? '0 0 10px rgba(16,185,129,0.3)' : 'none',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {isMicOpen ? '⏸️ Silenciar' : '🎙️ Micro'}
                                </button>
                                <button onClick={disconnect} style={{ 
                                    padding: '8px 12px', background: 'rgba(244,67,54,0.15)', border: '1px solid #f44336', 
                                    color: '#fba9a9', borderRadius: 10, fontSize: '0.8rem', whiteSpace: 'nowrap'
                                }}>⛔ Fin</button>
                            </>
                        )}
                        {connectionState === 'disconnected' && transcript.length > 2 && !feedback && (
                            <button onClick={handleGenerateFeedback} disabled={generatingFeedback} style={{ 
                                padding: '8px 14px', background: 'var(--accent)', color: 'white', borderRadius: 10, 
                                fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap'
                            }}>
                                {generatingFeedback ? '🧠 Evaluando...' : '📊 Feedback'}
                            </button>
                        )}
                    </div>

                    {/* MAIN CONTENT */}
                    <div style={{ 
                        background: 'rgba(0,0,0,0.2)', padding: 20, borderRadius: 16, 
                        border: '1px solid var(--glass-border)', 
                        minHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column'
                    }}>
                        {feedback ? (
                            <>
                                {/* Tab bar */}
                                <div style={{ display: 'flex', gap: 0, marginBottom: 15, borderBottom: '1px solid var(--glass-border)' }}>
                                    <button onClick={() => setFeedbackTab('feedback')} style={{
                                        flex: 1, padding: '10px', background: 'transparent', 
                                        color: feedbackTab === 'feedback' ? 'var(--primary)' : 'var(--text-muted)',
                                        borderBottom: feedbackTab === 'feedback' ? '2px solid var(--primary)' : '2px solid transparent',
                                        fontWeight: feedbackTab === 'feedback' ? 'bold' : 'normal', fontSize: '0.85rem'
                                    }}>🧑‍🏫 Evaluación</button>
                                    <button onClick={() => setFeedbackTab('transcript')} style={{
                                        flex: 1, padding: '10px', background: 'transparent', 
                                        color: feedbackTab === 'transcript' ? 'var(--primary)' : 'var(--text-muted)',
                                        borderBottom: feedbackTab === 'transcript' ? '2px solid var(--primary)' : '2px solid transparent',
                                        fontWeight: feedbackTab === 'transcript' ? 'bold' : 'normal', fontSize: '0.85rem'
                                    }}>📝 Transcripción</button>
                                </div>

                                {feedbackTab === 'feedback' ? (
                                    <div className="fadeIn" style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
                                        <div style={{ lineHeight: 1.7, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                            {feedback.split('\n').map((line, idx) => {
                                                if (line.startsWith('##')) return <h4 key={idx} style={{ color: 'var(--accent)', marginTop: 18, marginBottom: 4 }}>{line.replace(/^#+\s*/, '')}</h4>;
                                                if (line.includes('✅')) return <p key={idx} style={{ margin: '2px 0', color: '#10b981' }}>{line}</p>;
                                                if (line.includes('❌')) return <p key={idx} style={{ margin: '2px 0', color: '#ef4444' }}>{line}</p>;
                                                if (line.includes('⚠️')) return <p key={idx} style={{ margin: '2px 0', color: '#f59e0b' }}>{line}</p>;
                                                if (line.toLowerCase().includes('nota') && /[1-7]\.[0-9]/.test(line)) {
                                                    return <p key={idx} style={{ margin: '12px 0', padding: '10px 16px', background: 'rgba(99,102,241,0.15)', borderRadius: 10, fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)', border: '1px solid var(--primary)' }}>{line}</p>;
                                                }
                                                if (line.includes('**')) return <p key={idx} style={{ margin: '3px 0', fontWeight: 'bold' }}>{line.replace(/\*\*/g, '')}</p>;
                                                if (line.trim() === '') return <br key={idx} />;
                                                return <p key={idx} style={{ margin: '3px 0' }}>{line}</p>;
                                            })}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                                            <button onClick={handleReset} style={{ flex: 1, padding: 12, background: 'var(--primary)' }}>🔄 Nueva Entrevista</button>
                                            <button onClick={() => navigate('/units')} style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>Volver</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="fadeIn" style={{ flex: 1, overflowY: 'auto' }}>
                                        {renderTranscript()}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: 10 }}>📝 Transcripción</h3>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {renderTranscript()}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Reusable selector component
const Sel = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
    <div>
        <label style={labelStyle}>{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 };
const selectStyle: React.CSSProperties = { width: '100%', padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '0.85rem', outline: 'none' };
