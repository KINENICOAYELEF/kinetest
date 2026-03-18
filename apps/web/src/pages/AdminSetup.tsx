import { useState } from 'react';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export const AdminSetup = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const navigate = useNavigate();

  const addLog = (msg: string) => setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const runSetup = async () => {
    setLoading(true);
    setResults([]);
    addLog("Iniciando Setup Wizard...");

    try {
      const batch = writeBatch(db);

      // 1. Configuración Global
      addLog("Configurando /config/app...");
      const configRef = doc(db, 'config', 'app');
      batch.set(configRef, {
        passPercentage: 70,
        minGrade: 1.0,
        maxGrade: 7.0,
        examDurationMinutes: 45,
        adaptiveSettings: {
          alphaBase: 0.1,
          bonusDaysCorrect: 3
        },
        updatedAt: serverTimestamp()
      });

      // 2. Grupo por defecto
      addLog("Creando grupo /groups/default...");
      const groupRef = doc(db, 'groups', 'default');
      batch.set(groupRef, {
        name: "Generación 2024",
        active: true,
        weeklyPlan: {
          currentWeek: 1,
          focusTags: ["columna", "biomecanica"]
        }
      });

      // 3. Unidad DEMO
      addLog("Creando Unidad DEMO...");
      const unitId = "unit_demo_01";
      const unitRef = doc(db, 'units', unitId);
      batch.set(unitRef, {
        unit_id: unitId,
        title: "Unidad DEMO: Fundamentos Kinésicos",
        description: "Esta unidad contiene preguntas de prueba para verificar el funcionamiento del sistema.",
        tags: ["demo", "basico"],
        order: 1
      });

      // 4. Tutor Cards DEMO
      addLog("Añadiendo Tutor Cards...");
      const cardRef = doc(db, 'units', unitId, 'tutor_cards', 'card_demo_1');
      batch.set(cardRef, {
        id: "card_demo_1",
        title: "El Ciclo de la Marcha",
        content: "El ciclo de la marcha comienza con el contacto inicial del talón y termina con el siguiente contacto del mismo talón. Se divide en fase de apoyo (60%) y fase de oscilación (40%).",
        tag: "biomecanica"
      });

      // 5. Preguntas DEMO (Cargaremos 5 preguntas representativas para no exceder el batch inicial, luego se pueden cargar mas)
      addLog("Cargando Preguntas DEMO...");
      const demoQuestions = [
        {
          id: "q_demo_01",
          content: "¿Cuál es el porcentaje aproximado de la fase de apoyo en el ciclo de la marcha normal?",
          options: [
            { text: "40%", isCorrect: false },
            { text: "60%", isCorrect: true },
            { text: "20%", isCorrect: false },
            { text: "80%", isCorrect: false }
          ],
          difficulty: 2,
          tags: ["biomecanica", "marcha"],
          rationale: "En una marcha normal, la fase de apoyo constituye aproximadamente el 60% del ciclo.",
          unit_id: unitId
        },
        {
          id: "q_demo_02",
          content: "¿Qué músculo es el principal agonista en la flexión de cadera?",
          options: [
            { text: "Glúteo Mayor", isCorrect: false },
            { text: "Psoas Ilíaco", isCorrect: true },
            { text: "Bíceps Femoral", isCorrect: false },
            { text: "Cuádriceps", isCorrect: false }
          ],
          difficulty: 1,
          tags: ["anatomia", "cadera"],
          rationale: "El psoas ilíaco es el flexor más potente de la cadera.",
          unit_id: unitId
        }
      ];

      demoQuestions.forEach(q => {
        const qRef = doc(db, 'questions', q.id);
        batch.set(qRef, q);
      });

      // 6. Caso Clínico DEMO
      addLog("Cargando Caso Clínico DEMO...");
      const caseRef = doc(db, 'cases', 'case_demo_1');
      batch.set(caseRef, {
        case_id: "case_demo_1",
        unit_id: unitId,
        title: "Esguince de Tobillo Grado II",
        description: "Paciente deportista de 22 años que sufre inversión forzada de tobillo durante un partido de fútbol. Presenta edema y dolor localizado.",
        type: "linear",
        nodes: [
          {
            node_id: "n1",
            narrative: "El paciente llega a la consulta con apoyo doloroso. Se observa aumento de volumen en la zona lateral del tobillo derecho.",
            question_id: "q_demo_02", // Reutilizamos o mapeamos
            reveal: "La prueba de cajón anterior es positiva, sugiriendo compromiso del ligamento talofibular anterior."
          }
        ],
        soap_schema: {
          subjective: ["Dolor agudo", "Mecanismo de inversión"],
          objective: ["Edema perimaleolar", "Cajón anterior (+)", "Equimosis"],
          assessment: ["Esguince grado II"],
          plan: ["RICE inicial", "Propiocepción temprana"]
        }
      });

      await batch.commit();
      addLog("✅ ¡Proceso completado con éxito!");
      addLog("Ya puedes volver al inicio y ver el contenido.");

    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ background: 'none', WebkitTextFillColor: 'white' }}>Setup Wizard</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 30 }}>
          Este asistente inicializará la base de datos con configuraciones y datos de prueba (Unidad DEMO) para que la app sea funcional.
        </p>

        <button 
          onClick={runSetup} 
          disabled={loading}
          style={{ 
            background: loading ? 'gray' : 'var(--primary)',
            fontSize: '1.1rem',
            padding: '15px 30px'
          }}
        >
          {loading ? 'Inicializando...' : '🚀 Inicializar KineTest'}
        </button>

        <div style={{ 
          marginTop: 40, 
          textAlign: 'left', 
          background: 'rgba(0,0,0,0.2)', 
          padding: 20, 
          borderRadius: 12,
          maxHeight: 300,
          overflowY: 'auto',
          fontSize: '0.9rem',
          fontFamily: 'monospace'
        }}>
          <h4 style={{ marginTop: 0, color: 'var(--text-muted)' }}>Log de ejecución:</h4>
          {results.length === 0 && <p style={{ color: '#555' }}>Esperando inicio...</p>}
          {results.map((r, i) => (
            <div key={i} style={{ marginBottom: 4, color: r.includes('❌') ? '#f87171' : r.includes('✅') ? '#4ade80' : 'white' }}>
              {r}
            </div>
          ))}
        </div>

        <button 
          onClick={() => navigate('/home')} 
          className="link-btn"
          style={{ marginTop: 20, background: 'none', border: 'none' }}
        >
          ← Volver al Home
        </button>
      </div>
    </div>
  );
};
