// Client Script: Archive CA List
(function () {
frappe.listview_settings["Credit Application"] = {
  add_fields: ["archived"],

  onload(listview) {
    if (listview.__archive_initialized) return;
    listview.__archive_initialized = true;

    /* -------------------------
       MENU FILTERS
    -------------------------- */

    listview.page.add_menu_item("Show Active", () => apply_view(listview, "active"));
    listview.page.add_menu_item("Show Archived", () => apply_view(listview, "archived"));
    listview.page.add_menu_item("Show All", () => apply_view(listview, "all"));

    /* -------------------------
       BULK ACTIONS
    -------------------------- */

    listview.page.add_action_item("Archive Selected", () => bulk_archive(listview, 1));
    listview.page.add_action_item("Unarchive Selected", () => bulk_archive(listview, 0));

    /* -------------------------
       DEFAULT FILTER (SAFE)
    -------------------------- */

    const existing = listview.get_filters?.() || [];
    const hasArchivedFilter = existing.some(f => f[1] === "archived");

    if (!hasArchivedFilter) {
      listview.filter_area.add([
        [listview.doctype, "archived", "=", 0]
      ]);
    }

    install_selection_listener(listview);
  },

  refresh(listview) {
    update_visibility(listview);
  }
};


/* =====================================================
   VIEW SWITCHING (NO MANUAL REFRESH — Frappe handles it)
===================================================== */

function apply_view(listview, mode) {
  listview.filter_area.clear();

  if (mode === "active") {
    listview.filter_area.add([[listview.doctype, "archived", "=", 0]]);
  } else if (mode === "archived") {
    listview.filter_area.add([[listview.doctype, "archived", "=", 1]]);
  }
  // "all" = no filter

  // IMPORTANT: do NOT call listview.refresh()
  // filter_area.add() already triggers refresh internally
}


/* =====================================================
   VISIBILITY LOGIC (CORRECT + STABLE)
===================================================== */

function update_visibility(listview) {
  const selected = listview.get_checked_items() || [];

  const $menu = $(listview.page.wrapper)
    .find(".actions-btn-group .dropdown-menu");

  if (!$menu.length) return;

  const $archive = find_action($menu, "Archive Selected");
  const $unarchive = find_action($menu, "Unarchive Selected");

  if (!$archive.length || !$unarchive.length) return;

  if (!selected.length) {
    $archive.hide();
    $unarchive.hide();
    return;
  }

  let hasArchived = false;
  let hasActive = false;

  selected.forEach(row => {
    if (row.archived) hasArchived = true;
    else hasActive = true;
  });

  // Mixed selection → show both
  if (hasArchived && hasActive) {
    $archive.show();
    $unarchive.show();
  }
  // All archived
  else if (hasArchived) {
    $archive.hide();
    $unarchive.show();
  }
  // All active
  else {
    $archive.show();
    $unarchive.hide();
  }
}

function find_action($menu, label) {
  return $menu.find("a").filter(function () {
    return $(this).text().trim() === label;
  }).closest("li");
}


/* =====================================================
   BULK ARCHIVE / UNARCHIVE
===================================================== */

async function bulk_archive(listview, value) {
  const selected = listview.get_checked_items() || [];

  if (!selected.length) {
    frappe.msgprint("Please select at least one record.");
    return;
  }

  const verb = value ? "Archive" : "Unarchive";

  frappe.confirm(`${verb} ${selected.length} record(s)?`, async () => {
    frappe.dom.freeze(`${verb} in progress...`);

    for (const row of selected) {
      await frappe.call({
        method: "frappe.client.set_value",
        args: {
          doctype: listview.doctype,
          name: row.name,
          fieldname: "archived",
          value: value
        }
      });
    }

    frappe.dom.unfreeze();
    listview.refresh();
    frappe.show_alert(`${verb} completed.`);
  });
}


/* =====================================================
   SELECTION LISTENER (NO POLLING)
===================================================== */

function install_selection_listener(listview) {
  if (listview.__selection_listener_installed) return;
  listview.__selection_listener_installed = true;

  listview.$result.on("change", "input[type='checkbox']", function () {
    update_visibility(listview);
  });
}

})();
