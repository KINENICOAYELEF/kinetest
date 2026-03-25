import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('ingest_notebooklm/serviceAccountKey.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

def create_tobillo_unit():
    unit_id = 'unit_kine_04'
    unit_ref = db.collection('units').document(unit_id)
    
    # Check if exists
    if not unit_ref.get().exists:
        unit_ref.set({
            'title': 'Complejo Tobillo y Pie',
            'description': 'Anatomía clínica, biomecánica multisegmentaria y rehabilitación basada en deficiencias del pie y tobillo.',
            'order': 4,
            'isActive': True
        })
        print(f"Created unit {unit_id}")
    else:
        print(f"Unit {unit_id} already exists")

if __name__ == "__main__":
    create_tobillo_unit()
