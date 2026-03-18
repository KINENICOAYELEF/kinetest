import firebase_admin
from firebase_admin import credentials, firestore
import os

def check_users():
    cert_file = "/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json"
    if not os.path.exists(cert_file): return

    if not firebase_admin._apps:
        cred = credentials.Certificate(cert_file)
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    print("--- User Profiles Check ---")
    users = list(db.collection("users").stream())
    for u in users:
        data = u.to_dict()
        print(f"  - UID: {u.id}, Email: {data.get('email')}, Role: {data.get('role')}")

if __name__ == "__main__":
    check_users()
