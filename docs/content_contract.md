# Contrato de Contenido - Kine Poli App

Este documento define el formato estricto que debe seguir el contenido para ser aceptado por el motor de ingesta.

## 1. Unidades (Unit)
Colecci\u00f3n: `units`
Document ID: `{unit_id}` (ej: `kine_base_01`)

| Campo | Tipo | Descripci\u00f3n |
| :--- | :--- | :--- |
| `unit_id` | string | Identificador \u00fanico de la unidad |
| `title` | string | T\u00edtulo de la unidad |
| `description` | string | Breve resumen del contenido |
| `tags` | array[string]| Etiquetas para categorizaci\u00f3n |
| `order` | number | Orden de aparici\u00f3n |

## 2. Preguntas (Question)
Colecci\u00f3n: `questions`
Document ID: `{question_id}` (ej: `q_kine_001`)

| Campo | Tipo | Descripci\u00f3n |
| :--- | :--- | :--- |
| `unit_id` | string | ID de la unidad a la que pertenece |
| `question_id` | string | Identificador \u00fanico de la pregunta |
| `family_id` | string | ID para agrupar variantes de la misma pregunta |
| `type` | string | `multiple_choice`, `true_false`, etc. |
| `content` | string | El texto de la pregunta |
| `options` | array[object]| `{ text: string, isCorrect: boolean }` |
| `difficulty` | number | 1 (f\u00e1cil) a 5 (dif\u00edcil) |
| `estimated_time_sec`| number | Tiempo estimado de respuesta |
| `hints` | array[string]| M\u00e1ximo 3 pistas |
| `rationale` | string | Explicaci\u00f3n de la respuesta correcta |
| `tags` | array[string]| Etiquetas (habilidad, tema) |

## 3. Casos Cl\u00ednicos (Case)
Colecci\u00f3n: `cases`
Document ID: `{case_id}` (ej: `case_ank_01`)

| Campo | Tipo | Descripci\u00f3n |
| :--- | :--- | :--- |
| `case_id` | string | Identificador \u00fanico del caso |
| `title` | string | T\u00edtulo del caso |
| `description` | string | Historia cl\u00ednica inicial |
| `questions` | array[string]| IDs de preguntas generales (opcional) |
| `type` | string | `linear` o `branched` |
| `nodes` | array[object]| (Solo para branched) Lista de nodos narrativos |
| `soap_schema` | object | (Opcional) Definici\u00f3n de campos SOAP para el final |

### 3.1 Detalle de Nodos (Branched Case Only)
Cada objeto en el array `nodes` sigue esta estructura:

- `node_id`: string
- `narrative`: string (texto inicial del nodo)
- `reveal`: string (texto que aparece tras responder, antes de pasar al siguiente nodo)
- `question_id`: string (ID de la pregunta vinculada a este nodo)
- `next_rules`: map[`choice_index`] -> `node_id` (define el camino seg\u00fan la respuesta)

### 3.2 Resumen SOAP
Define una lista de checklists o selecciones m\u00faltiples para:
- **S**ubjetivo
- **O**bjetivo
- **A**preciaci\u00f3n
- **P**lan (Tratamiento)

