import roqson
import re

# 1. Order Form UX Fix
ux_body = roqson.get_script_body('Client Script', 'Order Form UX Fix')
# Remove the setup function entirely as it only contains CSS injection
new_ux = re.sub(r'setup:\s*function\(frm\)\s*\{[^}]*refresh:', 'refresh:', ux_body, flags=re.DOTALL)
# It might have been simpler to do a string replacement. Let's do exact match or regex.
new_ux = re.sub(r'setup:\s*function\(frm\)\s*\{.*?\},\s*refresh:\s*function\(frm\)', 'refresh: function(frm)', ux_body, flags=re.DOTALL)
if new_ux != ux_body:
    print("Updating Order Form UX Fix...")
    roqson.safe_update_script('Client Script', 'Order Form UX Fix', new_ux)

# 2. Order Form List - Master
list_body = roqson.get_script_body('Client Script', 'Order Form List - Master')
new_list = re.sub(r'// \u2500\u2500 CSS injection \u2500\u2500.*?(?=// \u2500\u2500 Date range filter button)', '', list_body, flags=re.DOTALL)
if new_list != list_body:
    print("Updating Order Form List - Master...")
    roqson.safe_update_script('Client Script', 'Order Form List - Master', new_list)

# 3. Order Form Display
display_body = roqson.get_script_body('Client Script', 'Order Form Display')
new_display = display_body.replace(
    '$input.css({"background-color": "var(--control-bg, #f3f3f3)", "cursor": "not-allowed"});',
    '$input.addClass("roqson-force-readonly");'
)
if new_display != display_body:
    print("Updating Order Form Display...")
    roqson.safe_update_script('Client Script', 'Order Form Display', new_display)

# 4. DSP Mandatory
dsp_body = roqson.get_script_body('Client Script', 'DSP Mandatory')
new_dsp = dsp_body.replace(
    '$(label).append(\'<span class="mandatory-asterisk" style="color: red; margin-left: 2px;">*</span>\');',
    '$(label).append(\'<span class="roqson-reqd-star">*</span>\');'
).replace('.mandatory-asterisk', '.roqson-reqd-star')
if new_dsp != dsp_body:
    print("Updating DSP Mandatory...")
    roqson.safe_update_script('Client Script', 'DSP Mandatory', new_dsp)

print("Done updating 4 scripts.")
