import roqson
import json

scripts = [
    "Order Form: Footer Row Summary Tab",
    "Order Form: Totals Footer Row",
    "Order Form: Table Management & Calculation"
]

results = {}
for name in scripts:
    try:
        body = roqson.get_script_body('Client Script', name)
        results[name] = body
    except Exception as e:
        results[name] = f"Error: {e}"

print(json.dumps(results, indent=2))
