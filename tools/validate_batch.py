#!/usr/bin/env python3
"""
validate_batch.py — Validador obligatorio pre-ingesta (Bible v1)

Uso:
    python3 tools/validate_batch.py ruta/al/batch.json

Reglas (de platform_design_bible.md §4.3):
  - Exactamente 4 opciones por pregunta
  - Exactamente 1 opción correcta
  - Texto de opción ≥ 15 caracteres
  - Contenido de pregunta ≥ 50 caracteres
  - Justificación (rationale) ≥ 300 caracteres
  - learning_pearl no vacío
  - Exactamente 3 hints no vacíos
  - difficulty entre 1 y 5
  - unit_id presente
  - question_type es uno de los 7 válidos
  - JSON sintácticamente válido

Si ALGUNA pregunta falla, TODO el lote se rechaza.
"""

import json
import sys
from pathlib import Path

VALID_TYPES = {"knowledge", "comprehension", "evaluation", "interview", "treatment", "clinical_case", "integrated"}
MIN_OPTION_LEN = 15
MIN_CONTENT_LEN = 50
MIN_RATIONALE_LEN = 300
REQUIRED_HINTS = 3
MIN_DIFFICULTY = 1
MAX_DIFFICULTY = 5


def validate_question(q: dict, index: int) -> list[str]:
    """Validates a single question, returns list of error strings."""
    errors = []
    qid = q.get("question_id", f"pregunta_{index}")

    # 1. content
    content = q.get("content", "")
    if not content or len(content) < MIN_CONTENT_LEN:
        errors.append(f"[{qid}] ❌ 'content' tiene {len(content)} chars (mín {MIN_CONTENT_LEN})")

    # 2. options
    options = q.get("options", [])
    if len(options) != 4:
        errors.append(f"[{qid}] ❌ Tiene {len(options)} opciones (debe ser exactamente 4)")
    else:
        correct_count = sum(1 for o in options if o.get("isCorrect"))
        if correct_count != 1:
            errors.append(f"[{qid}] ❌ Tiene {correct_count} opciones correctas (debe ser exactamente 1)")
        
        for i, opt in enumerate(options):
            text = opt.get("text", "")
            if not text or len(text) < MIN_OPTION_LEN:
                errors.append(f"[{qid}] ❌ Opción {i+1} tiene {len(text)} chars (mín {MIN_OPTION_LEN}): '{text[:30]}...'")

    # 3. rationale
    rationale = q.get("rationale", "")
    if not rationale or len(rationale) < MIN_RATIONALE_LEN:
        errors.append(f"[{qid}] ❌ 'rationale' tiene {len(rationale)} chars (mín {MIN_RATIONALE_LEN})")

    # 4. learning_pearl
    pearl = q.get("learning_pearl", "")
    if not pearl or len(pearl.strip()) == 0:
        errors.append(f"[{qid}] ❌ 'learning_pearl' está vacío")

    # 5. hints
    hints = q.get("hints", [])
    if len(hints) != REQUIRED_HINTS:
        errors.append(f"[{qid}] ❌ Tiene {len(hints)} hints (debe ser exactamente {REQUIRED_HINTS})")
    else:
        for i, h in enumerate(hints):
            if not h or len(h.strip()) == 0:
                errors.append(f"[{qid}] ❌ Hint {i+1} está vacío")

    # 6. difficulty
    diff = q.get("difficulty")
    if diff is None or not (MIN_DIFFICULTY <= diff <= MAX_DIFFICULTY):
        errors.append(f"[{qid}] ❌ 'difficulty' es {diff} (debe ser {MIN_DIFFICULTY}-{MAX_DIFFICULTY})")

    # 7. unit_id
    if not q.get("unit_id"):
        errors.append(f"[{qid}] ❌ 'unit_id' falta o está vacío")

    # 8. question_type
    qtype = q.get("question_type", "")
    if qtype not in VALID_TYPES:
        errors.append(f"[{qid}] ❌ 'question_type' es '{qtype}' (válidos: {', '.join(sorted(VALID_TYPES))})")

    # 9. question_id
    if not q.get("question_id"):
        errors.append(f"[{qid}] ❌ 'question_id' falta o está vacío")

    return errors


def validate_file(filepath: str) -> bool:
    """Validates an entire batch file. Returns True if all pass."""
    path = Path(filepath)
    
    if not path.exists():
        print(f"❌ Archivo no encontrado: {filepath}")
        return False

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ JSON inválido: {e}")
        return False

    questions = data if isinstance(data, list) else data.get("questions", [])
    
    if not questions:
        print("❌ No se encontraron preguntas en el archivo")
        return False

    print(f"\n📋 Validando {len(questions)} preguntas de: {path.name}")
    print("=" * 60)

    all_errors = []
    for i, q in enumerate(questions):
        errs = validate_question(q, i)
        all_errors.extend(errs)

    if all_errors:
        print(f"\n🔴 LOTE RECHAZADO — {len(all_errors)} errores encontrados:\n")
        for err in all_errors:
            print(f"  {err}")
        print(f"\n⚠️  Corrige TODOS los errores antes de intentar subir.")
        return False
    else:
        print(f"\n✅ TODAS LAS {len(questions)} PREGUNTAS PASARON LA VALIDACIÓN")
        print("   Puedes proceder con la ingesta a Firestore.")
        
        # Print summary stats
        types = {}
        diffs = {}
        for q in questions:
            t = q.get("question_type", "unknown")
            d = q.get("difficulty", 0)
            types[t] = types.get(t, 0) + 1
            diffs[d] = diffs.get(d, 0) + 1
        
        print(f"\n📊 Distribución por tipo:")
        for t, c in sorted(types.items()):
            print(f"   {t}: {c}")
        print(f"\n📊 Distribución por dificultad:")
        for d, c in sorted(diffs.items()):
            print(f"   Nivel {d}: {c}")
        
        return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 tools/validate_batch.py <archivo.json>")
        sys.exit(1)
    
    success = validate_file(sys.argv[1])
    sys.exit(0 if success else 1)
