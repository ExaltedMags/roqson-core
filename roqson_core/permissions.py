import frappe

# Permission Query Conditions — Phase 6
# Ported from 13 Permission Query + 2 DocType Event "Archive" Server Scripts.
#
# All functions follow the Frappe convention:
#   def get_<doctype>_conditions(user=None) -> str
#
# "Link search only" pattern: return conditions only when the request
# originates from a Link field search (cmd == frappe.desk.search.search_link),
# so list views and reports still show all records to authorised users.


def _is_link_search():
    return frappe.form_dict.get("cmd") == "frappe.desk.search.search_link"


# ---------------------------------------------------------------------------
# Simple archive guards (link-search only)
# ---------------------------------------------------------------------------

def get_order_form_conditions(user=None):
    # Ported from: Archive Order Form
    if _is_link_search():
        return "`tabOrder Form`.`archived` = 0"
    return ""


def get_sales_personnel_conditions(user=None):
    # Ported from: Archive Sales Personnel
    if _is_link_search():
        return "`tabSales Personnel`.`archived` = 0"
    return ""


def get_credit_application_conditions(user=None):
    # Ported from: Archive Credit Application
    if _is_link_search():
        return "`tabCredit Application`.`archived` = 0"
    return ""


def get_customer_survey_form_conditions(user=None):
    # Ported from: Archive CSV
    if _is_link_search():
        return "`tabCustomer Survey Form`.`archived` = 0"
    return ""


def get_customer_information_conditions(user=None):
    # Ported from: Archive CI
    if _is_link_search():
        return "`tabCustomer Information`.`archived` = 0"
    return ""


def get_product_conditions(user=None):
    # Ported from: Archive Product
    if _is_link_search():
        return "`tabProduct`.`archived` = 0"
    return ""


def get_nature_of_business_conditions(user=None):
    # Ported from: Archive NOB
    if _is_link_search():
        return "`tabNature of Business`.`archived` = 0"
    return ""


def get_promos_conditions(user=None):
    # Ported from: Archive Promos
    # Also hides expired promos (valid_until < today) in link searches.
    if _is_link_search():
        today_str = frappe.utils.today()
        return (
            "`tabPromos`.`archived` = 0 "
            "AND (`tabPromos`.`valid_until` IS NULL OR `tabPromos`.`valid_until` >= '" + today_str + "')"
        )
    return ""


def get_discounts_conditions(user=None):
    # Ported from: Archive Discounts
    if _is_link_search():
        return "`tabDiscounts`.`archived` = 0"
    return ""


def get_territories_conditions(user=None):
    # Ported from: Archive Teritorries
    if _is_link_search():
        return "`tabTerritories`.`archived` = 0"
    return ""


def get_vehicles_conditions(user=None):
    # Ported from: Archive Vehicle
    if _is_link_search():
        return "`tabVehicles`.`archived` = 0"
    return ""


def get_warehouses_conditions(user=None):
    # Ported from: Archive Warehouses
    if _is_link_search():
        return "`tabWarehouses`.`archived` = 0"
    return ""


def get_brands_conditions(user=None):
    # Ported from: Archive Brands
    if _is_link_search():
        return "`tabBrands`.`archived` = 0"
    return ""


# ---------------------------------------------------------------------------
# Role-based access guard
# ---------------------------------------------------------------------------

def get_sales_conditions(user=None):
    # Ported from: Sales Permission Query
    if frappe.session.user == "Guest":
        return "1=0"

    allowed_roles = {
        "Sales", "Accounting", "Manager", "President",
        "Dispatcher", "Administrator", "System Manager", "Driver",
    }
    user_roles = set(frappe.get_all(
        "Has Role",
        filters={"parent": frappe.session.user},
        pluck="role",
    ))
    if user_roles & allowed_roles:
        return ""
    return "1=0"


# ---------------------------------------------------------------------------
# Complex: Trip Ticket — archive + driver-scoped filtering
# ---------------------------------------------------------------------------

def get_trips_conditions(user=None):
    # Ported from: Archive Trip Ticket
    conditions = "`tabTrips`.`archived` = 0"
    roles = set(frappe.get_all(
        "Has Role",
        filters={"parent": frappe.session.user},
        pluck="role",
    ))

    # Driver users (not admins/dispatchers) see only their own assigned trips.
    if (
        "Driver" in roles
        and "System Manager" not in roles
        and "Administrator" not in roles
        and "Dispatcher" not in roles
    ):
        full_name = frappe.db.get_value("User", frappe.session.user, "full_name") or ""
        driver_names = frappe.get_all(
            "Driver",
            filters={"full_name": full_name, "status": "Active"},
            pluck="name",
        )

        if driver_names:
            quoted = ["'" + str(n).replace("'", "''") + "'" for n in driver_names]
            driver_in = ", ".join(quoted)
            driver_condition = (
                " AND (EXISTS ("
                "SELECT name FROM `tabTrips Driver Assignment` tt_da "
                "WHERE tt_da.parent = `tabTrips`.name "
                "AND tt_da.driver IN (" + driver_in + ")"
                ") OR `tabTrips`.`driverhelper` IN (" + driver_in + "))"
            )
            conditions = conditions + driver_condition
        else:
            # No active Driver record found — deny access to all trips.
            conditions = "1 = 0"

    return conditions or "1 = 1"
