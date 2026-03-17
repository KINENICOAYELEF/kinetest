import json
import os

def validate_data(data):
    errors = []
    
    # Validate Units
    for i, unit in enumerate(data.get("units", [])):
        if not unit.get("unit_id"):
            errors.append(f"Unit {i} is missing 'unit_id'")
        if not unit.get("title"):
            errors.append(f"Unit {unit.get('unit_id', i)} is missing 'title'")

    # Validate Questions
    for i, q in enumerate(data.get("questions", [])):
        q_id = q.get("question_id", f"index_{i}")
        required_fields = ["unit_id", "question_id", "content", "options", "difficulty"]
        for field in required_fields:
            if field not in q:
                errors.append(f"Question {q_id} is missing required field: '{field}'")
        
        # Check options
        options = q.get("options", [])
        if not isinstance(options, list) or len(options) < 2:
            errors.append(f"Question {q_id} must have at least 2 options")
        else:
            has_correct = any(opt.get("isCorrect") for opt in options if isinstance(opt, dict))
            if not has_correct:
                errors.append(f"Question {q_id} has no correct option marked")

    # Validate Cases
    for i, c in enumerate(data.get("cases", [])):
        c_id = c.get("case_id", f"index_{i}")
        if not c.get("case_id"):
            errors.append(f"Case {i} is missing 'case_id'")
        if not c.get("questions") or not isinstance(c.get("questions"), list):
            errors.append(f"Case {c_id} is missing 'questions' list")

    return errors

if __name__ == "__main__":
    input_file = "sample_output/normalized_bank.json"
    
    if os.path.exists(input_file):
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Validating {input_file}...")
        errors = validate_data(data)
        
        if errors:
            print("VALIDATION FAILED:")
            for err in errors:
                print(f"  - {err}")
            exit(1)
        else:
            print("Validation successful! All required fields are present.")
    else:
        print(f"Error: {input_file} not found. Run normalize_bank.py first.")
