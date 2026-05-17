"""
Patches each audit build script to accept real data from a JSON file.
Adds a data injection block right before the build() call.
Run once during deployment.
"""
import re

INJECT_CODE = '''
# ── REAL DATA INJECTION ──────────────────────────────────────────────────────
# If DATA_JSON env var is set, override all sample data with real values.
import os as _os, json as _json
_data_path = _os.environ.get("AUDIT_DATA_JSON")
if _data_path and _os.path.exists(_data_path):
    with open(_data_path) as _f:
        _d = _json.load(_f)
    _g = globals()
    for _k, _v in _d.items():
        if _k in _g or _k.isupper():
            _g[_k] = _v
    # Recalculate any derived values that depend on injected data
    # (script-specific recalcs happen after this block in each file)
# ─────────────────────────────────────────────────────────────────────────────

'''

scripts = [
    'build_pf_audit.py',
    'build_rf_audit.py', 
    'build_tf_audit.py',
]

import os
base = os.path.dirname(os.path.abspath(__file__))

for script in scripts:
    path = os.path.join(base, script)
    with open(path) as f:
        content = f.read()
    
    # Insert inject block right before "if __name__ == '__main__':"
    marker = 'if __name__ == "__main__":'
    if INJECT_CODE not in content:
        content = content.replace(marker, INJECT_CODE + marker)
        with open(path, 'w') as f:
            f.write(content)
        print(f"Patched: {script}")
    else:
        print(f"Already patched: {script}")

