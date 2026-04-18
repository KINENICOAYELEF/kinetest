import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Models ordered by RPD quota (highest first for daily sustainability)
const TEXT_MODELS = [
    'gemma-4-26b-it',                // 1,500 RPD — Primary evaluator
    'gemini-3.1-flash-lite-preview', // 500 RPD — Backup
    'gemini-2.5-flash',              // 20 RPD — Emergency
];

interface UseGeminiTextOptions {
    parseJson?: boolean;
}

export function useGeminiText(options: UseGeminiTextOptions = {}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async (prompt: string, systemInstruction?: string): Promise<any> => {
        setLoading(true);
        setError(null);

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setError('API Key no configurada');
            setLoading(false);
            return null;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        let lastError: any = null;

        for (const modelName of TEXT_MODELS) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    ...(systemInstruction ? { systemInstruction } : {}),
                });

                const result = await model.generateContent(prompt);
                const text = result.response.text();

                if (options.parseJson) {
                    // Strip markdown code fences if present
                    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    try {
                        const parsed = JSON.parse(cleaned);
                        setLoading(false);
                        return parsed;
                    } catch {
                        // If JSON parse fails, return raw text
                        setLoading(false);
                        return text;
                    }
                }

                setLoading(false);
                return text;
            } catch (err: any) {
                lastError = err;
                console.warn(`Model ${modelName} failed:`, err.message);
                continue;
            }
        }

        setError(`Todos los modelos fallaron: ${lastError?.message}`);
        setLoading(false);
        return null;
    }, [options.parseJson]);

    return { generate, loading, error };
}
