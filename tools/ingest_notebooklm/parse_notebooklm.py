import re
import os
import json

def parse_blocks(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find blocks like [TAG]...[/TAG]
    pattern = re.compile(r'\[(UNIT|QUESTION|CASE)\](.*?)\[/\1\]', re.DOTALL)
    matches = pattern.findall(content)

    blocks = []
    for tag, body in matches:
        blocks.append({
            "type": tag,
            "raw_body": body.strip()
        })
    
    return blocks

if __name__ == "__main__":
    input_file = "sample_input/notebooklm_raw.md"
    output_file = "sample_output/parsed_blocks.json"
    
    if os.path.exists(input_file):
        print(f"Parsing {input_file}...")
        blocks = parse_blocks(input_file)
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(blocks, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully extracted {len(blocks)} blocks to {output_file}")
    else:
        print(f"Error: {input_file} not found.")
