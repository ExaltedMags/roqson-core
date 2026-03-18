# Fresh Install Parity: Execution Plan

**Date:** 2026-03-18
**Author:** Gemini CLI Agent
**Objective:** Transition `roqson_core` from a "restore-dependent" app to a "bootstrap-ready" app for clean local installations.

---

## 1. Immediate Blockers & Required Fixture Changes

### A. Role Security (The Foundation)
**Problem:** Workflows and permissions refer to custom roles that are not bundled.
**Action:** Update `roqson_core/hooks.py` to include `Role` fixtures.
**Target Fixture:** `roqson_core/fixtures/role.json`
**Hook Edit:**
```python
{
    "dt": "Role",
    "filters": [["name", "in", [
        "DSP", "President", "Manager", "Dispatcher", "Driver", "Credit Investigator"
    ]]]
}
```

### B. Logic Mirroring (The Brain)
**Problem:** `server_script.json` is empty, but critical automation is still DB-resident.
**Action:** Re-export all `Server Script` records into `roqson_core/fixtures/server_script.json`.
**Target:** 100% parity for `DocType Event` and `API` type scripts.

### C. Master Data Structure (The Skeleton)
**Problem:** Custom fields on standard DocTypes (e.g., `Product`, `Warehouse`) are filtered out.
**Action:** Expand `Custom Field` filter in `roqson_core/hooks.py`.
**Target Fixture:** `roqson_core/fixtures/custom_field.json`
**Updated filter:**
```python
"filters": [["dt", "in", [
    "Trips", "Address", "Vehicle", "Vehicles", "Driver",
    "Print Settings", "Order Form", "Sales", "Promos", "Contact",
    "Communication", "Credit Application", "Email Account", "Territory",
    "Product", "Customer Information", "Warehouse", "User"
]]]
```

---

## 2. Code Refactoring (Hardcoded Assumptions)

### A. Warehouse ID Abstraction
**Problem:** `api.py` and `product_form.bundle.js` hardcode `WH-00001` (SJ) and `WH-00002` (UG).
**Files to Change:**
1. `roqson_core/api.py`
2. `roqson_core/public/js/product_form.bundle.js`
**Fix:** Replace with a lookup by `warehouse_name` or `custom_short_code`.
```python
# Instead of SJ_WH = "WH-00001"
SJ_WH = frappe.db.get_value("Warehouse", {"warehouse_name": "San Jose (SJ)"}, "name")
```

### B. Jabroni Default Cleanup
**Problem:** `order_form_extras.bundle.js` clears `CTMR-05131`.
**File to Change:** `roqson_core/public/js/generated/order_form_extras.bundle.js`
**Fix:** Remove the specific ID check; replace with a generic "is_new" check if the intent was to prevent accidental carryover.

---

## 3. Automation Improvements (`local_setup.py`)

### A. Full Workspace Sync
**Problem:** Only the `Home` workspace is synced locally.
**File to Change:** `roqson_core/dev/local_setup.py`
**Fix:** Update `sync_local_shell` to iterate through the entire `workspace.json` fixture.
```python
def sync_all_workspaces():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "workspace.json"
    names = [doc["name"] for doc in json.loads(fixture_path.read_text())]
    for name in names:
        _sync_workspace_from_fixture(name)
```

### B. Automated Bootstrap Call
**Problem:** `import_missing_doctype_fixtures` is defined but never called in `after_install`.
**Action:** Ensure `sync_local_shell` calls `import_missing_doctype_fixtures` during the first run.

---

## 4. Implementation Priority

| Step | Action | Dependency | Goal |
| :--- | :--- | :--- | :--- |
| **1** | **Broaden Fixtures** | Staging Access | Capture Roles, Server Scripts, and Fields. |
| **2** | **Update hooks.py** | Step 1 | Ensure the broader fixtures are actually imported. |
| **3** | **Refactor api.py** | None | Decouple from specific staging IDs (Warehouses). |
| **4** | **Patch local_setup.py** | None | Enable full Workspace and DocType bootstrap. |
| **5** | **Bundle Cleanup** | None | Remove the hardcoded "Jabroni" ID from Order Form. |

---

## 5. Can we solve this without a staging backup?
**Partially.** 
- We can refactor the code (Step 3, 4, 5) immediately.
- We **cannot** reliably solve Step 1 and 2 without a fresh `bench export-fixtures` from a site that contains the actual data (Roles, Scripts, Fields).

---

# Receipt Regression Fix Report

**Date:** 2026-03-18
**Status:** Resolved

## Issue
The "Apply To" child table in the **Receipt** DocType was showing Sales records from all customers instead of being filtered by the selected customer. This was due to the filtering logic being commented out in the JS bundle.

## Changes Made
- **File:** `roqson_core/public/js/generated/receipt_form.bundle.js`
- **Logic Restored:**
    - Restored the `customer_link` filter in the `tt_apply_sales_query` function.
    - The dropdown for `sales_no` in the `apply_to` grid now correctly filters by `frm.doc.customer`.
- **Cleanup:**
    - Removed all `console.log` debug statements from the file to ensure a production-ready state.

## Verification Steps (Localhost)
1. Open a new or existing **Receipt** record on `roqson.local`.
2. Select a **Customer** (e.g., a customer with multiple "Received" sales).
3. Go to the **Apply To** table and click the **Sales No.** link field.
4. **Expected Result:** Only Sales records belonging to the selected customer (with status "Received" and not archived) should appear in the list.
5. Select a different customer and verify the list updates accordingly.
