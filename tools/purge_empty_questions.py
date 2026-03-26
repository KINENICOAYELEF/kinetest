import os
import firebase_admin
from firebase_admin import credentials, firestore

def main():
    service_account_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not service_account_path:
        # Intento de ruta por defecto
        service_account_path = os.path.expanduser('~/.firebase/kinetest-service-account.json')
    
    if not os.path.exists(service_account_path):
        print(f"Error: No se encontró el archivo de credenciales en {service_account_path}")
        return

    if not firebase_admin._apps:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    questions_ref = db.collection('questions')
    docs = questions_ref.stream()

    deleted_count = 0
    total_count = 0

    print("Iniciando purga de preguntas con alternativas vacías...")
    for doc in docs:
        total_count += 1
        data = doc.to_dict()
        options = data.get('options', [])
        
        has_empty_option = False
        has_correct_option = False
        if not options or len(options) != 4:
            has_empty_option = True
        else:
            correct_count = 0
            for opt in options:
                if isinstance(opt, str):
                    text = opt.strip()
                else:
                    text = opt.get('text', '').strip()
                    if opt.get('isCorrect') == True or opt.get('isCorrect') == 'true':
                        correct_count += 1
                
                if not text or len(text) < 5:
                    has_empty_option = True
                    break
            
            if correct_count != 1:
                has_correct_option = False # Error: no tiene 1 alternativa correcta
            else:
                has_correct_option = True
        
        # También eliminar si no tiene rationale, o si rationale es muy corto
        has_bad_rationale = False
        rationale = data.get('rationale', '').strip()
        if len(rationale) < 10:
            has_bad_rationale = True

        if has_empty_option or has_bad_rationale:
            print(f"Borrando {doc.id} | Opciones vacías: {has_empty_option} | Rationale malo: {has_bad_rationale}")
            db.collection('questions').document(doc.id).delete()
            deleted_count += 1

    print(f"\nOperación completada.")
    print(f"Total procesadas: {total_count}")
    print(f"Preguntas eliminadas: {deleted_count}")
    print(f"Preguntas restantes: {total_count - deleted_count}")

if __name__ == '__main__':
    main()
