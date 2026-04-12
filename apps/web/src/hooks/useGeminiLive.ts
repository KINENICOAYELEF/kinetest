import { useState, useRef, useCallback } from 'react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseGeminiLiveProps {
    systemInstruction?: string;
}

export function useGeminiLive({ systemInstruction }: UseGeminiLiveProps = {}) {
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [volume, setVolume] = useState(0);

    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    // Audio playback queue
    const playbackNextTimeRef = useRef<number>(0);

    const connect = useCallback(async () => {
        if (connectionState !== 'disconnected') return;
        setConnectionState('connecting');

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WebSocket Connected");
                setConnectionState('connected');
                
                // Send Setup Frame
                const setupMsg = {
                    setup: {
                        model: "models/gemini-2.5-flash", // Good stable model for Live
                        systemInstruction: {
                            parts: [{ text: systemInstruction || "Eres un paciente de prueba." }]
                        },
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: "Aoede" // Example voice
                                    }
                                }
                            }
                        }
                    }
                };
                ws.send(JSON.stringify(setupMsg));

                startMicrophone();
            };

            ws.onmessage = async (event) => {
                let msg;
                if (event.data instanceof Blob) {
                    const text = await event.data.text();
                    msg = JSON.parse(text);
                } else {
                    msg = JSON.parse(event.data);
                }
                handleServerMessage(msg);
            };

            ws.onerror = (err) => {
                console.error("WebSocket Error:", err);
                setConnectionState('error');
            };

            ws.onclose = () => {
                console.log("WebSocket Disconnected");
                setConnectionState('disconnected');
                stopMicrophone(); // Make sure to stop mic when closed
            };

        } catch (e) {
            console.error(e);
            setConnectionState('error');
        }
    }, [systemInstruction, connectionState]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        stopMicrophone();
        setConnectionState('disconnected');
        // We do not clear transcript so the user can export it
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

            const audioCtx = new AudioContext({ sampleRate: 16000 });
            audioCtxRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            source.connect(processor);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Calculate volume for UI
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                setVolume(rms);

                // Convert float32 to PCM 16-bit
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    let s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Convert pure binary array to ArrayBuffer, then base64
                // Uint8Array over Int16Array buffer
                const pcm8 = new Uint8Array(pcm16.buffer);
                
                // Using a fast binary to base64 conversion
                let binary = '';
                const len = pcm8.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(pcm8[i]);
                }
                const b64Data = btoa(binary);

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        realtimeInput: {
                            mediaChunks: [{
                                mimeType: "audio/pcm;rate=16000",
                                data: b64Data
                            }]
                        }
                    }));
                }
            };
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
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleServerMessage = (msg: any) => {
        // Track the transcript text if the model decides to send it back
        if (msg.serverContent && msg.serverContent.modelTurn) {
            const parts = msg.serverContent.modelTurn.parts;
            setIsSpeaking(true);
            
            // Auto turn-off speaking after a small delay
            // A more robust implementation would hook into audio node 'onended'
            setTimeout(() => setIsSpeaking(false), 2000); 

            let textChunk = "";
            let audioB64 = "";

            parts.forEach((p: any) => {
                if (p.text) textChunk += p.text;
                if (p.inlineData && p.inlineData.data) {
                    audioB64 = p.inlineData.data;
                }
            });

            if (textChunk) {
                setTranscript(prev => [...prev, { role: 'model', text: textChunk }]);
            }

            if (audioB64 && audioCtxRef.current) {
                playAudio(audioB64);
            }
        }
        
        if (msg.serverContent && msg.serverContent.turnComplete) {
            // Model finished its turn
            setIsSpeaking(false);
        }
    };

    const playAudio = async (base64Audio: string) => {
        const audioCtx = audioCtxRef.current;
        if (!audioCtx) return;

        // Convert base64 to array buffer
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Decode PCM
        // The Live API returns raw PCM 24kHz 16-bit by default unless specified
        // But the WebAudio decodeAudioData requires a valid WAV/MP3 header.
        // Wait, Gemini raw PCM lacks headers! We have to manually create the AudioBuffer.
        
        // Let's assume 16-bit 24kHz 1-channel PCM data (Gemini's default output).
        const sampleRate = 24000;
        const pcm16 = new Int16Array(bytes.buffer);
        const audioBuffer = audioCtx.createBuffer(1, pcm16.length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < pcm16.length; i++) {
            channelData[i] = pcm16[i] / 32768.0;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        
        // Schedule sequentially to avoid overlap
        if (playbackNextTimeRef.current < audioCtx.currentTime) {
            playbackNextTimeRef.current = audioCtx.currentTime;
        }
        
        source.start(playbackNextTimeRef.current);
        playbackNextTimeRef.current += audioBuffer.duration;
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
