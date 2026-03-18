import firebase_admin
from firebase_admin import credentials, firestore
import os

def check_content():
    cert_file = "/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json"
    if not os.path.exists(cert_file):
        print("Error: Cert file not found.")
        return

    if not firebase_admin._apps:
        cred = credentials.Certificate(cert_file)
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    print("--- Database Content Check ---")
    
    # Check Units
    units = list(db.collection("units").stream())
    print(f"Units found: {len(units)}")
    for u in units:
        print(f"  - Unit ID: {u.id}, Title: {u.to_dict().get('title')}")
    
    # Check Questions
    questions = list(db.collection("questions").limit(5).stream())
    print(f"Questions preview (first 5):")
    for q in questions:
        data = q.to_dict()
        print(f"  - Q ID: {q.id}, Unit ID Field: {data.get('unit_id')}, Content: {data.get('content')[:50]}...")
    
    total_q = len(list(db.collection("questions").select([]).stream()))
    print(f"Total Questions: {total_q}")

    # Check Cases
    cases = list(db.collection("cases").stream())
    print(f"Cases found: {len(cases)}")
    for c in cases:
        data = c.to_dict()
        print(f"  - Case ID: {c.id}, Unit ID Field: {data.get('unit_id')}, Title: {data.get('title')}")

if __name__ == "__main__":
    check_content()
