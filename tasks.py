import frappe
from frappe.utils import today


# Scheduler tasks — Phase 7
# Ported from 2 Scheduler Event Server Scripts.


def auto_archive_expired_promos():
    # Ported from Server Script: "Auto Archive Expired Promos" (Daily)
    expired = frappe.get_list(
        "Promos",
        filters=[
            ["archived", "=", 0],
            ["valid_until", "is", "set"],
            ["valid_until", "<", today()],
        ],
        fields=["name", "promo_name", "valid_until"],
    )

    for promo in expired:
        frappe.db.set_value("Promos", promo.name, "archived", 1)
        frappe.logger().info(
            "Auto-archived expired promo: " + promo.name
            + " (" + str(promo.promo_name) + ") — valid until " + str(promo.valid_until)
        )

    if expired:
        frappe.db.commit()


def notify_overheld_reservations():
    # Ported from Server Script: "Overheld Reservation Notification" (Hourly)
    TARGET_ROLES = ["President", "Dispatcher", "Manager", "Sales", "Stock Manager", "Purchaser"]

    role_rows = frappe.get_all(
        "Has Role",
        filters={"role": ["in", TARGET_ROLES]},
        fields=["parent"],
    )

    valid_users = []
    for r in role_rows:
        if frappe.db.exists("User", r.parent):
            valid_users.append(r.parent)

    users = list(set(valid_users))

    orders = frappe.get_all(
        "Order Form",
        filters={"workflow_state": "Reserved"},
        fields=[
            "name",
            "outlet",
            "preferred_delivery_date",
            "preferred_delivery_time",
            "overheld_first_notified",
            "overheld_last_notified",
        ],
        ignore_permissions=True,
        limit_page_length=0,
    )

    now = frappe.utils.now_datetime()

    for o in orders:
        if not o.preferred_delivery_date or not o.preferred_delivery_time:
            continue

        preferred_str = str(o.preferred_delivery_date) + " " + str(o.preferred_delivery_time)
        preferred_dt = frappe.utils.get_datetime(preferred_str)
        diff_hours = frappe.utils.time_diff_in_hours(now, preferred_dt)

        if diff_hours >= 48:
            days_overheld = int(round(diff_hours / 24))
            send_notification = False

            if not o.overheld_first_notified:
                send_notification = True
                frappe.db.set_value(
                    "Order Form", o.name, "overheld_first_notified", now, update_modified=False
                )
            elif o.overheld_last_notified:
                last_dt = frappe.utils.get_datetime(o.overheld_last_notified)
                hours_since_last = frappe.utils.time_diff_in_hours(now, last_dt)
                if hours_since_last >= 24:
                    send_notification = True
            else:
                send_notification = True

            if send_notification:
                business_name = ""
                if o.outlet:
                    business_name = frappe.db.get_value(
                        "Customer Information", o.outlet, "name_of_business"
                    ) or ""

                styled_overheld = (
                    '<span style="color:#da1e28; font-weight:600;">Overheld ('
                    + str(days_overheld) + " days)</span>"
                )
                subject = o.name + " " + styled_overheld
                if business_name:
                    subject = subject + "<br>" + business_name

                for u in users:
                    n = frappe.new_doc("Notification Log")
                    n.for_user = u
                    n.type = "Alert"
                    n.subject = subject
                    n.email_content = subject
                    n.document_type = "Order Form"
                    n.document_name = o.name
                    n.insert(ignore_permissions=True)

                frappe.db.set_value(
                    "Order Form", o.name, "overheld_last_notified", now, update_modified=False
                )

        else:
            frappe.db.set_value(
                "Order Form",
                o.name,
                {"overheld_first_notified": None, "overheld_last_notified": None},
                update_modified=False,
            )
