app_name = "roqson_core"
app_title = "Roqson Core"
app_publisher = "ROQSON"
app_description = "ROQSON Industrial Sales core customizations"
app_version = "0.0.1"
app_license = "MIT"

app_include_css = [
    "/assets/roqson_core/css/roqson_core.css"
]

app_include_js = [
    "/assets/roqson_core/js/generated/global_pcr_popup.bundle.js"
]

doctype_js = {
    "Order Form": [
        "public/js/order_form.bundle.js",
        "public/js/generated/order_form_extras.bundle.js",
    ],
    "Sales": "public/js/sales_form.bundle.js",
    "Customer Survey Form": "public/js/customer_survey_form.bundle.js",
    "Customer Information": "public/js/customer_information_form.bundle.js",
    "Product": "public/js/product_form.bundle.js",
    "Trips": "public/js/trips_form.bundle.js",
    "Credit Application": "public/js/generated/credit_application.bundle.js",
    "Credit Application Request": "public/js/generated/credit_application_request.bundle.js",
    "Discounts": "public/js/generated/discounts_form.bundle.js",
    "Inventory Ledger": "public/js/generated/inventory_ledger.bundle.js",
    "Inventory Balance": "public/js/generated/inventory_balance.bundle.js",
    "Address": "public/js/generated/address.bundle.js",
    "PH Address": "public/js/generated/ph_address.bundle.js",
    "Drivers": "public/js/generated/drivers.bundle.js",
    "Receipt": "public/js/generated/receipt_form.bundle.js",
    "Brands": "public/js/generated/archive_misc_form.bundle.js",
    "Nature of Business": "public/js/generated/archive_misc_form.bundle.js",
    "Promos": "public/js/generated/archive_misc_form.bundle.js",
    "Sales Personnel": "public/js/generated/archive_misc_form.bundle.js",
    "Vehicles": "public/js/generated/archive_misc_form.bundle.js",
    "Warehouses": "public/js/generated/archive_misc_form.bundle.js",
    "Territories": [
        "public/js/generated/archive_misc_form.bundle.js",
        "public/js/generated/territories_form.bundle.js",
    ],
}

doctype_list_js = {
    "Sales": "public/js/sales_list.bundle.js",
    "Customer Survey Form": "public/js/customer_survey_form_list.js",
    "Customer Information": "public/js/customer_information_list.bundle.js",
    "Product": "public/js/product_list.bundle.js",
    "Trips": "public/js/trips_list.bundle.js",
    "Order Form": "public/js/generated/order_form_list_extras.bundle.js",
    "Credit Application": "public/js/generated/credit_application_list.bundle.js",
    "Discounts": "public/js/generated/discounts_list.bundle.js",
    "Brands": "public/js/generated/archive_misc_list.bundle.js",
    "Nature of Business": "public/js/generated/archive_misc_list.bundle.js",
    "Promos": "public/js/generated/archive_misc_list.bundle.js",
    "Sales Personnel": "public/js/generated/archive_misc_list.bundle.js",
    "Territories": "public/js/generated/archive_misc_list.bundle.js",
    "Vehicles": "public/js/generated/archive_misc_list.bundle.js",
    "Warehouses": "public/js/generated/archive_misc_list.bundle.js",
}

before_request = [
    "roqson_core.local_auth.auto_login_administrator"
]

after_request = [
    "roqson_core.local_auth.redirect_local_dev_to_app"
]

after_install = [
    "roqson_core.dev.local_setup.sync_local_shell",
]

after_migrate = [
    "roqson_core.dev.local_setup.sync_local_shell",
]

# Fixtures — Phase 4: Custom Fields + Print Formats
#            Phase 8: DocType JSON
#            Phase 9: Workflow JSON
fixtures = [
    {
        "dt": "Client Script",
        "filters": [
            ["enabled", "=", 1],
            ["name", "not in", [
                "Order Form Promos",
                "Order Form: Stock Availability UX",
                "Notes Acknowledgment",
                "Order Form: Edit Mode Control",
                "Order Form: Table Management & Calculation",
                "Order Form: Totals Footer Row",
                "Price Modified Flag",
                "Sales: Paid Validation",
                "Sales: Form Logic & Calculations",
                "Sales: Customer Info Autofill",
                "Sales: Cancel Warning",
                "Sales Pick-up Confirmation",
                "Sales List Script",
                "Sales: Receipts Section",
                "DSP Set Session",
                "Notes Indicator CSF",
                "Archive CSF List",
                "Archive CSF Form",
                "CSV: Fetch address",
                "CSF: Signed by fields",
                "CSF: DSP cant sign received fied",
                "CSF: Add photos",
                "CSF: Get Last Order",
                "Customer Info - Display Name",
                "Form Filters",
                "Hide Delete",
                "Order History Summary",
                "Archive CI List",
                "Archive CI Form",
                "Sales Personnel",
                "CI: Unlimited Credit Limit",
                "CI: Edit Permissions",
                "Customer Info: Address Helpers",
                "Archive Product List",
                "Archive Product Form",
                "Product: Show Inventory",
                "Trip Ticket: Display Name",
                "Trip Ticket Linked with Order Form",
                "Trip Ticket Failed Select",
                "in-form big buttons (preferred) + fallback to toolbar buttons",
                "Show Failure Reasons Dropdown",
                "Full Order Script",
                "Daily Numbering",
                "Archive Trip Ticket List",
                "Archive Trip Ticket Form",
                "Dispatcher",
                "Trip Ticket: Multi-Driver Operations",
                "Credit Application - Display Name",
                "DSP Session",
                "Fix Credit Application",
                "Signed By Fields",
                "Archive CA List",
                "Archive CA Form",
                "Credit Application - CAR Linkback",
                "CA: Unlimited Credit",
                "CA: Credit Validation",
                "CA: Workflow Stage Lock",
                "CA: Block creation if unresolved exists",
                "CA: Override Owners Signature",
                "CA: Date time for Owners Signature",
                "Credit Application Request - Sales Actions",
                "Toggle Discount Fields",
                "Discounts: Display Name",
                "Archive Discounts List",
                "Archive Discounts Form",
                "Drivers: Filter Drivers",
                "Inventory Balance Auto Compute",
                "Created By Status",
                "Source Type For Manual Adjustments",
                "Movement Type",
                "Fetch Rows",
                "Show reason and explanation",
                "Inventory Ledger Audit Trail",
                "Movement Type Accessibility",
                "PH Addresses",
                "Address Script",
                "Receipt: Form Controller",
                "Archive Brands Form",
                "Archive List Brands",
                "Archive NOB List",
                "Archive NOB Form",
                "Archive Promo",
                "Archive Promo Form",
                "Archive SP List",
                "Archive SP Form",
                "Archive Teritorries List",
                "Archive Territories Form",
                "DSP Territories",
                "Archive Vehicles List",
                "Archive Vehicles Form",
                "Archive Warehouses List",
                "Archive Warehouses Form",
                "Order Form Display",
                "Order By Field",
                "Order Form Fetch Addresses",
                "Price Edit",
                "Reward Item Name Display",
                "Total Previous Orders",
                "Hide Discounts for DSPs",
                "Submitted or Amended forms ONLY",
                "DSP Mandatory",
                "Archive Order Form",
                "Date Backtracking",
                "Nature of Business Label",
                "Date Time Sync",
                "Order Form: Footer Row Summary Tab",
                "Order Form List - Master",
                "Combine Pref. Date and Time in one field",
                "Pending Workflow Lock",
                "Terms and MOP Policy",
                "Request Credit Application Button",
                "Warning Past Business Hours",
                "Order Form: Warehouse Assignment",
                "Order Form: Cancel Sales Warning",
                "Order Form UX Fix",
                "Order Form: Clear Jabroni Default",
                "Order Form: DSP Restrictions",
                "Order Form: Fulfillment Visibility",
                "Price Change Request Pop Up",
                "Workspace: PCR Popup",
            ]],
        ]
    },
    {
        "dt": "Server Script",
        "filters": [["disabled", "=", 0]]
    },
    {
        "dt": "Role",
        "filters": [["name", "in", [
            "DSP", "President", "Manager", "Dispatcher", "Driver",
            "Credit Investigator", "Sales",
        ]]]
    },
    {
        "dt": "Role Profile",
        "filters": [["name", "in", [
            "DSP", "President", "Manager", "Dispatcher", "Driver",
            "Credit Investigator", "Sales",
        ]]]
    },
    {
        "dt": "Custom Field",
        "filters": [["dt", "in", [
            "Address", "Vehicle", "Driver", "Print Settings", "Contact",
            "Communication", "Email Account", "Territory", "Warehouse", "User",
        ]]]
    },
    {
        "dt": "Print Format",
        "filters": [["name", "in", ["Sales Billing Statement", "Billing Statement"]]]
    },
    {
        "dt": "DocType",
        "filters": [["name", "in", [
            "Brands", "Classifications", "Credit Application", "Credit Application Request",
            "Customer Information", "Customer Management", "Customer Survey Form",
            "DSP Order Form", "Discounts", "Drivers", "Inventory", "Inventory Balance",
            "Inventory Entry", "Inventory Ledger", "Nature of Business", "Order Form",
            "PH Address", "PH Barangay", "PH City Municipality", "PH Province",
            "Price Change Request", "Pricing Rules", "Product", "Product Bundles",
            "Products Price list", "Promos", "Receipt", "Sales", "Sales Order Form",
            "Sales Orders", "Sales Personnel", "Stock Transaction", "Territories",
            "Trips", "Vehicles", "Warehouses",
            "Applied Promos Table", "Bank Reference Table", "Business Representatives Table",
            "Cost Tier", "Credit Application Supporting Document",
            "Customer Information Outlet Address", "Inventory Entry Table",
            "Inventory Ledger Table", "Order", "Order - VAT Table", "Order Details Table",
            "Order History Summary", "Order Summary Table", "Order- Pricing Table",
            "Partner and Incorporators Stockholders Table", "Receipt Apply To",
            "Sales Items Table", "Supplier Reference Table", "Territory DSPs",
            "Trip Ticket Failed Deliveries", "Trips Delivery Item",
            "Trips Driver Assignment", "Trips Table",
        ]]]
    },
    {
        "dt": "Workflow",
        "filters": [["name", "in", [
            "Time in Time out",
            "Order Workflow",
            "Credit Approval",
            "Credit Application Request Workflow",
        ]]]
    },
    {
        "dt": "Workspace",
        "filters": [["name", "in", [
            "Home", "Selling", "Stock", "Users", "CRM", "Tools",
            "ERPNext Settings", "ERPNext Integrations", "Integrations",
            "Build", "Welcome Workspace",
        ]]]
    },
]

# DocType event hooks — populated in Phase 5
# Target state (from ARCHITECTURE.md):
#
# doc_events = {
#     "Order Form": {
#         "before_delete":           "roqson_core.order_form.before_delete",
#         "before_save":             "roqson_core.order_form.before_save",
#         "before_submit":           "roqson_core.order_form.before_submit",
#         "after_save":              "roqson_core.order_form.after_save",
#         "on_update_after_submit":  "roqson_core.order_form.on_update_after_submit",
#         "on_submit":               "roqson_core.order_form.on_submit",
#         "on_cancel":               "roqson_core.order_form.on_cancel",
#     },
#     "Trips": {
#         "before_insert":           "roqson_core.trips.before_insert",
#         "before_validate":         "roqson_core.trips.before_validate",
#         "before_save":             "roqson_core.trips.before_save",
#         "after_insert":            "roqson_core.trips.after_insert",
#         "after_save":              "roqson_core.trips.after_save",
#     },
#     "Credit Application": {
#         "before_save":             "roqson_core.credit_application.before_save",
#         "before_submit":           "roqson_core.credit_application.before_submit",
#         "after_save":              "roqson_core.credit_application.after_save",
#         "on_update_after_submit":  "roqson_core.credit_application.on_update_after_submit",
#     },
#     "Customer Information": {
#         "before_save":             "roqson_core.customer_information.before_save",
#         "on_update_after_submit":  "roqson_core.customer_information.on_update_after_submit",
#     },
#     "Sales": {
#         "before_save":             "roqson_core.sales.before_save",
#         "after_save":              "roqson_core.sales.after_save",
#     },
#     "Receipt": {
#         "before_cancel":           "roqson_core.receipt.before_cancel",
#         "on_submit":               "roqson_core.receipt.on_submit",
#     },
#     "Price Change Request": {
#         "after_save":              "roqson_core.price_change_request.after_save",
#     },
#     "Cost Tier": {
#         "before_save":             "roqson_core.cost_tier.before_save",
#     },
#     "Inventory Entry": {
#         "after_insert":            "roqson_core.inventory_entry.after_insert",
#     },
#     "Inventory Ledger": {
#         "before_insert":           "roqson_core.inventory_ledger.before_insert",
#         "after_insert":            "roqson_core.inventory_ledger.after_insert",
#         "on_update_after_submit":  "roqson_core.inventory_ledger.on_update_after_submit",
#     },
# }
doc_events = {
    "Receipt": {
        "before_cancel": "roqson_core.receipt.before_cancel",
        "on_submit":     "roqson_core.receipt.on_submit",
    },
    "Cost Tier": {
        "before_save": "roqson_core.cost_tier.before_save",
    },
    "Price Change Request": {
        "after_save": "roqson_core.price_change_request.after_save",
    },
    "Inventory Entry": {
        "after_insert": "roqson_core.inventory_entry.after_insert",
    },
    "Inventory Ledger": {
        "before_insert":          "roqson_core.inventory_ledger.before_insert",
        "after_insert":           "roqson_core.inventory_ledger.after_insert",
        "on_update_after_submit": "roqson_core.inventory_ledger.on_update_after_submit",
    },
    "Sales": {
        "before_save": "roqson_core.sales.before_save",
        "after_save":  "roqson_core.sales.after_save",
    },
    "Customer Information": {
        "before_save":            "roqson_core.customer_information.before_save",
        "on_update_after_submit": "roqson_core.customer_information.on_update_after_submit",
    },
    "Order Form": {
        "before_delete":          "roqson_core.order_form.before_delete",
        "before_save":            "roqson_core.order_form.before_save",
        "before_submit":          "roqson_core.order_form.before_submit",
        "after_save":             "roqson_core.order_form.after_save",
        "on_update_after_submit": "roqson_core.order_form.on_update_after_submit",
        "on_submit":              "roqson_core.order_form.on_submit",
        "on_cancel":              "roqson_core.order_form.on_cancel",
    },
    "Trips": {
        "before_insert":   "roqson_core.trips.before_insert",
        "before_validate": "roqson_core.trips.before_validate",
        "before_save":     "roqson_core.trips.before_save",
        "after_insert":    "roqson_core.trips.after_insert",
        "after_save":      "roqson_core.trips.after_save",
    },
    "Credit Application": {
        "before_save":            "roqson_core.credit_application.before_save",
        "before_submit":          "roqson_core.credit_application.before_submit",
        "after_save":             "roqson_core.credit_application.after_save",
        "on_update_after_submit": "roqson_core.credit_application.on_update_after_submit",
    },
}

# Permission query conditions — populated in Phase 6
# Target state (from ARCHITECTURE.md):
#
# permission_query_conditions = {
#     "Order Form":           "roqson_core.permissions.get_order_form_conditions",
#     "Trips":                "roqson_core.permissions.get_trips_conditions",
#     "Sales":                "roqson_core.permissions.get_sales_conditions",
#     "Credit Application":   "roqson_core.permissions.get_credit_application_conditions",
#     "Customer Survey Form": "roqson_core.permissions.get_customer_survey_form_conditions",
#     "Customer Information": "roqson_core.permissions.get_customer_information_conditions",
#     "Product":              "roqson_core.permissions.get_product_conditions",
#     "Nature of Business":   "roqson_core.permissions.get_nature_of_business_conditions",
#     "Promos":               "roqson_core.permissions.get_promos_conditions",
#     "Discounts":            "roqson_core.permissions.get_discounts_conditions",
#     "Territories":          "roqson_core.permissions.get_territories_conditions",
#     "Vehicles":             "roqson_core.permissions.get_vehicles_conditions",
#     "Warehouses":           "roqson_core.permissions.get_warehouses_conditions",
#     "Brands":               "roqson_core.permissions.get_brands_conditions",
#     "Sales Personnel":      "roqson_core.permissions.get_sales_personnel_conditions",
# }
permission_query_conditions = {
    "Order Form":           "roqson_core.permissions.get_order_form_conditions",
    "Trips":                "roqson_core.permissions.get_trips_conditions",
    "Sales":                "roqson_core.permissions.get_sales_conditions",
    "Credit Application":   "roqson_core.permissions.get_credit_application_conditions",
    "Customer Survey Form": "roqson_core.permissions.get_customer_survey_form_conditions",
    "Customer Information": "roqson_core.permissions.get_customer_information_conditions",
    "Product":              "roqson_core.permissions.get_product_conditions",
    "Nature of Business":   "roqson_core.permissions.get_nature_of_business_conditions",
    "Promos":               "roqson_core.permissions.get_promos_conditions",
    "Discounts":            "roqson_core.permissions.get_discounts_conditions",
    "Territories":          "roqson_core.permissions.get_territories_conditions",
    "Vehicles":             "roqson_core.permissions.get_vehicles_conditions",
    "Warehouses":           "roqson_core.permissions.get_warehouses_conditions",
    "Brands":               "roqson_core.permissions.get_brands_conditions",
    "Sales Personnel":      "roqson_core.permissions.get_sales_personnel_conditions",
}

# Scheduler tasks — populated in Phase 7
# Target state:
#
# scheduler_events = {
#     "daily":  ["roqson_core.tasks.auto_archive_expired_promos"],
#     "hourly": ["roqson_core.tasks.notify_overheld_reservations"],
# }
scheduler_events = {
    "daily":  ["roqson_core.tasks.auto_archive_expired_promos"],
    "hourly": ["roqson_core.tasks.notify_overheld_reservations"],
}
