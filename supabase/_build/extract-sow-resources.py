#!/usr/bin/env python3
"""Pull the SOW resource roster out of scripts/import_sow.py into JSON.

build-seed.mjs reads the JSON. Regenerate whenever import_sow.py changes:

    python3 supabase/_build/extract-sow-resources.py

The roster lives as a literal inside the import script rather than in a data
file, so parse it with ast instead of importing (importing would try to reach
Supabase at module load).
"""

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "import_sow.py"
OUT = Path(__file__).resolve().parent / "sow-resources.json"

tree = ast.parse(SRC.read_text())
found = {}
for node in tree.body:
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
        name = node.targets[0].id
        if name in ("rows", "SOW_FILES"):
            found[name] = ast.literal_eval(node.value)

rows = found["rows"]
sow_files = found.get("SOW_FILES", {})
for r in rows:
    r["sow_file"] = sow_files.get(r["sow_number"], "")

OUT.write_text(json.dumps(rows, indent=1) + "\n")
active = sum(1 for r in rows if r["status"] == "Active")
print(f"{OUT.name}: {len(rows)} resources ({active} active)")
