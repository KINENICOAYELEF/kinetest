#!/usr/bin/env python3
"""
delete_all_questions.py — Purgador definitivo de la colección 'questions'.
"""

import sys
import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore

def get_cert_path():
    p1 = Path(__file__).parent / "ingest_notebooklm" / "serviceAccountKey.json"
    p2 = Path("/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json")
    return p1 if p1.exists() else p2

cred = credentials.Certificate(str(get_cert_path()))
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

def delete_collection(coll_ref, batch_size):
    print(f"Borrando colección {coll_ref.id}...")
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        doc.reference.delete()
        deleted += 1

    if deleted >= batch_size:
        return deleted + delete_collection(coll_ref, batch_size)

    return deleted

if __name__ == "__main__":
    confirm = input("⚠️ ¿ESTÁS SEGURO DE BORRAR TODAS LAS PREGUNTAS? (escribe 'SI' para continuar): ")
    if confirm != "SI":
        print("Operación cancelada.")
        sys.exit(0)
        
    total_deleted = delete_collection(db.collection("questions"), batch_size=500)
    print(f"\n✅ ÉXITO: {total_deleted} preguntas eliminadas permanentemente. La base de datos está en blanco.")
