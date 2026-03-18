// Client Script: Archive List Brands
// Client Script: Archive NOB List
// Client Script: Archive Promo
// Client Script: Archive SP List
// Client Script: Archive Teritorries List
// Client Script: Archive Vehicles List
// Client Script: Archive Warehouses List
(function () {
  const ARCHIVE_FIELD = "archived";
  const ARCHIVE_ACTION = "Archive Selected";
  const UNARCHIVE_ACTION = "Unarchive Selected";
  const DOCTYPES = [
    "Brands",
    "Nature of Business",
    "Promos",
    "Sales Personnel",
    "Territories",
    "Vehicles",
    "Warehouses"
  ];

  function register_archive_list(doctype) {
    frappe.listview_settings[doctype] = {
      add_fields: [ARCHIVE_FIELD],

      onload(listview) {
        if (listview.__archive_initialized) return;
        listview.__archive_initialized = true;

        listview.page.add_menu_item("Show Active", () => apply_view(listview, "active"));
        listview.page.add_menu_item("Show Archived", () => apply_view(listview, "archived"));
        listview.page.add_menu_item("Show All", () => apply_view(listview, "all"));

        listview.page.add_action_item(ARCHIVE_ACTION, () => bulk_archive(listview, 1));
        listview.page.add_action_item(UNARCHIVE_ACTION, () => bulk_archive(listview, 0));

        ensure_default_archive_filter(listview);
        install_selection_listener(listview);
      },

      refresh(listview) {
        update_visibility(listview);
      }
    };
  }

  function ensure_default_archive_filter(listview) {
    const existing = listview.get_filters?.() || [];
    const hasArchivedFilter = existing.some(filter => filter[1] === ARCHIVE_FIELD);

    if (!hasArchivedFilter) {
      listview.filter_area.add([[listview.doctype, ARCHIVE_FIELD, "=", 0]]);
    }
  }

  function apply_view(listview, mode) {
    listview.filter_area.clear();

    if (mode === "active") {
      listview.filter_area.add([[listview.doctype, ARCHIVE_FIELD, "=", 0]]);
    } else if (mode === "archived") {
      listview.filter_area.add([[listview.doctype, ARCHIVE_FIELD, "=", 1]]);
    }
  }

  function update_visibility(listview) {
    const selected = listview.get_checked_items() || [];
    const $menu = $(listview.page.wrapper).find(".actions-btn-group .dropdown-menu");

    if (!$menu.length) return;

    const $archive = find_action($menu, ARCHIVE_ACTION);
    const $unarchive = find_action($menu, UNARCHIVE_ACTION);

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

    if (hasArchived && hasActive) {
      $archive.show();
      $unarchive.show();
    } else if (hasArchived) {
      $archive.hide();
      $unarchive.show();
    } else {
      $archive.show();
      $unarchive.hide();
    }
  }

  function find_action($menu, label) {
    return $menu.find("a").filter(function () {
      return $(this).text().trim() === label;
    }).closest("li");
  }

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
            fieldname: ARCHIVE_FIELD,
            value
          }
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

    listview.$result.on("change", "input[type='checkbox']", function () {
      update_visibility(listview);
    });
  }

  DOCTYPES.forEach(register_archive_list);
})();
