# Migration Quirks Implementation Notes

## What Was Fixed

### 1. Order-to-Sales synchronization
- Approved or Reserved `Order Form` updates now resync the linked `Sales` document from server Python.
- Sync now covers header fields and Sales child rows, instead of leaving Sales as the first-approval snapshot.
- Existing `Sales Items Table.is_unreserved` flags are preserved where possible during item rebuilds so order edits do not blindly wipe Sales-side inventory state.

### 2. Redundant Sales creation logic
- Consolidated Order-to-Sales creation/update logic into one shared server helper: `sync_sales_from_order`.
- Removed duplicate inline Sales creation branches from:
  - `Order Form.after_save`
  - `Order Form.on_update_after_submit`
  - `Price Change Request.after_save`
- PCR-driven approval now uses the same Order Form sync path as normal approval.

## Files Changed
- `roqson_core/order_form.py`
- `roqson_core/price_change_request.py`

## Ownership Decisions
- Order-to-Sales creation and synchronization now belongs to server Python in `roqson_core/order_form.py`.
- PCR approval no longer owns its own Sales creation behavior; it delegates to the Order Form server helper.
- Sales-side status-specific inventory behavior remains owned by `roqson_core/sales.py`.
- UI locking behavior remains owned by app JS and was not expanded in this pass.

## Intentionally Not Changed
- `roqson_core/fixtures/workflow.json` was not modified in this pass.
- I did not add or guess a workflow `field_permissions` structure because the installed local Frappe schema I could inspect exposes `Workflow` and `Workflow Document State`, but not a clear workflow field-permission child table matching the audit wording.
- I did not touch lower-priority UI/CSS quirks.
- I did not recreate legacy DB scripts or broaden the change into repo/process files.
- I did not change `is_unreserved` source ownership between Order Form and Sales beyond preserving existing Sales flags during sync.

## What Still Needs Testing
- Approve a new `Order Form` and confirm a linked `Sales` record is created exactly once.
- Edit an already `Approved` `Order Form` with a linked `Sales` in `Pending` status and confirm:
  - quantities update
  - prices update
  - totals update
  - added/removed items are reflected
- Approve a Price Change Request that moves an order from `Needs Review` to `Approved` and confirm the same shared Sales sync path is used.
- Verify `sales_ref` is backfilled when a Sales record already exists for an order.
- Verify `outstanding_balance` only follows `grand_total` when it has not already diverged due to downstream payment activity.
- Sanity-check behavior for non-pending Sales statuses to confirm skipping sync is the right rule for operations.

## Local Validation Performed
- `python3 -m py_compile roqson_core/order_form.py roqson_core/price_change_request.py`
