import firebase_admin
from firebase_admin import credentials, firestore

def check_collections():
    cred = credentials.Certificate('/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    collections = ['units', 'questions', 'cases', 'config']
    for col in collections:
        docs = list(db.collection(col).stream())
        print(f"Collection '{col}': {len(docs)} documents")
        for doc in docs:
            print(f"  - ID: {doc.id} | Data: {doc.to_dict()}")

if __name__ == "__main__":
    check_collections()
