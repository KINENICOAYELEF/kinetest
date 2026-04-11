import json
import re

paths = [
    "/Users/nicoayelefparraguez/Downloads/app preguntas/tools/ingest_notebooklm/batch_1.json",
    "/Users/nicoayelefparraguez/.gemini/antigravity/brain/2ab6866d-03ad-40d7-bdef-eb7f4ea7fa78/.system_generated/steps/3524/output.txt",
    "/Users/nicoayelefparraguez/.gemini/antigravity/brain/2ab6866d-03ad-40d7-bdef-eb7f4ea7fa78/.system_generated/steps/3525/output.txt",
    "/Users/nicoayelefparraguez/.gemini/antigravity/brain/2ab6866d-03ad-40d7-bdef-eb7f4ea7fa78/.system_generated/steps/3526/output.txt",
    "/Users/nicoayelefparraguez/.gemini/antigravity/brain/2ab6866d-03ad-40d7-bdef-eb7f4ea7fa78/.system_generated/steps/3527/output.txt"
]

all_questions = []

for idx, path in enumerate(paths):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if idx == 0:
        qs = json.loads(content)
        all_questions.extend(qs)
    else:
        data = json.loads(content)
        answer = data["answer"]
        answer = re.sub(r'^```json\s*', '', answer)
        answer = re.sub(r'\s*```$', '', answer)
        
        try:
            qs = json.loads(answer)
            all_questions.extend(qs)
        except json.JSONDecodeError as e:
            print(f"Error parseando el batch {idx}: {e}")
            
# Assign question IDs and basic metadata just in case
for idx, q in enumerate(all_questions):
    if 'question_id' not in q or not q['question_id']:
        q['question_id'] = f"tp2_{q.get('cognitive_level', 'q').lower()}_{idx+1:02d}"
    if 'status' not in q:
        q['status'] = 'draft'
        
print(f"Total de preguntas procesadas: {len(all_questions)}")

out_path = "/Users/nicoayelefparraguez/Downloads/app preguntas/tools/ingest_notebooklm/master_batch_50.json"
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(all_questions, f, indent=2, ensure_ascii=False)
    
print(f"Guardado en {out_path}")
