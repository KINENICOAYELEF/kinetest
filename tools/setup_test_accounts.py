
import firebase_admin
from firebase_admin import credentials, auth, firestore

def setup_test_accounts():
    cred = credentials.Certificate('/Users/nicoayelefparraguez/Downloads/kinetest-9e4c1-firebase-adminsdk-fbsvc-655c29307c.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    accounts = [
        {"email": "estudiante_prueba@kinetest.test", "password": "Kinetest2026!", "role": "student"},
        {"email": "admin_prueba@kinetest.test", "password": "AdminKinetest2026!", "role": "admin"}
    ]

    for acc in accounts:
        try:
            # Create or update in Auth
            try:
                user = auth.get_user_by_email(acc["email"])
                auth.update_user(user.uid, password=acc["password"])
                uid = user.uid
                print(f"Updated password for {acc['email']}")
            except:
                user = auth.create_user(email=acc["email"], password=acc["password"])
                uid = user.uid
                print(f"Created user {acc['email']}")

            # Update in Firestore
            db.collection('users').document(uid).set({
                'uid': uid,
                'email': acc["email"],
                'role': acc["role"],
                'groupId': 'test_group' if acc["role"] == 'student' else None
            }, merge=True)
            print(f"Set role '{acc['role']}' for {acc['email']} in Firestore")

        except Exception as e:
            print(f"Error setting up {acc['email']}: {e}")

if __name__ == "__main__":
    setup_test_accounts()
