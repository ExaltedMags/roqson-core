# Local Migration Status

Updated: 2026-03-18

This file tracks the current state of the local `roqson.local` staging clone after pulling more DB-owned assets into `roqson_core`.

## Repo-Owned Now

- Python API functions in `roqson_core/api.py`
- Python DocType event hooks in:
  - `roqson_core/order_form.py`
  - `roqson_core/trips.py`
  - `roqson_core/sales.py`
  - `roqson_core/receipt.py`
  - `roqson_core/credit_application.py`
  - `roqson_core/customer_information.py`
  - `roqson_core/inventory_entry.py`
  - `roqson_core/inventory_ledger.py`
  - `roqson_core/cost_tier.py`
  - `roqson_core/price_change_request.py`
- Permission query functions in `roqson_core/permissions.py`
- Scheduler tasks in `roqson_core/tasks.py`
- App-owned `Order Form` JS bundle in `roqson_core/public/js/order_form.bundle.js`
  - Source files live in `roqson_core/public/js/order_form/`
- App-owned `Sales` JS bundles in:
  - `roqson_core/public/js/sales_form.bundle.js`
  - `roqson_core/public/js/sales_list.bundle.js`
- App-owned `Customer Survey Form` JS bundles in:
  - `roqson_core/public/js/customer_survey_form.bundle.js`
  - `roqson_core/public/js/customer_survey_form_list.js`
- App-owned `Customer Information` JS bundles in:
  - `roqson_core/public/js/customer_information_form.bundle.js`
  - `roqson_core/public/js/customer_information_list.bundle.js`
- App-owned `Product` JS bundles in:
  - `roqson_core/public/js/product_form.bundle.js`
  - `roqson_core/public/js/product_list.bundle.js`
- App-owned `Trips` JS bundles in:
  - `roqson_core/public/js/trips_form.bundle.js`
  - `roqson_core/public/js/trips_list.bundle.js`
- App-owned generated migration bundles in `roqson_core/public/js/generated/` for:
  - `Credit Application`
  - `Credit Application Request`
  - `Discounts`
  - `Inventory Ledger`
  - `Inventory Balance`
  - `Address`
  - `PH Address`
  - `Drivers`
  - `Receipt`
  - archive/list shells for `Brands`, `Nature of Business`, `Promos`, `Sales Personnel`, `Territories`, `Vehicles`, `Warehouses`
  - supplemental `Order Form` and `Order Form` list behavior
- `roqson_core/fixtures/client_script.json` is now empty locally because the local site no longer depends on DB Client Scripts
- Remaining active `Server Script` records exported to `roqson_core/fixtures/server_script.json`
- Main workspaces exported to `roqson_core/fixtures/workspace.json`
- Custom fields, custom doctypes, print formats, workflows exported to fixtures

## Local Cutover Already Applied

The local site no longer depends on DB `Server Script` records for:

- Permission Query scripts
- Scheduler Event scripts
- API scripts
- DocType Event scripts

Those local DB records were disabled because app equivalents already exist in:

- `roqson_core/permissions.py`
- `roqson_core/tasks.py`
- `roqson_core/api.py`
- `roqson_core/order_form.py`
- `roqson_core/trips.py`
- `roqson_core/sales.py`
- `roqson_core/receipt.py`
- `roqson_core/credit_application.py`
- `roqson_core/customer_information.py`
- `roqson_core/inventory_entry.py`
- `roqson_core/inventory_ledger.py`
- `roqson_core/cost_tier.py`
- `roqson_core/price_change_request.py`

The local site also no longer depends on DB `Client Script` records for this first `Order Form` batch:

- `Order Form Promos`
- `Order Form: Stock Availability UX`
- `Notes Acknowledgment`
- `Order Form: Edit Mode Control`
- `Order Form: Table Management & Calculation`
- `Order Form: Totals Footer Row`
- `Price Modified Flag`

Those behaviors now load from the app via `doctype_js` in `roqson_core/hooks.py`.

The local site also no longer depends on DB `Client Script` records for this `Sales` batch:

- `Sales: Paid Validation`
- `Sales: Form Logic & Calculations`
- `Sales: Customer Info Autofill`
- `Sales: Cancel Warning`
- `Sales Pick-up Confirmation`
- `Sales List Script`
- `Sales: Receipts Section`

Those behaviors now load from the app via `doctype_js` and `doctype_list_js` in `roqson_core/hooks.py`.

The local site also no longer depends on DB `Client Script` records for this `Customer Survey Form` batch:

- `DSP Set Session`
- `Notes Indicator CSF`
- `Archive CSF List`
- `Archive CSF Form`
- `CSV: Fetch address`
- `CSF: Signed by fields`
- `CSF: DSP cant sign received fied`
- `CSF: Add photos`
- `CSF: Get Last Order`

The local site also no longer depends on DB `Client Script` records for this `Customer Information` batch:

- `Customer Info - Display Name`
- `Form Filters`
- `Hide Delete`
- `Order History Summary`
- `Archive CI List`
- `Archive CI Form`
- `Sales Personnel`
- `CI: Unlimited Credit Limit`
- `CI: Edit Permissions`
- `Customer Info: Address Helpers`

The local site also no longer depends on DB `Client Script` records for this `Product` batch:

- `Archive Product List`
- `Archive Product Form`
- `Product: Show Inventory`

The local site also no longer depends on DB `Client Script` records for this `Trips` batch:

- `Trip Ticket: Display Name`
- `Trip Ticket Linked with Order Form`
- `Trip Ticket Failed Select`
- `in-form big buttons (preferred) + fallback to toolbar buttons`
- `Show Failure Reasons Dropdown`
- `Full Order Script`
- `Daily Numbering`
- `Archive Trip Ticket List`
- `Archive Trip Ticket Form`
- `Dispatcher`
- `Trip Ticket: Multi-Driver Operations`

Those behaviors now load from the app via `doctype_js` and `doctype_list_js` in `roqson_core/hooks.py`.

The local site also no longer depends on DB `Client Script` records for the remaining legacy batches:

- `Credit Application`
- `Credit Application Request`
- `Discounts`
- `Inventory Ledger`
- `Inventory Balance`
- `Address`
- `PH Address`
- `Drivers`
- `Receipt`
- archive/list screens for `Brands`, `Nature of Business`, `Promos`, `Sales Personnel`, `Territories`, `Vehicles`, `Warehouses`
- remaining `Order Form` extras
- global Price Change Request popup behavior

## Still DB-Driven / Not Fully Migrated

The local site still has active DB records for:

- `0` Client Scripts
- `0` Server Scripts

This means the local staging clone is no longer depending on DB Client Scripts or DB Server Scripts for runtime behavior.

## What Is IDE-Friendly Today

Safe to treat as app code:

- Python business logic already wired through hooks
- Permission logic
- Scheduler logic
- App-owned replacements for the previously active Server Script layer
- App-owned replacements for the previously active Client Script layer
- App stylesheet in `roqson_core/public/css/roqson_core.css`

## What Still Needs True Migration

- Reduce `Client Script` count by moving logic into:
- Make workspace/home UI fully app-owned and reproducible from install
- Fix fixture/import ordering so a fresh install works without restoring a site backup
- Audit and refine generated migration bundles where they were lifted directly from DB scripts and not yet hand-cleaned
- Smoke-test all high-risk flows on localhost after the cutover

## Next Highest-Value Steps

1. Smoke-test the app-owned local staging clone screen by screen and fix any regressions.
2. Hand-clean the generated bundles in `roqson_core/public/js/generated/` into more maintainable app code.
3. Make a clean install path work from `roqson_core` fixtures plus code, without needing a staging DB restore.
