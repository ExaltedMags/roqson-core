# PRD: CSS Injection Cleanup Sprint

**Version**: 1.0
**Created**: 2026-03-17
**Status**: Backlog — execute after roqson_core migration is confirmed stable
**Prerequisite**: roqson_core migration complete (all 10 phases done ✅)

---

## Objective

29 Client Scripts currently inject CSS into the page via inline `<style>` tags or jQuery `.css()` calls. This works but is fragile — any Frappe UI update can break selectors silently, producing invisible visual regressions with no error in the logs.

This sprint extracts all CSS injection into `roqson_core/public/css/roqson_core.css` (a proper stylesheet loaded by the app on every page) and replaces jQuery DOM manipulation with Frappe's native form APIs where applicable.

**Done looks like**: Zero `<style>` tag injections and zero `.css()` DOM manipulations remaining in active Client Scripts. All styling managed through the app stylesheet or proper Frappe APIs.

---

## Hard Constraints

1. **Do not change any business logic** — this sprint is styling only. If a Client Script mixes CSS injection with logic, extract only the CSS parts.
2. **Do not disable any Client Script** unless the entire script is pure CSS injection with zero logic.
3. **Test visually on staging after each DocType** — CSS regressions are silent. Eyes-on verification required.
4. **One DocType at a time** — same pattern as Phase 5 of the migration.
5. **No changes to production until staging is visually verified**.

---

## Background: What CSS Injection Looks Like

```javascript
// Style tag injection (most common pattern)
$('<style>.form-column { background: #f5f5f5; }</style>').appendTo('head');

// jQuery DOM manipulation
$('.btn-primary').hide();
$('.form-group').css('margin-top', '10px');
```

**Proper replacement options:**

| Current pattern | Proper replacement |
|---|---|
| Global CSS rules (colours, spacing, fonts) | `roqson_core/public/css/roqson_core.css` |
| Hide/show a specific field | `frm.set_df_property('fieldname', 'hidden', 1)` |
| Make a field read-only | `frm.set_df_property('fieldname', 'read_only', 1)` |
| Change field label | `frm.set_df_property('fieldname', 'label', 'New Label')` |
| Hide a section | `frm.set_df_property('section_name', 'hidden', 1)` |
| Conditional show/hide | `frappe.ui.form.on('DocType', { refresh: function(frm) { frm.set_df_property(...) } })` |

---

## Phase Overview

| Phase | Content | Risk |
|---|---|---|
| 0 | Audit — read each of the 29 scripts, categorise injection type | None |
| 1 | Create `public/css/roqson_core.css` + wire in hooks.py | Low |
| 2 | Extract global/shared CSS from Order Form scripts | Low |
| 3 | Extract CSS from Sales scripts | Low |
| 4 | Extract CSS from Trips scripts | Low |
| 5 | Extract CSS from Customer Survey Form scripts | Low |
| 6 | Extract CSS from Customer Information scripts | Low |
| 7 | Extract CSS from Inventory Ledger scripts | Low |
| 8 | Extract CSS from remaining scripts (Notification Log, Workspace) | Low |
| 9 | Final verification — zero injections remaining | None |

---

## The 29 Scripts (Full Inventory)

From Phase 0 audit snapshot. Grouped by DocType for processing order.

### Order Form (12 scripts)
1. `Order Form: Footer Row Summary Tab`
2. `Order Form: Totals Footer Row`
3. `Order Form: Table Management & Calculation`
4. `Order Form: Stock Availability UX`
5. `DSP Mandatory`
6. `Price Modified Flag`
7. `Order Form Display`
8. `Order Form Promos`
9. `Order Form List - Master`
10. `Order Form UX Fix`
11. `Order Form: Edit Mode Control`
12. `Notes Acknowledgment`

### Sales (4 scripts)
13. `Sales: Form Logic & Calculations`
14. `Sales List Script`
15. `Sales Pick-up Confirmation`
16. `Sales: Receipts Section`
17. `Sales: Paid Validation`

### Trips (3 scripts)
18. `Full Order Script`
19. `Trip Ticket: Multi-Driver Operations`
20. `Archive Trip Ticket List`

### Customer Survey Form (3 scripts)
21. `CSF: Get Last Order`
22. `CSF: Add photos`
23. `Notes Indicator CSF`

### Customer Information (2 scripts)
24. `Archive CI List`
25. `Order History Summary`

### Inventory Ledger (2 scripts)
26. `Movement Type Accessibility`
27. `Inventory Ledger Audit Trail`

### Other (2 scripts)
28. `Price Change Request Pop Up` (DocType: Notification Log)
29. `Workspace: PCR Popup` (DocType: Workspace)

---

## Phase 0: Audit

For each of the 29 scripts, fetch the body and answer:

1. Is the CSS **global** (applies to the whole page) or **scoped** (applies only to this form)?
2. Is the injection **pure CSS** or mixed with logic (show/hide based on conditions)?
3. Can it be replaced with `frm.set_df_property()` instead of CSS?
4. Is it safe to extract as-is, or does it depend on runtime values?

```python
import roqson
body = roqson.get_script_body('Client Script', 'SCRIPT_NAME')
print(body)
```

Record findings per script before writing any CSS.

### Exit condition
All 29 scripts reviewed. Each categorised as: `global_css` / `scoped_css` / `replace_with_frappe_api` / `mixed_keep_partial`.

---

## Phase 1: Create CSS File + Wire hooks.py

Create `roqson_core/public/css/roqson_core.css`:

```css
/* ROQSON Core Stylesheet
   Extracted from Client Script CSS injection — roqson_core CSS cleanup sprint
   Do not add business logic here. Styling only.
*/

/* === Order Form === */

/* === Sales === */

/* === Trips === */

/* === Customer Survey Form === */

/* === Customer Information === */

/* === Inventory Ledger === */
```

Wire in `hooks.py`:
```python
app_include_css = [
    "/assets/roqson_core/css/roqson_core.css"
]
```

Push, deploy to staging, verify the stylesheet loads (check browser DevTools → Network → filter CSS).

### Exit condition
`roqson_core.css` loads on staging. No CSS rules in it yet — just the structure.

---

## Phase 2–8: Per-DocType Extraction

For each DocType group, repeat this procedure:

**Step A** — For each injecting script in the group:
1. Fetch the script body
2. Extract the CSS rules from the `<style>` block
3. Add them to the correct section in `roqson_core.css`
4. Remove the `<style>` injection from the Client Script body
5. If any jQuery `.css()` calls can be replaced with `frm.set_df_property()`, do so

**Step B** — Push `roqson_core.css` to GitHub and deploy to staging

**Step C** — Visual verification on staging:
- Open a real document of that DocType in the staging Frappe Desk
- Confirm the UI looks identical to production (same colours, spacing, hidden/visible fields)
- Check browser DevTools → Elements to confirm styles are now coming from `roqson_core.css` not inline `<style>` tags

**Step D** — If staging looks correct, update Client Scripts on production and deploy CSS to production

**Step E** — Visual spot-check on production

---

## Phase 9: Final Verification

Run this against production to confirm zero injections remain:

```python
import roqson, re

cs = roqson.list_docs(
    'Client Script',
    ['name', 'dt', 'script'],
    filters=[['enabled', '=', 1]],
    limit=200
)

injecting = []
for c in cs:
    body = c.get('script', '')
    if '<style' in body or "appendTo('head')" in body or '.css(' in body:
        injecting.append({'name': c['name'], 'dt': c['dt']})

print(f"Scripts still injecting CSS: {len(injecting)}")
for s in injecting:
    print(f"  - {s['name']} ({s['dt']})")
```

Expected: `Scripts still injecting CSS: 0`

Also verify visually — open Order Form, Sales, and Trips on production and confirm all styling is intact.

### Exit condition
Zero CSS-injecting Client Scripts. All styling served from `roqson_core.css`. No visual regressions on Order Form, Sales, or Trips.

---

## Rollback

CSS changes are low risk. If a visual regression is introduced:

**Option A (CSS regression):** Revert the CSS rule in `roqson_core.css`, push, deploy. No data risk.

**Option B (Client Script broke):** Re-add the `<style>` injection back to the Client Script via `roqson.safe_update_script()`. Takes 2 minutes.

There is no DB risk in this sprint — it's pure CSS and Client Script changes.

---

## Notes

- This sprint does **not** migrate Client Scripts into the app JS bundle. That's a separate, larger initiative requiring a webpack pipeline. This sprint only extracts inline CSS into a proper stylesheet.
- Some CSS rules may reference Frappe's internal CSS class names (e.g. `.form-column`, `.frappe-card`). These are stable in v15 but may break on a v16 upgrade. Document any such selectors with a comment in `roqson_core.css` flagging them as version-sensitive.
- The Workspace and Notification Log scripts (scripts 28–29) are lower priority — they style admin-facing pages, not field-staff-facing forms. Do them last.
