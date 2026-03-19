import frappe
from roqson_core.order_form import sync_sales_from_order

# Price Change Request DocType Event handlers — populated in Phase 5.3.


def after_save(doc, method):
    # Ported from Server Script: "Process PCR Approval"
    if doc.status == "Approved" and doc.order_form:
        pending = frappe.db.count("Price Change Request", {
            "order_form": doc.order_form,
            "status": "Pending"
        })

        if pending == 0:
            order_state = frappe.db.get_value("Order Form", doc.order_form, "workflow_state")
            if order_state == "Needs Review":
                user_name = frappe.db.get_value("User", frappe.session.user, "full_name") or frappe.session.user

                frappe.db.set_value("Order Form", doc.order_form, {
                    "workflow_state": "Approved",
                    "docstatus": 1,
                    "approved_by": user_name
                }, update_modified=False)
                order_doc = frappe.get_doc("Order Form", doc.order_form)
                order_doc.workflow_state = "Approved"
                order_doc.docstatus = 1
                order_doc.approved_by = user_name
                sync_sales_from_order(order_doc)
