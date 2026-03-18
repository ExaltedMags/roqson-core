// -- Trips List View Script ---------------------------------------------------
// Architecture: Label-based column identification (immune to column order changes).
// Columns visible in Trips list: ID (sales numbers) | Status | Assigned Drivers |
//   No. of Items | Liters | Area Barangay | Outlet | Vehicle
//
// Column widths
var TT_WIDTHS = {
    "tt-col-status":   "110px",
    "tt-col-drivers":  "200px",
    "tt-col-items":    "130px",
    "tt-col-liters":   "110px",
    "tt-col-barangay": "200px",
    "tt-col-outlet":   "220px",
    "tt-col-vehicle":  "120px",
};
// subject(340) + 110+200+130+110+200+220+120 = 1370 => row min 1740px
var TT_ROW_MIN = "1740px";
var TT_ALL_CLS = Object.keys(TT_WIDTHS);

// Map lowercased trimmed header text → semantic class
var TT_LABEL_MAP = {
    "status":           "tt-col-status",
    "assigned drivers": "tt-col-drivers",
    "no. of items":     "tt-col-items",
    "liters":           "tt-col-liters",
    "area barangay":    "tt-col-barangay",
    "outlet":           "tt-col-outlet",
    "vehicle":          "tt-col-vehicle",
};

function tt_apply_style(col, cls) {
    var w = TT_WIDTHS[cls];
    if (!w) return;
    TT_ALL_CLS.forEach(function(c) { col.classList.remove(c); });
    col.classList.add(cls);
    var base = "flex:0 0 " + w + " !important;min-width:" + w + " !important;max-width:" + w + " !important;" +
        "padding-left:8px;padding-right:8px;box-sizing:border-box;white-space:nowrap;overflow:hidden;";
    if (cls === "tt-col-status") {
        col.setAttribute("style", base + "display:flex !important;align-items:center;justify-content:center;");
    } else if (cls === "tt-col-items" || cls === "tt-col-liters") {
        col.setAttribute("style", base + "display:flex !important;align-items:center;justify-content:flex-end;");
    } else {
        col.setAttribute("style", base);
    }
}

function tt_style_columns(page) {
    if (!page) return;

    // Pass 1: Read header labels → build colClasses index
    var colClasses = [];
    var headerRow = page.querySelector(".list-row-head");
    if (headerRow) {
        Array.from(headerRow.querySelectorAll(".list-row-col")).forEach(function(col) {
            if (col.classList.contains("list-subject")) return;
            if (col.classList.contains("tag-col")) {
                col.style.setProperty("display", "none", "important");
                colClasses.push("__tag");
                return;
            }
            var text = (col.textContent || "").trim().toLowerCase();
            if (text === "tag") {
                col.style.setProperty("display", "none", "important");
                colClasses.push("__tag");
                return;
            }
            var cls = TT_LABEL_MAP[text] || null;
            colClasses.push(cls);
            col.style.cssText = "";
            TT_ALL_CLS.forEach(function(c) { col.classList.remove(c); });
            if (cls) {
                tt_apply_style(col, cls);
            }
        });
    }

    // Pass 2: Apply same class-by-index to data rows
    page.querySelectorAll(".list-row-container .list-row").forEach(function(row) {
        var ci = 0;
        Array.from(row.querySelectorAll(".list-row-col")).forEach(function(col) {
            if (col.classList.contains("list-subject")) return;
            col.style.cssText = "";
            TT_ALL_CLS.forEach(function(c) { col.classList.remove(c); });
            var cls = ci < colClasses.length ? colClasses[ci] : null;
            ci++;
            if (!cls || cls === "__tag") {
                if (col.classList.contains("tag-col")) {
                    col.style.setProperty("display", "none", "important");
                }
                return;
            }
            tt_apply_style(col, cls);
        });
    });
}

function injectTTCSS() {
    var existing = document.getElementById("tt-list-css");
    if (existing) existing.remove();
    var el = document.createElement("style");
    el.id = "tt-list-css";
    el.textContent = '\
#page-List\\/Trips\\/List .list-subject {\
    flex:0 0 340px !important; min-width:340px !important; max-width:340px !important;\
    overflow:hidden !important; display:flex !important; align-items:center !important;\
}\
#page-List\\/Trips\\/List .list-header-subject .list-header-meta { display:none !important; }\
\
#page-List\\/Trips\\/List .list-row-head .level-left,\
#page-List\\/Trips\\/List .list-row-container .list-row .level-left {\
    flex:0 0 auto !important; min-width:0 !important; max-width:none !important; overflow:visible !important;\
}\
#page-List\\/Trips\\/List .list-row-head .level-right,\
#page-List\\/Trips\\/List .list-row-container .list-row .level-right {\
    flex:0 0 0px !important; min-width:0px !important; max-width:0px !important; overflow:hidden !important; display:none !important;\
}\
\
#page-List\\/Trips\\/List .list-row-col { margin-right:0 !important; }\
#page-List\\/Trips\\/List .tag-col { display:none !important; }\
\
#page-List\\/Trips\\/List .list-row-head,\
#page-List\\/Trips\\/List .list-row-container .list-row {\
    min-width:' + TT_ROW_MIN + ' !important; flex-wrap:nowrap !important; display:flex !important;\
}\
\
#page-List\\/Trips\\/List .layout-main-section { overflow:visible !important; }\
#page-List\\/Trips\\/List .frappe-list,\
#page-List\\/Trips\\/List .layout-main-section-wrapper { overflow:visible !important; }\
#page-List\\/Trips\\/List .result {\
    overflow-x:auto !important; -webkit-overflow-scrolling:touch;\
}\
\
#page-List\\/Trips\\/List .list-row-col.hidden-xs,\
#page-List\\/Trips\\/List .list-row-col.hidden-sm,\
#page-List\\/Trips\\/List .list-row-col.hidden-md,\
#page-List\\/Trips\\/List .list-row-head .list-row-col.hidden-xs,\
#page-List\\/Trips\\/List .list-row-head .list-row-col.hidden-sm,\
#page-List\\/Trips\\/List .list-row-head .list-row-col.hidden-md {\
    display:flex !important;\
}\
';
    document.head.appendChild(el);
}

function removeTTCSS() {
    var x = document.getElementById("tt-list-css");
    if (x) x.remove();
}

frappe.listview_settings['Trips'] = {
  add_fields: [
    'archived',
    'trip_no',
    'sales_numbers_display',
    'assigned_drivers_display',
    'total_item_qty',
    'total_liters',
    'area_barangay',
    'area_zip_code',
    'address',
    'date',
    'workflow_state'
  ],

  formatters: {
    // Show SAL numbers in the ID column — truncate to first 2 with "+X more" if longer
    name(val, df, doc) {
      const raw = doc.sales_numbers_display || doc.trip_no || val;
      if (!doc.sales_numbers_display) return frappe.utils.escape_html(raw || val || '');
      const parts = doc.sales_numbers_display.split(', ').filter(Boolean);
      if (parts.length <= 2) return frappe.utils.escape_html(parts.join(', '));
      return frappe.utils.escape_html(parts.slice(0, 2).join(', ') + '  +' + (parts.length - 2) + ' more');
    }
  },

  onload(listview) {
    ensure_tt_summary_box(listview);
    ensure_tt_filter_cleanup(listview);

    injectTTCSS();

    if (!listview.__tt_route_handler) {
      listview.__tt_route_handler = true;
      frappe.router.on("change", function() {
        var route = frappe.get_route();
        if (route && route[0] === "List" && route[1] === "Trips") injectTTCSS();
        else removeTTCSS();
      });
    }

    // Hide Assigned Driver column for Driver-only users (it's always their own name)
    const roles = frappe.user_roles || [];
    const is_driver_only = roles.includes('Driver') && !roles.includes('Administrator') && !roles.includes('System Manager') && !roles.includes('Dispatcher');
    if (is_driver_only) {
      listview.__tt_hide_driver_col = true;
    }
  },

  refresh(listview) {
    var page = document.getElementById("page-List/Trips/List") || (listview.page.wrapper && listview.page.wrapper[0]);

    setTimeout(function() {
      ensure_tt_summary_box(listview);
      apply_tt_filter_cleanup(listview);
      render_tt_summary(listview);
      tt_style_columns(page);

      if (listview.__tt_hide_driver_col) {
        apply_tt_hide_driver_column(listview);
      }
    }, 120);

    setTimeout(function() { tt_style_columns(page); }, 600);
    setTimeout(function() { tt_style_columns(page); }, 1200);

    if (!listview.__tt_default_archive_applied) {
      listview.__tt_default_archive_applied = true;
      const filters = listview.get_filters ? listview.get_filters() : [];
      const hasArchived = (filters || []).some(f => f[1] === 'archived');
      if (!hasArchived) {
        listview.filter_area.add([[listview.doctype, 'archived', '=', 0]]);
      }
    }
  }
};

// Hide the assigned_drivers_display column header and all cells
function apply_tt_hide_driver_column(listview) {
  const wrapper = listview.page.wrapper[0];
  if (!wrapper) return;
  wrapper.querySelectorAll('[data-fieldname="assigned_drivers_display"]').forEach(el => {
    el.style.display = 'none';
  });
}

function ensure_tt_summary_box(listview) {
  if (!$(listview.page.wrapper).find('.tt-area-summary').length) {
    $(listview.page.wrapper)
      .find('.layout-main-section')
      .prepend('<div class="tt-area-summary" style="display:none; margin:12px 0 4px 0; padding:10px 14px; border-radius:10px; background:linear-gradient(135deg,#f4f0e8,#e7efe7); border:1px solid #d8dfd1;"></div>');
  }
}

function ensure_tt_filter_cleanup(listview) {
  if (listview.__tt_filter_cleanup_bound) {
    return;
  }

  listview.__tt_filter_cleanup_bound = true;

  const observer = new MutationObserver(function() {
    apply_tt_filter_cleanup(listview);
  });

  observer.observe(listview.page.wrapper[0], {
    childList: true,
    subtree: true
  });

  listview.__tt_filter_observer = observer;
}

function apply_tt_filter_cleanup(listview) {
  const wrapper = listview.page.wrapper[0];
  if (!wrapper) {
    return;
  }

  const allowed = {
    name: 'Sales No.',
    sales_numbers_display: 'Sales No.',
    assigned_drivers_display: 'Assigned Drivers',
    total_item_qty: 'No. of Items',
    total_liters: 'Liters',
    area_barangay: 'Area Barangay',
    area_zip_code: 'Area ZIP Code',
    address: 'Address',
    date: 'Delivery Date'
  };

  const seen = {};

  wrapper.querySelectorAll('.filter-selector .field-area').forEach(function(node) {
    const labelNode = node.querySelector('.like-disabled-input, .input-with-feedback, .control-input, .ellipsis');
    const text = labelNode ? (labelNode.textContent || '').trim() : '';
    let fieldname = node.getAttribute('data-fieldname') || '';

    if (!fieldname && text === 'ID') {
      fieldname = 'name';
    }

    if (!fieldname) {
      for (const key in allowed) {
        if (allowed[key] === text) {
          fieldname = key;
          break;
        }
      }
    }

    if (!fieldname || !allowed[fieldname]) {
      return;
    }

    if (labelNode) {
      labelNode.textContent = allowed[fieldname];
    }

    const dedupeKey = allowed[fieldname];
    if (seen[dedupeKey]) {
      node.remove();
      return;
    }

    seen[dedupeKey] = true;
  });
}

function render_tt_summary(listview) {
  const filters = listview.get_filters ? listview.get_filters() : [];
  const hasArea = (filters || []).some(f => f[1] === 'area_barangay' || f[1] === 'area_zip_code');
  const box = $(listview.page.wrapper).find('.tt-area-summary');

  if (!hasArea) {
    box.hide();
    return;
  }

  let qty = 0;
  let liters = 0;

  (listview.data || []).forEach(doc => {
    qty += Number(doc.total_item_qty || 0);
    liters += Number(doc.total_liters || 0);
  });

  box.html('<div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#617061;">Area Volume Summary</div><div style="display:flex; gap:18px; margin-top:6px; font-size:14px;"><div><strong>Total Qty:</strong> ' + frappe.utils.escape_html(String(qty)) + '</div><div><strong>Total Liters:</strong> ' + frappe.utils.escape_html(String(liters.toFixed(2))) + '</div></div>');
  box.show();
}
