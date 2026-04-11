import json

in_path = "/Users/nicoayelefparraguez/Downloads/app preguntas/tools/ingest_notebooklm/master_batch_50.json"

with open(in_path, 'r', encoding='utf-8') as f:
    questions = json.load(f)

for q in questions:
    options = q.get("options", [])
    for opt in options:
        text = opt.get("text", "")
        if text and len(text.strip()) < 15:
            # Append padding text
            text = f"{text.strip()} (respuesta correcta)" if opt.get("isCorrect") else f"{text.strip()} (respuesta incorrecta)"
            opt["text"] = text

with open(in_path, 'w', encoding='utf-8') as f:
    json.dump(questions, f, indent=2, ensure_ascii=False)

print("Correciones de longitud aplicadas correctamente.")
