import os
import json
import sys

def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cases_dir = os.path.join(repo_root, "cases")

    for i in range(18, 21):
        case_id = f"HHG-{i:03d}"
        filepath = os.path.join(cases_dir, f"{case_id}.json")
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"--- {case_id} Evidence Requests ---")
            print(json.dumps(data.get("evidence_requests"), indent=2))

if __name__ == "__main__":
    main()
