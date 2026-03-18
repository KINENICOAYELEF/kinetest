import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

def initialize_firebase(cert_path):
    if not firebase_admin._apps:
        cred = credentials.Certificate(cert_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def upload_collection(db, collection_name, items, id_field):
    print(f"Uploading to '{collection_name}'...")
    count = 0
    for item in items:
        doc_id = item.get(id_field)
        if not doc_id:
            print(f"  Skipping item missing {id_field}")
            continue
        
        # Idempotent upload (set merges by default if we wanted, 
        # but here we overwrite the full doc to match state)
        doc_ref = db.collection(collection_name).document(doc_id)
        doc_ref.set(item)
        count += 1
    print(f"  Successfully uploaded {count} documents to {collection_name}")

if __name__ == "__main__":
    input_file = "/Users/nicoayelefparraguez/Downloads/app preguntas/tools/ingest_notebooklm/sample_output/normalized_bank.json"
    cert_file = "/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        exit(1)
        
    if not os.path.exists(cert_file):
        print(f"Error: {cert_file} not found. Please place your Firebase service account key here.")
        exit(1)

    try:
        db = initialize_firebase(cert_file)
        
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Upload each main collection
        units = data.get("units", [])
        for unit in units:
            unit_id = unit.get("unit_id")
            if not unit_id: continue
            
            # Extract subcollections before uploading main doc
            tutor_cards = unit.pop("tutor_cards", [])
            
            # Upload main unit doc
            db.collection("units").document(unit_id).set(unit)
            
            # Upload tutor_cards subcollection
            if tutor_cards:
                print(f"Uploading {len(tutor_cards)} tutor cards for unit {unit_id}...")
                for card in tutor_cards:
                    card_id = card.get("id")
                    if card_id:
                        db.collection("units").document(unit_id).collection("tutor_cards").document(card_id).set(card)

        upload_collection(db, "questions", data.get("questions", []), "question_id")
        upload_collection(db, "cases", data.get("cases", []), "case_id")
        
        print("\nAll uploads completed successfully!")
        
    except Exception as e:
        print(f"Upload failed: {e}")
