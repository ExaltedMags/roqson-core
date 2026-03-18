/**
 * Product List View behavior migrated from Client Scripts.
 * Handles the Archive/Unarchive UX and filters.
 */

frappe.listview_settings["Product"] = {
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

  // IMPORTANT: filter_area.add() triggers refresh internally
}


/* =====================================================
   BULK ARCHIVE LOGIC
===================================================== */

async function bulk_archive(listview, val) {
  const rows = listview.get_checked_items() || [];
  if (!rows.length) return;

  const action = val === 1 ? "Archive" : "Unarchive";
  
  frappe.confirm(`Are you sure you want to ${action.toLowerCase()} ${rows.length} selected record(s)?`, async () => {
    frappe.show_alert({ message: __(`${action}ing...`), indicator: 'blue' }, 2);
    
    for (const row of rows) {
        // Only update if not already in the target state
        if (row.archived !== val) {
            await frappe.db.set_value(listview.doctype, row.name, 'archived', val);
        }
    }
    
    frappe.show_alert({ message: __(`${action} complete.`), indicator: 'green' }, 3);
    listview.refresh();
  });
}


/* =====================================================
   VISIBILITY HELPER (Hides/Shows Archive actions)
===================================================== */

function update_visibility(listview) {
  const selected = listview.get_checked_items() || [];
  const $menu = $(listview.page.wrapper).find(".actions-btn-group .dropdown-menu");
  if (!$menu.length) return;

  const $archive = find_action($menu, "Archive Selected");
  const $unarchive = find_action($menu, "Unarchive Selected");

  if (!$archive.length || !$unarchive.length) return;

  if (selected.length === 0) {
    $archive.hide();
    $unarchive.hide();
    return;
  }

  const all_archived = selected.every(r => r.archived);
  const all_active = selected.every(r => !r.archived);

  if (all_active) {
    $archive.show();
    $unarchive.hide();
  } else if (all_archived) {
    $archive.hide();
    $unarchive.show();
  } else {
    $archive.show();
    $unarchive.show();
  }
}

function install_selection_listener(listview) {
  // Listen for individual row check and global header check
  listview.$page.on('click', '.list-row-checkbox', () => {
    setTimeout(() => update_visibility(listview), 10);
  });
  listview.$page.on('click', '.list-header-checkbox', () => {
    setTimeout(() => update_visibility(listview), 10);
  });
}

function find_action($menu, label) {
  return $menu.find("a").filter((_, el) => $(el).text().trim() === label).closest("li");
}
