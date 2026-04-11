/**
 * TestGemini.tsx — Página temporal para verificar que Gemini funciona
 * Se elimina después de confirmar que todo está bien.
 */
import { useState } from 'react';
import { generateText } from '../lib/gemini';

export const TestGemini = () => {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const testConnection = async () => {
    setLoading(true);
    setError('');
    setResponse('');
    try {
      const result = await generateText(
        '¿Cuál es el ligamento más comúnmente lesionado en un esguince de tobillo por inversión? Responde en 1 oración.',
        'Eres un profesor de kinesiología musculoesquelética. Responde en español latino (Chile). Sé conciso.'
      );
      setResponse(result);
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
      console.error('Gemini test error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <h1>🧪 Test de Conexión IA</h1>
      <p>Esta página verifica que la API de Gemini funciona correctamente.</p>

      <button onClick={testConnection} disabled={loading} style={{ background: loading ? '#555' : 'var(--accent)' }}>
        {loading ? '⏳ Consultando a la IA...' : '🚀 Probar Conexión con Gemini'}
      </button>

      {response && (
        <div style={{ marginTop: 20, padding: 20, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <h3 style={{ color: '#10b981', margin: '0 0 10px', background: 'none', WebkitTextFillColor: '#10b981' }}>✅ IA Conectada</h3>
          <p style={{ color: 'var(--text-main)', margin: 0 }}>{response}</p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 20, padding: 20, background: 'rgba(248, 113, 113, 0.1)', borderRadius: 12, border: '1px solid rgba(248, 113, 113, 0.3)' }}>
          <h3 style={{ color: '#f87171', margin: '0 0 10px', background: 'none', WebkitTextFillColor: '#f87171' }}>❌ Error</h3>
          <p style={{ color: 'var(--text-main)', margin: 0, fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}
    </div>
  );
};
