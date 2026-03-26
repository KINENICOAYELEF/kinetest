# 📖 KineTest — Documento Maestro de Diseño

> **Versión**: 1.0 — 25 marzo 2026  
> **Estado**: En revisión por el administrador  
> **Propósito**: Este documento es la LEY de la plataforma. Ninguna pregunta se genera, ningún código se escribe, sin seguir estas reglas.

---

## 1. Visión de la Plataforma

KineTest es un **tutor inteligente** para kinesiólogos en formación en el área musculoesquelética y deportiva. No es solo un banco de preguntas — es un sistema de aprendizaje activo que obliga al alumno a pensar rápido, razonar clínicamente y dominar cada unidad antes de avanzar.

### Principios Fundamentales
1. **Si no puedes explicarlo, no lo sabes**: Cada respuesta incluye justificación clínica basada en evidencia.
2. **Anti-memorización**: Variantes de preguntas + pool de alternativas impiden que el alumno memorice patrones.
3. **Presión controlada**: Tiempo limitado por pregunta para desarrollar agilidad de pensamiento.
4. **Dominio obligatorio**: Umbral de 85% para aprobar. No se avanza sin saber.

---

## 2. Catálogo de Unidades

### 2.1 Unidades por Segmento Corporal
Cada una cubre todos los dominios: anatomía, biomecánica, evaluación, entrevista, tratamiento, razonamiento integrado.

| ID | Unidad | Cuaderno NotebookLM |
|---|---|---|
| `unit_cervical` | Cervical | Por definir |
| `unit_lumbar` | Columna Lumbar | Dolor Lumbar Agudo |
| `unit_hombro` | Complejo del Hombro | literatura complejo del Hombro |
| `unit_codo` | Codo | literatura codo muñeca mano |
| `unit_muneca_mano` | Muñeca y Mano | literatura codo muñeca mano |
| `unit_pelvis_cadera` | Pelvis, Cadera e Ingle | literatura cadera e ingle |
| `unit_rodilla` | Rodilla | literatura rodilla + SDPF |
| `unit_tobillo_pie` | Tobillo y Pie | tobillo/pie |

### 2.2 Unidades Temáticas Transversales
Dominios específicos según el tema. No necesariamente tienen evaluación/tratamiento por segmento.

| ID | Unidad | Cuaderno NotebookLM |
|---|---|---|
| `unit_ejercicio_terap` | Ejercicio Terapéutico en Dolor | curso Ejercicio Terapéutico/dolor |
| `unit_diseno_programas` | Diseño de Programas de Entrenamiento | Diseño de Programas |
| `unit_reintegro_dep` | Reintegro Deportivo | Por definir |
| `unit_razonamiento` | Razonamiento Clínico (Eval + Tto) | Por definir |
| `unit_neurofisio_dolor` | Neurofisiología del Dolor | Neurofisiología del dolor |
| `unit_dolor_central` | Dolor y Sensibilización Central | dolor y sensibilización central |
| `unit_eval_msk` | Evaluación Musculoesquelética | Eva. Musculoesquelética |

> [!NOTE]
> El administrador puede crear nuevas unidades en cualquier momento. Esta lista es un punto de partida, no un límite.

---

## 3. Tipos de Preguntas

Cada unidad debe tener una **mezcla diversa** de tipos. No solo casos clínicos.

### 3.1 Tipos Universales

| Tipo | Código | Descripción | Ejemplo |
|---|---|---|---|
| **Conocimiento Directo** | `knowledge` | Datos, definiciones, anatomía | "¿Qué ligamento limita la inversión del tobillo?" |
| **Comprensión** | `comprehension` | Explicar mecanismos o relaciones | "¿Por qué la pronación excesiva del retropié produce rotación medial tibial?" |
| **Evaluación Clínica** | `evaluation` | Tests, escalas, interpretación de resultados | "Un paciente obtiene 6/10 en FAAM. ¿Cómo interpretas este resultado?" |
| **Entrevista / Anamnesis** | `interview` | Banderas rojas, preguntas al paciente, historia | "¿Qué bandera roja descartarías primero en dolor lumbar agudo?" |
| **Tratamiento / Intervención** | `treatment` | Prescripción de ejercicio, dosificación, progresión | "Para un esguince grado II en fase proliferativa, ¿qué ejercicio prescribirías?" |
| **Aplicación Clínica** | `clinical_case` | Caso breve (2-3 líneas) + decisión | Viñeta con paciente real, una sola decisión |
| **Razonamiento Integrado** | `integrated` | Caso más complejo, multi-dominio | Caso que requiere evaluar + decidir tratamiento |

### 3.2 Distribución Sugerida por Unidad Segmental (~150 preguntas)

| Tipo | Cantidad aprox. | % |
|---|---|---|
| Conocimiento Directo | 25 | 17% |
| Comprensión | 20 | 13% |
| Evaluación Clínica | 25 | 17% |
| Entrevista / Anamnesis | 15 | 10% |
| Tratamiento / Intervención | 25 | 17% |
| Aplicación Clínica (caso breve) | 25 | 17% |
| Razonamiento Integrado | 15 | 10% |

> [!IMPORTANT]
> Las unidades temáticas (dolor, biomecánica, etc.) ajustarán esta distribución según su naturaleza. No se fuerza un tipo donde no corresponde.

---

## 4. Formato Obligatorio de Cada Pregunta

### 4.1 Reglas Inquebrantables

1. **4 alternativas** siempre. Exactamente 1 correcta y 3 incorrectas (distractores).
2. **Los distractores deben ser plausibles**. No incluir opciones absurdas que se descarten por sentido común.
3. **El texto de cada alternativa debe tener mínimo 15 caracteres** (evitar opciones vacías).
4. **Justificación clínica** ≥ 300 caracteres. Explica POR QUÉ la correcta es correcta y POR QUÉ las demás no.
5. **Perla de aprendizaje** (learning_pearl): Frase memorable de 1-2 líneas que el alumno recuerda.
6. **3 pistas progresivas**: De sutil a directa. Nunca dan la respuesta, solo guían el razonamiento.
7. **Dificultad**: 1 (básica) a 5 (experto). Distribución: 20% nivel 1-2, 50% nivel 3, 30% nivel 4-5.
8. **Tags**: Mínimo 2 tags descriptivos por pregunta.

### 4.2 Esquema JSON Obligatorio

```json
{
  "question_id": "tobillo_knowledge_01",
  "unit_id": "unit_tobillo_pie",
  "question_type": "knowledge",
  "family_id": "tobillo_lig_lateral",
  "variant": 1,
  "content": "¿Cuál de los siguientes ligamentos del complejo lateral del tobillo es el más frecuentemente lesionado durante un mecanismo de inversión forzada en flexión plantar?",
  "options": [
    {"text": "Ligamento talofibular anterior (LTFA)", "isCorrect": true},
    {"text": "Ligamento calcaneofibular (LCF)", "isCorrect": false},
    {"text": "Ligamento talofibular posterior (LTFP)", "isCorrect": false},
    {"text": "Ligamento deltoideo (fascículo tibiotalar anterior)", "isCorrect": false}
  ],
  "rationale": "El LTFA es el ligamento más débil del complejo lateral y el primero en lesionarse durante la inversión en flexión plantar, que es el mecanismo más común del esguince de tobillo (85% de los casos). El LCF se lesiona secundariamente si la fuerza continúa. El LTFP es el más resistente y rara vez se lesiona de forma aislada. El deltoideo pertenece al complejo medial.",
  "learning_pearl": "LTFA → el más débil, el primero en caer. Inversión + flexión plantar = mecanismo rey del esguince lateral.",
  "hints": [
    "Piensa en qué posición está el pie cuando 'te doblas el tobillo' al caminar por terreno irregular.",
    "De los tres ligamentos laterales, ¿cuál está más tenso en flexión plantar?",
    "Este ligamento es horizontal cuando el pie está en posición neutra y se tensa máximamente con inversión + flexión plantar."
  ],
  "difficulty": 2,
  "tags": ["anatomía", "ligamentos", "esguince", "tobillo"],
  "status": "draft"
}
```

### 4.3 Validación Automática Pre-Ingesta

Antes de subir CUALQUIER lote a Firestore, el script debe verificar:

- [ ] ¿Tiene exactamente 4 opciones?
- [ ] ¿Exactamente 1 opción tiene `isCorrect: true`?
- [ ] ¿Todas las opciones tienen `text` con ≥ 15 caracteres?
- [ ] ¿El `content` tiene ≥ 50 caracteres?
- [ ] ¿El `rationale` tiene ≥ 300 caracteres?
- [ ] ¿Tiene `learning_pearl` no vacío?
- [ ] ¿Tiene exactamente 3 hints no vacíos?
- [ ] ¿`difficulty` está entre 1 y 5?
- [ ] ¿`unit_id` es válido?
- [ ] ¿`question_type` es uno de los 7 tipos definidos?
- [ ] ¿JSON es sintácticamente válido?

**Si alguna pregunta falla una validación, TODO el lote se rechaza. No se suben preguntas parciales.**

---

## 5. Sistema Anti-Memorización

### 5.1 Familias de Variantes
Cada concepto clave genera una **familia** de 3-5 preguntas. Misma idea, pero con:
- Contexto diferente (paciente diferente, deporte diferente, edad diferente)
- Redacción diferente
- El concepto evaluado es el mismo

Ejemplo de familia `tobillo_lig_lateral` (3 variantes):
1. "¿Qué ligamento se lesiona más frecuentemente en inversión?" (pregunta directa)
2. "Un futbolista se tuerce el tobillo en el pasto... ¿qué estructura está más comprometida?" (caso breve)
3. "En la secuencia de lesión del complejo lateral, ¿cuál es la primera estructura en fallar?" (comprensión)

### 5.2 Pool de Alternativas
Para preguntas de tipo `knowledge` y `comprehension`, considerar tener 6-8 alternativas posibles de las cuales se muestran 4 aleatorias (siempre incluyendo la correcta). **Esto es un objetivo futuro** — por ahora, las 4 fijas con shuffle de orden son suficientes.

---

## 6. Estructura de Exámenes

### 6.1 Exámenes de Unidad (Parciales)
- **Cantidad de preguntas**: 40 por examen
- **Selección**: Aleatoria del pool de preguntas aprobadas de la unidad
- **Tiempo**: 90 segundos por pregunta (60 minutos total)
- **Retroalimentación**: La respuesta correcta/incorrecta se muestra **inmediatamente** después de marcar
- **Umbral de aprobación**: 85%
- **Reintentos**: Ilimitados. Cada reintento genera un examen con preguntas **diferentes** (selección aleatoria distinta)
- **Registro**: Se guardan todos los intentos para análisis

### 6.2 Examen Final de Unidad
- Se desbloquea cuando el alumno alcanza ≥ 85% en al menos un examen parcial
- **40 preguntas** aleatorias (distintas al último parcial)
- **Retroalimentación al final** (no después de cada pregunta)
- Si aprueba con ≥ 85%, **la unidad queda aprobada definitivamente**
- Si no aprueba, vuelve al ciclo de parciales

### 6.3 Calificación Global
- El administrador define qué unidades están activas para cada estudiante (ej: 6 de 15)
- La nota final = promedio ponderado de las notas de las unidades activas aprobadas
- Escala de notas chilena (1.0 a 7.0)

---

## 7. Flujo del Estudiante

```
1. Login
2. Ver Unidades Activas (las que el admin activó)
3. Elegir Unidad
4. Modo Tutor (práctica libre)
   - Preguntas aleatorias de la unidad
   - Feedback inmediato + justificación + perla
   - Rating de confianza antes de responder (🔴🟡🟢)
   - Sin tiempo límite
   - Repetición espaciada (SM-2)
5. Examen de Unidad (cuando se sienta preparado)
   - 40 preguntas, 90s c/u
   - Feedback inmediato por pregunta
   - Si ≥ 85% → se desbloquea Examen Final
   - Si < 85% → puede reintentar (preguntas diferentes)
6. Examen Final
   - 40 preguntas, 90s c/u
   - Feedback solo al final
   - Si ≥ 85% → UNIDAD APROBADA ✅
7. Nota Global = promedio de unidades aprobadas
```

---

## 8. Estrategias de Aprendizaje Implementadas

| Estrategia | Implementación | Estado |
|---|---|---|
| **Repetición Espaciada** | Motor SM-2 en Modo Tutor | ✅ Implementado |
| **Retrieval Practice** | El formato de preguntas + exámenes | ✅ Implementado |
| **Desirable Difficulties** | Alternativas muy similares, variantes | ✅ En diseño |
| **Feedback Inmediato** | Justificación + perla tras cada respuesta (tutor y parciales) | ✅ Implementado |
| **Metacognición** | Rating de confianza antes de responder | 🟡 Por implementar |
| **Shuffle de Opciones** | Orden aleatorio de alternativas | ✅ Implementado |
| **Anti-Memorización** | Familias de variantes + exámenes con preguntas distintas | ✅ En diseño |
| **Presión Temporal** | 90s por pregunta en exámenes | 🟡 Por implementar |
| **Interleaving** | Mezclar preguntas de unidades ya aprobadas (futuro) | ⬜ Futuro |

---

## 9. Panel de Administración

### Funcionalidades Requeridas
- [x] Activar/Desactivar unidades (`/admin/units`)
- [x] Aprobar/Rechazar/Editar preguntas (`/admin/content`)
- [ ] Definir unidades activas por estudiante
- [ ] Calcular nota global por estudiante
- [ ] Aprobación masiva de preguntas (seleccionar varias + aprobar)
- [ ] Ocultar "Examen de Viernes" del menú
- [ ] Ver estadísticas de rendimiento por unidad/estudiante

---

## 10. Proceso de Generación de Contenido (Paso a Paso)

> **Este proceso es INFALIBLE. Se sigue exactamente o no se genera nada.**

### Paso 1: Identificar el Cuaderno y Temario
- Seleccionar la unidad objetivo
- Identificar el cuaderno de NotebookLM asociado
- Obtener el temario/índice del cuaderno

### Paso 2: Planificar la Distribución
- Definir cuántas preguntas de cada tipo (ver §3.2)
- Definir las familias conceptuales (temas clave que deben cubrirse)
- Generar en lotes de **10 preguntas máximo** por solicitud

### Paso 3: Generar con el Prompt Maestro
- Usar notebook_query con el prompt estándar (ver §11)
- Especificar el tipo de pregunta, la familia y el rango de dificultad
- NUNCA pedir más de 10 preguntas por prompt

### Paso 4: Validar el JSON
- Ejecutar el script de validación (`validate_batch.py`)
- Si hay errores → corregir y re-validar
- **No avanzar al paso 5 sin validación 100%**

### Paso 5: Revisión Humana (Admin)
- Subir como `draft` a Firestore
- El admin revisa en `/admin/content`
- Aprueba, edita o descarta

### Paso 6: Activar
- Cuando la unidad tiene suficientes preguntas aprobadas → activar en `/admin/units`

---

## 11. Prompt Maestro para Generación

```
Eres un educador experto en kinesiología musculoesquelética y deportiva.
Genera exactamente {N} preguntas de tipo "{type}" para la unidad "{unit}".

REGLAS OBLIGATORIAS:
1. Formato: JSON array. Cada pregunta sigue EXACTAMENTE este esquema: [ver §4.2]
2. Cada pregunta tiene EXACTAMENTE 4 alternativas con texto completo (≥15 caracteres cada una).
3. EXACTAMENTE 1 alternativa es correcta (isCorrect: true).
4. Los distractores son PLAUSIBLES — errores comunes que un estudiante podría cometer.
5. La justificación (rationale) tiene ≥300 caracteres y explica por qué la correcta es correcta Y por qué las demás no.
6. La perla de aprendizaje es una frase memorable de 1-2 líneas.
7. Las 3 pistas son PROGRESIVAS: de sutil a directa, nunca dan la respuesta.
8. Dificultad: {difficulty_range} (1=básica, 5=experto).
9. Basa TODO el contenido en las fuentes del cuaderno. No inventes datos.
10. NO hagas todas las preguntas iguales. Varía la redacción, el contexto y el ángulo.

TIPOS DE PREGUNTA:
- knowledge: Dato factual, definición, anatomía básica. Pregunta directa.
- comprehension: Explicar un mecanismo, relacionar conceptos.
- evaluation: Interpretar un test o escala clínica.
- interview: Anamnesis, banderas rojas, preguntas al paciente.
- treatment: Prescripción de ejercicio, dosificación, progresión terapéutica.
- clinical_case: Viñeta clínica breve (2-3 líneas) + una decisión.
- integrated: Caso clínico complejo que cruza evaluación + tratamiento.

Genera SOLO preguntas de tipo: {type}
Familia conceptual: {family}
Rango de dificultad: {difficulty_range}
```

---

## 12. Cambios de Código Pendientes

| Cambio | Prioridad | Archivo(s) |
|---|---|---|
| Ocultar "Examen de Viernes" | Alta | `Home.tsx` |
| Timer de 90s por pregunta en exámenes | Alta | `UnitExam.tsx` |
| Rating de confianza (🔴🟡🟢) en Modo Tutor | Media | `TutorMode.tsx` |
| Examen Final (desbloqueo + feedback al final) | Alta | Nuevo: `UnitFinalExam.tsx` |
| Definir unidades activas por estudiante | Alta | `AdminUnits.tsx`, Firestore |
| Nota global por estudiante | Media | `StudentDashboard.tsx` |
| Aprobación masiva | Media | `AdminContent.tsx` |
| Script de validación pre-ingesta | Alta | Nuevo: `validate_batch.py` |
| Feedback inmediato en parciales | Media | `UnitExam.tsx` |
| Preguntas diferentes en reintentos | Alta | `UnitExam.tsx` |
