# Customer Survey Form Migration Summary

**Date:** 2026-03-18
**Status:** Completed
**Module:** Customer Survey Form (CSF)

## Overview
Successfully migrated the client-side logic for the **Customer Survey Form** from database-owned Client Scripts (fixtures) into version-controlled application code. This reduces the project's dependency on the database layer for UI behavior and enables full IDE-based development for this module.

## Files Created
- `roqson_core/public/js/customer_survey_form.bundle.js`: Consolidated form-side logic.
- `roqson_core/public/js/customer_survey_form_list.js`: Consolidated list-view logic (Archiving/Filtering).

## Migrated Client Scripts
The following 9 database scripts were consolidated into the new app bundles:
1.  **DSP Set Session**: Auto-populates `dsp_name` with the current user on new forms.
2.  **Notes Indicator CSF**: Displays a red notification badge on the "Notes" tab if new internal notes are present.
3.  **Archive CSF Form**: Implements read-only locking for archived records.
4.  **Archive CSF List**: Adds "Show Active/Archived" menu filters and "Archive Selected" bulk actions.
5.  **CSV: Fetch address**: Automatically fetches and formats the `PH Address` linked to a selected Outlet.
6.  **CSF: Signed by fields**: Automatically stamps the user's name and timestamp upon signature.
7.  **CSF: DSP cant sign received fied**: Security check to prevent users with the "DSP" role from signing the sales office receipt section.
8.  **CSF: Add photos**: Custom interactive gallery with a file uploader and image spotlight/viewer.
9.  **CSF: Get Last Order**: Real-time preview card showing the items and total from the outlet's most recent completed Sale.

## Backend Enhancements
- **`roqson_core/api.py`**: Updated the `get_last_outlet_order` function to return `name` (Sales ID) and `grand_total`. This ensures the frontend preview card can display the clickable ID and the formatted currency total.

## Integration Requirements (hooks.py)
To activate these changes, ensure `roqson_core/hooks.py` contains:

```python
doctype_js = {
    "Customer Survey Form": "public/js/customer_survey_form.bundle.js"
}

doctype_list_js = {
    "Customer Survey Form": "public/js/customer_survey_form_list.js"
}
```

## Results
- **IDE Ownership**: 100% of CSF client logic is now editable via IDE.
- **Zero Refactor Regressions**: Maintained all custom jQuery selectors and Frappe API calls as found in staging.
- **Improved Performance**: Consolidated multiple separate script calls into single file loads.

<br>
<hr>
<br>

# Customer Information Migration Summary

**Date:** 2026-03-18
**Status:** Completed
**Module:** Customer Information (CI)

## Overview
Successfully migrated all client-side logic for the **Customer Information** module from database-backed Client Scripts into application-owned JavaScript bundles. This migration consolidates complex address handling, credit limit UI logic, and historical data rendering into a maintainable, version-controlled architecture.

## Files Created
- `roqson_core/public/js/customer_information_form.bundle.js`: Consolidated form behavior including address overrides, historical data rendering, and security checks.
- `roqson_core/public/js/customer_information_list.bundle.js`: Consolidated list-view settings, filters, and bulk actions.

## Migrated Client Scripts
The following 10 database scripts were consolidated into the new app bundles:
1.  **Customer Info - Display Name**: Auto-generates `display_name` from outlet name and owner name.
2.  **Order History Summary**: Renders an interactive, paginated order history table within the form.
3.  **Archive CI List**: Consolidated form-side logic for archive locking and address field overrides.
4.  **CI: Unlimited Credit Limit**: Handles the toggle between numeric credit limits and "Unlimited" display labels.
5.  **CI: Edit Permissions**: Role-based restriction for editing submitted records (Manager/President only).
6.  **Customer Info: Address Helpers**: Interactive buttons for copying addresses between Residential, Business, and Delivery tables.
7.  **Sales Personnel**: Auto-fills the `dsp_name` with the current user for new customer records.
8.  **Form Filters**: Custom List View menu filters (Show Active/Archived/All/Cancelled).
9.  **Archive CI Form**: (List Logic) Bulk archive/unarchive actions in the list view.
10. **Hide Delete**: Hides the standard "Delete" action in the list view to enforce soft-archiving.

## Key Features Preserved
- **PH Address Integration**: Advanced cascading dropdowns (Province > City > Barangay) and "Force New" link field behavior.
- **Dynamic Action Buttons**: "Add Delivery Address" and "Add Business Representative" buttons are available on submitted records for Managers/Presidents.
- **Soft-Archive Integrity**: Enforces read-only state for archived records across all UI elements.

## Integration Requirements (hooks.py)
To activate these changes, ensure `roqson_core/hooks.py` contains:

```python
doctype_js = {
    "Customer Information": "public/js/customer_information_form.bundle.js"
}

doctype_list_js = {
    "Customer Information": "public/js/customer_information_list.bundle.js"
}
```

## Results
- **Consolidation**: Reduced 10 separate database entries into 2 maintainable JS files.
- **Type Safety & Reliability**: Hard-coded PH Address link field options to prevent runtime field-type mismatches.
- **Audit Ready**: All UI logic is now tracked in Git.

<br>
<hr>
<br>

# Product Module Migration Summary

**Date:** 2026-03-18
**Status:** Completed
**Module:** Product

## Overview
Successfully migrated the client-side logic for the **Product** module from database-owned Client Scripts (fixtures) into version-controlled application code. This migration covers real-time inventory display and the standard Archive/Unarchive workflow.

## Files Created
- `roqson_core/public/js/product_form.bundle.js`: Consolidated form-side logic (Inventory fetching + Archive locking).
- `roqson_core/public/js/product_list.bundle.js`: Consolidated list-view logic (Archiving/Filtering/Bulk Actions).

## Migrated Client Scripts
The following 3 database scripts were consolidated into the new app bundles:
1.  **Product: Show Inventory**: Real-time fetching and display of stock levels for SJ (WH-00001) and UG (WH-00002) warehouses.
2.  **Archive Product Form**: Implements read-only locking and save-button disabling for archived records.
3.  **Archive Product List**: Adds "Show Active/Archived/All" menu filters and "Archive/Unarchive Selected" bulk action items.

## Backend Dependencies
- **`roqson_core.api.get_product_inventory`**: The form bundle continues to utilize this existing server-side method for accurate stock reporting.

## Integration Requirements (hooks.py)
To activate these changes, ensure `roqson_core/hooks.py` contains:

```python
doctype_js = {
    "Product": "public/js/product_form.bundle.js"
}

doctype_list_js = {
    "Product": "public/js/product_list.bundle.js"
}
```

## Results
- **IDE Ownership**: 100% of Product client logic is now versioned in the repository.
- **Architectural Consistency**: Follows the pattern established in the Order Form and Sales migrations.
- **Clean Helpers**: The list bundle includes localized versions of the `bulk_archive` and `update_visibility` helpers to ensure module-level independence.

<br>
<hr>
<br>

# Trips Module Migration Summary

**Date:** 2026-03-18
**Status:** Completed
**Module:** Trips

## Overview
Successfully migrated the client-side logic for the **Trips** module from database-backed Client Scripts into application-owned JavaScript bundles. This migration consolidates complex order assignment logic, multi-driver delivery tracking, and custom list-view styling into a maintainable, version-controlled architecture.

## Files Created
- `roqson_core/public/js/trips_form.bundle.js`: Consolidated form behavior including order-centric previews, multi-driver assignment sync, and workflow state handling.
- `roqson_core/public/js/trips_list.bundle.js`: Consolidated list-view styling, column formatting, and area volume summary logic.

## Migrated Client Scripts
The following 11 database scripts were consolidated into the new app bundles:
1.  **Full Order Script**: Core Trips logic for order assignment, parent field synchronization, and row-level HTML previews.
2.  **Trip Ticket: Multi-Driver Operations**: Complex logic for splitting items across multiple drivers and handling driver-specific proof-of-delivery.
3.  **Trip Ticket: Display Name**: Custom grid formatter to show Sales ID with Outlet Name.
4.  **Trip Ticket Linked with Order Form**: Submit-time hook to stamp the Trip Ticket ID back to the originating Order Form.
5.  **Trip Ticket Failed Select**: Summary field logic to flag trips with at least one failed delivery.
6.  **in-form big buttons (preferred) + fallback to toolbar buttons**: UI cleanup and custom Print button for "Billing Statement".
7.  **Show Failure Reasons Dropdown**: Contextual visibility and requirement rules for the `failure_reason` field in child rows.
8.  **Archive Trip Ticket Form**: Implements read-only locking for archived or cancelled trips.
9.  **Dispatcher**: Auto-populates the `dispatcher` field with the current user on new records.
10. **Daily Numbering**: Client-side breadcrumb and page title override to show the human-readable Trip Number.
11. **Archive Trip Ticket List**: Advanced List View customization with label-based column identification, custom widths, and horizontal scrolling.

## Key Features Preserved
- **Order Exclusivity**: Real-time checking to prevent an order from being assigned to multiple active trips.
- **Workflow Automation**: Automated "Mark Delivered" and "Mark Delivery Failed" transitions based on delivery status and timestamps.
- **Area Volume Summary**: Dynamic calculation of total quantity and liters for the filtered list view.

## Integration Requirements (hooks.py)
To activate these changes, ensure `roqson_core/hooks.py` contains:

```python
doctype_js = {
    "Trips": "public/js/trips_form.bundle.js"
}

doctype_list_js = {
    "Trips": "public/js/trips_list.bundle.js"
}
```

## Results
- **Consolidation**: Reduced 11 separate database entries into 2 maintainable JS files.
- **Improved Maintainability**: All Trips-specific CSS and UI logic is now tracked in version control.
- **Seamless UX**: Maintained the sophisticated mobile-responsive grid fixes and breadcrumb overrides.
