import re
import json
import requests
import glob
import os

THIS_FOLDER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUSTOM_RULES_PATH = os.path.join(THIS_FOLDER, 'config/custom_rules.txt')
WHITELIST_PATH = os.path.join(THIS_FOLDER, 'config/whitelist.txt')

names = {
    "easylist": "https://easylist.to/easylist/easylist.txt",
    "fanboy_annoyance": "https://easylist.to/easylist/fanboy-annoyance.txt",
    "easyprivacy": "https://easylist.to/easylist/easyprivacy.txt",
    "custom_rules": None
}

RESOURCE_MAP = {
    "script": "script",
    "image": "image",
    "stylesheet": "stylesheet",
    "media": "media",
    "font": "font",
    "object": "object",
    "xhr": "xmlhttprequest",
    "xmlhttprequest": "xmlhttprequest",
    "subdocument": "sub_frame",
    "sub_frame": "sub_frame",
    "other": "other"
}

# Cosmetic rule keywords (MV3 cannot use these)
COSMETIC = ["#@#", "#?#", ":-abp-", "##+js", "#$#"]


# --------------------------------------------------------------------
# UTILS
# --------------------------------------------------------------------

def is_ascii(s: str) -> bool:
    """Check if a string contains only ASCII characters."""
    try:
        s.encode("ascii")
        return True
    except UnicodeEncodeError:
        return False


def strip_unicode(s: str) -> str:
    """Remove non-ASCII characters from a string."""
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")



def download_lists():
    contents = {}
    for name, url in names.items():
        if name == "custom_rules":
            contents[name] = load_file(CUSTOM_RULES_PATH)
            continue
        print(f"Downloading {name}...")
        text = requests.get(url, timeout=20).text
        contents[name] = text
    return contents

def clear_existing_files(path: str):
    """Remove all existing rule files matching the pattern rules_*.json"""
    for file in glob.glob(os.path.join(THIS_FOLDER, path)):
        try:
            os.remove(file)
        except OSError as e:
            print(f"Error deleting {file}: {e}")

def save_rules_to_files(rules_list: list[list[dict[str, any]]], base_name: str = "rules"):
    """Save rules to multiple files with max 30k rules each"""
    clear_existing_files("src/rules_*.json")
    
    all_files = []
    for i, rule_chunk in enumerate(rules_list, 1):
        if not rule_chunk:
            continue
            
        filename = os.path.join(THIS_FOLDER, f"src/{base_name}_{i}.json")
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(rule_chunk, f, indent=2)
        all_files.append(filename)
        print(f"Saved {len(rule_chunk)} rules to {filename}")
    
    return all_files

def save_json_to_file(domain_rules: dict[str, list[str]], file_path: str):
    with open(os.path.join(THIS_FOLDER, file_path), "a", encoding="utf-8") as f:
        json.dump(domain_rules, f, indent=2)
        f.write("\n") 

def save_css_to_file(domain_rules: list[str], file_path: str ):
    with open(os.path.join(THIS_FOLDER, file_path), "a", encoding="utf-8") as f:
        json.dump(list(domain_rules), f, indent=2)
        f.write("\n") 

def update_manifest(num_rule_files: int):
    manifest_path = os.path.join(THIS_FOLDER, "src/manifest.json")
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            
        # Update rule resources
        rule_resources = []
        for i in range(1, num_rule_files + 1):
            rule_resources.append({
                "id": f"ruleset_{i}",
                "enabled": True,
                "path": f"rules_{i}.json"
            })
            
        if "declarative_net_request" not in manifest:
            manifest["declarative_net_request"] = {}
        manifest["declarative_net_request"]["rule_resources"] = rule_resources
        
        # Save updated manifest
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
            
        print(f"Updated manifest with {num_rule_files} rule sets")
    except Exception as e:
        print(f"Error updating manifest: {e}")

def load_file(filename: str) -> str:
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: {filename} not found. Creating an empty file.")
        with open(filename, "w", encoding="utf-8") as f:
            f.write("# Add your custom blocking rules here, one per line\n")
        return ""

def parse_whitelist(filename: str) -> list[str]:
    return load_file(filename).splitlines()
# --------------------------------------------------------------------
# PARSER
# --------------------------------------------------------------------

def parse_list(text: str, domain_rules: dict[str, list[str]], whitelist, starting_id=1):
    rules = []
    meta_rules = []
    global_css = []
    rule_id = starting_id
    CHUNK_SIZE = 30000

    for raw in text.splitlines():

        line = raw.strip()

        # ------------------------------------------------------------
        # Skip comments, empty lines, exception rules (@@ means allowlist)
        # ------------------------------------------------------------
        if not line or line.startswith("!") or line.startswith("@@"):
            continue

        # ------------------------------------------------------------
        # Skip cosmetic & HTML filtering (MV3 does not support). Might change more someday as we add support
        # ------------------------------------------------------------
        if any(c in line for c in COSMETIC):
            continue
      
        if "##" in line:
            parts = line.split('##')
            if(len(parts) != 2): continue
            dom = parts[0].strip()
            sel = parts[1].strip()
            if (not sel): continue
            if dom == '':
                #Global selector
                global_css.append(sel)
            else:
                #Domain selector
                domain_rules.setdefault(dom, []).append(sel)
            

        # ------------------------------------------------------------
        # Extract resource type modifiers ($script, $image, $xhr)
        # ------------------------------------------------------------
        resource_types = []
        domain_restrictions = None

        if "$" in line:
            parts = line.split("$", 1)
            pattern = parts[0]
            modifiers = parts[1]

            for mod in modifiers.split(","):
                mod = mod.strip()

                if mod in RESOURCE_MAP:
                    resource_types.append(RESOURCE_MAP[mod])

                elif mod == "third-party":
                    # MV3 does support "domainType": "thirdParty"
                    domain_restrictions = {"domainType": "thirdParty"}

                elif mod.startswith("domain="):
                    # ABP domain=example.com|foo.com
                    doms = mod.replace("domain=", "").split("|")
                    domain_restrictions = {"domains": doms}

        else:
            pattern = line

        # Default resource types (for non-domain rules)
        if not resource_types:
            resource_types = [
                "script", "image", "xmlhttprequest",
                "sub_frame", "other"
            ]

        # ------------------------------------------------------------
        # Parse ||domain^ syntax
        # ------------------------------------------------------------
        url_filter = None

        m = re.match(r"^\|\|(.+?)\^", pattern)
        if m:
            url_filter = m.group(1)

        else:
            # plain domain style: example.com -> convert to ||example.com^
            if re.match(r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", pattern):
                url_filter = f"||{pattern}^"
                # For domain blocks, ensure we're including all relevant resource types
                resource_types = [
                    "main_frame",  # Block the main page load
                    "sub_frame",   # Block iframes
                    "script",
                    "image",
                    "stylesheet",
                    "font",
                    "media",
                    "websocket",
                    "xmlhttprequest",
                    "ping",
                    "other"
                ]

        if not url_filter:
            continue  # unsupported format
            
        # Skip rules that would break essential functionality
        if any(whitelisted in url_filter or url_filter in whitelisted for whitelisted in whitelist):
            print(f"Skipping whitelisted URL: {url_filter}")
            continue

        # ------------------------------------------------------------
        # Enforce ASCII-only filters
        # ------------------------------------------------------------
        if not is_ascii(url_filter):
            url_filter = strip_unicode(url_filter)
            if not url_filter:
                continue  # skip broken filter

        # ------------------------------------------------------------
        # Build final rule
        # ------------------------------------------------------------
        rule = {
            "id": rule_id,
            "priority": 1,
            "action": {"type": "block"},
            "condition": {
                "urlFilter": url_filter,
                "resourceTypes": resource_types
            }
        }

        # Add domain restrictions if any
        if domain_restrictions:
            rule["condition"].update(domain_restrictions)

        rules.append(rule)
        rule_id += 1

        if len(rules) >= CHUNK_SIZE:
            meta_rules.append(rules)
            rules = []
            rule_id = 1 

    meta_rules.append(rules)
    return meta_rules, global_css

def build_static_rules():
    clear_existing_files("src/css_rules/hide_global.css")
    clear_existing_files("src/css_rules/hide_domain.json")
    domain_rules = {}
    start_id = 1
    contents = download_lists()
    all_rules = []
    whitelist = parse_whitelist(WHITELIST_PATH)
    
    for name in names:
        print(f"Processing {name}...")
        rules_sets, global_rules = parse_list(contents[name], domain_rules, whitelist, start_id)
        save_css_to_file(global_rules, "src/css_rules/hide_global.css")
        if not all_rules:
            all_rules = rules_sets
            start_id = len(all_rules[-1]) + 1
            continue
        if all_rules and rules_sets:
            last_chunk = all_rules[-1]
            first_chunk = rules_sets[0]
            
            # If combined size is under limit, merge them
            if len(last_chunk) + len(first_chunk) <= 30000:
                last_chunk.extend(first_chunk)
                all_rules.extend(rules_sets[1:])
            else:
                all_rules.extend(rules_sets)
        else:
            all_rules.extend(rules_sets)
        start_id = len(all_rules[-1]) + 1
    
    save_json_to_file(domain_rules, "src/css_rules/hide_domain.json")
    rule_files = save_rules_to_files(all_rules)
    update_manifest(len(rule_files))
    
    print(f"Total rule chunks: {len(rule_files)}")
    print(f"Total rules: {sum(len(chunk) for chunk in all_rules)}")


if __name__ == "__main__":
    build_static_rules()
