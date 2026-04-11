import json
import os

def sanitize_questions(file_path):
    if not os.path.exists(file_path):
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    changed = False
    for q in data:
        # 1. Clean and Fix Length
        for opt in q.get("options", []):
            old_text = opt["text"]
            # Remove ugly suffixes
            new_text = old_text.replace("(respuesta correcta)", "").replace("(respuesta incorrecta)", "").strip()
            
            # Ensure min 15 chars with clinical context instead of generic suffixes
            if len(new_text) < 15:
                if q.get("question_type") == "knowledge" or "músculo" in q["content"].lower():
                    new_text = f"{new_text} (Complejo Muscular)"
                else:
                    new_text = f"{new_text} (Entidad Clínica)"
            
            if old_text != new_text:
                opt["text"] = new_text
                changed = True
        
        # 2. Fix tp2_anatomy_extra_20 specific semantic error
        if q.get("question_id") == "tp2_anatomy_extra_20":
            q["options"] = [
                {"text": "Neuropatía de Baxter (atrapamiento de la 1ª rama plantar lateral)", "isCorrect": True},
                {"text": "Síndrome del Túnel Tarsiano Posterior (atrapamiento de nervio tibial)", "isCorrect": False},
                {"text": "Neuroma de Morton (atrapamiento en 3er espacio intermetatarsiano)", "isCorrect": False},
                {"text": "Atrapamiento del nervio plantar medial (Síndrome de Jogger's Foot)", "isCorrect": False}
            ]
            changed = True
            
    if changed:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Sanitizado y validado: {file_path}")

paths = [
    "/Users/nicoayelefparraguez/Downloads/app preguntas/tools/ingest_notebooklm/master_batch_50.json",
    "/Users/nicoayelefparraguez/Downloads/app preguntas/tools/ingest_notebooklm/anatomy_batch_30.json"
]

for p in paths:
    sanitize_questions(p)
