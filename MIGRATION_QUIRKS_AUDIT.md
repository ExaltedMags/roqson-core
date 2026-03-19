# ROQSON Core — Migration Quirks Audit

**Date:** 2026-03-19
**Status:** Initial Audit Complete
**Project:** ROQSON Industrial Sales ERPNext (v15)

## Summary
The migration of ROQSON from a site-side script architecture to a custom-app-first architecture is largely successful. Core logic for **Order Form**, **Sales**, **Trips**, and **Customer Information** has been consolidated into version-controlled JS and Python. However, several behavioral gaps and architectural "quirks" remain, particularly around data synchronization between linked documents and the enforcement of field-level permissions via metadata vs. scripts.

---

## Confirmed Gaps (Definitely Missing)

### 1. Order-to-Sales Synchronization (Critical)
- **Issue:** Authorized users (Admins/Managers) can use the "Edit" button on an `Approved` `Order Form` to change quantities, items, or prices.
- **Gap:** These changes are **not** propagated to the linked `Sales` record if it already exists. The `Sales` record remains a stale snapshot of the first approval.
- **Correct Owner:** **Server Python** (`roqson_core/order_form.py`).
- **Proposed Fix:** Update `on_update_after_submit` in `order_form.py` to identify the linked `Sales` record and update its items/totals if the `Order Form` is updated in an `Approved` state.

### 2. Redundant Sales Creation Logic
- **Issue:** `Sales` record creation logic is duplicated in both `before_save` and `on_update_after_submit` hooks within `order_form.py`.
- **Gap:** The `before_save` implementation uses `frappe.db.set_value` and `doc.insert()`, which can lead to race conditions or partial transactions if the main save fails.
- **Correct Owner:** **Server Python** (`roqson_core/order_form.py`).
- **Proposed Fix:** Consolidate all `Sales` creation logic into `on_update_after_submit` and use `doc.flags.ignore_permissions` instead of manual DB sets where possible.

### 3. Workflow Field Permissions (Metadata)
- **Issue:** The `Order Workflow` and `Credit Approval` workflows in `fixtures/workflow.json` do not use the `field_permissions` table.
- **Gap:** While JS logic (`lock_form`, `unlock_form`) handles UI-level locking, the server-side metadata does not know that fields should be read-only in certain states. This makes the system reliant on "Administrative Bypass" flags in Python.
- **Correct Owner:** **Metadata / Fixture** (`roqson_core/fixtures/workflow.json`).
- **Proposed Fix:** Export field-level permissions (Read/Write/Hide) into the Workflow fixture for each state.

---

## Likely Gaps (High Probability)

### 4. Mobile Grid Consistency
- **Issue:** `roqson_core.css` contains sophisticated mobile grid fixes for child tables, but they are often scoped to specific DocTypes.
- **Gap:** Newer child tables (e.g., in `Credit Application` or `Inventory Entry`) may not have these styling overrides, leading to poor mobile UX.
- **Correct Owner:** **CSS** (`roqson_core/public/css/roqson_core.css`).

### 5. `is_unreserved` Propagation
- **Issue:** `Sales Items Table` has an `is_unreserved` flag used by the inventory logic.
- **Gap:** This flag is not present in `Order Details Table`, and it is not cleared or synced when an `Order Form` is re-approved or amended.
- **Correct Owner:** **Server Python** (`roqson_core/sales.py` and `order_form.py`).

---

## Risky Areas (Fragile/Non-Idiomatic)

### 6. Fragile CSS Selectors
- **Observation:** Many CSS overrides rely on Frappe-generated IDs like `#page-List\/Order\ Form\/List`.
- **Risk:** These selectors are fragile and will break if Frappe changes its page-naming convention or if the DocType is renamed.
- **Recommendation:** Use more generic class-based selectors where possible, or target the `data-page-route` attribute.

### 7. Global Bypass Flags (`ignore_validate_update_after_submit`)
- **Observation:** `order_form.py` makes heavy use of `doc.flags.ignore_validate_update_after_submit = True` for Admin roles.
- **Risk:** This bypasses ALL standard Frappe validations for submitted documents. If a script error occurs during an admin edit, it could leave the database in an inconsistent state.
- **Recommendation:** Replace broad bypasses with targeted field updates using `db_set` or specific permission overrides in the Workflow.

---

## Ownership Classification

| Feature | Correct Owner | Why? |
| :--- | :--- | :--- |
| **Field Visibility (Default)** | Metadata (DocType) | Standard Frappe behavior; improves load performance. |
| **Field Visibility (State-based)** | Metadata (Workflow) | Ensures server-side enforcement and clean UI. |
| **Complex Validations** | Server Python | Prevents data corruption; bypasses JS-only restrictions. |
| **Order-Sales Sync** | Server Python | Requires cross-document database operations. |
| **Real-time Totals/CSS** | App JS / CSS | Provides immediate feedback to the user. |

---

## Recommended Fix Order

1.  **Critical: Order-to-Sales Sync** (Python) — Prevents stale data in fulfillment.
2.  **Metadata: Workflow Permissions** (Fixture) — Reduces reliance on JS-based locking.
3.  **Refactor: Consolidate Sales Creation** (Python) — Cleans up document lifecycle hooks.
4.  **UX: CSS Selector Cleanup** (CSS) — Increases long-term stability of UI overrides.

---

## Validation Notes

- **Refresh Only:** CSS changes, JS bundle changes (after build).
- **Migrate Required:** DocType changes, Workflow changes, Custom Field additions.
- **Both Required:** When adding a new field (Migrate) and then using it in a JS calculation (Refresh).
- **Asset Rebuild:** Any changes to the `public/js/` or `public/css/` directories require a `bench build` (or `roqson-refresh` in this environment) to update the symlinked assets.
