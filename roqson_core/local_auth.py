from __future__ import annotations

import re
import time

import frappe


LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost"}
SKIP_PATH_PREFIXES = (
    "/api/",
    "/assets/",
    "/app",
    "/files/",
    "/private/files/",
)
WEBSITE_REDIRECT_PATHS = {
    "",
    "/",
    "/login",
    "/me",
    "/apps",
}

ASSET_PATTERN = re.compile(r'(/assets/roqson_core/[^"\'\s>,?]+)')


def _is_local_request(request) -> bool:
    request_ip = getattr(frappe.local, "request_ip", None)
    host = (getattr(request, "host", "") or "").split(":", 1)[0]
    return request_ip in LOCAL_HOSTS or host in LOCAL_HOSTS or host.endswith(".local")


def auto_login_administrator() -> None:
    """Auto-login Administrator for local development when explicitly enabled."""

    if not frappe.conf.get("local_dev_auto_login"):
        return

    request = getattr(frappe.local, "request", None) or getattr(frappe, "request", None)
    if not request:
        return

    path = getattr(request, "path", "") or ""
    if path.startswith(SKIP_PATH_PREFIXES):
        return

    # If already logged in (not Guest), don't do anything
    if getattr(frappe.session, "user", "Guest") != "Guest":
        return

    if not _is_local_request(request):
        return

    # Initialize LoginManager if needed
    from frappe.auth import LoginManager
    login_manager = getattr(frappe.local, "login_manager", None)
    if not login_manager:
        login_manager = LoginManager()
        frappe.local.login_manager = login_manager

    # Force login as Administrator
    login_manager.user = "Administrator"
    login_manager.post_login()

    # Flag for redirect in after_request
    if path in WEBSITE_REDIRECT_PATHS:
        frappe.flags.local_dev_redirect_to_app = True


def redirect_local_dev_to_app(response) -> None:
    request = getattr(frappe.local, "request", None) or getattr(frappe, "request", None)
    if request and _is_local_request(request):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        cache_buster = str(int(time.time()))

        link_header = response.headers.get("Link")
        if link_header and "/assets/roqson_core/" in link_header:
            response.headers["Link"] = ASSET_PATTERN.sub(rf"\1?v={cache_buster}", link_header)

        content_type = (response.headers.get("Content-Type") or "").lower()
        if "text/html" in content_type:
            body = response.get_data(as_text=True)
            if "/assets/roqson_core/" in body:
                response.set_data(ASSET_PATTERN.sub(rf"\1?v={cache_buster}", body))

    if not getattr(frappe.flags, "local_dev_redirect_to_app", False):
        return

    landing_page = frappe.conf.get("local_dev_landing_page") or "/app"
    
    response.status_code = 302
    response.headers["Location"] = landing_page
    response.set_data(b"")
