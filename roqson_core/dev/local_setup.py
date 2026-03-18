from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path

import frappe
from frappe.core.doctype.data_import.data_import import import_doc


DOCTYPE_META_KEYS = {
    "doctype",
    "name",
    "creation",
    "modified",
    "modified_by",
    "owner",
    "docstatus",
    "idx",
}

DOCTYPE_ALLOWED_KEYS = {
    "actions",
    "allow_auto_repeat",
    "allow_copy",
    "allow_events_in_timeline",
    "allow_guest_to_view",
    "allow_import",
    "allow_rename",
    "autoname",
    "beta",
    "custom",
    "default_view",
    "document_type",
    "editable_grid",
    "email_append_to",
    "engine",
    "fields",
    "force_re_route_to_default_view",
    "grid_page_length",
    "has_web_view",
    "hide_toolbar",
    "in_create",
    "index_web_pages_for_search",
    "is_calendar_and_gantt",
    "is_submittable",
    "is_tree",
    "is_virtual",
    "issingle",
    "istable",
    "links",
    "make_attachments_public",
    "max_attachments",
    "module",
    "naming_rule",
    "permissions",
    "protect_attached_files",
    "quick_entry",
    "queue_in_background",
    "read_only",
    "row_format",
    "rows_threshold_for_grid_search",
    "search_fields",
    "show_name_in_global_search",
    "show_preview_popup",
    "show_title_field_in_link",
    "sort_field",
    "sort_order",
    "states",
    "title_field",
    "track_changes",
    "track_seen",
    "track_views",
    "translated_doctype",
}

CHILD_ALLOWED_KEYS = {
    "actions": {
        "action",
        "condition",
        "hidden",
        "idx",
        "label",
    },
    "fields": {
        "allow_bulk_edit",
        "allow_in_quick_entry",
        "allow_on_submit",
        "bold",
        "collapsible",
        "columns",
        "default",
        "depends_on",
        "description",
        "fetch_from",
        "fetch_if_empty",
        "fieldname",
        "fieldtype",
        "hidden",
        "hide_border",
        "hide_days",
        "hide_seconds",
        "ignore_user_permissions",
        "ignore_xss_filter",
        "in_filter",
        "in_global_search",
        "in_list_view",
        "in_preview",
        "in_standard_filter",
        "label",
        "length",
        "make_attachment_public",
        "mandatory_depends_on",
        "max_height",
        "non_negative",
        "oldfieldname",
        "oldfieldtype",
        "options",
        "permlevel",
        "placeholder",
        "precision",
        "print_hide",
        "print_hide_if_no_value",
        "read_only",
        "read_only_depends_on",
        "remember_last_selected_value",
        "report_hide",
        "reqd",
        "search_index",
        "set_only_once",
        "show_dashboard",
        "show_on_timeline",
        "show_preview_popup",
        "translatable",
        "unique",
        "width",
    },
    "links": {
        "custom",
        "group",
        "hidden",
        "idx",
        "is_child_table",
        "link_doctype",
        "link_fieldname",
        "parent_doctype",
        "table_fieldname",
    },
    "permissions": {
        "amend",
        "cancel",
        "create",
        "delete",
        "email",
        "export",
        "if_owner",
        "import",
        "permlevel",
        "print",
        "read",
        "report",
        "role",
        "select",
        "share",
        "submit",
        "write",
    },
    "states": {
        "color",
        "custom",
        "doc_status",
        "idx",
        "title",
    },
}


def _sanitize_child_rows(rows: list[dict], table_field: str, doctype_name: str | None = None) -> list[dict]:
    allowed_keys = CHILD_ALLOWED_KEYS[table_field]
    sanitized = []

    custom_doctype_names = set()
    if table_field == "fields":
        fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "doctype.json"
        custom_doctype_names = {
            doc.get("name")
            for doc in json.loads(fixture_path.read_text())
            if doc.get("name")
        }

    for row in rows:
        cleaned = {key: value for key, value in row.items() if key in allowed_keys}

        # Allow the initial bootstrap insert to proceed even when a DocType
        # links to itself before that DocType exists in the target site.
        if (
            doctype_name
            and table_field == "fields"
            and cleaned.get("fieldtype") in {"Link", "Table", "Table MultiSelect"}
            and cleaned.get("options") == doctype_name
        ):
            continue

        if (
            table_field == "fields"
            and cleaned.get("fieldtype") in {"Link", "Table", "Table MultiSelect"}
            and cleaned.get("options") in custom_doctype_names
            and not frappe.db.exists("DocType", cleaned.get("options"))
        ):
            continue

        sanitized.append(cleaned)
    return sanitized


def _sanitize_doctype_payload(doc: dict) -> dict:
    payload = {key: value for key, value in doc.items() if key in DOCTYPE_ALLOWED_KEYS}
    payload["doctype"] = "DocType"
    doctype_name = doc.get("name")
    payload.pop("autoname", None)

    for table_field in ("fields", "permissions", "actions", "links", "states"):
        if table_field == "links":
            payload[table_field] = []
            continue
        payload[table_field] = _sanitize_child_rows(doc.get(table_field) or [], table_field, doctype_name)

    return payload


@contextmanager
def _skip_missing_table_column_checks():
    original = frappe.db.has_column

    def wrapper(doctype_name, column):
        try:
            return original(doctype_name, column)
        except Exception as exc:
            if exc.__class__.__name__ == "ProgrammingError" and getattr(exc, "args", [None, None])[1] == doctype_name:
                return False
            return False

    frappe.db.has_column = wrapper
    try:
        yield
    finally:
        frappe.db.has_column = original


def import_missing_doctype_fixtures() -> dict[str, list[str]]:
    """Insert missing custom DocTypes from fixture export for local setup recovery."""

    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "doctype.json"
    docs = json.loads(fixture_path.read_text())

    inserted: list[str] = []
    skipped: list[str] = []
    failed: list[str] = []

    pending = []
    for doc in docs:
        name = doc.get("name")
        if not name:
            continue
        if frappe.db.exists("DocType", name):
            skipped.append(name)
            continue
        pending.append(doc)

    with _skip_missing_table_column_checks():
        while pending:
            next_round = []
            progress = False

            for doc in pending:
                name = doc.get("name")
                doctype = frappe.get_doc(_sanitize_doctype_payload(doc))
                doctype.flags.ignore_permissions = True
                doctype.flags.ignore_links = True

                try:
                    doctype.insert(set_name=name, ignore_permissions=True, ignore_links=True)
                    inserted.append(name)
                    progress = True
                except Exception:
                    frappe.db.rollback()
                    next_round.append(doc)

            if not progress:
                failed = [doc.get("name") for doc in next_round if doc.get("name")]
                break

            pending = next_round

    frappe.db.commit()
    return {"inserted": inserted, "skipped": skipped, "failed": failed}


def inspect_doctype_bootstrap_failures(targets: list[str] | None = None) -> list[dict[str, str]]:
    """Debug helper for clean-install fixture failures."""

    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "doctype.json"
    docs = json.loads(fixture_path.read_text())
    target_set = set(targets or [])
    failures = []

    for doc in docs:
        name = doc.get("name")
        if not name or (target_set and name not in target_set):
            continue
        if frappe.db.exists("DocType", name):
            continue

        with _skip_missing_table_column_checks():
            doctype = frappe.get_doc(_sanitize_doctype_payload(doc))
            doctype.flags.ignore_permissions = True
            doctype.flags.ignore_links = True

            try:
                doctype.insert(set_name=name, ignore_permissions=True, ignore_links=True)
                frappe.db.rollback()
            except Exception as exc:
                import traceback
                frappe.db.rollback()
                failures.append({
                    "name": name,
                    "error_type": exc.__class__.__name__,
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                })

    return failures


def import_fixture_file(filename: str) -> dict[str, str]:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / filename
    if not fixture_path.exists():
        return {"fixture": filename, "status": "missing"}

    import_doc(str(fixture_path))
    frappe.db.commit()
    return {"fixture": filename, "status": "imported"}


WORKSPACE_META_KEYS = {
    "doctype",
    "name",
    "creation",
    "modified",
    "modified_by",
    "owner",
    "docstatus",
    "idx",
}

WORKSPACE_CHILD_TABLES = (
    "links",
    "shortcuts",
    "cards",
    "charts",
    "quick_lists",
    "number_cards",
    "onboarding",
    "custom_blocks",
    "roles",
)

WORKSPACE_CHILD_META_KEYS = WORKSPACE_META_KEYS | {
    "parent",
    "parentfield",
    "parenttype",
}


def _load_workspace_fixture(name: str) -> dict | None:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "workspace.json"
    docs = json.loads(fixture_path.read_text())
    return next((doc for doc in docs if doc.get("name") == name), None)


def _load_all_workspace_fixtures() -> list[dict]:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "workspace.json"
    return json.loads(fixture_path.read_text())


def _sync_workspace_from_fixture(name: str) -> dict[str, str]:
    fixture = _load_workspace_fixture(name)
    if not fixture:
        raise frappe.ValidationError(f"Workspace fixture not found: {name}")

    if frappe.db.exists("Workspace", name):
        workspace = frappe.get_doc("Workspace", name)
    else:
        workspace = frappe.new_doc("Workspace")
        workspace.name = name

    for key, value in fixture.items():
        if key in WORKSPACE_META_KEYS or key in WORKSPACE_CHILD_TABLES:
            continue
        workspace.set(key, value)

    for table_field in WORKSPACE_CHILD_TABLES:
        workspace.set(table_field, [])
        for row in fixture.get(table_field) or []:
            child = {
                key: value
                for key, value in row.items()
                if key not in WORKSPACE_CHILD_META_KEYS
            }
            workspace.append(table_field, child)

    workspace.flags.ignore_links = True
    if workspace.is_new():
        workspace.insert(ignore_permissions=True, ignore_links=True)
    else:
        workspace.save(ignore_permissions=True)

    return {
        "workspace": name,
        "title": workspace.title,
        "module": workspace.module,
    }


def ensure_local_workspaces() -> dict[str, object]:
    """Sync all repo-owned workspaces and make Home the local default."""

    synced = []
    for fixture in _load_all_workspace_fixtures():
        name = fixture.get("name")
        if not name:
            continue
        synced.append(_sync_workspace_from_fixture(name))

    frappe.db.set_value("User", "Administrator", "default_workspace", "Home", update_modified=False)
    frappe.db.commit()
    return {"default_workspace": "Home", "synced_workspaces": synced}


def sync_local_shell() -> dict[str, object]:
    """Replay repo-owned bootstrap records after install/migrate."""

    doctype_status = import_missing_doctype_fixtures()
    doctype_fixture_status = import_fixture_file("doctype.json")
    custom_field_status = import_fixture_file("custom_field.json")
    workspace_status = ensure_local_workspaces()
    return {
        "doctype_status": doctype_status,
        "doctype_fixture_status": doctype_fixture_status,
        "custom_field_status": custom_field_status,
        **workspace_status,
    }
