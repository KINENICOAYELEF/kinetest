import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { getPatientPromptForUnit } from '../utils/patientPrompts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const VoicePatientSimulator = () => {
    const { unitId } = useParams();
    const navigate = useNavigate();
    const [generatingFeedback, setGeneratingFeedback] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    const systemInstruction = getPatientPromptForUnit(unitId || 'default');
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
        await connect();
    };

    const handleGenerateFeedback = async () => {
        disconnect();
        setGeneratingFeedback(true);
        try {
            // Generate feedback based on the transcript using Gemini Flash
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const formattedTranscript = transcript.map(t => `${t.role === 'user' ? 'Kinesiólogo(a)' : 'Paciente'}: ${t.text}`).join('\n');
            
            const req = `
                Eres un tutor clínico supervisor. Aquí está la transcripción de una entrevista simulada entre un kinesiólogo (estudiante) y un paciente:
                
                --- TRANSCRIPCIÓN ---
                ${formattedTranscript}
                ---------------------

                Por favor, evalúa la entrevista:
                1. ¿El estudiante fue empático?
                2. ¿Hizo preguntas clave sobre el mecanismo de lesión, intensidad del dolor y tiempo de evolución?
                3. ¿Omitió banderas rojas o información crítica de la anamnesis?
                
                Proporciona un feedback constructivo de máximo 3 párrafos en tono alentador pero riguroso.
            `;

            const result = await model.generateContent(req);
            setFeedback(result.response.text());
        } catch (e) {
            setFeedback("Error al generar el feedback. Revisa tu plan mensual o conexión de IA.");
        } finally {
            setGeneratingFeedback(false);
        }
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
                Practica tu entrevista clínica en tiempo real. Ponte audífonos, presiona conectar y comienza a hablar.
            </p>

            <div style={{ display: 'flex', gap: 20, marginTop: 30, flexDirection: 'row', flexWrap: 'wrap' }}>
                
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
                        {connectionState === 'disconnected' && <p style={{ color: 'var(--text-muted)' }}>Desconectado</p>}
                    </div>

                    <div style={{ display: 'flex', gap: 15, marginTop: 30, width: '100%' }}>
                        {connectionState === 'disconnected' && !feedback && (
                            <button onClick={handleStart} style={{ flex: 1, padding: 15, background: 'var(--primary)', color: 'white' }}>
                                📞 Iniciar Entrevista
                            </button>
                        )}
                        
                        {(connectionState === 'connected' || connectionState === 'connecting') && (
                            <button onClick={disconnect} style={{ flex: 1, padding: 15, background: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', color: '#fba9a9' }}>
                                ⛔ Colgar
                            </button>
                        )}
                    </div>

                    {transcript.length > 2 && connectionState === 'disconnected' && !feedback && (
                        <button onClick={handleGenerateFeedback} disabled={generatingFeedback} style={{ marginTop: 15, width: '100%', padding: 15, background: 'var(--accent)', color: 'white' }}>
                            {generatingFeedback ? '🧠 Evaluando Entrevista...' : '📊 Generar Feedback del Tutor'}
                        </button>
                    )}
                </div>

                {/* RIGHT PANEL: Transcript or Feedback */}
                <div style={{ flex: 1.5, minWidth: 350, background: 'rgba(0,0,0,0.2)', padding: 30, borderRadius: 20, border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
                    
                    {feedback ? (
                        <div className="fadeIn">
                            <h3 style={{ color: 'var(--primary)', margin: '0 0 20px 0' }}>🧑‍🏫 Feedback Clínico</h3>
                            <div style={{ lineHeight: 1.6, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                {feedback.split('\n').map((paragraph, idx) => (
                                    <p key={idx}>{paragraph}</p>
                                ))}
                            </div>
                            <button onClick={() => navigate('/units')} style={{ marginTop: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                                Volver al Panel
                            </button>
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
        </div>
    );
};
