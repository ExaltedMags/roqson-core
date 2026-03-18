import roqson
import json

def check_field(doctype, fieldname):
    try:
        doc = roqson.get_doc('DocType', doctype)
        fields = [f['fieldname'] for f in doc.get('fields', [])]
        print(f"DocType: {doctype}, Field {fieldname} standard: {fieldname in fields}")
    except Exception as e:
        print(f"Error checking {doctype}: {str(e)}")

print("Checking potential standard fields on staging...")
check_field('Email Account', 'company')
check_field('Communication', 'company')
check_field('Address', 'tax_category')
check_field('Contact', 'is_billing_contact')
check_field('Print Settings', 'print_taxes_with_zero_amount')
check_field('Print Settings', 'print_uom_after_quantity')
check_field('Print Settings', 'compact_item_print')
