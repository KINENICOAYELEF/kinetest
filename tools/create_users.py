import firebase_admin
from firebase_admin import credentials, auth, firestore
import string
import random

# Initialize connection
def initialize_firebase():
    # You MUST replace 'serviceAccountKey.json' with your actual path 
    # downloaded from Firebase Console -> Project Settings -> Service Accounts
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
    return firestore.client()

def generate_random_password(length=8):
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for i in range(length))

def create_users(db, group_id, count=12):
    print(f"Creating {count} users for group '{group_id}'...")
    
    created_users = []
    
    for i in range(count):
        email = f"student{i+1}_{group_id}@kinepoli.test"
        password = generate_random_password()
        
        try:
            # 1. Create user in Firebase Auth
            user = auth.create_user(
                email=email,
                password=password,
            )
            
            # 2. Create user profile in Firestore
            user_ref = db.collection('users').document(user.uid)
            user_ref.set({
                'uid': user.uid,
                'email': email,
                'role': 'student',
                'groupId': group_id
            })
            
            created_users.append({'email': email, 'password': password, 'uid': user.uid})
            print(f"[{i+1}/{count}] Created User: {email}")
            
        except Exception as e:
            print(f"Error creating user {email}: {e}")

    print("\n--- Summary ---")
    for u in created_users:
        print(f"Email: {u['email']} | Temp Password: {u['password']}")

if __name__ == '__main__':
    try:
        db = initialize_firebase()
        
        # You can prompt inputs in CLI here if desired
        target_group = "group_alpha_01"
        create_users(db, target_group, count=12)
        
    except Exception as e:
        print(f"Initialization Failed. Did you place 'serviceAccountKey.json' correctly? Error details: {e}")
