frappe.listview_settings["Customer Information"] = {
    add_fields: ["archived", "docstatus"],

    onload(listview) {
        if (listview.__ci_inited) return;
        listview.__ci_inited = true;

        // From: Form Filters & Archive CI Form
        setup_menu_filters(listview);
        setup_bulk_actions(listview);
        
        // From: Hide Delete
        hide_delete_action(listview);

        // Default view
        setTimeout(() => {
            set_ci_view(listview, "active");
            watch_ci_selection(listview);
        }, 500);
    },

    refresh(listview) {
        // From: Form Filters
        update_ci_action_visibility(listview);
        // From: Hide Delete
        hide_delete_action(listview);
    }
};

// --- Helper Functions ---

function setup_menu_filters(listview) {
    listview.page.add_menu_item(__("Show Active"), () => set_ci_view(listview, "active"));
    listview.page.add_menu_item(__("Show Archived"), () => set_ci_view(listview, "archived"));
    listview.page.add_menu_item(__("Show All"), () => set_ci_view(listview, "all"));
    listview.page.add_menu_item(__("Show Cancelled"), () => set_ci_view(listview, "cancelled"));
}

function setup_bulk_actions(listview) {
    listview.page.add_action_item(__("Archive Selected"), () => bulk_archive_ci(listview, 1));
    listview.page.add_action_item(__("Unarchive Selected"), () => bulk_archive_ci(listview, 0));
}

function set_ci_view(listview, mode) {
    listview.filter_area.clear();

    if (mode === "active") {
        listview.filter_area.add([[listview.doctype, "archived", "=", 0]]);
        listview.filter_area.add([[listview.doctype, "docstatus", "!=", 2]]);
    } else if (mode === "archived") {
        listview.filter_area.add([[listview.doctype, "archived", "=", 1]]);
        listview.filter_area.add([[listview.doctype, "docstatus", "!=", 2]]);
    } else if (mode === "all") {
        listview.filter_area.add([[listview.doctype, "docstatus", "!=", 2]]);
    } else if (mode === "cancelled") {
        listview.filter_area.add([[listview.doctype, "docstatus", "=", 2]]);
    }

    listview.refresh();
    update_ci_action_visibility(listview);
}

async function bulk_archive_ci(listview, val) {
    const rows = listview.get_checked_items() || [];
    const eligible = rows.filter(r => r.docstatus != 2);

    if (!eligible.length) {
        frappe.msgprint(__("Cancelled records cannot be archived."));
        return;
    }

    const verb = val ? __("Archive") : __("Unarchive");

    frappe.confirm(__("{0} {1} customer(s)?", [verb, eligible.length]), async () => {
        frappe.dom.freeze(`${verb}...`);
        for (const r of eligible) {
            await frappe.call({
                method: "frappe.client.set_value",
                args: {
                    doctype: "Customer Information",
                    name: r.name,
                    fieldname: "archived",
                    value: val
                }
            });
        }
        frappe.dom.unfreeze();
        listview.refresh();
    });
}

function update_ci_action_visibility(listview) {
    const rows = listview.get_checked_items() || [];
    let hasActive = false;
    let hasArchived = false;

    rows.forEach(r => {
        if (r.docstatus == 2) return;
        if (r.archived == 1) hasArchived = true;
        else hasActive = true;
    });

    toggle_ci_action(listview, __("Archive Selected"), hasActive);
    toggle_ci_action(listview, __("Unarchive Selected"), hasArchived);
}

function toggle_ci_action(listview, label, show) {
    const menu = $(listview.page.wrapper).find(".actions-btn-group .dropdown-menu");
    const item = menu.find("a").filter((_, el) => $(el).text().trim() === label).closest("li");
    if (item.length) item.toggle(!!show);
}

function watch_ci_selection(listview) {
    let last = -1;
    setInterval(() => {
        const now = (listview.get_checked_items() || []).length;
        if (now !== last) {
            last = now;
            update_ci_action_visibility(listview);
        }
    }, 200);
}

function hide_delete_action(listview) {
    const menu = $(listview.page.wrapper).find(".actions-btn-group .dropdown-menu");
    menu.find("a").filter((_, el) => $(el).text().trim() === __("Delete"))
        .closest("li").hide();
}
