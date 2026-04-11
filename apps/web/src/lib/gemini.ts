/**
 * gemini.ts — Conexión con la API de Gemini (IA)
 * 
 * Este módulo permite que la app se comunique con los modelos de IA de Google.
 * Se usa para:
 * - Generar preguntas y casos clínicos automáticamente (admin)
 * - Evaluar respuestas abiertas de los alumnos (runtime)
 * - Verificar calidad del contenido generado (Search Grounding)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Obtener la API key del archivo .env (seguro, no se sube a GitHub)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

if (!API_KEY) {
  console.error('⚠️ GEMINI API KEY no encontrada. Revisa el archivo .env');
}

// Inicializar el cliente de Gemini
const genAI = new GoogleGenerativeAI(API_KEY || '');

// ============================================================
// MODELOS DISPONIBLES (free tier)
// ============================================================

/**
 * Modelo principal para generar texto (preguntas, casos, evaluaciones)
 * - 500 requests por día
 * - 15 requests por minuto
 */
export const getFlashLiteModel = () => {
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

/**
 * Modelo de embeddings para comparar textos por significado
 * - 1,000 requests por día
 * - Útil para evaluar respuestas abiertas de alumnos
 */
export const getEmbeddingModel = () => {
  return genAI.getGenerativeModel({ model: 'text-embedding-004' });
};

// ============================================================
// FUNCIONES DE UTILIDAD
// ============================================================

/**
 * Genera texto con Gemini Flash Lite
 * @param prompt - La instrucción para la IA
 * @param systemPrompt - Contexto/rol de la IA (opcional)
 * @returns El texto generado
 */
export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const config: any = {};
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }
  
  const modelWithConfig = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    ...config
  });
  
  const result = await modelWithConfig.generateContent(prompt);
  return result.response.text();
}

/**
 * Genera contenido JSON estructurado con Gemini
 * @param prompt - La instrucción para la IA
 * @param systemPrompt - Contexto/rol de la IA
 * @returns El objeto JSON parseado
 */
export async function generateJSON<T = any>(prompt: string, systemPrompt?: string): Promise<T> {
  const text = await generateText(
    prompt + '\n\nRespuestas SOLO en JSON válido. Sin markdown, sin ```json, sin texto adicional.',
    systemPrompt
  );
  
  // Limpiar posibles artifacts de markdown
  const cleaned = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  
  return JSON.parse(cleaned);
}

/**
 * Obtiene el embedding (vector numérico) de un texto
 * Útil para comparar semánticamente lo que dice el alumno vs la respuesta esperada
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Calcula la similitud coseno entre dos vectores de embedding
 * Resultado: 0 = totalmente distintos, 1 = idénticos en significado
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Evalúa si la respuesta del alumno es semánticamente similar a la esperada
 * @returns score de 0 a 1
 */
export async function evaluateSemanticSimilarity(
  studentResponse: string,
  expectedAnswer: string
): Promise<number> {
  const [studentEmb, expectedEmb] = await Promise.all([
    getEmbedding(studentResponse),
    getEmbedding(expectedAnswer)
  ]);
  return cosineSimilarity(studentEmb, expectedEmb);
}

/**
 * Usa Gemini para evaluar una respuesta abierta del alumno con una rúbrica
 * @returns Objeto con score, feedback y conceptos faltantes
 */
export async function evaluateOpenResponse(
  studentResponse: string,
  expectedAnswer: string,
  rubric: string
): Promise<{ score: number; feedback: string; missing: string[] }> {
  const systemPrompt = `Eres un evaluador clínico experto en kinesiología musculoesquelética y deportiva.
Evalúas respuestas de alumnos en práctica profesional.
Sé constructivo pero riguroso. Usa español latino (Chile).
No seas condescendiente.`;

  const prompt = `Evalúa la siguiente respuesta del estudiante.

RESPUESTA ESPERADA:
${expectedAnswer}

RESPUESTA DEL ESTUDIANTE:
${studentResponse}

RÚBRICA DE EVALUACIÓN:
${rubric}

Responde SOLO con este JSON:
{
  "score": <número de 0 a 100>,
  "feedback": "<retroalimentación constructiva en 2-3 oraciones>",
  "missing": ["<concepto faltante 1>", "<concepto faltante 2>"]
}`;

  return generateJSON(prompt, systemPrompt);
}

// Exportar el cliente base por si se necesita para configuraciones avanzadas
export { genAI };
