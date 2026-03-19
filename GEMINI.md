# ROQSON ERPNext — Project Context & Restoration Guide

This document is the shared foundation for any agent working on the ROQSON Industrial Sales ERPNext codebase and site behavior.

The same content should exist in:

- `CLAUDE.md`
- `GEMINI.md`
- `AGENTS.md`

## Project Essence

- Goal: Automotive lubricant ERP solution for ROQSON.
- Stack: Frappe / ERPNext v15.x.
- Main codebase: custom app in this repo.
- Production platform: managed Frappe Cloud.
- Git repository: `https://github.com/ExaltedMags/roqson-core`
- Rule: always push to this repo only.

## Source of Truth

There are multiple historical sources of behavior in this project:

1. App-owned code in this repo
2. GUI metadata stored as fixtures
3. Historical Client Scripts / Server Scripts from older environments or backups
4. Live site database state

For ongoing development, the target source of truth is the custom app in this repo, not DB runtime scripts.

## Frappe Cloud Fallback

Frappe Cloud scripting and API inspection are still valid fallback tools, but they are not the primary workflow.

Use them when:

- checking live prod/staging state
- reading currently enabled or disabled scripts
- validating remote metadata or doctypes
- comparing local app behavior against live site behavior
- recovering script logic from a site when repo parity is unclear

Preferred fallback tool:

- `roqson.py` REST wrapper

Typical fallback uses:

- inspect scripts by doctype
- fetch a specific script body
- inspect error logs
- validate API responses on live Frappe Cloud

Important rule:

- use Frappe Cloud scripting and APIs for inspection, recovery, and emergency fallback
- do not treat DB scripts as the long-term runtime target unless explicitly required

## Critical Runtime Finding

This repo contains a very important Frappe-specific caveat:

- In this Frappe build, custom doctypes do not reliably receive `doctype_js` and `doctype_list_js` through doctype meta.
- Root cause: Frappe `FormMeta.add_code()` exits early for `custom=1` doctypes, so `__js` and `__list_js` are not embedded for those doctypes.
- Consequence: a bundle can exist in the repo, be registered in hooks, and still never run in Desk.

This was verified live on `Trips`:

- `frappe.get_hooks('doctype_list_js')` included `Trips`
- but the browser never received `__list_js`
- `frappe.listview_settings['Trips']` was missing at runtime
- the Trips list script was therefore never executing

### Required Workaround

For affected custom doctypes, migrated bundles may need to be loaded via `app_include_js` instead of relying only on:

- `doctype_js`
- `doctype_list_js`

If a migrated feature seems “present in code but dead in UI”, always verify whether the JS actually loaded at runtime before patching logic.

## Local Development Commands

### Normal code refresh

Use:

```bash
roqson refresh
```

Use this after changing:

- `.py`
- `.js`
- `.css`
- repo-owned `.json`

This rebuilds assets, syncs local app-owned metadata, and clears cache.

### GUI metadata refresh

Use:

```bash
roqson refresh gui
```

Use this after changing ERPNext/Frappe GUI metadata locally, such as:

- adding a field
- changing field/form settings
- other Customize Form changes

This exports eligible fixtures, syncs them back into the repo/local site, and clears cache.

### Important fixture rule

GUI changes are not automatically part of git.

- Without fixture export, a GUI change may exist only in the local DB.
- `roqson refresh gui` makes eligible changes visible in git by exporting fixtures.
- Always check `git diff` after GUI changes.

## Fixture Caveat

Common GUI changes may become:

- `Custom Field`
- `Property Setter`

This repo was updated to support `Property Setter` fixture handling, but agents should still verify expected diffs after GUI work. Some metadata can still be environment-specific or stored unexpectedly.

## Restoration Strategy

Do not rebuild missing ERP behavior from memory when historical scripts exist.

Best practice:

1. Use historical scripts as reference material
2. Port behavior into app-owned code
3. Do not restore DB Client Scripts / Server Scripts as runtime dependencies unless explicitly required

### Preferred restoration sources

Use these in order:

1. Pre-disable database backup
2. Disabled script records still present on site
3. `Version` history, if available
4. Existing migrated app code
5. Human memory only as a last resort

### Backup-driven restoration

This repo includes extracted historical scripts from a pre-disable backup. Use them as behavioral references, not as runtime targets.

Key locations:

- `agent_reports/backup_script_recovery/summary.md`
- `agent_reports/backup_script_recovery/client_script_files/`
- `agent_reports/backup_script_recovery/server_script_files/`
- `scripts/extract_backup_scripts.py`

## Required Restoration Workflow

For any module restoration:

1. Read the historical backup-extracted scripts for that module
2. Read the current app-owned implementation
3. Verify whether the app code is actually loading at runtime
4. Build a parity map:
   - working
   - broken
   - missing
   - unclear
5. Patch only the broken or missing behaviors into the app
6. Run `roqson refresh`
7. Verify in browser with realistic records

Do not assume that “bundle exists in repo” means “feature works.”

## Runtime Verification Rule

Before concluding that a migrated module is broken or incomplete, verify whether the relevant bundle is actually active in Desk.

Examples of valid checks:

- inspect `frappe.listview_settings['Doctype']`
- inspect `locals.DocType['Doctype'].__js`
- inspect `locals.DocType['Doctype'].__list_js`
- inspect network requests / browser runtime
- inspect DOM changes or injected CSS

This is mandatory for custom doctypes.

## Current Known State

### Trips

Trips had two separate issues:

1. Real restoration gaps in form behavior
2. Runtime loading failure for custom-doctype JS

Form/list work already completed:

- restored major Trips form behavior in `roqson_core/public/js/trips_form.bundle.js`
- hardened Trips list behavior in `roqson_core/public/js/trips_list.bundle.js`
- fixed runtime loading by globally including affected bundles in `roqson_core/hooks.py`

This was verified live:

- Trips list settings became available at runtime
- Trips list CSS was injected
- list column styling began applying to real rows

### Order Form

Order Form is affected by the same custom-doctype runtime issue.

The same workaround was applied so Order Form list logic is now available at runtime as well.

Any remaining Order Form bugs after that should be treated as true migration gaps, not just missing asset loading.

## Frappe Cloud / Script Safety

When touching legacy Server Scripts or remote script content:

- Server Scripts run under RestrictedPython
- do not use f-strings
- do not use `.format()`
- prefer string concatenation and `str()`

Also:

1. Read before write
2. Never delete scripts blindly
3. Prefer soft-disable over destructive removal
4. Do not set workflow-controlled states directly unless the workflow logic explicitly expects it

Useful fallback checks:

- `python -c "import roqson; roqson.print_error_logs(20)"`
- `python -c "import roqson; roqson.get_scripts_for_doctype('Doctype Name')"`
- `python -c "import roqson; print(roqson.get_script_body('Client Script', 'Script Name'))"`

## Git and Deployment Rules

- Local code changes do not affect prod automatically.
- Pushing to git does not affect prod automatically.
- Prod changes made through GUI do not automatically return to local or git.

Recommended flow:

1. change locally
2. export fixtures if GUI metadata was changed
3. run refresh
4. verify locally
5. commit and push
6. deploy to staging/prod separately

## What Agents Should Avoid

- Do not treat reports as proof of parity unless runtime and browser behavior were checked.
- Do not assume historical DB scripts should remain the runtime solution.
- Do not rebuild from shaky memory when backup material exists.
- Do not assume `doctype_js` / `doctype_list_js` works for custom doctypes in this project without runtime verification.

## Practical Rule of Thumb

If a feature looks “default” or “dead” in a custom doctype:

1. first verify whether the bundle loaded
2. then verify whether the old behavior exists in backup scripts
3. only then patch the app logic

That ordering prevents wasted effort and false restoration work.
