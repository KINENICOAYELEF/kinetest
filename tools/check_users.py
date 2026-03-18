import firebase_admin
from firebase_admin import credentials, firestore

def check_users():
    cred = credentials.Certificate('/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json')
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("Checking Users...")
    users = list(db.collection('users').stream())
    for u in users:
        data = u.to_dict()
        print(f"UID: {u.id} | Email: {data.get('email')} | Role: {data.get('role')}")

if __name__ == "__main__":
    check_users()
