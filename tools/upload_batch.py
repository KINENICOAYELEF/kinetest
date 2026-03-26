#!/usr/bin/env python3
"""
upload_batch.py — Sube un lote de preguntas de NotebookLM a Firestore.

Uso:
    python3 tools/upload_batch.py ruta/al/batch.json

Este script primero ejecuta la validación estricta de `validate_batch.py`.
Si el archivo no pasa la validación, NO se sube nada.
Si pasa, sube las preguntas a la colección `questions` con status='draft'.
"""

import sys
import json
import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore

sys.path.append(str(Path(__file__).parent))

# Importar el validador
try:
    from validate_batch import validate_file
except ImportError:
    print("❌ Error: No se encontró validate_batch.py en el mismo directorio.")
    sys.exit(1)

def initialize_firebase():
    if not firebase_admin._apps:
        # Busca el serviceAccount local
        cert_path = Path(__file__).parent / "ingest_notebooklm" / "serviceAccountKey.json"
        
        # Fallback al nivel root o donde esté
        if not cert_path.exists():
            cert_path = Path("/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json")
            
        if not cert_path.exists():
            print(f"❌ Error: Service Account no encontrado en {cert_path}")
            sys.exit(1)
            
        cred = credentials.Certificate(str(cert_path))
        firebase_admin.initialize_app(cred)
    return firestore.client()

def upload_validated_batch(filepath: str):
    # 1. Validar estrictamente el lote
    print("🔍 Iniciando validación estricta (Bible v1)...")
    is_valid = validate_file(filepath)
    
    if not is_valid:
        print("\n⛔ CARGA CANCELADA: El archivo no cumple con los estándares de la plataforma.")
        sys.exit(1)
        
    print("\n🚀 Procediendo a la ingesta en Firestore...")
    db = initialize_firebase()
    
    # 2. Cargar datos
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    questions = data if isinstance(data, list) else data.get("questions", [])
    
    # 3. Subir individualmente asegurando status='draft'
    batch = db.batch()
    count = 0
    
    for q in questions:
        qid = q.get("question_id")
        
        # Asegurar estado borrador y campos por defecto si faltaran (aunque ya los validamos)
        q["status"] = "draft"
        if "approved" in q:
            del q["approved"] # Evitar inyecciones accidentales
            
        doc_ref = db.collection("questions").document(qid)
        batch.set(doc_ref, q, merge=True)
        count += 1
        
        # Firestore batch supports up to 500 operations
        if count % 450 == 0:
            batch.commit()
            print(f"  ... {count} preguntas subidas ...")
            batch = db.batch()
            
    if count % 450 != 0:
        batch.commit()
        
    print(f"\n✅ ÉXITO: {count} preguntas subidas a Firestore como 'draft'.")
    print("   El administrador debe revisarlas y aprobarlas en el dashboard web (/admin).")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 tools/upload_batch.py <archivo.json>")
        sys.exit(1)
        
    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"❌ Archivo no encontrado: {filepath}")
        sys.exit(1)
        
    upload_validated_batch(filepath)
