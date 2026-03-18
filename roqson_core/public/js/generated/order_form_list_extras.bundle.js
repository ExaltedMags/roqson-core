// Client Script: Order Form List - Master
(function () {
// ── Module-level helpers ───────────────────────────────────────────────────────

function apply_order_range_filter(listview, field, from_date, to_date) {
    ['date', 'preferred_delivery_date'].forEach(function(f) {
        listview.filter_area.filter_list.filters
            .filter(function(x) { return x.fieldname === f; })
            .forEach(function(x) { x.remove(); });
    });
    listview.filter_area.add([
        [listview.doctype, field, '>=', from_date],
        [listview.doctype, field, '<=', to_date]
    ]);
    listview.refresh();
}

function clear_all_order_date_filters(listview) {
    ['date', 'preferred_delivery_date'].forEach(function(f) {
        listview.filter_area.filter_list.filters
            .filter(function(x) { return x.fieldname === f; })
            .forEach(function(x) { x.remove(); });
    });
    listview.refresh();
}

function set_order_active_preset($active_btn) {
    $('.order-preset-btn')
        .removeClass('btn-primary')
        .addClass('btn-default')
        .css({ 'font-weight': 'normal', 'justify-content': 'center' });
    if ($active_btn) {
        $active_btn
            .removeClass('btn-default')
            .addClass('btn-primary')
            .css({ 'font-weight': 'bold', 'justify-content': 'center' });
    }
}

function apply_view(listview, mode) {
    listview.filter_area.clear();
    if (mode === "active")       listview.filter_area.add([[listview.doctype, "archived", "=", 0]]);
    else if (mode === "archived") listview.filter_area.add([[listview.doctype, "archived", "=", 1]]);
}

function update_visibility(listview) {
    const selected = listview.get_checked_items() || [];
    const $menu = $(listview.page.wrapper).find(".actions-btn-group .dropdown-menu");
    if (!$menu.length) return;
    const $archive   = find_action($menu, "Archive Selected");
    const $unarchive = find_action($menu, "Unarchive Selected");
    if (!$archive.length || !$unarchive.length) return;

    if (!selected.length) { $archive.hide(); $unarchive.hide(); return; }

    let hasArchived = false, hasActive = false;
    selected.forEach(row => { if (row.archived) hasArchived = true; else hasActive = true; });

    if (hasArchived && hasActive) { $archive.show(); $unarchive.show(); }
    else if (hasArchived)         { $archive.hide(); $unarchive.show(); }
    else                          { $archive.show(); $unarchive.hide(); }
}

function find_action($menu, label) {
    return $menu.find("a").filter(function() {
        return $(this).text().trim() === label;
    }).closest("li");
}

async function bulk_archive(listview, value) {
    const selected = listview.get_checked_items() || [];
    if (!selected.length) { frappe.msgprint("Please select at least one record."); return; }
    const verb = value ? "Archive" : "Unarchive";
    frappe.confirm(`${verb} ${selected.length} record(s)?`, async () => {
        frappe.dom.freeze(`${verb} in progress...`);
        for (const row of selected) {
            await frappe.call({
                method: "frappe.client.set_value",
                args: { doctype: listview.doctype, name: row.name, fieldname: "archived", value: value }
            });
        }
        frappe.dom.unfreeze();
        listview.refresh();
        frappe.show_alert(`${verb} completed.`);
    });
}

function install_selection_listener(listview) {
    if (listview.__selection_listener_installed) return;
    listview.__selection_listener_installed = true;
    listview.$result.on("change", "input[type='checkbox']", function() {
        update_visibility(listview);
    });
}

function get_filter_controller(listview) {
    const fa = listview.filter_area;
    if (!fa || !fa.filter_list) return null;
    return { fa, fl: fa.filter_list };
}

async function wait_for_filter_ui(listview) {
    for (let i = 0; i < 30; i++) {
        const ctrl = get_filter_controller(listview);
        if (ctrl) return ctrl;
        await sleep(100);
    }
    throw new Error("Filter UI not ready");
}

async function set_state_filter(listview, state) {
    const { fa, fl } = await wait_for_filter_ui(listview);
    fl.clear_filters();
    fl.add_filter("Order Form", "workflow_state", "=", state);
    trigger_list_refresh(fa, listview);
}

async function clear_state_filter(listview) {
    const { fa, fl } = await wait_for_filter_ui(listview);
    fl.clear_filters();
    trigger_list_refresh(fa, listview);
}

function trigger_list_refresh(fa, listview) {
    if (fa && typeof fa.trigger_refresh === "function") {
        fa.trigger_refresh();
    } else if (fa && typeof fa.debounced_refresh_list_view === "function") {
        fa.debounced_refresh_list_view();
    } else {
        listview.refresh();
    }
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// ── Workflow state badge color map ───────────────────────────────────────────────
const STATE_COLORS = {
    "Draft":           { bg: "#FEFCE8", text: "#854D0E", border: "rgba(133, 77, 14, 0.15)" },
    "Needs Review":         { bg: "#FFF7ED", text: "#C2410C", border: "rgba(194, 65, 12, 0.15)" },
    "Approved":        { bg: "#F0FDF4", text: "#065F46", border: "rgba(6, 95, 70, 0.15)" },
    "Reserved":        { bg: "#F0F9FF", text: "#0C4A6E", border: "rgba(12, 74, 110, 0.15)" },
    "Dispatched":      { bg: "#F0FDFA", text: "#134E4A", border: "rgba(19, 78, 74, 0.15)" },
    "Delivered":       { bg: "#F0FDF4", text: "#14532D", border: "rgba(20, 83, 45, 0.15)" },
    "Rejected":        { bg: "#FFF1F2", text: "#9F1239", border: "rgba(159, 18, 57, 0.15)" },
    "Delivery Failed": { bg: "#FEF2F2", text: "#7F1D1D", border: "rgba(127, 29, 29, 0.15)" },
    "Redeliver":       { bg: "#F5F3FF", text: "#4C1D95", border: "rgba(76, 29, 149, 0.15)" },
    "Canceled":        { bg: "#FFF0F6", text: "#831843", border: "rgba(131, 24, 67, 0.15)" },
    "Paid":            { bg: "#F0FDF4", text: "#14532D", border: "rgba(20, 83, 45, 0.15)" },
    "Unpaid":          { bg: "#FEF2F2", text: "#7F1D1D", border: "rgba(127, 29, 29, 0.15)" },
};

function badge_html(colors, label) {
    const style = [
        `background-color:${colors.bg}`,
        `color:${colors.text}`,
        `border:1px solid ${colors.border}`,
        `border-radius:9999px`,
        `padding:2px 6px`,
        `font-size:12px`,
        `font-weight:500`,
        `white-space:nowrap`,
    ].join(';');
    return `<span style="${style}">${label}</span>`;
}

function apply_state_badge_colors(listview) {
    listview.$result.find('.list-row-container').each(function() {
        let $row = $(this);
        let docname = $row.find('.list-row-checkbox').attr('data-name');
        let doc = listview.data.find(d => d.name === docname);
        if (!doc || !doc.workflow_state) return;
        let colors = STATE_COLORS[doc.workflow_state];
        if (!colors) return;
        let $cell = $row.find('[data-filter^="workflow_state,=,"]').closest('.list-row-col');
        if (!$cell.length) return;
        if ($cell.find('.of-state-badge').length) return;
        $cell.empty().css({
            'display': 'flex',
            'align-items': 'center',
        }).append(
            $(`<span class="of-state-badge">${badge_html(colors, doc.workflow_state)}</span>`)
        );
    });
}

// ── Column width definitions (single source of truth) ────────────────────────
// Wider widths for horizontal scroll — gives content room to breathe.
// Subject(30) + ID(140) + Status(130) + Customer(240) + DeliverBy(150) +
// Address(220) + Reservation(110) + CreatedBy(130) + Date(110) = 1260 cols
// + 8 gaps * 0px (we remove gaps) = 1260
// + Activity(95) = 1355  + subject(30) = already counted
// Row total = 1450px (including 15px right-padding and internal spacing)
const OF_COL_WIDTHS = {
    "of-col-id":          "140px",
    "of-col-status":      "130px",
    "of-col-outlet":      "240px",
    "of-col-delivery-dt": "150px",
    "of-col-address":     "220px",
    "of-col-reservation": "110px",
    "of-col-createdby":   "130px",
    "of-col-date":        "110px",
};

const OF_ROW_WIDTH  = "1500px";
const OF_ACTIVITY_W = "95px";
const OF_SUBJECT_W  = "30px";

// ── Robust column styling function ───────────────────────────────────────────
// Called after BOTH badge colors and any Frappe re-renders have settled.
// Uses positional logic to identify every column reliably.
function style_all_columns(page) {
    if (!page) return;

    const OF_CLASSES = Object.keys(OF_COL_WIDTHS);

    // Map data-filter field names to our classes
    const fieldClassMap = {
        "name":                              "of-col-id",
        "outlet":                            "of-col-outlet",
        "workflow_state":                    "of-col-status",
        "order_by":                          "of-col-createdby",
        "date":                              "of-col-date",
        "reservation_urgency":               "of-col-reservation",
        "preferred_delivery_date_and_time":   "of-col-delivery-dt",
        "preferred_delivery_date_and_time":   "of-col-delivery-dt",
        "address":                           "of-col-address",
    };

    // Map header text labels to our classes
    const headerLabelMap = {
        "ID":               "of-col-id",
        "Customer":         "of-col-outlet",
        "Outlet":           "of-col-outlet",
        "Status":           "of-col-status",
        "Created By":       "of-col-createdby",
        "Date":             "of-col-date",
        "Reservation":      "of-col-reservation",
        "Deliver By":       "of-col-delivery-dt",
        "Delivery Address": "of-col-address",
    };

    function resetCol(col) {
        col.style.cssText = "";
        OF_CLASSES.forEach(c => col.classList.remove(c));
    }

    function applyColWidth(col, cls) {
        const w = OF_COL_WIDTHS[cls];
        if (!w) return;
        col.classList.add(cls);
        // Use setAttribute to set style so it's fresh every time
        const isStatus = (cls === "of-col-status");
        if (isStatus) {
            col.setAttribute("style",
                "flex:0 0 " + w + " !important;min-width:" + w + " !important;max-width:" + w + " !important;" +
                "overflow:hidden;display:flex !important;align-items:center;padding-left:8px;padding-right:8px;box-sizing:border-box;");
        } else {
            col.setAttribute("style",
                "flex:0 0 " + w + " !important;min-width:" + w + " !important;max-width:" + w + " !important;" +
                "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:8px;padding-right:8px;box-sizing:border-box;");
        }
    }

    // ── Header ──────────────────────────────────────────────────────────────
    const headerRow = page.querySelector(".list-row-head");
    if (headerRow) {
        const allHCols = Array.from(headerRow.querySelectorAll(".list-row-col"));
        allHCols.forEach(col => {
            const text = (col.textContent || "").trim();
            const cls  = headerLabelMap[text];
            if (cls) {
                resetCol(col);
                applyColWidth(col, cls);
            }
        });
        // Move ID header after subject
        const idH = allHCols.find(c => (c.textContent || "").trim() === "ID");
        const subH = headerRow.querySelector(".list-subject");
        if (idH && subH) {
            resetCol(idH);
            applyColWidth(idH, "of-col-id");
            subH.after(idH);
        }
    }

    // ── Data rows ───────────────────────────────────────────────────────────
    page.querySelectorAll(".list-row-container .list-row").forEach(row => {
        const cols = Array.from(row.querySelectorAll(".list-row-col"));

        // Step 1: Reset ALL columns first to clear any stale styles
        cols.forEach(col => {
            if (!col.classList.contains("list-subject") && !col.classList.contains("tag-col")) {
                resetCol(col);
            }
        });

        // Step 2: Classify columns with data-filter attributes
        cols.forEach(col => {
            const filterEl = col.querySelector("[data-filter]");
            if (!filterEl) return;
            const field = (filterEl.getAttribute("data-filter") || "").split(",")[0];
            const cls   = fieldClassMap[field];
            if (cls) applyColWidth(col, cls);
        });

        // Step 3: Find anchor indices for positional classification
        let idIdx = -1, outletIdx = -1, addressIdx = -1, createdByIdx = -1;
        cols.forEach((col, i) => {
            if (col.classList.contains("of-col-id"))        idIdx        = i;
            if (col.classList.contains("of-col-outlet"))    outletIdx    = i;
            if (col.classList.contains("of-col-address"))   addressIdx   = i;
            if (col.classList.contains("of-col-createdby")) createdByIdx = i;
        });

        // Step 4: Classify workflow_state — between ID and outlet, not tag-col
        if (idIdx >= 0 && outletIdx > idIdx) {
            for (let i = idIdx + 1; i < outletIdx; i++) {
                const col = cols[i];
                if (col.classList.contains("tag-col")) continue;
                if (col.classList.contains("list-subject")) continue;
                if (OF_CLASSES.some(c => col.classList.contains(c))) continue;
                applyColWidth(col, "of-col-status");
            }
        }

        // Step 5: Classify deliver_by — between outlet and address
        if (outletIdx >= 0 && addressIdx > outletIdx) {
            for (let i = outletIdx + 1; i < addressIdx; i++) {
                const col = cols[i];
                if (col.classList.contains("tag-col") || col.classList.contains("list-subject")) continue;
                if (OF_CLASSES.some(c => col.classList.contains(c))) continue;
                applyColWidth(col, "of-col-delivery-dt");
                col.classList.remove("hidden-xs");
            }
        }

        // Step 6: Classify reservation — between address and createdBy
        if (addressIdx >= 0 && createdByIdx > addressIdx) {
            for (let i = addressIdx + 1; i < createdByIdx; i++) {
                const col = cols[i];
                if (col.classList.contains("tag-col") || col.classList.contains("list-subject")) continue;
                if (OF_CLASSES.some(c => col.classList.contains(c))) continue;
                applyColWidth(col, "of-col-reservation");
            }
        }

        // Step 7: Move ID col after subject
        const idCol = cols.find(c => c.classList.contains("of-col-id"));
        const subCol = row.querySelector(".list-subject");
        if (idCol && subCol) {
            subCol.after(idCol);
        }
    });
}

// ── Main listview settings ───────────────────────────────────────────────────────
frappe.listview_settings["Order Form"] = {

    add_fields: [
        "archived", "reservation_urgency", "preferred_delivery_date",
        "preferred_delivery_time", "preferred_delivery_date_and_time",
        "workflow_state"
    ],

    formatters: {
        reservation_urgency(value, field, doc) {
            if (doc.workflow_state !== "Reserved") return "";
            if (!doc.preferred_delivery_date || !doc.preferred_delivery_time) return "";
            const preferred = frappe.datetime.get_datetime_as_string(
                doc.preferred_delivery_date + " " + doc.preferred_delivery_time
            );
            const now    = frappe.datetime.now_datetime();
            const diff   = frappe.datetime.get_hour_diff(preferred, now);
            let status = "On Track"; let color = "#2e7d32";
            if (diff < 24)  { status = "Due Soon"; color = "#f9a825"; }
            if (diff < 0)   { status = "Overdue";  color = "#ef6c00"; }
            if (diff < -48) { status = "Overheld"; color = "#c62828"; }
            return `<span style="color:${color}; font-weight:600;">${status}</span>`;
        },
        workflow_state(value, field, doc) {
            if (!value) return value;
            let colors = STATE_COLORS[value];
            if (!colors) return value;
            return badge_html(colors, value);
        },
        preferred_delivery_date_and_time(value, field, doc) {
            if (!value) return "";
            const date = frappe.datetime.str_to_obj(value);
            if (!date) return value;
            const now = new Date();
            const orderYear  = date.getFullYear();
            const currentYear = now.getFullYear();
            const month   = date.toLocaleString('en-US', { month: 'short' });
            const day     = date.getDate();
            const hours   = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm    = hours >= 12 ? 'PM' : 'AM';
            const hour12  = hours % 12 || 12;
            const datePart = orderYear < currentYear
                ? `${month} ${day}, ${orderYear}`
                : `${month} ${day}`;
            return `${datePart}, ${hour12}:${minutes} ${ampm}`;
        }    },

    onload(listview) {
        roqson_add_copy_action(listview, "Order Form", "Order Form");
        // ── Archive setup ───────────────────────────────────────────────────────
        if (!listview.__archive_initialized) {
            listview.__archive_initialized = true;
            listview.page.add_menu_item("Show Active",          () => apply_view(listview, "active"));
            listview.page.add_menu_item("Show Archived",        () => apply_view(listview, "archived"));
            listview.page.add_menu_item("Show All (Archive)",   () => apply_view(listview, "all"));
            listview.page.add_action_item("Archive Selected",   () => bulk_archive(listview, 1));
            listview.page.add_action_item("Unarchive Selected", () => bulk_archive(listview, 0));

            const existing = listview.get_filters?.() || [];
            const hasArchivedFilter = existing.some(f => f[1] === "archived");
            if (!hasArchivedFilter) {
                listview.filter_area.add([[listview.doctype, "archived", "=", 0]]);
            }
            install_selection_listener(listview);
        }

        // ── State filter menu items ─────────────────────────────────────────────
        const states = [
            "Draft","Needs Review","Approved","Reserved","Dispatched",
            "Delivered","Rejected","Delivery Failed","Redeliver","Canceled"
        ];
        states.forEach(state => {
            listview.page.add_menu_item(`Show ${state}`, () => set_state_filter(listview, state));
        });
        listview.page.add_menu_item("Show All", () => clear_state_filter(listview));
        // ── CSS injection ────────────────────────────────────────────────────────
        function injectCSS() {
            const existing = document.getElementById("of-list-css");
            if (existing) existing.remove();
            const style = document.createElement("style");
            style.id    = "of-list-css";
            style.textContent = `
#page-List\\/Order\\ Form\\/List .list-row-activity .comment-count,
#page-List\\/Order\\ Form\\/List .list-row-activity .mx-2,
#page-List\\/Order\\ Form\\/List .list-row-activity .list-row-like { display: none !important; }
#page-List\\/Order\\ Form\\/List .list-header-meta .list-liked-by-me { display: none !important; }

#page-List\\/Order\\ Form\\/List .list-subject {
    flex: 0 0 30px !important; min-width: 30px !important; max-width: 30px !important;
    overflow: hidden !important;
}
#page-List\\/Order\\ Form\\/List .list-subject .level-item.bold,
#page-List\\/Order\\ Form\\/List .list-subject .level-item.ellipsis,
#page-List\\/Order\\ Form\\/List .list-header-subject .list-subject-title,
#page-List\\/Order\\ Form\\/List .list-header-subject .list-header-meta { display: none !important; }

#page-List\\/Order\\ Form\\/List .list-row-head .level-left,
#page-List\\/Order\\ Form\\/List .list-row-container .list-row .level-left {
    flex: 0 0 auto !important; min-width: 0 !important; max-width: none !important; overflow: visible !important;
}
#page-List\\/Order\\ Form\\/List .list-row-head .level-right,
#page-List\\/Order\\ Form\\/List .list-row-container .list-row .level-right {
    flex: 0 0 95px !important; min-width: 95px !important; max-width: 95px !important; overflow: hidden !important;
}

#page-List\\/Order\\ Form\\/List .list-row-head .level-right .list-count {
    white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
}

#page-List\\/Order\\ Form\\/List .list-row-col { margin-right: 0 !important; }

#page-List\\/Order\\ Form\\/List .of-col-id {
    flex: 0 0 140px !important; min-width: 140px !important; max-width: 140px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
    font-weight: 700;
}
#page-List\\/Order\\ Form\\/List .of-col-status {
    flex: 0 0 130px !important; min-width: 130px !important; max-width: 130px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
    display: flex !important; align-items: center !important;
}
#page-List\\/Order\\ Form\\/List .of-col-outlet {
    flex: 0 0 240px !important; min-width: 240px !important; max-width: 240px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-delivery-dt {
    flex: 0 0 150px !important; min-width: 150px !important; max-width: 150px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
    display: flex !important;
}
#page-List\\/Order\\ Form\\/List .of-col-address {
    flex: 0 0 220px !important; min-width: 220px !important; max-width: 220px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-reservation {
    flex: 0 0 110px !important; min-width: 110px !important; max-width: 110px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-createdby {
    flex: 0 0 130px !important; min-width: 130px !important; max-width: 130px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-date {
    flex: 0 0 110px !important; min-width: 110px !important; max-width: 110px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-delivery-dt.hidden-xs { display: flex !important; }

#page-List\\/Order\\ Form\\/List .list-row-activity {
    flex: 0 0 95px !important; min-width: 95px !important; max-width: 95px !important;
}

#page-List\\/Order\\ Form\\/List .list-row-head,
#page-List\\/Order\\ Form\\/List .list-row-container .list-row {
    min-width: 1500px !important;
    flex-wrap: nowrap !important; display: flex !important;
}

#page-List\\/Order\\ Form\\/List .layout-main-section { overflow: visible !important; }
#page-List\\/Order\\ Form\\/List .result { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }

#page-List\\/Order\\ Form\\/List .list-row-col {
    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;
}

/* Force ALL columns visible on all screen sizes - rely on horizontal scroll instead of hiding */
#page-List\\/Order\\ Form\\/List .list-row-col.hidden-xs,
#page-List\\/Order\\ Form\\/List .list-row-col.hidden-sm,
#page-List\\/Order\\ Form\\/List .list-row-col.hidden-md,
#page-List\\/Order\\ Form\\/List .list-row-head .list-row-col.hidden-xs,
#page-List\\/Order\\ Form\\/List .list-row-head .list-row-col.hidden-sm,
#page-List\\/Order\\ Form\\/List .list-row-head .list-row-col.hidden-md {
    display: flex !important;
}

/* Ensure scroll container chain works on mobile/tablet */
#page-List\\/Order\\ Form\\/List .frappe-list,
#page-List\\/Order\\ Form\\/List .layout-main-section-wrapper {
    overflow: visible !important;
}
#page-List\\/Order\\ Form\\/List .result {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
}
`;
            document.head.appendChild(style);
        }

        function removeCSS() {
            const el = document.getElementById("of-list-css");
            if (el) el.remove();
        }

        injectCSS();
        if (!listview.__of_route_handler) {
            listview.__of_route_handler = true;
            frappe.router.on("change", () => {
                const route = frappe.get_route();
                if (route && route[0] === "List" && route[1] === "Order Form") {
                    injectCSS();
                } else {
                    removeCSS();
                }
            });
        }

        // ── Date range filter button ────────────────────────────────────────────
        let active_field = 'date';
        let from_date = null;
        let to_date   = null;

        function update_btn_state(is_active) {
            let $b = $('#order-date-filter-btn');
            if (is_active) {
                $b.removeClass('btn-default').addClass('btn-primary').text('Date Range \u2713');
                $('#order-filter-clear').show();
            } else {
                $b.removeClass('btn-primary').addClass('btn-default').text('Date Range');
                $('#order-filter-clear').hide();
            }
        }

        setTimeout(function() {
            if ($('#order-date-filter-btn').length) return;

            let $btn = $(`<button id="order-date-filter-btn" class="btn btn-default btn-sm" style="margin-right:8px;">Date Range</button>`);

            let $popover_content = $(`
                <div id="order-date-popover" style="display:none;position:fixed;z-index:9999;background:white;border:1px solid #d1d8dd;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:14px 16px;width:420px;">
                    <div style="margin-bottom:10px;">
                        <label style="font-size:11px;color:#8d99a6;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Filter By</label>
                        <select id="order-date-field-toggle" style="width:100%;border:1px solid #d1d8dd;border-radius:5px;padding:5px 28px 5px 10px;font-size:13px;cursor:pointer;background-color:white;background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path fill=%22%238d99a6%22 d=%22M6 8L1 3h10z%22/></svg>');background-repeat:no-repeat;background-position:right 10px center;-webkit-appearance:none;appearance:none;color:#36414c;height:36px;box-sizing:border-box;">
                            <option value="date">Order Date</option>
                            <option value="preferred_delivery_date">Delivery Date</option>
                        </select>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-size:11px;color:#8d99a6;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Date Range</label>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <input id="order-from-date" type="text" placeholder="From..." readonly style="flex:1;border:1px solid #d1d8dd;border-radius:5px;padding:0 8px;font-size:12px;cursor:pointer;background:white;color:#36414c;height:30px;box-sizing:border-box;min-width:0;"/>
                            <span style="color:#8d99a6;font-size:12px;flex-shrink:0;">\u2192</span>
                            <input id="order-to-date" type="text" placeholder="To..." readonly style="flex:1;border:1px solid #d1d8dd;border-radius:5px;padding:0 8px;font-size:12px;cursor:pointer;background:white;color:#36414c;height:30px;box-sizing:border-box;min-width:0;"/>
                        </div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-size:11px;color:#8d99a6;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Quick Select</label>
                        <div style="display:flex;flex-wrap:nowrap;gap:5px;align-items:stretch;">
                            <button class="order-preset-btn btn btn-default" data-days="3" style="flex:1;white-space:nowrap;font-size:13px;padding:6px 0;justify-content:center;display:flex;align-items:center;">3D</button>
                            <button class="order-preset-btn btn btn-default" data-days="5" style="flex:1;white-space:nowrap;font-size:13px;padding:6px 0;justify-content:center;display:flex;align-items:center;">5D</button>
                            <button class="order-preset-btn btn btn-default" data-days="7" style="flex:1;white-space:nowrap;font-size:13px;padding:6px 0;justify-content:center;display:flex;align-items:center;">7D</button>
                            <button class="order-preset-btn btn btn-default" data-days="14" style="flex:1;white-space:nowrap;font-size:13px;padding:6px 0;justify-content:center;display:flex;align-items:center;">14D</button>
                            <button class="order-preset-btn btn btn-default" data-days="30" style="flex:1;white-space:nowrap;font-size:13px;padding:6px 0;justify-content:center;display:flex;align-items:center;">30D</button>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <button id="order-filter-clear" class="btn btn-xs" style="border:1px solid #ff5858;color:#ff5858;background:white;display:none;padding:3px 10px;">\u2715 Clear</button>
                    </div>
                </div>
            `);

            let $standard_actions = listview.page.wrapper.find('.standard-actions');
            $standard_actions.prepend($popover_content);
            $standard_actions.prepend($btn);

            $(document).off('click.orderfilter', '#order-date-filter-btn')
                .on('click.orderfilter', '#order-date-filter-btn', function(e) {
                    e.stopPropagation();
                    let $pop = $('#order-date-popover');
                    if ($pop.is(':visible')) { $pop.hide(); return; }
                    let btnOffset = $(this).offset();
                    let btnRight  = btnOffset.left + $(this).outerWidth();
                    $pop.css({
                        top:  btnOffset.top + $(this).outerHeight() + 6,
                        left: Math.max(8, btnRight - 420)
                    }).show();
                });

            $(document).off('click.orderpopover').on('click.orderpopover', function(e) {
                let $t = $(e.target);
                if (!$t.closest('#order-date-popover, #order-date-filter-btn').length
                    && !$t.closest('.datepicker, .datepicker-global-container').length
                    && !$t.hasClass('datepicker--cell')
                    && !$t.closest('.datepicker--cell').length) {
                    $('#order-date-popover').hide();
                }
            });

            let picker_opts = {
                language:    frappe.boot.user.language || 'en',
                autoClose:   true,
                todayButton: true,
                dateFormat:  frappe.boot.sysdefaults.date_format || 'mm-dd-yyyy',
                keyboardNav: false,
                firstDay:    frappe.datetime.get_first_day_of_the_week_index(),
            };

            $('#order-from-date').datepicker({
                ...picker_opts,
                onSelect(formatted_date, date) {
                    from_date = frappe.datetime.obj_to_str(date);
                    if (to_date && from_date > to_date) { to_date = null; $('#order-to-date').val(''); }
                    if (from_date && to_date) {
                        apply_order_range_filter(listview, active_field, from_date, to_date);
                        update_btn_state(true);
                        set_order_active_preset(null);
                    }
                }
            });

            $('#order-to-date').datepicker({
                ...picker_opts,
                onSelect(formatted_date, date) {
                    to_date = frappe.datetime.obj_to_str(date);
                    if (from_date && to_date) {
                        apply_order_range_filter(listview, active_field, from_date, to_date);
                        update_btn_state(true);
                        set_order_active_preset(null);
                    }
                }
            });

            $(document).off('change.orderfilter', '#order-date-field-toggle')
                .on('change.orderfilter', '#order-date-field-toggle', function() {
                    active_field = $(this).val();
                    if (from_date && to_date) apply_order_range_filter(listview, active_field, from_date, to_date);
                    else clear_all_order_date_filters(listview);
                });

            $(document).off('click.orderfilter', '.order-preset-btn')
                .on('click.orderfilter', '.order-preset-btn', function() {
                    let days = parseInt($(this).data('days'));
                    to_date   = frappe.datetime.nowdate();
                    from_date = frappe.datetime.add_days(to_date, -days);
                    $('#order-from-date').val(frappe.datetime.str_to_user(from_date));
                    $('#order-to-date').val(frappe.datetime.str_to_user(to_date));
                    apply_order_range_filter(listview, active_field, from_date, to_date);
                    set_order_active_preset($(this));
                    update_btn_state(true);
                    $('#order-date-popover').hide();
                });

            $(document).off('click.orderfilter', '#order-filter-clear')
                .on('click.orderfilter', '#order-filter-clear', function() {
                    from_date = null; to_date = null;
                    $('#order-from-date').val('');
                    $('#order-to-date').val('');
                    clear_all_order_date_filters(listview);
                    set_order_active_preset(null);
                    update_btn_state(false);
                    $('#order-date-popover').hide();
                });
        }, 400);
    },

    refresh(listview) {
        // ── Archive visibility ──────────────────────────────────────────────────
        update_visibility(listview);

        // ── Apply badge colors first, then column widths AFTER ──────────────────
        // Badge colors at 200ms, column styling at 400ms + 600ms safety pass.
        // This ensures column widths override any style changes from badge colors.
        setTimeout(() => { apply_state_badge_colors(listview); }, 200);

        setTimeout(() => {
            const page = document.getElementById("page-List/Order Form/List");
            style_all_columns(page);
        }, 400);

        // Safety re-apply in case Frappe re-renders something late
        setTimeout(() => {
            const page = document.getElementById("page-List/Order Form/List");
            style_all_columns(page);
        }, 800);
    },
};

function roqson_add_copy_action(listview, doctype, label) {
    if (!Array.isArray(frappe.user_roles) || frappe.user_roles.indexOf("System Manager") === -1) {
        return;
    }
    if (listview.__roqson_copy_action_added) {
        return;
    }
    listview.__roqson_copy_action_added = true;

    listview.page.add_action_item("Copy to New Draft", function() {
        var selected = listview.get_checked_items() || [];
        if (selected.length !== 1) {
            frappe.msgprint("Select exactly one " + label + " record to copy.");
            return;
        }
        if (!frappe.model || typeof frappe.model.copy_doc !== "function") {
            frappe.msgprint("Copying is not available in this ERPNext build.");
            return;
        }

        frappe.dom.freeze("Preparing draft copy...");
        frappe.model.with_doctype(doctype, function() {
            frappe.db.get_doc(doctype, selected[0].name).then(function(source_doc) {
                var copied_doc = frappe.model.copy_doc(source_doc);
                roqson_prepare_copied_doc(copied_doc);
                frappe.dom.unfreeze();
                frappe.show_alert({
                    message: "Draft copy opened. Review linked references before saving.",
                    indicator: "blue"
                });
                frappe.set_route("Form", doctype, copied_doc.name);
            }).catch(function(err) {
                frappe.dom.unfreeze();
                console.error(err);
                frappe.msgprint("Unable to copy " + label + ".");
            });
        });
    });
}

function roqson_prepare_copied_doc(doc) {
    if (!doc) {
        return;
    }
    delete doc.workflow_state;
    delete doc.status;
    delete doc.docstatus;
    delete doc.amended_from;
}

})();
