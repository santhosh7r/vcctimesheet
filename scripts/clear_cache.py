import json
path = "/opt/d4-hiring/output/hiring/hiring_tracker.json"
with open(path) as f:
    d = json.load(f)
d["processed_email_ids"] = []
with open(path, "w") as f:
    json.dump(d, f, indent=2)
print("Cleared processed IDs")
