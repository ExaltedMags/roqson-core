import roqson

scripts = [
    "Order Form: Footer Row Summary Tab",
    "Order Form: Totals Footer Row",
    "Order Form: Table Management & Calculation",
    "Order Form: Stock Availability UX",
    "Order Form Promos",
    "Order Form: Edit Mode Control",
    "Notes Acknowledgment",
    "Price Modified Flag"
]

for name in scripts:
    try:
        body = roqson.get_script_body('Client Script', name)
        if '<style' in body or '.css(' in body:
            print(f"FOUND IN {name}")
    except Exception as e:
        print(f"Error checking {name}: {e}")
