# Fresh Install Status

Date: 2026-03-18

## Outcome

Fresh install parity is now materially improved and partially proven.

What is proven:

- A brand-new site can be created on the local MariaDB instance:
  - `roqson-fresh3.local`
- `erpnext` installs successfully on that blank site.
- `roqson_core` installs successfully on that blank site.
- A full `bench --site roqson-fresh3.local migrate` completes successfully after install.
- The fresh site contains the app's custom DocTypes.
- The fresh site contains the app's custom roles and role profiles.
- The fresh site contains the repo-owned workspace set and `Administrator.default_workspace = Home`.
- The fresh site has zero DB `Client Script` records.
- The fresh site has zero DB `Server Script` records.

## Fixture Coverage Added

- `Role`
- `Role Profile`
- `Workspace`
- tightened `Custom Field` coverage to standard doctypes that must exist on bootstrap
- `Server Script` fixture intentionally kept empty

## Server Script Decision

`server_script.json` should stay empty for now.

Reason:

- the working local staging clone runs with zero active DB Server Scripts
- the fresh disposable site also runs with zero DB Server Scripts
- runtime behavior is now expected to come from app Python hooks and JS assets, not DB scripts

## Bootstrap Hardening Added

`roqson_core.dev.local_setup.sync_local_shell()` now:

- bootstraps missing custom DocTypes first
- replays `doctype.json`
- replays `custom_field.json`
- syncs the repo-owned workspace set
- sets `Administrator.default_workspace = Home`

The DocType bootstrap path was hardened to survive blank-site installation by:

- inserting reduced-shell custom DocTypes first
- stripping self-referential and not-yet-existing custom links from the initial insert payload
- skipping link rows during the first pass
- inserting with explicit `set_name`

## Staging Assumptions Removed

The repo no longer relies on hardcoded warehouse IDs for the main stock helpers:

- `WH-00001`
- `WH-00002`

Warehouse resolution is now dynamic in app Python and Product form JS.

## Remaining Gaps

This is not yet equivalent to "staging restore no longer needed in all cases."

What is still not fully proven:

- a brand-new site opening in browser and matching staging UX without any manual QA
- full seed/reference data completeness for every business flow
- perfect fixture fidelity for every customization record that may still exist only in live site data
- elimination of all data assumptions beyond the hardcoded-ID fixes already done

## Practical Meaning

For normal development, the repo is now in a usable state:

- you can develop against the existing local site
- the app now owns the main runtime logic
- clean install is no longer obviously broken at install/migrate time

The next engineering step is not migration. It is validation and polish:

- workflow-by-workflow QA on a fresh site
- fill any missing reference data/bootstrap records discovered there
- then UI cleanup
