import roqson
import json

scripts = [
    "Order Form Display",
    "Order Form Promos",
    "Order Form List - Master",
    "Price Modified Flag"
]

results = {}
for name in scripts:
    try:
        body = roqson.get_script_body('Client Script', name)
        results[name] = body
    except Exception as e:
        results[name] = f"Error: {e}"

print(json.dumps(results, indent=2))
