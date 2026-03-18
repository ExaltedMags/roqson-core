// Order Form extras registry
(function () {
const root = typeof window !== 'undefined' ? window : globalThis;

if (root.__roqson_order_form_extras_registry__) {
    return;
}

const registry = {
    handlers: {},

    collect(handlers) {
        Object.keys(handlers || {}).forEach((eventName) => {
            const handler = handlers[eventName];
            if (typeof handler !== 'function') {
                return;
            }
            if (!this.handlers[eventName]) {
                this.handlers[eventName] = [];
            }
            this.handlers[eventName].push(handler);
        });
    },

    activate() {
        if (this.activated) {
            return;
        }

        const mergedHandlers = {};
        Object.keys(this.handlers).forEach((eventName) => {
            const chain = this.handlers[eventName].slice();
            mergedHandlers[eventName] = function () {
                let pending = null;
                let lastResult;

                chain.forEach((handler) => {
                    if (pending) {
                        pending = pending.then(() => handler.apply(this, arguments)).then((result) => {
                            lastResult = result;
                            return result;
                        });
                        return;
                    }

                    const result = handler.apply(this, arguments);
                    if (result && typeof result.then === 'function') {
                        pending = Promise.resolve(result).then((resolved) => {
                            lastResult = resolved;
                            return resolved;
                        });
                    } else {
                        lastResult = result;
                    }
                });

                return pending || lastResult;
            };
        });

        frappe.ui.form.on('Order Form', mergedHandlers);
        this.activated = true;
    }
};

root.__roqson_order_form_extras_registry__ = registry;
root.collectOrderFormHandlers = function (handlers) {
    registry.collect(handlers);
};
})();

// Client Script: Order Form Display
(function () {

collectOrderFormHandlers({
    refresh(frm) {
        // Enforce readonly visually without Frappe's auto-hide for empty fields
        setTimeout(() => {
            if (frm.fields_dict.approved_by && frm.fields_dict.approved_by.$input) {
                let $input = frm.fields_dict.approved_by.$input;
                $input.prop("readonly", true);
                $input.css({"background-color": "var(--control-bg, #f3f3f3)", "cursor": "not-allowed"});
            }
        }, 100);

        frm.toggle_display("subtotal", false);
        frm.toggle_display("vat_amount", false);
        update_display_title(frm);
    },
    outlet(frm) {
        update_display_title(frm);
    },
    date(frm) {
        update_display_title(frm);
    }
});

function update_display_title(frm) {
    const id = frm.doc.name;
    const is_new = frm.is_new();
    const outlet = frm.doc.outlet || "";
    
    let title = "";
    if (is_new) {
        title = "New Order Form";
        if (outlet) {
            title += " - " + outlet;
        }
    } else {
        title = id;
        if (outlet) {
            title += " - " + outlet;
        }
    }
    
    // Set the hidden display_name field which is the DocType's title_field
    if (frm.doc.display_name !== title) {
        frm.set_value("display_name", title);
    }
}

})();

// Client Script: Order By Field
(function () {
collectOrderFormHandlers({
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('order_by', frappe.session.user);
        }
    }
});

})();

// Client Script: Order Form Fetch Addresses
(function () {
collectOrderFormHandlers({
  setup(frm) {
    frm.__outlet_addr_cache = frm.__outlet_addr_cache || {};
  },

  refresh(frm) {
    frm.trigger("sync_delivery_address_from_outlet");
  },

  outlet(frm) {
    // Clear cache on outlet change so fresh data is fetched
    frm.__outlet_addr_cache = {};
    frm.trigger("sync_delivery_address_from_outlet");
  },

  async sync_delivery_address_from_outlet(frm) {
    const CONFIG = {
      outlet_field: "outlet",
      delivery_address_select_field: "address",
      outlet_doctype: "Customer Information",
      outlet_child_table_field: "outlet_address",
      child_row_address_ref_field: "addresses", // PH Address doc name
      max_addresses: 50
    };

    const outlet_name = frm.doc[CONFIG.outlet_field];

    // Clear if no outlet
    if (!outlet_name) {
      frm.set_df_property(CONFIG.delivery_address_select_field, "options", "");
      await frm.set_value(CONFIG.delivery_address_select_field, "");
      frm.refresh_field(CONFIG.delivery_address_select_field);
      return;
    }

    // Fetch outlet doc (cached)
    let outlet_doc = frm.__outlet_addr_cache[outlet_name];
    if (!outlet_doc) {
      outlet_doc = await frappe.db.get_doc(CONFIG.outlet_doctype, outlet_name);
      frm.__outlet_addr_cache[outlet_name] = outlet_doc;
    }

    const rows = Array.isArray(outlet_doc[CONFIG.outlet_child_table_field])
      ? outlet_doc[CONFIG.outlet_child_table_field]
      : [];

    // Get PH Address doc names from child table
    let addr_name_list = rows
      .map(r => (r && r[CONFIG.child_row_address_ref_field] ? String(r[CONFIG.child_row_address_ref_field]).trim() : ""))
      .filter(v => v.length > 0);

    // De-dupe preserving order
    addr_name_list = [...new Set(addr_name_list)];

    if (addr_name_list.length === 0) {
      frm.set_df_property(CONFIG.delivery_address_select_field, "options", "");
      await frm.set_value(CONFIG.delivery_address_select_field, "");
      frm.refresh_field(CONFIG.delivery_address_select_field);
      return;
    }

    // Resolve each PH Address doc name → address_line1
    let results = await frappe.db.get_list("PH Address", {
      filters: [["name", "in", addr_name_list]],
      fields: ["name", "address_line1"],
      limit: CONFIG.max_addresses
    });

    // Build lookup: doc name → address_line1
    let lookup = {};
    results.forEach(r => lookup[r.name] = (r.address_line1 || "").trim() || r.name);

    // Build display list preserving child table order, falling back to doc name if no address_line1
    let addr_display_list = addr_name_list.map(n => lookup[n] || n);

    // Cap list
    if (addr_display_list.length > CONFIG.max_addresses) {
      addr_display_list = addr_display_list.slice(0, CONFIG.max_addresses);
    }

    // Blank first option = "no selection" default pattern
    const options = ["", ...addr_display_list];
    frm.set_df_property(CONFIG.delivery_address_select_field, "options", options.join("\n"));

    // Keep current value if still valid, otherwise auto-fill with first address
    const current = (frm.doc[CONFIG.delivery_address_select_field] || "").trim();
    const valid_values = new Set(addr_display_list);

    if (!current || !valid_values.has(current)) {
      await frm.set_value(CONFIG.delivery_address_select_field, addr_display_list[0]);
    }

    frm.refresh_field(CONFIG.delivery_address_select_field);
  }
});
})();

// Client Script: Price Edit
(function () {
collectOrderFormHandlers({
    refresh(frm) {
        // Roles allowed to edit price (including Sales)
        const ADMIN_ROLES = ["Administrator", "Manager", "System Manager", "President"];
        const SALES_ROLES = ["Sales", "Sales Manager", "Sales User"];
        
        const is_admin = ADMIN_ROLES.some(r => frappe.user.has_role(r));
        const is_sales = SALES_ROLES.some(r => frappe.user.has_role(r));

        const state = frm.doc.workflow_state;
        const is_draft = !state || state === 'Draft';
        const is_edit_mode = frm._roqson_edit_mode || false;

        let can_edit_price = false;

        if (is_draft) {
            // In Draft, both Sales and Admins can edit the price
            if (is_admin || is_sales) {
                can_edit_price = true;
            }
        } else if (state === 'Needs Review') {
            // In Needs Review, Sales can edit price (to review DSP-submitted orders)
            // Admins still need Edit Mode for post-Needs-Review states
            if (is_admin || is_sales) {
                can_edit_price = true;
            }
        } else {
            // Approved and beyond: only Admins in explicit 'Edit Mode' can change price
            if (is_admin && is_edit_mode) {
                can_edit_price = true;
            }
        }

        // Apply to the grid's 'price' column in the main details table (table_mkaq)
        if (frm.fields_dict.table_mkaq && frm.fields_dict.table_mkaq.grid) {
            frm.fields_dict.table_mkaq.grid.update_docfield_property(
                'price',
                'read_only',
                can_edit_price ? 0 : 1
            );
        }
    }
});
})();

// Client Script: Reward Item Name Display
(function () {
collectOrderFormHandlers({
    apply_promo(frm) {
        if (!frm.doc.apply_promo) return;

        frappe.db.get_doc('Promos', frm.doc.apply_promo).then(promo => {
            frm.set_value('promo_type', promo.promo_type);
            frm.set_value('buy_quantity', promo.buy_quantity);
            frm.set_value('get_quantity', promo.get_quantity);

            if (promo.reward_item) {
                frm.set_value('reward_item', promo.reward_item);

                // fetch description for display
                frappe.db.get_value(
                    'Product',
                    promo.reward_item,
                    'item_description'
                ).then(r => {
                    frm.set_value('reward_item_name', r.message.item_description);
                });
            }
        });
    }
});

})();

// Client Script: Total Previous Orders
(function () {
collectOrderFormHandlers({
  outlet(frm) {
    if (!frm.doc.outlet) {
      frm.set_value("total_previous_orders", 0);
      return;
    }

    frappe.call({
      method: "frappe.client.get_count",
      args: {
        doctype: "Order Form",
        filters: {
          outlet: frm.doc.outlet
          }
      },
      callback(r) {
        frm.set_value("total_previous_orders", r.message || 0);
      }
    });
  }
});

})();

// Client Script: Hide Discounts for DSPs
(function () {
collectOrderFormHandlers({
    refresh(frm) {
        // Check if the user has the DSP role AND is not the Administrator
        if (frappe.user.has_role("DSP") && frappe.session.user !== 'Administrator') {
            frm.set_df_property("discounts_section", "hidden", 1);
        } else {
            // Ensure the section is visible for everyone else (including Admin)
            frm.set_df_property("discounts_section", "hidden", 0);
        }
    }
});
})();

// Client Script: Submitted or Amended forms ONLY
(function () {
collectOrderFormHandlers({
    setup: function(frm) {
        frm.set_query('outlet', function() {
            return {
                filters: {
                    docstatus: ['!=', 2]
                }
            };
        });
    }
});
})();

// Client Script: DSP Mandatory
(function () {
collectOrderFormHandlers({
    refresh: function(frm) {
        // 1. --- Core UI Handling ---
        frm.__saving = false;

        // 2. --- DSP Role Logic (Mandatory Fields & Labels) ---
        var is_dsp_only = frappe.user_roles.includes('DSP') && !frappe.user_roles.includes('System Manager');
        var dsp_only_fields = [
            'contact_number', 'contact_person', 'date_and_time',
            'attach_image_of_store', 'attach_image_of_display', 'signed_by'
        ];
        
        var grid = frm.fields_dict['table_mkaq'] && frm.fields_dict['table_mkaq'].grid;

        if (is_dsp_only) {
            // Set fields to mandatory for DSP
            ['contact_number', 'contact_person', 'date_and_time', 'signed_by'].forEach(field => {
                frm.set_df_property(field, 'reqd', 1);
                frm.refresh_field(field);
            });
            // Handle specific mandatory asterisks for image attachments
            ['attach_image_of_store', 'attach_image_of_display'].forEach(field => {
                frm.set_df_property(field, 'reqd', 0);
                let label = frm.fields_dict[field] && frm.fields_dict[field].label_area;
                if (label && !$(label).find('.mandatory-asterisk').length) {
                    $(label).append('<span class="mandatory-asterisk" style="color: red; margin-left: 2px;">*</span>');
                }
                frm.refresh_field(field);
            });
            
            // Hide warehouse column for DSP
            if (grid) {
                grid.update_docfield_property('warehouse', 'hidden', 1);
            }
        } else {
            // Reset mandatory status for non-DSP roles
            dsp_only_fields.forEach(field => {
                frm.set_df_property(field, 'reqd', 0);
                frm.refresh_field(field);
            });
            
            // Show warehouse column for non-DSP roles
            if (grid) {
                grid.update_docfield_property('warehouse', 'hidden', 0);
            }
        }

        // 3. --- Address Field "Allow on Submit" Restriction ---
        // We only need to manage this once the document is Submitted (docstatus 1)
        if (frm.doc.docstatus === 1) {
            let allowed_roles = ['Manager', 'President', 'Administrator', 'System Manager'];
            let has_allowed_role = frappe.user_roles.some(role => allowed_roles.includes(role));
            
            // Define workflow states where editing is permitted
            // Based on your workflow: Sr 1-22 cover Draft through Reserved 
            let valid_states = ['Draft', 'Needs Review', 'Approved', 'Reserved'];
            let is_valid_state = valid_states.includes(frm.doc.workflow_state);

            if (has_allowed_role && is_valid_state) {
                // Keep field editable for privileged roles
                frm.set_df_property('address', 'read_only', 0);
            } else {
                // Explicitly lock for everyone else OR if status is Dispatched/Delivered/etc
                frm.set_df_property('address', 'read_only', 1);
            }
            frm.refresh_field('address');
        }
    },

    before_save: function(frm) {
        var is_dsp_only = frappe.user_roles.includes('DSP') && !frappe.user_roles.includes('System Manager');
        if (is_dsp_only) frm.__saving = true;
    },

    validate: function(frm) {
        var is_dsp_only = frappe.user_roles.includes('DSP') && !frappe.user_roles.includes('System Manager');
        if (!is_dsp_only || !frm.__saving) return;
        
        frm.__saving = false;
        var mandatory_fields = {
            'contact_number': 'Contact Number',
            'contact_person': 'Contact Person',
            'attach_image_of_store': 'Attach Image of Store',
            'attach_image_of_display': 'Attach Image of Display',
            'date_and_time': 'Date and Time',
            'signed_by': 'Signed and Ordered By'
        };
        
        var missing = [];
        Object.keys(mandatory_fields).forEach(field => {
            if (!frm.doc[field]) missing.push(mandatory_fields[field]);
        });
        
        if (missing.length) {
            frappe.throw(__('The following fields are mandatory: ' + missing.join(', ')));
        }
    }
});
})();

// Client Script: Archive Order Form
(function () {
collectOrderFormHandlers({

  onload(frm) {
    enforce_archive_lock(frm);
  },

  refresh(frm) {
    enforce_archive_lock(frm);
  }

});

function enforce_archive_lock(frm) {

  if (!frm.doc.archived) return;

  // Make entire form read-only
  frm.set_read_only();

  // Disable save button
  frm.disable_save();
}


})();

// Client Script: Date Backtracking
(function () {
collectOrderFormHandlers({
    validate(frm) {
        // Sync split fields → hidden combined field before validation
        if (frm.doc.preferred_delivery_date && frm.doc.preferred_delivery_time) {
            let combined = frm.doc.preferred_delivery_date + ' ' + frm.doc.preferred_delivery_time;
            frm.doc.preferred_delivery_date_and_time = combined;
        } else if (frm.doc.preferred_delivery_date) {
            frm.doc.preferred_delivery_date_and_time = frm.doc.preferred_delivery_date + ' 00:00:00';
        } else {
            frm.doc.preferred_delivery_date_and_time = null;
            return; // nothing to validate
        }

        const selected = frm.doc.preferred_delivery_date_and_time;
        const now = frappe.datetime.now_datetime();

        if (selected < now) {
            frappe.throw(__("Preferred Delivery Date and Time cannot be in the past."));
        }
    }
});
})();

// Client Script: Nature of Business Label
(function () {
collectOrderFormHandlers({
    refresh(frm) {
        frappe.db.get_list('Nature of Business', {
            fields: ['customer_group', 'archived'],
            filters: [['archived', '=', 0]],
            limit: 100
        }).then(records => {
            const excluded = ['hi', 'Testing'];
            const options = ['', ...records
                .map(r => r.customer_group)
                .filter(v => v && !excluded.includes(v))
                .sort()
            ];
            frm.set_df_property('account_type', 'options', options.join('\n'));
            frm.refresh_field('account_type');
        });
    }
});
})();

// Client Script: Date Time Sync
(function () {
collectOrderFormHandlers({
    onload_post_render(frm) {
        // On load: split existing combined value into the two new fields
        let combined = frm.doc.preferred_delivery_date_and_time;
        if (combined && !frm.doc.preferred_delivery_date) {
            let parts = combined.split(' ');
            frm.set_value('preferred_delivery_date', parts[0] || null);
            frm.set_value('preferred_delivery_time', parts[1] || null);
        }
    },

    preferred_delivery_date(frm) {
        sync_datetime(frm);
    },

    preferred_delivery_time(frm) {
        sync_datetime(frm);
    }
});

function sync_datetime(frm) {
    let d = frm.doc.preferred_delivery_date;
    let t = frm.doc.preferred_delivery_time;
    if (d && t) {
        frm.doc.preferred_delivery_date_and_time = d + ' ' + t;
    } else if (d) {
        frm.doc.preferred_delivery_date_and_time = d + ' 00:00:00';
    } else {
        frm.doc.preferred_delivery_date_and_time = null;
    }
}
})();

// Client Script: Order Form: Footer Row Summary Tab
(function () {
collectOrderFormHandlers({
    refresh(frm) { render_summary_totals_row(frm); },
    after_save(frm) { render_summary_totals_row(frm); },
    apply_discount(frm) {
        setTimeout(() => render_summary_totals_row(frm), 800);
    },
    discount_total(frm) {
        render_summary_totals_row(frm);
    }
});

frappe.ui.form.on('Order Details Table', {
    qty(frm) { render_summary_totals_row(frm); },
    price(frm) { render_summary_totals_row(frm); },
    table_aaaa_remove(frm) { render_summary_totals_row(frm); }
});

function render_summary_totals_row(frm) {
    setTimeout(() => {
        let grid_field = 'table_aaaa';
        let grid = frm.fields_dict[grid_field]?.grid;
        if (!grid) return;

        let wrapper = grid.wrapper;
        wrapper.find('.summary-totals-footer-row').remove();

        let total_qty = 0;
        (frm.doc[grid_field] || []).forEach(row => {
            total_qty += flt(row.qty || 0);
        });

        let subtotal   = flt(frm.doc.subtotal || 0);
        let vat_amount = flt(frm.doc.vat_amount || 0);
        let net_of_vat = +((subtotal - vat_amount).toFixed(2));
        let discount   = flt(frm.doc.discount_total || 0);
        let grand_total = flt(frm.doc.grand_total ?? 0);

        let fmt = val => {
            let formatted = frappe.format(val, { fieldtype: 'Currency' });
            return $(formatted).text() || formatted;
        };

        let row_html = (label, value, style) => `
            <div class="grid-row">
                <div class="data-row row" style="font-size: 13px; background: var(--fg-color, #fff); ${style || ''}">
                    <div class="row-check col"></div>
                    <div class="row-index col"></div>
                    <div class="col grid-static-col col-xs-4"></div>
                    <div class="col grid-static-col col-xs-1"></div>
                    <div class="col grid-static-col col-xs-1"></div>
                    <div class="col grid-static-col col-xs-2 text-right">
                        <div class="static-area ellipsis">${label}</div>
                    </div>
                    <div class="col grid-static-col col-xs-2 text-right">
                        <div class="static-area ellipsis">${value}</div>
                    </div>
                    <div class="col grid-static-col"></div>
                </div>
            </div>
        `;

        let discount_row = discount > 0 ? row_html(
            'Discount',
            '- ' + fmt(discount),
            'color: var(--red, #e74c3c);'
        ) : '';

        let footer = $(`
            <div class="summary-totals-footer-row">
                <div class="grid-row">
                    <div class="data-row row" style="font-weight: 700; font-size: 13px; background: var(--fg-color, #fff); border-top: 2px solid var(--border-color, #d1d8dd);">
                        <div class="row-check col"></div>
                        <div class="row-index col"></div>
                        <div class="col grid-static-col col-xs-4 text-right">
                            <div class="static-area ellipsis" style="padding-right: 8px;">Total Quantity</div>
                        </div>
                        <div class="col grid-static-col col-xs-1 text-right">
                            <div class="static-area ellipsis">${total_qty}</div>
                        </div>
                        <div class="col grid-static-col col-xs-1"></div>
                        <div class="col grid-static-col col-xs-2 text-right">
                            <div class="static-area ellipsis">Total (VAT Inclusive)</div>
                        </div>
                        <div class="col grid-static-col col-xs-2 text-right">
                            <div class="static-area ellipsis">${fmt(subtotal)}</div>
                        </div>
                        <div class="col grid-static-col"></div>
                    </div>
                </div>
                ${frm.__no_vat ? '' : row_html('Less VAT (12%)', fmt(vat_amount))}
                ${frm.__no_vat ? '' : row_html('Amount Net of VAT', fmt(net_of_vat))}
                ${discount_row}
                <div class="grid-row">
                    <div class="data-row row" style="font-weight: 700; font-size: 13px; background: var(--fg-color, #fff); border-top: 1px solid var(--border-color, #d1d8dd);">
                        <div class="row-check col"></div>
                        <div class="row-index col"></div>
                        <div class="col grid-static-col col-xs-4"></div>
                        <div class="col grid-static-col col-xs-1"></div>
                        <div class="col grid-static-col col-xs-1"></div>
                        <div class="col grid-static-col col-xs-2 text-right">
                            <div class="static-area ellipsis">Total Amount Due</div>
                        </div>
                        <div class="col grid-static-col col-xs-2 text-right">
                            <div class="static-area ellipsis">${fmt(grand_total)}</div>
                        </div>
                        <div class="col grid-static-col"></div>
                    </div>
                </div>
            </div>
        `);

        wrapper.find('.grid-footer').after(footer);

    }, 400);
}

})();

// Client Script: Pending Workflow Lock
(function () {
collectOrderFormHandlers({
    refresh(frm) {
        enforce_pending_lock(frm);
    },
    onload(frm) {
        enforce_pending_lock(frm);
    },
    before_save(frm) {
        // Final backstop: block save entirely for locked users
        if (frm.doc.workflow_state === 'Needs Review' && is_locked_user()) {
            frappe.throw(__('This order Needs Review and cannot be edited. Contact a Manager or President to make changes.'));
        }
    }
});

function is_locked_user() {
    // Manager, President, Admin, and Sales have unrestricted access — they must be able to approve/edit price in Needs Review
    const unrestrictedRoles = ['Manager', 'President', 'Administrator', 'System Manager', 'Sales', 'Sales Manager', 'Sales User'];
    const hasUnrestricted = unrestrictedRoles.some(role => frappe.user.has_role(role));
    if (hasUnrestricted) return false;

    // Lock DSP and other non-sales roles in Needs Review
    return true;
}

function enforce_pending_lock(frm) {
    if (frm.doc.workflow_state !== 'Needs Review') return;
    if (!is_locked_user()) return;

    // ── 1. Lock every individual field ──────────────────────────────────────
    frm.fields.forEach(function(field) {
        // Skip display-only types that have no input anyway
        const skipTypes = ['Section Break', 'Column Break', 'Tab Break', 'HTML', 'Heading', 'Button'];
        if (skipTypes.includes(field.df.fieldtype)) return;

        frm.set_df_property(field.df.fieldname, 'read_only', 1);
        frm.refresh_field(field.df.fieldname);
    });

    // ── 2. Lock all child table grids (prevents Add Row, Edit Row, Delete) ──
    Object.keys(frm.fields_dict).forEach(function(fieldname) {
        const fd = frm.fields_dict[fieldname];
        if (fd && fd.grid) {
            fd.grid.cannot_add_rows = true;
            fd.grid.cannot_delete_rows = true;
            fd.grid.df.read_only = 1;

            // Disable the Add Row button if already rendered
            if (fd.grid.wrapper) {
                fd.grid.wrapper.find('.grid-add-row, .grid-add-multiple-rows').hide();
                fd.grid.wrapper.find('.btn-open-row, .grid-delete-row').hide();
            }

            // Lock each child row's fields
            (frm.doc[fieldname] || []).forEach(function(row) {
                frappe.meta.get_docfields(fd.grid.doctype).forEach(function(child_df) {
                    const skipTypes = ['Section Break', 'Column Break', 'HTML', 'Heading', 'Button'];
                    if (!skipTypes.includes(child_df.fieldtype)) {
                        frappe.model.set_value(fd.grid.doctype, row.name, child_df.fieldname, row[child_df.fieldname]);
                    }
                });
            });

            fd.grid.refresh();
        }
    });

    // ── 3. Disable Save and clear action buttons ─────────────────────────────
    frm.disable_save();
    frm.page.clear_primary_action();
    frm.page.clear_secondary_action();

    // Hide workflow action buttons (Approve / Reject etc.) for locked users
    frm.page.wrapper.find('.workflow-action-btn').hide();

    // ── 4. Informational banner ───────────────────────────────────────────────
    frm.dashboard.clear_headline();
    frm.dashboard.set_headline(
        `<span class="text-muted">
            <i class="fa fa-lock"></i>&nbsp;
            This order <strong>Needs Review</strong> and cannot be edited.
            Contact a Manager or President to make changes.
        </span>`
    );
}
})();

// Client Script: Terms and MOP Policy
(function () {
// ============================================================
// Terms and MOP Policy
// Handles: terms visibility, MOP restriction + autofill,
//          requested_term, reason_for_request
// Roles: DSP (fill), Sales (approve), President/Admin (view all)
// ============================================================

const CREDIT_MOP = 'On Account / Credit Terms';

const ALL_MOPS = [
    '',
    'Bank Transfer',
    'Cash',
    'Check / Cheque',
    'Credit Card',
    'Post-Dated Check',
    'Installment',
    'On Account / Credit Terms'
];

const NON_CREDIT_MOPS = ALL_MOPS.filter(m => m !== CREDIT_MOP);

const MOP_TO_TERMS_MAP = {
    'On Account / Credit Terms': ['7 DAYS', '15 DAYS', '30 DAYS', '40 DAYS', '45 DAYS', '60 DAYS', '75 DAYS', '90 DAYS', '100 DAYS', 'N30', 'ON ACCOUNT'],
    'Cash': ['CASH', 'PROMO'],
    'Cash on Delivery (COD)': ['COD'],
    'Bank Transfer': ['BANK TRANSFER'],
    'Online Banking': ['ONLINE PAYMENT'],
    'E-Wallet': ['GCASH', 'LAZADA', 'SHOPEE', 'Tiktok'],
    'Check / Cheque': ['DATED CHEQUE'],
    'Installment': ['CONSIGNMENT'],
    'Post-Dated Check': ['PDC 7 DAYS', 'PDC 15 DAYS', 'PDC 30 DAYS', 'PDC 45 DAYS', 'PDC 60 DAYS', 'PDC 75 DAYS', 'PDC 90 DAYS']
};

const ALL_TERMS = [
    '100 DAYS', '15 DAYS', '30 DAYS', '40 DAYS', '45 DAYS', '60 DAYS', '7 DAYS', '75 DAYS', '90 DAYS',
    'BANK TRANSFER', 'CASH', 'COD', 'CONSIGNMENT', 'DATED CHEQUE', 'GCASH', 'LAZADA', 'N30',
    'ON ACCOUNT', 'ONLINE PAYMENT', 'PDC 15 DAYS', 'PDC 30 DAYS', 'PDC 45 DAYS', 'PDC 60 DAYS',
    'PDC 7 DAYS', 'PDC 75 DAYS', 'PDC 90 DAYS', 'PROMO', 'SHOPEE', 'Tiktok'
];


collectOrderFormHandlers({

    setup(frm) {
        frm.__terms_setting = false;
    },

    async refresh(frm) {
        frm.__prevent_terms_autofill = true;
        if (frm.doc.outlet && frm.doc.docstatus === 0) {  // <- add docstatus === 0
            const fetched = await fetch_customer_terms(frm.doc.outlet);
            if (fetched !== frm.doc.default_terms) {
                await set_safe(frm, 'default_terms', fetched);
            }
        }
        apply_policy(frm);
        setTimeout(() => { frm.__prevent_terms_autofill = false; }, 500);
    },

    async outlet(frm) {
        frm.__prevent_terms_autofill = true;
        // Outlet cleared
        if (!frm.doc.outlet) {
            await set_safe(frm, 'default_terms', '');
            await set_safe(frm, 'terms', '');
            await set_safe(frm, 'requested_term', '');
            await set_safe(frm, 'reason_for_request', '');
            await set_safe(frm, 'mop', '');
            apply_policy(frm);
            setTimeout(() => { frm.__prevent_terms_autofill = false; }, 500);
            return;
        }

        // Outlet selected - fetch terms and autofill MOP
        const fetched = await fetch_customer_terms(frm.doc.outlet);
        await set_safe(frm, 'default_terms', fetched);
        await set_safe(frm, 'requested_term', '');
        await set_safe(frm, 'reason_for_request', '');
        await set_safe(frm, 'mop', derive_mop_from_terms(fetched));
        apply_policy(frm);
        setTimeout(() => { frm.__prevent_terms_autofill = false; }, 500);
    },

    mop(frm) {
        apply_reason_visibility(frm);
        filter_terms_options(frm);
        
        // Clear terms/requested_term if they are no longer in the valid options
        if (frm.doc.mop && MOP_TO_TERMS_MAP[frm.doc.mop]) {
            const valid = MOP_TO_TERMS_MAP[frm.doc.mop];
            if (frm.doc.requested_term && !valid.includes(frm.doc.requested_term)) {
                frm.set_value('requested_term', '');
            }
            if (frm.doc.terms && !valid.includes(frm.doc.terms) && !frm.doc.default_terms) {
                // Only clear terms if it's editable or not default? Actually, terms is read-only usually.
                // Let's just clear terms if it doesn't match and docstatus is 0
                if (frm.doc.docstatus === 0 && frm.doc.terms !== frm.doc.default_terms) {
                    frm.set_value('terms', '');
                }
            }
        }
    },

    requested_term(frm) {
        apply_reason_visibility(frm);
    }
});

// -- Core policy engine ---------------------------------------

function apply_policy(frm) {
    const has_outlet = !!(frm.doc.outlet && frm.doc.outlet.trim());
    const has_terms  = !!(frm.doc.default_terms && frm.doc.default_terms.trim());
    const is_dsp     = is_dsp_only();
    const is_sales   = frappe.user_roles.includes('Sales');

    // -- 1. MOP options ---------------------------------------
    if (!has_outlet) {
        // No outlet yet - show all options, leave MOP blank, touch nothing
        set_mop_options(frm, ALL_MOPS);

    } else if (has_terms) {
        // Outlet with terms - all MOPs available
        set_mop_options(frm, ALL_MOPS);
        // If MOP is credit but was set before terms loaded, leave it - user chose it
        // If MOP is blank (shouldn't happen after outlet trigger), don't force anything
    } else {
        // Outlet with NO terms - restrict to non-credit, force Cash
        set_mop_options(frm, NON_CREDIT_MOPS);
        if (!frm.doc.mop || frm.doc.mop === CREDIT_MOP) {
            set_safe(frm, 'mop', 'Cash');
        }
    }

    // -- 2. Terms + related fields ----------------------------
    if (!has_outlet || !has_terms) {
        // No outlet, or outlet has no terms - hide everything terms-related
        frm.toggle_display('terms', false);
        frm.toggle_display('default_terms', false);
        // frm.toggle_display('requested_term', false); // kept visible for mapping
        frm.toggle_display('reason_for_request', false);
        frm.toggle_reqd('terms', false);
        frm.toggle_reqd('requested_term', false);
        frm.toggle_reqd('reason_for_request', false);

    } else {
        // Outlet HAS terms
        frm.toggle_display('terms', true);
        frm.toggle_display('default_terms', false);

        // Sync terms display to default_terms (read-only)
        // Sync terms display to default_terms (read-only)
        // Only set value on draft/new docs - on submitted docs, just display read-only
        if (frm.doc.docstatus === 0 && !frm.__terms_setting) {
            frm.__terms_setting = true;
            frm.set_value('terms', frm.doc.default_terms).then(() => {
                frm.__terms_setting = false;
                frm.set_df_property('terms', 'read_only', 1);
                frm.refresh_field('terms');
            });
        } else if (frm.doc.docstatus !== 0) {
            // Submitted doc - just enforce read-only display, don't dirty the form
            frm.set_df_property('terms', 'read_only', 1);
            frm.refresh_field('terms');
        }

                                // -- 3. requested_term visibility -------------------------
        // Always show on Draft so users can see/pick terms even before outlet selection
        if (frm.doc.docstatus === 0) {
            frm.toggle_display('requested_term', true);
            frm.set_df_property('requested_term', 'read_only', 0);
        } else {
            // Submitted - show only if it has a value
            const has_request = !!(frm.doc.requested_term && frm.doc.requested_term.trim());
            frm.toggle_display('requested_term', has_request);
            frm.set_df_property('requested_term', 'read_only', 1);
        }

        apply_reason_visibility(frm);
    }

    filter_terms_options(frm);

    frm.refresh_fields(['terms', 'requested_term', 'reason_for_request', 'mop']);
}

function apply_reason_visibility(frm) {
    const has_terms   = !!(frm.doc.default_terms && frm.doc.default_terms.trim());
    const has_request = !!(frm.doc.requested_term && frm.doc.requested_term.trim());
    const is_dsp      = is_dsp_only();
    const is_sales    = frappe.user_roles.includes('Sales');

    if (!has_terms || !has_request) {
        frm.toggle_display('reason_for_request', false);
        frm.toggle_reqd('reason_for_request', false);
        if (!has_request && frm.doc.reason_for_request) {
            frm.set_value('reason_for_request', '');
        }
        frm.refresh_field('reason_for_request');
        return;
    }

    frm.toggle_display('reason_for_request', true);
    frm.toggle_reqd('reason_for_request', is_dsp);
    frm.set_df_property('reason_for_request', 'read_only',
        (!is_dsp && (is_sales || is_admin())) ? 1 : 0
    );
    frm.refresh_field('reason_for_request');
}

// -- MOP derivation from terms --------------------------------

function derive_mop_from_terms(terms) {
    if (!terms) return 'Cash';
    const t = terms.trim().toUpperCase();
    if (t.includes('PDC')) return 'Post-Dated Check';
    if (t.match(/^\d+\s*DAYS?$/) || t === 'N30' || t === 'ON ACCOUNT') {
        return 'On Account / Credit Terms';
    }
    const map = {
        'CASH':           'Cash',
        'COD':            'Cash',
        'PROMO':          'Cash',
        'BANK TRANSFER':  'Bank Transfer',
        'ONLINE PAYMENT': 'Bank Transfer',
        'GCASH':          'Bank Transfer',
        'LAZADA':         'Bank Transfer',
        'SHOPEE':         'Bank Transfer',
        'TIKTOK':         'Bank Transfer',
        'DATED CHEQUE':   'Check / Cheque',
        'CONSIGNMENT':    'Installment',
        'INSTALLMENT':    'Installment'
    };
    return map[t] || '';
}

// -- Helpers --------------------------------------------------

function set_mop_options(frm, options_array) {
    frm.set_df_property('mop', 'options', options_array.join('\n'));
    frm.refresh_field('mop');
}

async function set_safe(frm, fieldname, value) {
    if (!frm.fields_dict[fieldname]) return;
    await frm.set_value(fieldname, value);
    frm.refresh_field(fieldname);
}

async function fetch_customer_terms(outlet_name) {
    try {
        const r = await frappe.db.get_value('Customer Information', outlet_name, 'terms');
        return (r && r.message && r.message.terms) ? String(r.message.terms).trim() : '';
    } catch (e) {
        return '';
    }
}

function is_dsp_only() {
    return frappe.user_roles.includes('DSP') &&
           !frappe.user_roles.includes('System Manager');
}

function is_admin() {
    return frappe.user_roles.includes('System Manager') ||
           frappe.user_roles.includes('President') ||
           frappe.user_roles.includes('Administrator');
}


function filter_terms_options(frm) {
    let options = [''];
    const valid = (frm.doc.mop && MOP_TO_TERMS_MAP[frm.doc.mop]) ? MOP_TO_TERMS_MAP[frm.doc.mop] : ALL_TERMS;
    options = options.concat(valid);
    
    // 1. Filter Requested Terms options
    if (frm.fields_dict.requested_term) {
        frm.set_df_property('requested_term', 'options', options.join('\n'));
        frm.refresh_field('requested_term');
    }

    // 2. Autofill if only one choice and on draft
    // Skip if requested_term is already set to something else that is valid?
    // Actually, if there is only one choice, it should BE that choice.
    if (frm.doc.docstatus === 0 && valid.length === 1 && frm.doc.mop && !frm.__prevent_terms_autofill) {
        if (frm.doc.requested_term !== valid[0]) {
            frm.set_value('requested_term', valid[0]);
        }
    }
}

})();

// Client Script: Request Credit Application Button
(function () {

// ============================================================
// Credit Application Request - Order Form Button Handler
// Handles the "Request Credit Application" button field click,
// visibility control, and dialog on Order Form
// ============================================================
const CAR_TERMS_OPTIONS = [
    '', '100 DAYS', '15 DAYS', '30 DAYS', '40 DAYS', '45 DAYS',
    '60 DAYS', '7 DAYS', '75 DAYS', '90 DAYS', 'BANK TRANSFER',
    'CASH', 'COD', 'CONSIGNMENT', 'DATED CHEQUE', 'GCASH', 'LAZADA',
    'N30', 'ON ACCOUNT', 'ONLINE PAYMENT', 'PDC 15 DAYS', 'PDC 30 DAYS',
    'PDC 45 DAYS', 'PDC 60 DAYS', 'PDC 7 DAYS', 'PDC 75 DAYS',
    'PDC 90 DAYS', 'PROMO', 'SHOPEE', 'Tiktok'
];

collectOrderFormHandlers({
    async refresh(frm) {
        await setup_credit_request_button(frm);
    },
    async outlet(frm) {
        await setup_credit_request_button(frm);
    },
    async request_credit_application(frm) {
        await on_request_credit_application_click(frm);
    }
});

async function setup_credit_request_button(frm) {
    const is_dsp = frappe.user_roles.includes('DSP') && !frappe.user_roles.includes('System Manager');

    // Always hide first
    frm.toggle_display('request_credit_application', false);

    // Only relevant for DSP role, and only if an outlet is selected
    if (!is_dsp || !frm.doc.outlet) return;

    // Fetch the customer's actual terms directly from Customer Information
    let customer_terms = '';
    try {
        const r = await frappe.db.get_value('Customer Information', frm.doc.outlet, 'terms');
        customer_terms = (r && r.message && r.message.terms) ? String(r.message.terms).trim() : '';
    } catch(e) {
        customer_terms = '';
    }

    // Only show for no-terms (cash) customers
    if (customer_terms) return;

    // Check if a pending or draft CAR already exists for this outlet
    let pending_exists = false;
    try {
        const existing = await frappe.db.get_list('Credit Application Request', {
            filters: [
                ['outlet', '=', frm.doc.outlet],
                ['workflow_state', 'in', ['Draft', 'Pending Review']]
            ],
            fields: ['name'],
            limit: 1
        });
        pending_exists = !!(existing && existing.length > 0);
    } catch(e) {
        pending_exists = false;
    }

    // Show the button
    frm.toggle_display('request_credit_application', true);

    if (pending_exists) {
        frm.set_df_property('request_credit_application', 'read_only', 1);
        frm.set_df_property('request_credit_application', 'description',
            'A credit application request is already pending for this customer.');
    } else {
        frm.set_df_property('request_credit_application', 'read_only', 0);
        frm.set_df_property('request_credit_application', 'description', '');
    }
    frm.refresh_field('request_credit_application');
}

async function on_request_credit_application_click(frm) {
    const is_dsp = frappe.user_roles.includes('DSP') && !frappe.user_roles.includes('System Manager');
    if (!is_dsp || !frm.doc.outlet) return;

    let customer_terms = '';
    try {
        const r = await frappe.db.get_value('Customer Information', frm.doc.outlet, 'terms');
        customer_terms = (r && r.message && r.message.terms) ? String(r.message.terms).trim() : '';
    } catch(e) {
        customer_terms = '';
    }

    if (customer_terms) {
        frappe.msgprint({ title: __('Not Applicable'), message: __('This customer already has credit terms assigned.'), indicator: 'orange' });
        return;
    }

    let pending_exists = false;
    try {
        const existing = await frappe.db.get_list('Credit Application Request', {
            filters: [
                ['outlet', '=', frm.doc.outlet],
                ['workflow_state', 'in', ['Draft', 'Pending Review']]
            ],
            fields: ['name'],
            limit: 1
        });
        pending_exists = !!(existing && existing.length > 0);
    } catch(e) {
        pending_exists = false;
    }

    if (pending_exists) {
        frappe.msgprint({
            title: __('Pending Request Exists'),
            message: __('A credit application request is already pending for this customer. Please wait for Sales to review it.'),
            indicator: 'orange'
        });
        return;
    }

    const customer_label = frm.doc.name_of_outlet || frm.doc.outlet;

    let dialog = new frappe.ui.Dialog({
        title: __('Request Credit Terms for ' + customer_label),
        fields: [
            {
                fieldname: 'requested_terms',
                label: __('Requested Terms'),
                fieldtype: 'Select',
                options: CAR_TERMS_OPTIONS.join('\n'),
                reqd: 1
            },
            {
                fieldname: 'reason',
                label: __('Reason / Notes'),
                fieldtype: 'Small Text',
                reqd: 0
            }
        ],
        primary_action_label: __('Submit Request'),
        primary_action: async function(values) {
            dialog.get_primary_btn().prop('disabled', true);
            try {
                if (frm.doc.__islocal || !frm.doc.name || frm.doc.name.startsWith('new-')) {
                    frappe.show_alert({ message: __('Saving Order Form before submitting request...'), indicator: 'blue' }, 3);
                    await new Promise((resolve, reject) => {
                        frm.save('Save', function(err) {
                            if (err) reject(err);
                            else resolve();
                        }, null, null);
                    });
                }

                const order_form_name = (frm.doc.__islocal || !frm.doc.name || frm.doc.name.startsWith('new-'))
                    ? ''
                    : frm.doc.name;

                const insert_result = await frappe.call({
                    method: 'frappe.client.insert',
                    args: {
                        doc: {
                            doctype: 'Credit Application Request',
                            outlet: frm.doc.outlet,
                            customer_name: frm.doc.name_of_outlet || frm.doc.outlet,
                            order_form: order_form_name,
                            requested_terms: values.requested_terms,
                            reason: values.reason || '',
                            requested_by: frappe.session.user,
                            requested_on: frappe.datetime.now_datetime()
                        }
                    }
                });

                if (!insert_result || !insert_result.message) {
                    throw new Error('Insert returned no result');
                }

                await frappe.call({
                    method: 'frappe.model.workflow.apply_workflow',
                    args: {
                        doc: insert_result.message,
                        action: 'Submit for Review'
                    }
                });

                frappe.show_alert({
                    message: __('Credit Application Request submitted. Sales will be notified.'),
                    indicator: 'green'
                }, 7);

                await setup_credit_request_button(frm);
                dialog.hide();

            } catch (e) {
                frappe.msgprint({
                    title: __('Error'),
                    message: __('Failed to submit request. Please try again.'),
                    indicator: 'red'
                });
                console.error('CAR create error:', e);
                dialog.get_primary_btn().prop('disabled', false);
            }
        },
        secondary_action_label: __('Undo / Cancel'),
        secondary_action: function() {
            dialog.hide();
        }
    });

    dialog.show();
}

})();

// Client Script: Warning Past Business Hours
(function () {

collectOrderFormHandlers({
    preferred_delivery_time: function(frm) {
        const val = frm.doc.preferred_delivery_time;
        if (!val) return;

        const hour = parseInt(val.split(':')[0], 10);

        if (hour < 8 || hour >= 17) {
            // Clear the value immediately
            frm.set_value('preferred_delivery_time', '');
            
            // Prevent toast flooding
            if (!window._delivery_time_alert_active) {
                window._delivery_time_alert_active = true;
                
                // Optional: clear existing toasts in the container to be extra safe
                $('.alert-container').empty();
                
                frappe.show_alert({
                    message: 'Delivery time must be between 8:00 AM and 5:00 PM. Entry cleared.',
                    indicator: 'red'
                }, 5);

                // Unlock the alert guard after 2.5 seconds (prevents rapid re-triggering while typing)
                setTimeout(() => {
                    window._delivery_time_alert_active = false;
                }, 2500);
            }
        }
    }
});

})();

// Client Script: Order Form: Warehouse Assignment
(function () {
// Order Form: Workflow Action Interceptors (Merged)
// Consolidates before_workflow_action for Warehouse Assignment and Cancel Warning
// to prevent Frappe hook overwriting.

collectOrderFormHandlers({
    before_workflow_action: function(frm) {
        const action = frm.selected_workflow_action;
        
        // 1. Warehouse Assignment
        if (action === 'Submit' || action === 'Approve') {
            return open_warehouse_assignment_dialog(frm, action);
        }
        
        // 2. Cancel Sales Warning
        if (action === 'Cancel') {
            return new Promise((resolve, reject) => {
                const sales_ref = frm.doc.sales_ref;
                if (!sales_ref) {
                    resolve();
                    return;
                }
                frappe.confirm(
                    __("This order has a linked Sales record ({0}). Cancelling the order will also cancel the Sales record. Proceed?", [sales_ref]),
                    function() { resolve(); },
                    function() { reject("Cancelled by user."); }
                );
            });
        }
    }
});

function open_warehouse_assignment_dialog(frm, action) {
    return new Promise((resolve, reject) => {
        const rows = frm.doc.table_mkaq || [];
        const non_promo = rows.filter(r => !r.is_promo_reward && r.items);

        if (!non_promo.length) {
            resolve();
            return;
        }

        frappe.db.get_list('Warehouses', { fields: ['name', 'warehouse_name'], limit: 50 })
        .then(warehouses => {
            const item_codes = non_promo.map(r => r.items);

            return frappe.db.get_list('Product', {
                filters: { name: ['in', item_codes] },
                fields: ['name', 'item_description']
            }).then(products => {
                const product_map = {};
                products.forEach(p => product_map[p.name] = p.item_description || p.name);

                const wh_options = warehouses.map(w => ({ label: w.warehouse_name, value: w.name }));
                const default_wh = warehouses.length > 0 ? warehouses[0].name : '';

                const fields = [
                    { fieldtype: 'Section Break', label: 'Assign Warehouse per Item' },
                    {
                        fieldname: 'bulk_warehouse',
                        fieldtype: 'Select',
                        label: 'Set All To',
                        options: [{ label: '', value: '' }].concat(wh_options),
                        description: 'Quickly set all items to one warehouse, then adjust individually.'
                    },
                    { fieldtype: 'Section Break', label: 'Per Item' }
                ];

                non_promo.forEach(function(row) {
                    const desc = product_map[row.items] || row.items;
                    const lbl = desc + (row.unit ? ' (' + row.unit + ', qty: ' + row.qty + ')' : ' (qty: ' + row.qty + ')');
                    fields.push({
                        fieldname: 'wh_' + row.name,
                        fieldtype: 'Select',
                        label: lbl,
                        options: wh_options,
                        default: row.warehouse || default_wh,
                        reqd: 1
                    });
                });

                const title = action === 'Submit'
                    ? 'Assign Warehouses — Submit Order'
                    : 'Assign Warehouses — Approve Order';
                const btn_label = action === 'Submit' ? 'Confirm & Submit' : 'Confirm & Approve';

                let confirmed = false;

                const d = new frappe.ui.Dialog({
                    title: title,
                    fields: fields,
                    primary_action_label: btn_label,
                    primary_action: function(values) {
                        non_promo.forEach(function(row) {
                            frappe.model.set_value(row.doctype, row.name, 'warehouse', values['wh_' + row.name]);
                        });
                        confirmed = true;
                        d.hide();
                        resolve();
                    }
                });

                d.onhide = function() {
                    if (!confirmed) reject('Warehouse assignment cancelled.');
                };

                d.fields_dict.bulk_warehouse.$input.on('change', function() {
                    const val = $(this).val();
                    if (!val) return;
                    non_promo.forEach(function(row) {
                        d.set_value('wh_' + row.name, val);
                    });
                });

                d.show();
            });
        });
    });
}

})();

// Client Script: Order Form UX Fix
(function () {

collectOrderFormHandlers({
    setup: function(frm) {
        // Inject CSS for horizontal scrolling in child tables on mobile/tablets
        let grid_style = document.createElement('style');
        grid_style.id = 'grid-mobile-fix';
        grid_style.innerHTML = `
            @media (max-width: 991px) {
                .form-grid .grid-body, .form-grid .grid-heading-row {
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                }
                /* We force a wide minimum width on the row container itself */
                .form-grid .grid-row {
                    min-width: 800px !important;
                    display: flex !important;
                    flex-wrap: nowrap !important;
                }
                /* We prevent columns from compressing */
                .form-grid .grid-row .grid-static-col {
                    min-width: 120px !important;
                    flex: 1 1 0 !important;
                    white-space: normal !important; /* Allow text to wrap natively inside the column if needed */
                }
                /* Optional: Keep headers aligned */
                .form-grid .grid-heading-row .grid-row {
                    min-width: 800px !important;
                    display: flex !important;
                    flex-wrap: nowrap !important;
                }
            }
        `;
        if (!document.getElementById('grid-mobile-fix')) {
            document.head.appendChild(grid_style);
        }
    
        // Inject CSS directly into head to override default Leaflet height
        let style = document.createElement('style');
        style.id = 'map-height-fix';
        style.innerHTML = '.leaflet-container, .map-wrapper { height: 250px !important; min-height: 250px !important; }';
        if (!document.getElementById('map-height-fix')) {
            document.head.appendChild(style);
        }
    },
    refresh: function(frm) {
        if (frm.fields_dict.proof_of_visit_gallery) {
            render_image_gallery(frm);
        }

        // Final map tweaks once initialized
        setTimeout(() => {
            let m = frm.get_field('location');
            if (m && m.map) {
                m.map.scrollWheelZoom.disable();
                m.map.invalidateSize();
            }
        }, 1200);
    }
});

function render_image_gallery(frm) {
    let w = frm.get_field('proof_of_visit_gallery').$wrapper.empty();

    let btn = $('<button class="btn btn-xs btn-primary mb-3">Add Photos</button>').appendTo(w);
    btn.on('click', () => {
        new frappe.ui.FileUploader({
            doctype: frm.doc.doctype,
            docname: frm.doc.name,
            allow_multiple: 1,
            on_success: (file_doc) => {
                if (!frm.is_new()) {
                    frm.reload_docinfo();
                }
                setTimeout(() => render_image_gallery(frm), 800);
            }
        });
    });

    let grid = $('<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px;"></div>').appendTo(w);

    // Reliable async fetch for attachments, explicitly pulling files linked to this specific record name
    // This works perfectly for both saved records and new unsaved records (e.g., "New Order Form 1")
    frappe.db.get_list('File', {
        filters: { attached_to_doctype: frm.doc.doctype, attached_to_name: frm.doc.name },
        fields: ['name', 'file_url']
    }).then(files => {
        let attachments = files.filter(a => a.file_url && a.file_url.match(/\.(jpg|jpeg|png|webp)$/i));
        
        attachments.forEach(a => {
            let div = $(`<div style="position: relative; aspect-ratio: 1; border: 1px solid var(--border-color, #ddd); border-radius: var(--border-radius-md, 8px); overflow: hidden; background: var(--control-bg, #f3f3f3); box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05));">
                <img src="${a.file_url}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <button class="delete-photo btn btn-danger" data-name="${a.name}" style="position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 16px; line-height: 1; z-index: 10;">
                    &times;
                </button>
            </div>`).appendTo(grid);
            
            // Pop-over Image Preview using Frappe Native Dialog
            div.find('img').on('click', () => {
                let d = new frappe.ui.Dialog({
                    title: __('Image Preview'),
                    size: 'extra-large',
                    fields: [
                        {
                            fieldtype: 'HTML',
                            fieldname: 'img_html',
                            options: `<div style="text-align: center; background: var(--control-bg, #f3f3f3); border-radius: var(--border-radius-md, 8px); padding: 10px; display: flex; justify-content: center; align-items: center; min-height: 200px;">
                                        <img src="${a.file_url}" style="max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: var(--border-radius-sm, 4px);">
                                      </div>`
                        }
                    ]
                });
                d.show();
            });
            
            div.find('.delete-photo').on('click', function(e) {
                e.stopPropagation(); // Prevent triggering the image click
                let name = $(this).attr('data-name');
                frappe.confirm('Delete photo?', () => {
                    frappe.call({ 
                        method: 'frappe.client.delete', 
                        args: { doctype: 'File', name: name }, 
                        callback: () => {
                            if (!frm.is_new()) {
                                frm.reload_docinfo();
                            }
                            setTimeout(() => render_image_gallery(frm), 800);
                        }
                    });
                });
            });
        });
    });
}

})();

// Client Script: Order Form: Clear Jabroni Default
(function () {
collectOrderFormHandlers({
    onload(frm) {
        if (frm.is_new() && should_clear_default_outlet(frm.doc.outlet)) {
            frm.set_value('outlet', '');
        }
    }
});

function should_clear_default_outlet(outlet) {
    const normalized = String(outlet || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return normalized.includes('jabroni') || normalized === 'ctmr-05131';
}
})();

// Client Script: Order Form: DSP Restrictions
(function () {
collectOrderFormHandlers({
    onload(frm) {
        restrict_fulfillment_type(frm);
    },
    refresh(frm) {
        hide_submit_for_dsp(frm);
        restrict_fulfillment_type(frm);
    }
});

function is_dsp_only() {
    return frappe.user_roles.includes('DSP') &&
           !frappe.user_roles.includes('System Manager') &&
           !frappe.user_roles.includes('Manager') &&
           !frappe.user_roles.includes('President') &&
           !frappe.user_roles.includes('Administrator');
}

function can_edit_fulfillment() {
    const roles = ["Sales", "Manager", "President", "System Manager", "Administrator"];
    return roles.some(role => frappe.user_roles.includes(role));
}

function hide_submit_for_dsp(frm) {
    if (!is_dsp_only()) return;

    setTimeout(() => {
        frm.page.wrapper.find(".workflow-action-btn").each(function() {
            const $btn = $(this);
            const text = $btn.text().trim();
            if (text === "Submit" || text === __("Submit")) {
                $btn.hide();
            }
        });
    }, 500);
}

function restrict_fulfillment_type(frm) {
    if (!can_edit_fulfillment()) {
        frm.set_df_property('fulfillment_type', 'read_only', 1);
    }
}
})();

// Client Script: Order Form: Fulfillment Visibility
(function () {
collectOrderFormHandlers({
    onload: function(frm) {
        handle_fulfillment_visibility(frm);
    },
    onload_post_render: function(frm) {
        handle_fulfillment_visibility(frm);
    },
    refresh: function(frm) {
        handle_fulfillment_visibility(frm);
    },
    fulfillment_type: function(frm) {
        handle_fulfillment_visibility(frm);
        if (frm.doc.fulfillment_type === 'Pick-up') {
            // Clear values to avoid stale validation issues
            frm.set_value('preferred_delivery_date', null);
            frm.set_value('preferred_delivery_time', null);
            frm.set_value('preferred_delivery_date_and_time', null);
        }
    }
});

function handle_fulfillment_visibility(frm) {
    const is_pickup = (frm.doc.fulfillment_type === 'Pick-up');
    
    // Toggle visibility
    frm.toggle_display('preferred_delivery_date', !is_pickup);
    frm.toggle_display('preferred_delivery_time', !is_pickup);
    
    // Toggle mandatory status
    // Use toggle_reqd and refresh_field to ensure UI reflects changes
    frm.toggle_reqd('preferred_delivery_date', !is_pickup);
    frm.toggle_reqd('preferred_delivery_time', false); // Time should be optional anyway but let's be explicit
    
    // Force a UI refresh on the fields to update asterisks
    frm.refresh_field('preferred_delivery_date');
    frm.refresh_field('preferred_delivery_time');
}
})();

(function () {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (root.__roqson_order_form_extras_registry__) {
        root.__roqson_order_form_extras_registry__.activate();
    }
})();
