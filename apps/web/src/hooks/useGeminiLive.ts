import { useState, useRef, useCallback } from 'react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseGeminiLiveProps {
    systemInstruction?: string;
    voiceName?: string;
}

// Models available in user's account for Live API:
// 1. "models/gemini-2.5-flash-native-audio-latest" → "Gemini 2.5 Flash Native Audio Dialog"
// 2. "models/gemini-3.1-flash-live-preview"         → "Gemini 3 Flash Live"
const LIVE_MODEL = "models/gemini-3.1-flash-live-preview";

export function useGeminiLive({ systemInstruction, voiceName = "Aoede" }: UseGeminiLiveProps = {}) {
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [volume, setVolume] = useState(0);

    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playbackCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const setupDoneRef = useRef(false);

    // Audio playback queue
    const playbackNextTimeRef = useRef<number>(0);

    const connect = useCallback(async () => {
        if (connectionState !== 'disconnected') return;
        setConnectionState('connecting');
        setupDoneRef.current = false;

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        // Official endpoint from Google docs: v1beta
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WebSocket Connected. Sending setup...");
                
                // Step 1: Send Setup Frame FIRST (required before any data)
                // Based on official docs: https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket
                const setupMsg = {
                    setup: {
                        model: LIVE_MODEL,
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: voiceName
                                    }
                                }
                            }
                        },
                        systemInstruction: {
                            parts: [{ text: systemInstruction || "Eres un paciente de prueba. Responde en español." }]
                        }
                    }
                };
                ws.send(JSON.stringify(setupMsg));
                console.log("Setup message sent for model:", LIVE_MODEL);
            };

            ws.onmessage = async (event) => {
                let msg;
                if (event.data instanceof Blob) {
                    const text = await event.data.text();
                    msg = JSON.parse(text);
                } else {
                    msg = JSON.parse(event.data);
                }
                
                // The first message back should be a setupComplete
                if (msg.setupComplete) {
                    console.log("Setup complete! Starting microphone...");
                    setupDoneRef.current = true;
                    setConnectionState('connected');
                    startMicrophone();
                    return;
                }

                handleServerMessage(msg);
            };

            ws.onerror = (err) => {
                console.error("WebSocket Error:", err);
                setConnectionState('error');
            };

            ws.onclose = (event) => {
                console.log("WebSocket Disconnected. Code:", event.code, "Reason:", event.reason);
                setConnectionState('disconnected');
                stopMicrophone();
            };

        } catch (e) {
            console.error(e);
            setConnectionState('error');
        }
    }, [systemInstruction, voiceName, connectionState]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        stopMicrophone();
        setConnectionState('disconnected');
    }, []);

    const startMicrophone = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            } });
            streamRef.current = stream;

            // Create a separate AudioContext for recording at 16kHz
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            audioCtxRef.current = audioCtx;

            // Create a separate playback context at 24kHz for model audio output
            const playbackCtx = new AudioContext({ sampleRate: 24000 });
            playbackCtxRef.current = playbackCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            source.connect(processor);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
                if (!setupDoneRef.current) return; // Don't send audio until setup is confirmed
                
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Calculate volume for UI visualization
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                setVolume(rms);

                // Convert float32 to PCM 16-bit little-endian
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Convert to base64
                const pcm8 = new Uint8Array(pcm16.buffer);
                let binary = '';
                const len = pcm8.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(pcm8[i]);
                }
                const b64Data = btoa(binary);

                // Send using the NEW correct format from official docs:
                // realtimeInput.audio (NOT realtimeInput.mediaChunks)
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        realtimeInput: {
                            audio: {
                                data: b64Data,
                                mimeType: "audio/pcm;rate=16000"
                            }
                        }
                    }));
                }
            };
            console.log("Microphone started. Streaming audio...");
        } catch (e) {
            console.error("Microphone error:", e);
        }
    };

    const stopMicrophone = () => {
        if (processorRef.current && audioCtxRef.current) {
            processorRef.current.disconnect();
            audioCtxRef.current.close();
            processorRef.current = null;
            audioCtxRef.current = null;
        }
        if (playbackCtxRef.current) {
            playbackCtxRef.current.close();
            playbackCtxRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleServerMessage = (msg: any) => {
        if (msg.serverContent) {
            const sc = msg.serverContent;

            // Handle model audio/text turn (play audio chunks)
            if (sc.modelTurn && sc.modelTurn.parts) {
                setIsSpeaking(true);

                sc.modelTurn.parts.forEach((p: any) => {
                    // Audio content - play it
                    if (p.inlineData && p.inlineData.data) {
                        playAudio(p.inlineData.data);
                    }
                });
            }

            // Buffer user input transcription (arrives word by word)
            if (sc.inputTranscription && sc.inputTranscription.text) {
                const fragment = sc.inputTranscription.text;
                setTranscript(prev => {
                    // If the last entry is from the user AND we're still in the same turn, append to it
                    if (prev.length > 0 && prev[prev.length - 1].role === 'user') {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'user',
                            text: updated[updated.length - 1].text + fragment
                        };
                        return updated;
                    }
                    // Otherwise start a new user entry
                    return [...prev, { role: 'user', text: fragment }];
                });
            }

            // Buffer model output transcription (arrives word by word)
            if (sc.outputTranscription && sc.outputTranscription.text) {
                const fragment = sc.outputTranscription.text;
                setTranscript(prev => {
                    // If the last entry is from the model AND we're still in the same turn, append to it
                    if (prev.length > 0 && prev[prev.length - 1].role === 'model') {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'model',
                            text: updated[updated.length - 1].text + fragment
                        };
                        return updated;
                    }
                    // Otherwise start a new model entry
                    return [...prev, { role: 'model', text: fragment }];
                });
            }

            // Model finished its turn
            if (sc.turnComplete) {
                setIsSpeaking(false);
            }
        }
    };

    const playAudio = (base64Audio: string) => {
        const playbackCtx = playbackCtxRef.current;
        if (!playbackCtx) return;

        // Convert base64 to raw bytes
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Gemini Live API outputs raw PCM 24kHz 16-bit mono by default
        const sampleRate = 24000;
        const pcm16 = new Int16Array(bytes.buffer);
        
        if (pcm16.length === 0) return;
        
        const audioBuffer = playbackCtx.createBuffer(1, pcm16.length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < pcm16.length; i++) {
            channelData[i] = pcm16[i] / 32768.0;
        }

        const source = playbackCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackCtx.destination);
        
        // Schedule sequentially to avoid overlap
        if (playbackNextTimeRef.current < playbackCtx.currentTime) {
            playbackNextTimeRef.current = playbackCtx.currentTime;
        }
        
        source.start(playbackNextTimeRef.current);
        playbackNextTimeRef.current += audioBuffer.duration;
        
        // Auto-clear speaking state when playback finishes
        source.onended = () => {
            setIsSpeaking(false);
        };
    };

    return {
        connect,
        disconnect,
        connectionState,
        transcript,
        isSpeaking,
        volume
    };
}
