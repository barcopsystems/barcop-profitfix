"""
inject_data.py
Reads a JSON data file and injects values into a build script's global namespace,
replacing all sample data variables before building the PDF.
Usage: python3 inject_data.py <build_script.py> <data.json> <output.pdf>
"""
import sys
import json
import importlib.util
import os

def run(build_script_path, data_json_path, output_pdf_path):
    # Load data
    with open(data_json_path) as f:
        data = json.load(f)

    # Load the build script as a module
    spec = importlib.util.spec_from_file_location("audit_build", build_script_path)
    mod  = importlib.util.module_from_spec(spec)

    # Override OUT path before executing
    data['OUT'] = output_pdf_path

    # Pre-inject all data keys into the module's namespace
    for key, val in data.items():
        setattr(mod, key, val)

    # Execute the module (defines all functions, replaces sample vars with our values)
    spec.loader.exec_module(mod)

    # Re-inject after exec (exec_module resets globals from the script)
    for key, val in data.items():
        setattr(mod, key, val)

    # Call build()
    mod.build()
    print(f"PDF generated: {output_pdf_path}")

if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2], sys.argv[3])
