import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

def initialize_firebase():
    if not firebase_admin._apps:
        # Assumes serviceAccountKey.json is in the same directory
        cred = credentials.Certificate('serviceAccountKey.json')
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
    input_file = "sample_output/normalized_bank.json"
    cert_file = "serviceAccountKey.json"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        exit(1)
        
    if not os.path.exists(cert_file):
        print(f"Error: {cert_file} not found. Please place your Firebase service account key here.")
        exit(1)

    try:
        db = initialize_firebase()
        
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Upload each main collection
        upload_collection(db, "units", data.get("units", []), "unit_id")
        upload_collection(db, "questions", data.get("questions", []), "question_id")
        upload_collection(db, "cases", data.get("cases", []), "case_id")
        
        print("\nAll uploads completed successfully!")
        
    except Exception as e:
        print(f"Upload failed: {e}")
