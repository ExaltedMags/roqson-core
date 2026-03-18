import roqson
import json

scripts = [
    "Order Form: Stock Availability UX",
    "DSP Mandatory",
    "Price Modified Flag",
    "Order Form Display",
    "Order Form Promos",
    "Order Form List - Master",
    "Order Form UX Fix",
    "Order Form: Edit Mode Control",
    "Notes Acknowledgment"
]

results = {}
for name in scripts:
    try:
        body = roqson.get_script_body('Client Script', name)
        results[name] = body
    except Exception as e:
        results[name] = f"Error: {e}"

print(json.dumps(results, indent=2))
