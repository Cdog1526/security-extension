import re
import json
import requests

names = {
    "easylist": "https://easylist.to/easylist/easylist.txt",
    "fanboy_annoyance": "https://easylist.to/easylist/fanboy-annoyance.txt",
    "easyprivacy": "https://easylist.to/easylist/easyprivacy.txt"
}

def download_lists():
    contents = {}
    for name, url in names.items():
        print(f"Downloading {name}...")
        text = requests.get(url, timeout=20).text
        contents[name] = text
    return contents

def parse_list(list, rid):
    rules = []
    lists = list.split("\n")

    for line in lists:
        line = line.strip()

        if not line or line.startswith("!") or line.startswith("@@"):
            continue

        # Skip cosmetic rules (Chrome MV3 can't use them)
        if "##" in line or "#@" in line or "#?#" in line:
            continue

        # Skip extended ABP cosmetic operators
        if ":-abp-" in line:
            continue

        # 1. ||domain^ syntax
        m = re.match(r"^\|\|(.+?)\^", line)
        if m:
            domain = m.group(1)
            if any(domain.endswith(tld) for tld in ('.com', '.net', '.org', '.io', '.co')):
                rules.append({
                    "id": rid,
                    "priority": 1,
                    "action": {"type": "block"},
                    "condition": {
                        "urlFilter": f"||{domain}^",
                        "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
                    }
                })
                rid += 1
                continue

        # 2. simple /path/file.js
        if line.startswith("/"):
            pattern = line.lstrip("/")
            rules.append({
                "id": rid,
                "priority": 1,
                "action": {"type": "block"},
                "condition": {"urlFilter": pattern}
            })
            rid += 1
            continue

        # 3. wildcard patterns
        if "*" in line:
            rules.append({
                "id": rid,
                "priority": 1,
                "action": {"type": "block"},
                "condition": {"urlFilter": line.replace("*", "")}
            })
            rid += 1
            continue
    return rules


def build_static_rules():
    start_id = 1
    contents = download_lists()
    all_rules = []
    
    for name, content in contents.items():
        print(f"Processing {name}...")
        rules = parse_list(content, start_id)
        all_rules.extend(rules)
        start_id += len(rules)
        print(f"  Added {len(rules)} rules from {name}")
    
    print(f"Total rules: {len(all_rules)}")
    
    # Ensure we don't exceed Chrome's limit
    MAX_RULES = 30000  # Chrome's default limit
    # if len(all_rules) > MAX_RULES:
    #     print(f"Warning: Truncating to {MAX_RULES} rules (Chrome's limit)")
    #     all_rules = all_rules[:MAX_RULES]
    
    output_path = "rules.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_rules, f, indent=2)
    print(f"Rules saved to {output_path}")

if __name__ == "__main__":
    build_static_rules()
