import roqson
import re

# 1. Order Form Promos
promo_body = roqson.get_script_body('Client Script', 'Order Form Promos')
# Remove .show() and .css()
new_promo = promo_body.replace(
    "frm.fields_dict.applied_promos.$wrapper.show();",
    "frm.set_df_property('applied_promos', 'hidden', 0);"
)
new_promo = re.sub(
    r"grid\.wrapper\.css\('width',\s*'100%'\);\s*grid\.wrapper\.find\('\.form-grid'\)\.css\('width',\s*'100%'\);",
    "grid.wrapper.addClass('roqson-full-width-grid');",
    new_promo
)
if new_promo != promo_body:
    print("Updating Order Form Promos...")
    roqson.safe_update_script('Client Script', 'Order Form Promos', new_promo)

# 2. Order Form: Edit Mode Control
edit_body = roqson.get_script_body('Client Script', 'Order Form: Edit Mode Control')
# Remove .hide() and .show() lines
new_edit = re.sub(r'\s*if\s*\(fd\.grid\.wrapper\)\s*\{\s*fd\.grid\.wrapper\.find\([^)]+\)\.hide\(\);\s*fd\.grid\.wrapper\.find\([^)]+\)\.hide\(\);\s*\}', '', edit_body)
new_edit = re.sub(r'\s*if\s*\(fd\.grid\.wrapper\)\s*\{\s*fd\.grid\.wrapper\.find\([^)]+\)\.show\(\);\s*fd\.grid\.wrapper\.find\([^)]+\)\.show\(\);\s*\}', '', new_edit)
if new_edit != edit_body:
    print("Updating Order Form: Edit Mode Control...")
    roqson.safe_update_script('Client Script', 'Order Form: Edit Mode Control', new_edit)

# 3. Price Modified Flag
pcr_body = roqson.get_script_body('Client Script', 'Price Modified Flag')
new_pcr = pcr_body.replace(
    '<button class="btn btn-default btn-sm pcr-view-full" style="position:absolute;left:15px;">',
    '<button class="btn btn-default btn-sm pcr-view-full roqson-pcr-view-full-btn">'
)
if new_pcr != pcr_body:
    print("Updating Price Modified Flag...")
    roqson.safe_update_script('Client Script', 'Price Modified Flag', new_pcr)

print("Done updating.")
