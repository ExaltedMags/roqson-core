import roqson

name = 'Order Form: Stock Availability UX'
body = roqson.get_script_body('Client Script', name)
new_body = body.replace(
    '<span style="font-size: 12px; color: var(--text-muted);">',
    '<span class="roqson-stock-alert-loc">'
).replace(
    '<div style="font-size: 13px; line-height: 1.5; min-width: 280px; position: relative;">',
    '<div class="roqson-stock-alert-msg">'
).replace(
    '<b style="padding-right: 15px; display: inline-block;">',
    '<b class="roqson-stock-alert-title">'
).replace(
    '<span style="color:${status_color}; font-weight:bold; font-size: 14px;">',
    '<span class="roqson-stock-alert-status" style="color:${status_color};">'
)

if new_body != body:
    print(f"Updating {name}...")
    roqson.safe_update_script('Client Script', name, new_body)
print("Done.")
