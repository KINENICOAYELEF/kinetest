import json
import os
import yaml # We'll assume yaml is available or use a basic parser if not. 
             # For robustness in a non-coder environment, a simple key:value parser might be better.

def simple_kv_parser(text):
    data = {}
    current_key = None
    
    lines = text.strip().split('\n')
    for line in lines:
        if ':' in line and not line.strip().startswith('-'):
            key, value = line.split(':', 1)
            current_key = key.strip()
            val = value.strip()
            
            # Simple list detection
            if val == '' or val.startswith('['):
                 data[current_key] = []
            else:
                # Type conversion
                if val.lower() == 'true': val = True
                elif val.lower() == 'false': val = False
                elif val.isdigit(): val = int(val)
                data[current_key] = val
        elif line.strip().startswith('-') and current_key:
            item = line.strip()[1:].strip()
            if isinstance(data[current_key], list):
                # Handle nested objects like options
                if 'text:' in item:
                    # Very simple nested parse for options
                    # In a real scenario, use PyYAML
                    pass 
                data[current_key].append(item)
    return data

# Using PyYAML is much better if we can ensure it's installed.
# I'll use a hybrid approach or just yaml.safe_load for the body.

def normalize_blocks(input_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        blocks = json.load(f)
    
    normalized = {
        "units": [],
        "questions": [],
        "cases": []
    }
    
    for block in blocks:
        try:
            # YAML is perfect for the format I designed in sample_input
            data = yaml.safe_load(block["raw_body"])
            
            if block["type"] == "UNIT":
                normalized["units"].append(data)
            elif block["type"] == "QUESTION":
                normalized["questions"].append(data)
            elif block["type"] == "CASE":
                normalized["cases"].append(data)
        except Exception as e:
            print(f"Error normalizing block: {e}")
            
    return normalized

if __name__ == "__main__":
    input_file = "sample_output/parsed_blocks.json"
    output_file = "sample_output/normalized_bank.json"
    
    if os.path.exists(input_file):
        print(f"Normalizing {input_file}...")
        # Note: requires 'pip install pyyaml'
        # I'll update requirements.txt later
        import yaml
        result = normalize_blocks(input_file)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"Normalization complete. Output saved to {output_file}")
    else:
        print(f"Error: {input_file} not found. Run parse_notebooklm.py first.")
