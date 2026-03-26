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

def create_tobillo_unit():
    unit_id = 'unit_tobillo_pie'
    unit_ref = db.collection('units').document(unit_id)
    
    # Check if exists
    if not unit_ref.get().exists:
        unit_ref.set({
            'title': 'Tobillo y Pie',
            'description': 'Anatomía clínica, biomecánica multisegmentaria y rehabilitación basada en deficiencias del pie y tobillo.',
            'order': 8,
            'isActive': True
        })
        print(f"Created unit {unit_id}")
    else:
        print(f"Unit {unit_id} already exists")

if __name__ == "__main__":
    create_tobillo_unit()
