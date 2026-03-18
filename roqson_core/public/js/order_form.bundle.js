(function () {
// Order Form Promos
let _promo_timer = null;
let _promo_running = false;

// ─── Remove reward rows using native Frappe methods ─────────────────────────
function remove_promo_reward_rows(frm, promo_name) {
    let removed_any = false;
    ['table_mkaq', 'table_aaaa'].forEach(table_field => {
        let rows = frm.doc[table_field] || [];

        // Find rows that match our criteria
        let to_remove = rows.filter(row =>
            row.is_promo_reward == 1 &&
            (promo_name == null || row.promo_source === promo_name)
        );

        // Use Frappe's native model clearance to safely destroy the row
        if (to_remove.length > 0) {
            to_remove.forEach(row => frappe.model.clear_doc(row.doctype, row.name));
            removed_any = true;
            frm.refresh_field(table_field);
        }
    });
    return removed_any;
}

// ─── Upsert summary row in applied_promos ───────────────────────────────────
function upsert_applied_promo_summary(frm, promo, free_qty) {
    let existing = (frm.doc.applied_promos || []).find(r => r.promo === promo.name);
    if (existing) {
        frappe.model.set_value(existing.doctype, existing.name, {
            promo_type: promo.promo_type || '',
            application_type: promo.application || '',
            buy_item: promo.buy_item,
            buy_quantity: promo.buy_quantity,
            get_quantity: promo.get_quantity,
            reward_item: promo.reward_item,
            reward_item_name: promo.reward_item,
            computed_free_qty: free_qty
        });
    } else {
        let row = frm.add_child('applied_promos');
        row.promo = promo.name;
        row.promo_type = promo.promo_type || '';
        row.application_type = promo.application || '';
        row.buy_item = promo.buy_item;
        row.buy_quantity = promo.buy_quantity;
        row.get_quantity = promo.get_quantity;
        row.reward_item = promo.reward_item;
        row.reward_item_name = promo.reward_item;
        row.computed_free_qty = free_qty;
        frm.refresh_field('applied_promos');
    }
}

// ─── Remove summary row from applied_promos ─────────────────────────────────
function remove_applied_promo_summary(frm, promo_name) {
    let rows = frm.doc.applied_promos || [];
    let to_remove = rows.filter(r => r.promo === promo_name);

    if (to_remove.length > 0) {
        to_remove.forEach(row => frappe.model.clear_doc(row.doctype, row.name));
        frm.refresh_field('applied_promos');
    }
}

// ─── Add reward rows for a specific promo ───────────────────────────────────
// #2: Auto-select warehouse (SJ vs UG) based on available stock
function add_promo_reward_rows(frm, promo, free_qty) {
    remove_promo_reward_rows(frm, promo.name);

    if (!promo.reward_item || free_qty <= 0) return;

    // Lock the calculations
    _promo_running = true;

    // First check warehouse availability, then fetch product
    frappe.call({
        method: 'roqson_core.api.get_promo_warehouse',
        args: { product: promo.reward_item }
    }).then(r => {
        const warehouse_resp = r.message;

        if (warehouse_resp && warehouse_resp.error) {
            frappe.msgprint({
                title: 'Promo Blocked',
                indicator: 'red',
                message: 'Cannot add promo <b>' + promo.name + '</b>: <b>' + promo.reward_item + '</b> has no available stock in any warehouse (SJ: 0, UG: 0).'
            });
            _promo_running = false;
            return;
        }

        const selected_warehouse = warehouse_resp && warehouse_resp.warehouse;
        const warehouse_name = warehouse_resp && warehouse_resp.warehouse_name;

        return frappe.db.get_doc('Product', promo.reward_item).then(product => {
            ['table_mkaq', 'table_aaaa'].forEach(table_field => {
                if (!frm.get_field(table_field)) return;

                let row = frm.add_child(table_field);
                row.items = promo.reward_item;
                row.unit = product.default_unit_of_measurement || '';
                row.qty = free_qty;
                row.price = 0;
                row.original_price = 0;
                row.total_price = 0;
                row.is_promo_reward = 1;
                row.promo_source = promo.name;
                if (selected_warehouse) row.warehouse = selected_warehouse;

                if (product.item_name) row.item_name = product.item_name;
                if (product.item_description) row.description = product.item_description;

                frm.refresh_field(table_field);
            });

            const wh_info = warehouse_name ? ' (from <b>' + warehouse_name + '</b> warehouse)' : '';
            const sj_info = warehouse_resp ? ' | SJ: ' + (warehouse_resp.sj_stock || 0) + ', UG: ' + (warehouse_resp.ug_stock || 0) : '';
            frappe.show_alert({
                message: 'Promo <b>' + promo.name + '</b>: ' + free_qty + 'x <b>' + (product.item_description || promo.reward_item) + '</b>' + wh_info + ' added as free item.' + sj_info,
                indicator: 'green'
            }, 6);
        });
    }).catch(() => {
        // Fallback: add row without warehouse if API fails
        frappe.db.get_doc('Product', promo.reward_item).then(product => {
            ['table_mkaq', 'table_aaaa'].forEach(table_field => {
                if (!frm.get_field(table_field)) return;
                let row = frm.add_child(table_field);
                row.items = promo.reward_item;
                row.unit = product.default_unit_of_measurement || '';
                row.qty = free_qty;
                row.price = 0;
                row.original_price = 0;
                row.total_price = 0;
                row.is_promo_reward = 1;
                row.promo_source = promo.name;
                if (product.item_name) row.item_name = product.item_name;
                if (product.item_description) row.description = product.item_description;
                frm.refresh_field(table_field);
            });
            frappe.show_alert({
                message: 'Promo <b>' + promo.name + '</b>: ' + free_qty + 'x <b>' + (product.item_description || promo.reward_item) + '</b> added. (Warehouse auto-select unavailable)',
                indicator: 'orange'
            }, 5);
        });
    }).finally(() => {
        _promo_running = false;
    });
}

// ─── Compute and apply a single promo ───────────────────────────────────────
function compute_single_promo(frm, promo, force) {
    let eligible_qty = 0;
    (frm.doc.table_mkaq || []).forEach(row => {
        if (row.items === promo.buy_item && !row.is_promo_reward) {
            eligible_qty += row.qty || 0;
        }
    });

    if (eligible_qty < promo.buy_quantity) {
        remove_promo_reward_rows(frm, promo.name);
        remove_applied_promo_summary(frm, promo.name);
        frappe.db.get_doc('Product', promo.buy_item).then(product => {
            frappe.show_alert({
                message: 'Promo <b>' + promo.name + '</b> not applicable: need ' + promo.buy_quantity + 'x <b>' + (product.item_description || promo.buy_item) + '</b>.',
                indicator: 'orange'
            }, 5);
        });
        return;
    }

    let multiplier = Math.floor(eligible_qty / promo.buy_quantity);
    if (promo.application === "Once per Order") multiplier = 1;

    let free_qty = promo.get_quantity * multiplier;
    if (promo.max_reward_quantity && free_qty > promo.max_reward_quantity) {
        free_qty = promo.max_reward_quantity;
    }

    const already_applied = (frm.doc.table_mkaq || []).some(
        row => row.is_promo_reward && row.promo_source === promo.name
    );
    if (!force && already_applied) {
        return;
    }

    upsert_applied_promo_summary(frm, promo, free_qty);
    add_promo_reward_rows(frm, promo, free_qty);
}

// ─── Main: recompute all promos in the applied_promos table ─────────────────
function compute_all_promos(frm, force) {
    if (_promo_running) return; // Ignore overlap calls

    const applied = frm.doc.applied_promos || [];
    const unique_promo_names = [...new Set(applied.map(r => r.promo).filter(Boolean))];

    if (!unique_promo_names.length) {
        remove_promo_reward_rows(frm, null);
        return;
    }

    const active_set = new Set(unique_promo_names);
    (frm.doc.table_mkaq || [])
        .filter(row => row.is_promo_reward && row.promo_source && !active_set.has(row.promo_source))
        .forEach(row => remove_promo_reward_rows(frm, row.promo_source));

    Promise.all(unique_promo_names.map(name => frappe.db.get_doc('Promos', name)))
        .then(promo_docs => {
            promo_docs.forEach(promo => compute_single_promo(frm, promo, force));
        });
}

function debounced_compute_all_promos(frm, force) {
    clearTimeout(_promo_timer);
    _promo_timer = setTimeout(() => compute_all_promos(frm, force), 300);
}

// ─── Event Handlers ─────────────────────────────────────────────────────────
frappe.ui.form.on("Order Form", {
    refresh(frm) {
        frm.fields_dict.applied_promos.$wrapper.show();

        setTimeout(() => {
            const grid = frm.fields_dict.applied_promos.grid;
            if (grid && grid.wrapper) {
                grid.wrapper.css('width', '100%');
                grid.wrapper.find('.form-grid').css('width', '100%');
                grid.refresh();
            }
        }, 100);

        setTimeout(() => compute_all_promos(frm, false), 500);
    },

    validate(frm) {
        const applied = frm.doc.applied_promos || [];
        const unique_promo_names = [...new Set(applied.map(r => r.promo).filter(Boolean))];
        if (!unique_promo_names.length) return;

        return Promise.all(
            unique_promo_names.map(name =>
                frappe.db.get_doc('Promos', name).then(promo => {
                    let eligible_qty = 0;
                    (frm.doc.table_mkaq || []).forEach(row => {
                        if (row.items === promo.buy_item && !row.is_promo_reward) {
                            eligible_qty += row.qty || 0;
                        }
                    });
                    if (eligible_qty < promo.buy_quantity) {
                        frappe.validated = false;
                        frappe.msgprint({
                            title: 'Promo Invalid',
                            message: 'Cannot save: promo <b>' + name + '</b> requires <b>' + promo.buy_quantity + 'x ' + promo.buy_item + '</b> but the item is no longer in the order.',
                            indicator: 'red'
                        });
                    }
                })
            )
        );
    }
});
frappe.ui.form.on("Applied Promos Table", {
    promo(frm, cdt, cdn) {
        const row = frappe.get_doc(cdt, cdn);
        if (!row.promo) return;

        const duplicates = (frm.doc.applied_promos || []).filter(
            r => r.promo === row.promo && r.name !== cdn
        );

        if (duplicates.length) {
            frappe.model.set_value(cdt, cdn, 'promo', '');
            frappe.show_alert({
                message: 'Promo <b>' + row.promo + '</b> is already applied.',
                indicator: 'orange'
            }, 5);
            return;
        }

        debounced_compute_all_promos(frm, true);
    },
    applied_promos_remove(frm) {
        const active_set = new Set((frm.doc.applied_promos || []).map(r => r.promo).filter(Boolean));
        ['table_mkaq', 'table_aaaa'].forEach(table_field => {
            (frm.doc[table_field] || [])
                .filter(row => row.is_promo_reward && row.promo_source && !active_set.has(row.promo_source))
                .forEach(row => remove_promo_reward_rows(frm, row.promo_source));
        });
    }
});

frappe.ui.form.on("Order Details Table", {
    qty(frm) {
        debounced_compute_all_promos(frm, true);
    },
    items(frm) {
        debounced_compute_all_promos(frm, true);
    }
});
})();
(function () {
function is_dsp_only() {
    return frappe.user_roles.includes('DSP') &&
           !frappe.user_roles.includes('System Manager') &&
           !frappe.user_roles.includes('Manager') &&
           !frappe.user_roles.includes('President') &&
           !frappe.user_roles.includes('Administrator');
}

function check_row_stock(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let is_dsp = is_dsp_only();
    
    // For DSPs, we check overall stock (no warehouse required).
    // For others, we require warehouse.
    if (!row || !row.items || !row.qty) return;
    if (!is_dsp && !row.warehouse) return;

    // Prevent recursive trigger from set_value if we adjust qty
    if (row._checking_stock) return;
    row._checking_stock = true;

    // Fetch product description for UI
    frappe.db.get_value('Product', row.items, 'item_description').then(r => {
        let desc = r.message ? r.message.item_description : row.items;
        
        let proceed_with_stock_check = function(wh_name) {
            // Call backend API for stock (omits warehouse for DSPs for overall stock)
            frappe.call({
                method: 'roqson_core.api.get_product_stock',
                args: { 
                    product: row.items,
                    warehouse: is_dsp ? '' : row.warehouse
                },
                callback: function(resp) {
                    row._checking_stock = false;
                    if (resp.message && !resp.message.error) {
                        let stock = resp.message;
                        let available = flt(stock.available);
                        
                        // Success or Out-of-Stock Alert formatting
                        let is_out = (available <= 0);
                        let status_color = is_out ? 'var(--red-600)' : 'var(--green-600)';
                        let hide_x_script = is_out ? '' : "<img src='x' onerror='$(this).closest(\".alert\").find(\"a.close, button.close\").remove(); $(this).remove();' style='display:none;'>";
                        
                        let location_html = is_dsp ? "" : `<span style="font-size: 12px; color: var(--text-muted);">Location: <b>${wh_name}</b></span><br>`;
                        
                        let msg = `
                            ${hide_x_script}
                            <div style="font-size: 13px; line-height: 1.5; min-width: 280px; position: relative;">
                                <b style="padding-right: 15px; display: inline-block;">${desc}</b><br>
                                ${location_html}
                                <span style="color:${status_color}; font-weight:bold; font-size: 14px;">
                                    ${is_out ? 'OUT OF STOCK' : available + ' Available'}
                                </span>
                            </div>
                        `;

                        if (is_out) {
                            // CLEAR ITEM cell but keep row
                            frappe.model.set_value(cdt, cdn, 'items', '');
                            
                            // Recompute if needed
                            if (typeof recompute_all === 'function') {
                                recompute_all(frm);
                            }

                            // Show RED alert for 10s
                            frappe.show_alert({ message: msg, indicator: 'red' }, 10); 
                            return;
                        }

                        // Cap quantity if already set
                        if (flt(row.qty) > available) {
                            frappe.model.set_value(cdt, cdn, 'qty', available);
                            frappe.show_alert({
                                message: __('Quantity for {0} adjusted to available stock ({1}) in {2}', [desc, available, wh_name]),
                                indicator: 'orange'
                            }, 10);
                        }
                        
                        // Show GREEN alert for 10s
                        frappe.show_alert({ message: msg, indicator: 'green' }, 10); 
                    }
                }
            });
        };

        if (is_dsp) {
            proceed_with_stock_check('Overall Stock (All Warehouses)');
        } else {
            // Fetch warehouse name
            frappe.db.get_value('Warehouses', row.warehouse, 'warehouse_name').then(w => {
                let wh_name = (w.message && w.message.warehouse_name) ? w.message.warehouse_name : row.warehouse;
                proceed_with_stock_check(wh_name);
            });
        }
    });
}

frappe.ui.form.on('Order Details Table', {
    items: function(frm, cdt, cdn) {
        check_row_stock(frm, cdt, cdn);
    },
    qty: function(frm, cdt, cdn) {
        check_row_stock(frm, cdt, cdn);
    },
    warehouse: function(frm, cdt, cdn) {
        check_row_stock(frm, cdt, cdn);
    }
});
})();
(function () {
frappe.ui.form.on('Order Form', {
    refresh(frm) { render_totals_row(frm); },
    after_save(frm) { render_totals_row(frm); },
    apply_discount(frm) {
        // Discount fetch is async in VAT script, wait for it to finish
        setTimeout(() => render_totals_row(frm), 800);
    },
    discount_total(frm) {
        // Fires after VAT script sets the value — most reliable trigger
        render_totals_row(frm);
    }
});

frappe.ui.form.on('Order Details Table', {
    qty(frm) { render_totals_row(frm); },
    price(frm) { render_totals_row(frm); },
    table_mkaq_remove(frm) { render_totals_row(frm); }
});

function render_totals_row(frm) {
    setTimeout(() => {
        let grid_field = 'table_mkaq';
        let grid = frm.fields_dict[grid_field]?.grid;
        if (!grid) return;

        let wrapper = grid.wrapper;
        wrapper.find('.totals-footer-row').remove();

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
            <div class="totals-footer-row">
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
(function () {
// DocType: Order Form
// Consolidated script for table calculations, synchronization, and UI consistency
// Source of truth: table_mkaq (Details Tab)
// Mirror table: table_aaaa (Summary Tab)

frappe.ui.form.on("Order Form", {
    
    setup(frm) {
        // --- Role-based Access Control for Warehouse ---
        const allowed_roles = ['Sales', 'Sales Manager', 'Sales User', 'Manager', 'System Manager', 'President'];
        const user_roles = frappe.user_roles;
        const is_dsp = user_roles.includes('DSP');
        const has_allowed = allowed_roles.some(r => user_roles.includes(r));
        
        // Final permission: Must have allowed role AND NOT be DSP (Administrator exempt)
        const can_access_wh = (has_allowed && !is_dsp) || user_roles.includes('Administrator');
        frm.__can_access_warehouse = can_access_wh;

        // VAT: DSP and Sales roles calculate VAT themselves (Sir Chez requirement)
        const is_sales_user = user_roles.includes('Sales') || user_roles.includes('Sales Manager') || user_roles.includes('Sales User');
        // VAT Visibility Logic (Sir Chez requirement)
        // Visible to: Sales, Manager, System Manager, Dispatcher, Stock Manager, and President roles.
        // NOT visible to: DSP role.
        const allowed_vat_roles = ['Sales', 'Sales Manager', 'Sales User', 'Manager', 'System Manager', 'President', 'Dispatcher', 'Stock Manager', 'Administrator'];
        const can_see_vat = allowed_vat_roles.some(r => user_roles.includes(r));
        const is_dsp_only_vat = user_roles.includes('DSP') && !can_see_vat;
        frm.__no_vat = is_dsp_only_vat;

        // --- UI Consistency: Ensure both tables show identical columns ---
        const visible_fields = ['items', 'qty', 'unit', 'price', 'total_price'];
        if (can_access_wh) {
            visible_fields.push('warehouse');
        }

        const all_fields = ['items', 'qty', 'unit', 'price', 'total_price', 'warehouse', 'original_price', 'terms_child', 'addr_child', 'is_promo_reward', 'promo_source'];
        
        [frm.fields_dict.table_mkaq, frm.fields_dict.table_aaaa].forEach(df => {
            if (!df || !df.grid) return;
            
            // Set visually required fields for table_mkaq (source of truth)
            if (df.df.fieldname === 'table_mkaq') {
                df.grid.update_docfield_property('items', 'reqd', 1);
                df.grid.update_docfield_property('qty', 'reqd', 1);
                
                // Warehouse mandatory if user can access it
                if (can_access_wh) {
                    df.grid.update_docfield_property('warehouse', 'reqd', 1);
                    df.grid.update_docfield_property('warehouse', 'hidden', 0);
                    df.grid.update_docfield_property('warehouse', 'read_only', 0);
                } else {
                    df.grid.update_docfield_property('warehouse', 'reqd', 0);
                    df.grid.update_docfield_property('warehouse', 'hidden', 1);
                    df.grid.update_docfield_property('warehouse', 'read_only', 1);
                }
            } else {
                // table_aaaa (Summary) is read-only
                df.grid.cannot_add_rows = true;
                df.grid.cannot_delete_rows = true;
                df.grid.df.read_only = 1;
                
                // Still hide warehouse in summary if not allowed
                if (!can_access_wh) {
                    df.grid.update_docfield_property('warehouse', 'hidden', 1);
                }
            }
            
            // Ensure column visibility matches and force list view visibility for allowed users
            all_fields.forEach(f => {
                let should_be_visible = visible_fields.includes(f);
                df.grid.update_docfield_property(f, 'in_list_view', should_be_visible ? 1 : 0);
            });
            df.grid.refresh();
        });
    },

    
    refresh(frm) {
        recompute_all(frm);
        // Only sync on refresh if form is already saved (not dirty)
        if (!frm.is_dirty()) {
            sync_to_summary(frm);
        }

        // --- Set All Warehouses Button (Only for authorized roles) ---
        if (frm.__can_access_warehouse && frm.fields_dict.table_mkaq && frm.fields_dict.table_mkaq.grid) {
            const grid = frm.fields_dict.table_mkaq.grid;
            // Remove existing DOM button to prevent duplicates on refresh
            if (grid.wrapper) {
                grid.wrapper.find('.btn-set-all-wh').remove();
            }
            if (grid.custom_buttons && grid.custom_buttons[__('Set All Warehouses')]) {
                delete grid.custom_buttons[__('Set All Warehouses')];
            }
            
            const wh_btn = grid.add_custom_button(__('Set All Warehouses'), () => {
                const d = new frappe.ui.Dialog({
                    title: __('Set Warehouse for All Items'),
                    fields: [
                        {
                            label: __('Select Warehouse'),
                            fieldname: 'warehouse',
                            fieldtype: 'Link',
                            options: 'Warehouses',
                            reqd: 1
                        }
                    ],
                    primary_action_label: __('Apply'),
                    primary_action(values) {
                        (frm.doc.table_mkaq || []).forEach(row => {
                            frappe.model.set_value(row.doctype, row.name, 'warehouse', values.warehouse);
                        });
                        d.hide();
                        frappe.show_alert({ message: __('Warehouse updated for all items'), indicator: 'green' });
                    }
                });
                d.show();
            });
            if (wh_btn) wh_btn.addClass('btn-set-all-wh');
        }

    },

    
    validate(frm) {
        // --- Validation: Item and Qty are required in Details table ---
        (frm.doc.table_mkaq || []).forEach((row, i) => {
            if (!row.items || !row.qty) {
                frappe.throw(__('Row {0}: Item and Qty are required in the Order Details table.', [i + 1]));
            }
            // Only validate warehouse if user has access to it and it's visible
            if (frm.__can_access_warehouse && !row.warehouse) {
                frappe.throw(__('Row {0}: Warehouse is required.', [i + 1]));
            }
        });

        recompute_all(frm);
    },

    after_save(frm) {
        sync_to_summary(frm);
    },

    table_mkaq_add(frm) {
        recompute_all(frm);
    },

    table_mkaq_remove(frm) {
        recompute_all(frm);
    }
});

frappe.ui.form.on("Order Details Table", {
    qty(frm, cdt, cdn) {
        calculate_row_total(frm, cdt, cdn);
        recompute_all(frm);
    },
    price(frm, cdt, cdn) {
        calculate_row_total(frm, cdt, cdn);
        recompute_all(frm);
    },
    items(frm, cdt, cdn) {
        // Recalculate if item changes (it might fetch a different price)
        setTimeout(() => {
            if (locals[cdt] && locals[cdt][cdn]) {
                calculate_row_total(frm, cdt, cdn);
                recompute_all(frm);
            }
        }, 800);
    }
});

function calculate_row_total(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row) return;
    let total = flt(row.qty || 0) * flt(row.price || 0);
    if (isNaN(total)) total = 0;
    if (flt(row.total_price) !== total) {
        frappe.model.set_value(cdt, cdn, "total_price", total);
    }
}
function recompute_all(frm) {
    let subtotal = 0;
    let total_qty = 0;

    (frm.doc.table_mkaq || []).forEach(row => {
        // Row-level totals calculation failsafe
        let row_total = flt(row.qty || 0) * flt(row.price || 0);
        if (flt(row.total_price) !== row_total) {
            row.total_price = row_total;
        }
        
        subtotal += row.total_price;
        total_qty += flt(row.qty || 0);
    });

    // Parent form totals
    frm.set_value('total_quantity', total_qty);

    // Apply Discount Logic
    if (frm.doc.apply_discount) {
        frappe.db.get_value("Discounts", frm.doc.apply_discount, ["discount_type", "percent_", "amount"])
            .then(({ message }) => {
                let discount_total = 0;
                if (message) {
                    if (message.discount_type === "Percent") {
                        discount_total = +(subtotal * (message.percent_ / 100)).toFixed(2);
                    } else {
                        discount_total = message.amount || 0;
                    }
                }
                set_final_totals(frm, subtotal, discount_total);
            });
    } else {
        set_final_totals(frm, subtotal, 0);
    }
}

function set_final_totals(frm, subtotal, discount) {
    let vat_amount = frm.__no_vat ? 0 : +(subtotal * 12 / 112).toFixed(2);
    let grand_total = +(flt(subtotal) - flt(discount)).toFixed(2);
    if (isNaN(grand_total)) grand_total = 0;
    
    frm.set_value('subtotal', isNaN(subtotal) ? 0 : subtotal);
    frm.set_value('vat_amount', isNaN(vat_amount) ? 0 : vat_amount);
    frm.set_value('discount_total', discount);
    frm.set_value('grand_total', isNaN(grand_total) ? 0 : grand_total);
    frm.set_value('grand_total_summary', isNaN(grand_total) ? 0 : grand_total);
    
    frm.refresh_fields(['subtotal', 'vat_amount', 'discount_total', 'grand_total', 'grand_total_summary', 'total_quantity', 'table_mkaq']);
}

function sync_to_summary(frm) {
    // Keep Summary Tab table (table_aaaa) as a read-only mirror of Details (table_mkaq)
    const was_clean = !frm.is_dirty();
    
    // Check if anything actually changed to avoid unnecessary clearing/adding
    const source = frm.doc.table_mkaq || [];
    const target = frm.doc.table_aaaa || [];
    
    if (source.length === target.length) {
        let is_same = true;
        for (let i = 0; i < source.length; i++) {
            if (source[i].items !== target[i].items || 
                source[i].qty !== target[i].qty || 
                source[i].price !== target[i].price) {
                is_same = false;
                break;
            }
        }
        if (is_same) return; // Skip if already in sync
    }

    frm.clear_table("table_aaaa");
    source.forEach(row => {
        let child = frm.add_child("table_aaaa");
        Object.keys(row).forEach(key => {
            if (!["name", "idx", "parent", "parentfield", "parenttype", "doctype", "_islocal", "creation", "modified", "owner", "modified_by"].includes(key)) {
                child[key] = row[key];
            }
        });
    });
    
    frm.refresh_field("table_aaaa");
    if (was_clean) frm.doc.__unsaved = 0;
}
})();
(function () {
// ── Notes Acknowledgment ─────────────────────────────────────────────────
// UI Rules:
// - Admins/Managers: See text editor + live checklist. Save is NOT blocked.
// - Sales: See text editor + live checklist. Save is NOT blocked.
// - DSP: Read-only checklist only. Save IS blocked until all items are checked.

frappe.ui.form.on('Order Form', {
    refresh(frm) {
        render_notes_panel(frm);
    },
    internal_notes(frm) {
        // When notes change, reset acknowledgments if an admin/manager/sales edited them
        // This ensures the checklist refreshes in real-time
        if (!is_dsp_only()) {
            reset_acknowledgments_silent(frm);
        }
        render_notes_panel(frm);
    },
    before_save(frm) {
        // FORCE logic only applied to DSP
        if (is_dsp_only()) {
            validate_acknowledgments(frm);
        }
    }
});

// ── Role helpers ───────────────────────────────────────────────────────────

function is_admin_user() {
    const adminRoles = ['Manager', 'President', 'Administrator', 'System Manager', 'Purchaser'];
    return adminRoles.some(r => frappe.user.has_role(r));
}

function is_dsp_only() {
    // Pure DSP: has DSP role but NOT Sales and NOT an Admin role
    if (frappe.user.has_role('Sales') || is_admin_user()) return false;
    return frappe.user.has_role('DSP');
}

function is_sales_user() {
    if (is_admin_user()) return false;
    return frappe.user.has_role('Sales');
}

// ── Acknowledgment storage helpers ─────────────────────────────────────────

function get_ack_data(frm) {
    try {
        return JSON.parse(frm.doc.notes_acknowledgments || '{}');
    } catch(e) {
        return {};
    }
}

function set_ack_data(frm, data) {
    frappe.model.set_value(frm.doctype, frm.docname, 'notes_acknowledgments', JSON.stringify(data));
}

function reset_acknowledgments_silent(frm) {
    const current = get_ack_data(frm);
    if (Object.keys(current).length === 0) return; 
    set_ack_data(frm, {});
}

// ── Note parsing ───────────────────────────────────────────────────────────

function parse_note_items(html) {
    if (!html || !html.trim()) return [];
    const $div = $('<div>').html(html);
    const items = [];
    let idx = 0;

    $div.find('li').each(function() {
        const $li = $(this);
        const text = $li.clone().find('ul, ol').remove().end().text().trim();
        if (text) {
            items.push({ id: 'item_' + idx, text: text });
            idx++;
        }
    });

    if (items.length === 0) {
        $div.find('p').each(function() {
            const text = $(this).text().trim();
            if (text) {
                items.push({ id: 'item_' + idx, text: text });
                idx++;
            }
        });
    }
    return items;
}

// ── Validation ─────────────────────────────────────────────────────────────

function validate_acknowledgments(frm) {
    const notes_html = frm.doc.internal_notes || '';
    if (!notes_html.trim()) return; 

    const note_items = parse_note_items(notes_html);
    if (note_items.length === 0) return;

    const ack_data = get_ack_data(frm);
    const unacked = note_items.filter(item => !ack_data[item.id]);

    if (unacked.length > 0) {
        frappe.validated = false;
        frappe.msgprint({
            title: __('Notes Acknowledgment Required'),
            indicator: 'red',
            message: __('As a DSP, you must acknowledge all {0} note item(s) on the Notes tab before saving.', [unacked.length])
        });
    }
}

// ── Main render function ───────────────────────────────────────────────────

function render_notes_panel(frm) {
    const panel_field = frm.fields_dict['notes_ack_panel'];
    if (!panel_field) return;
    const $panel_wrapper = panel_field.$wrapper;

    const notes_html = frm.doc.internal_notes || '';
    const ack_data = get_ack_data(frm);
    const note_items = parse_note_items(notes_html);

    // Visibility Logic
    // Only pure DSPs are blocked from editing. Others see the editor.
    frm.set_df_property('internal_notes', 'hidden', 0);
    frm.set_df_property('internal_notes', 'read_only', is_dsp_only() ? 1 : 0);
    // Everyone (Admin, Sales, DSP) now sees the panel if notes exist
    frm.set_df_property('notes_ack_panel', 'hidden', 0);

    $panel_wrapper.empty();

    if (!notes_html.trim()) {
        $panel_wrapper.html(
            '<div class="text-muted" style="padding:12px 0;font-size:13px;">' +
            '<i class="fa fa-info-circle"></i> No internal notes for this order.</div>'
        );
        return;
    }

    if (note_items.length === 0) {
        $panel_wrapper.html(
            '<div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:16px;margin-bottom:12px;">' +
            '<h6 style="margin:0 0 10px;font-weight:600;">Internal Notes Preview</h6>' +
            '<div style="font-size:13px;line-height:1.6;">' + notes_html + '</div>' +
            '</div>'
        );
        return;
    }

    // Build checklist
    const total = note_items.length;
    const acked_count = note_items.filter(item => ack_data[item.id]).length;
    const all_acked = acked_count === total;

    const progress_color = all_acked ? '#28a745' : (acked_count > 0 ? '#fd7e14' : '#dc3545');
    const progress_pct = Math.round((acked_count / total) * 100);

    let status_html = all_acked 
        ? '<span style="color:#28a745;font-weight:600;"><i class="fa fa-check-circle"></i> All items acknowledged</span>'
        : `<span style="color:${is_dsp_only() ? '#dc3545' : '#6c757d'};font-weight:600;">${acked_count} of ${total} items acknowledged</span>`;

    let items_html = note_items.map(item => {
        const is_acked = !!ack_data[item.id];
        const ack_info = ack_data[item.id];
        const ack_detail = is_acked ? `<small style="color:#6c757d;margin-left:8px;">✓ ${ack_info.acked_by} on ${ack_info.acked_on}</small>` : '';

        return `
            <div class="notes-ack-item" data-item-id="${item.id}" style="
                display:flex;align-items:flex-start;padding:10px 12px;
                margin-bottom:6px;border-radius:6px;cursor:pointer;
                background:${is_acked ? '#f0fff4' : '#fff8f8'};
                border:1px solid ${is_acked ? '#b7ebc8' : '#f5c6cb'};">
                <div style="flex-shrink:0;margin-right:10px;margin-top:2px;">
                    <input type="checkbox" class="notes-ack-checkbox" data-item-id="${item.id}" ${is_acked ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
                </div>
                <div style="flex:1;font-size:13px;line-height:1.5;${is_acked ? 'text-decoration:line-through;color:#6c757d;' : ''}">
                    ${item.text} ${ack_detail}
                </div>
            </div>`;
    }).join('');

    $panel_wrapper.html(`
        <div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin-top:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h6 style="margin:0;font-weight:600;">Notes Checklist ${is_dsp_only() ? '' : '(DSP Preview)'}</h6>
                <div>${status_html}</div>
            </div>
            <div style="background:#e9ecef;border-radius:4px;height:6px;margin-bottom:14px;">
                <div style="background:${progress_color};height:6px;border-radius:4px;width:${progress_pct}%;transition:width 0.3s;"></div>
            </div>
            <div class="notes-ack-items">${items_html}</div>
        </div>
    `);

    // Checkbox and Row click events
    $panel_wrapper.find('.notes-ack-checkbox').on('change', function() {
        const item_id = $(this).data('item-id');
        const current_ack = get_ack_data(frm);

        if ($(this).is(':checked')) {
            current_ack[item_id] = {
                acked_by: frappe.session.user,
                acked_on: frappe.datetime.now_datetime()
            };
        } else {
            delete current_ack[item_id];
        }

        set_ack_data(frm, current_ack);
        setTimeout(() => render_notes_panel(frm), 50);
    });

    $panel_wrapper.find('.notes-ack-item').on('click', function(e) {
        if ($(e.target).is('input[type="checkbox"]')) return;
        $(this).find('input[type="checkbox"]').trigger('click');
    });
}
})();
(function () {
// -- Order Form: Edit Mode Control -------------------------------------------
// Post-Draft forms appear read-only to Administrator, Manager, System Manager,
// and President roles. An 'Edit' button activates full edit mode for that
// session. Read-only view resets automatically after each save.
// Draft forms are not touched — default Frappe behavior applies.
//
// Implementation notes:
//   docstatus=0 (Draft): fields editable by default. No action needed.
//   docstatus=1 (Submitted/post-Draft): Frappe's native submitted-doc protection
//     locks ALL fields unless df.allow_on_submit=1. set_df_property('read_only',0)
//     alone does nothing. We must also set allow_on_submit=1 when unlocking, and
//     restore allow_on_submit=0 when re-locking.
//   docstatus=0 post-Draft (rare): manual read_only approach used.

frappe.ui.form.on('Order Form', {
    onload(frm) {
        // Only reset the flag here. Locking is handled exclusively in refresh
        // to avoid a double-lock (onload fires just before refresh, which would
        // cause the second lock to see all fields already read_only and populate
        // _roqson_locked_fields as empty, making Edit restore nothing).
        frm._roqson_edit_mode = false;
    },
    refresh(frm) {
        apply_edit_mode_control(frm);
    },
    after_save(frm) {
        frm._roqson_edit_mode = false;
    }
});

var EDIT_ROLES = ['Administrator', 'Manager', 'System Manager', 'President'];
var SKIP_TYPES = ['Section Break', 'Column Break', 'Tab Break', 'HTML', 'Heading', 'Button'];

// For docstatus=0 post-Draft: tracks fields we flipped read_only 0->1
var _roqson_locked_fields = null;
var _roqson_locked_grids  = null;

// For docstatus=1: tracks fields we set allow_on_submit=1 on (so we can restore)
var _roqson_aos_fields = null;
var _roqson_aos_grids  = null;

// Set true when Edit is clicked — causes the next refresh (after reload_doc) to
// enter edit mode instead of re-locking. Persists across the reload cycle.
var _roqson_pending_edit_after_reload = false;

function can_edit_post_draft() {
    return EDIT_ROLES.some(function(r) { return frappe.user.has_role(r); });
}
function apply_edit_mode_control(frm) {
    if (frm._roqson_edit_btn) {
        frm._roqson_edit_btn.remove();
        delete frm.custom_buttons[__('Edit')];
        frm._roqson_edit_btn = null;
    }

    var state = frm.doc.workflow_state;

    if (!state || state === 'Draft') {
        // Restore any meta mutations we made on a previous post-Draft view
        restore_locked_fields(frm);
        restore_allow_on_submit(frm);
        return;
    }

    if (!can_edit_post_draft()) return;

    // If Edit was clicked and a reload was triggered, enter edit mode on fresh data
    if (_roqson_pending_edit_after_reload) {
        _roqson_pending_edit_after_reload = false;
        frm._roqson_edit_mode = true;
        unlock_form(frm);
        return;
    }

    if (frm._roqson_edit_mode) return;

    lock_form(frm);
    add_edit_button(frm);
}

// ── Locking ────────────────────────────────────────────────────────────────

function lock_form(frm) {
    if (frm.doc.docstatus === 1) {
        // Frappe already locks submitted docs natively — just ensure any previous
        // allow_on_submit edits are reversed so the form shows as read-only
        restore_allow_on_submit(frm);
        frm.disable_save();
    } else {
        // docstatus=0 post-Draft: manually flip read_only 0->1
        lock_fields_readonly(frm);
    }
}

function lock_fields_readonly(frm) {
    _roqson_locked_fields = [];
    _roqson_locked_grids  = [];

    frm.fields.forEach(function(field) {
        if (SKIP_TYPES.includes(field.df.fieldtype)) return;
        if (field.df.read_only) return;
        frm.set_df_property(field.df.fieldname, 'read_only', 1);
        frm.refresh_field(field.df.fieldname);
        _roqson_locked_fields.push(field.df.fieldname);
    });

    Object.keys(frm.fields_dict).forEach(function(fieldname) {
        var fd = frm.fields_dict[fieldname];
        if (!fd || !fd.grid) return;
        if (fd.grid.df.read_only) return;
        fd.grid.cannot_add_rows = true;
        fd.grid.cannot_delete_rows = true;
        fd.grid.df.read_only = 1;
        if (fd.grid.wrapper) {
            fd.grid.wrapper.find('.grid-add-row, .grid-add-multiple-rows').hide();
            fd.grid.wrapper.find('.grid-remove-rows').hide();
        }
        fd.grid.refresh();
        _roqson_locked_grids.push(fieldname);
    });

    frm.disable_save();
}

// ── Unlocking ──────────────────────────────────────────────────────────────

function unlock_form(frm) {
    if (frm.doc.docstatus === 1) {
        unlock_submitted(frm);
    } else {
        restore_locked_fields(frm);
    }
}

function unlock_submitted(frm) {
    // For submitted docs, we need allow_on_submit=1 AND read_only=0
    _roqson_aos_fields = [];
    _roqson_aos_grids  = [];

    frm.fields.forEach(function(field) {
        if (SKIP_TYPES.includes(field.df.fieldtype)) return;

        var changed = false;

        if (!field.df.allow_on_submit) {
            field.df.allow_on_submit = 1;
            changed = true;
        }
        // Also clear any read_only that may have been set
        if (field.df.read_only) {
            field.df.read_only = 0;
        }

        frm.refresh_field(field.df.fieldname);
        if (changed) _roqson_aos_fields.push(field.df.fieldname);
    });

    Object.keys(frm.fields_dict).forEach(function(fieldname) {
        var fd = frm.fields_dict[fieldname];
        if (!fd || !fd.grid) return;

        var changed = false;
        if (!fd.grid.df.allow_on_submit) {
            fd.grid.df.allow_on_submit = 1;
            changed = true;
        }
        fd.grid.df.read_only = 0;
        fd.grid.cannot_add_rows = false;
        fd.grid.cannot_delete_rows = false;
        if (fd.grid.wrapper) {
            fd.grid.wrapper.find('.grid-add-row, .grid-add-multiple-rows').show();
            fd.grid.wrapper.find('.grid-remove-rows').show();
        }
        fd.grid.refresh();
        if (changed) _roqson_aos_grids.push(fieldname);
    });

    frm.enable_save();
}

function restore_allow_on_submit(frm) {
    if (_roqson_aos_fields) {
        _roqson_aos_fields.forEach(function(fieldname) {
            var fd = frm.fields_dict[fieldname];
            if (fd) {
                fd.df.allow_on_submit = 0;
                frm.refresh_field(fieldname);
            }
        });
        _roqson_aos_fields = null;
    }

    if (_roqson_aos_grids) {
        _roqson_aos_grids.forEach(function(fieldname) {
            var fd = frm.fields_dict[fieldname];
            if (!fd || !fd.grid) return;
            fd.grid.df.allow_on_submit = 0;
            fd.grid.cannot_add_rows = true;
            fd.grid.cannot_delete_rows = true;
            if (fd.grid.wrapper) {
                fd.grid.wrapper.find('.grid-add-row, .grid-add-multiple-rows').hide();
                fd.grid.wrapper.find('.grid-remove-rows').hide();
            }
            fd.grid.refresh();
        });
        _roqson_aos_grids = null;
    }
}

function restore_locked_fields(frm) {
    if (_roqson_locked_fields) {
        _roqson_locked_fields.forEach(function(fieldname) {
            frm.set_df_property(fieldname, 'read_only', 0);
            frm.refresh_field(fieldname);
        });
        _roqson_locked_fields = null;
    }

    if (_roqson_locked_grids) {
        _roqson_locked_grids.forEach(function(fieldname) {
            var fd = frm.fields_dict[fieldname];
            if (!fd || !fd.grid) return;
            fd.grid.cannot_add_rows = false;
            fd.grid.cannot_delete_rows = false;
            fd.grid.df.read_only = 0;
            if (fd.grid.wrapper) {
                fd.grid.wrapper.find('.grid-add-row, .grid-add-multiple-rows').show();
                fd.grid.wrapper.find('.grid-remove-rows').show();
            }
            fd.grid.refresh();
        });
        _roqson_locked_grids = null;
    }

    frm.enable_save();
}

// ── Edit button ────────────────────────────────────────────────────────────

function add_edit_button(frm) {
    var btn = frm.add_custom_button(__('Edit'), function() {
        if (frm._roqson_edit_btn) {
            frm._roqson_edit_btn.remove();
            delete frm.custom_buttons[__('Edit')];
            frm._roqson_edit_btn = null;
        }
        // Reload the document from the server before entering edit mode.
        // This clears any stale child rows that exist on the client but were
        // removed from the DB by server-side workflow actions (e.g. the
        // "Order Details Table db91s8ldv2 not found" class of error).
        // The flag is read by apply_edit_mode_control on the next refresh.
        _roqson_pending_edit_after_reload = true;
        frm.reload_doc();
    });
    frm._roqson_edit_btn = btn;
    if (btn) btn.removeClass('btn-default btn-secondary').addClass('btn-warning');
}
})();
(function () {
frappe.ui.form.on('Order Details Table', {
    items: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        if (row.items && !row.is_promo_reward) {
            frappe.db.get_value('Product', row.items, 'sales_price').then(function(r) {
                if (r.message) {
                    frappe.model.set_value(cdt, cdn, 'price', r.message.sales_price);
                }
            });
        }
    },
    price: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        if (row.items && !row.is_promo_reward) {
            frappe.db.get_value('Product', row.items, 'sales_price').then(function(r) {
                if (r.message && row.price < r.message.sales_price) {
                    frappe.show_alert({
                        message: 'Unit cost changed from ' + r.message.sales_price + ' to ' + row.price,
                        indicator: 'orange'
                    });
                }
            });
        }
    }
});
frappe.ui.form.on('Order Form', {
    onload: function(frm) {
        if (window._pcr_global_initialized) return;
        var ROLES = ['Administrator', 'President', 'Manager', 'System Manager'];
        if (!ROLES.some(function (r) { return frappe.user.has_role(r); })) return;
        window._pcr_global_initialized = true;

    window._pcr_open = window._pcr_open || {};
    window._pcr_dismissed = window._pcr_dismissed || {};
    window._pcr_queue = window._pcr_queue || [];

    function pcr_process_queue() {
        if (Object.keys(window._pcr_open).length > 0) return;
        var next = window._pcr_queue.shift();
        if (next) window.show_pcr_dialog(next);
    }

    window.show_pcr_dialog = function (d) {
        if (window._pcr_open[d.name]) {
            try { window._pcr_open[d.name].show(); } catch (e) {}
            return;
        }
        var dialog = new frappe.ui.Dialog({
            title: __('Price Change Request'),
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'info',
                    options: '<div style="font-size:14px;">'
                        + '<p style="color:red;font-weight:bold;margin-bottom:12px;">Selling Price has been changed</p>'
                        + '<table class="table table-bordered">'
                        + '<tr><td><b>Order</b></td><td><a href="/app/order-form/' + d.order_form + '">' + d.order_form + '</a></td></tr>'
                        + '<tr><td><b>Date</b></td><td>' + (d.request_date ? d.request_date.substring(0, 10) : '') + '</td></tr>'
                        + '<tr><td><b>Item</b></td><td>' + (d.item_description || d.item) + '</td></tr>'
                        + '<tr><td><b>Quantity</b></td><td>' + (d.qty || '') + '</td></tr>'
                        + '<tr><td><b>Customer / Outlet</b></td><td>' + (d.customer_outlet || '') + '</td></tr>'
                        + '<tr><td><b>Original Price</b></td><td>\u20b1 ' + Number(d.original_price).toLocaleString() + '</td></tr>'
                        + '<tr><td><b>Requested Price</b></td><td style="color:red;font-weight:bold;">\u20b1 ' + Number(d.new_price).toLocaleString() + '</td></tr>'
                        + '<tr><td><b>Requested By</b></td><td>' + d.requested_by + (d.dsp && d.dsp !== d.requested_by ? ' (DSP: ' + d.dsp + ')' : '') + '</td></tr>'
                        + '</table></div>'
                },
                { fieldtype: 'Small Text', fieldname: 'remarks', label: 'Remarks' }
            ],
            primary_action_label: __('Approve'),
            primary_action: function () {
                frappe.xcall('frappe.client.set_value', {
                    doctype: 'Price Change Request',
                    name: d.name,
                    fieldname: {
                        status: 'Approved',
                        reviewed_by: frappe.session.user,
                        review_date: frappe.datetime.now_datetime(),
                        remarks: dialog.get_value('remarks') || ''
                    }
                }).then(function () {
                    frappe.show_alert({ message: __('Price change approved'), indicator: 'green' });
                    dialog.hide();
                    delete window._pcr_open[d.name];
                    pcr_process_queue();
                });
            },
            secondary_action_label: __('Reject'),
            secondary_action: function () {
                frappe.xcall('frappe.client.set_value', {
                    doctype: 'Price Change Request',
                    name: d.name,
                    fieldname: {
                        status: 'Rejected',
                        reviewed_by: frappe.session.user,
                        review_date: frappe.datetime.now_datetime(),
                        remarks: dialog.get_value('remarks') || ''
                    }
                }).then(function () {
                    frappe.show_alert({ message: __('Price change rejected'), indicator: 'red' });
                    dialog.hide();
                    delete window._pcr_open[d.name];
                    pcr_process_queue();
                });
            }
        });

        dialog.$wrapper.find('.modal-footer').prepend(
            '<button class="btn btn-default btn-sm pcr-view-full" style="position:absolute;left:15px;">View Full Form</button>'
        );
        dialog.$wrapper.find('.pcr-view-full').on('click', function () {
            dialog.hide();
            delete window._pcr_open[d.name];
            frappe.set_route('Form', 'Price Change Request', d.name);
        });

        // X-close: mark dismissed so it does NOT reappear from polling
        dialog.$wrapper.on('hidden.bs.modal', function () {
            if (window._pcr_open[d.name]) {
                delete window._pcr_open[d.name];
                window._pcr_dismissed[d.name] = true;
                pcr_process_queue();
            }
        });

        window._pcr_open[d.name] = dialog;
        dialog.show();
    };

    function pcr_enqueue(d) {
        if (window._pcr_open[d.name]) return;
        if (window._pcr_dismissed[d.name]) return;
        var already = window._pcr_queue.some(function(q) { return q.name === d.name; });
        if (already) return;
        window._pcr_queue.push(d);
        pcr_process_queue();
    }

    setInterval(function () {
        frappe.xcall('frappe.client.get_list', {
            doctype: 'Price Change Request',
            filters: { status: 'Pending' },
            fields: ['name', 'order_form', 'item', 'item_description', 'qty', 'customer_outlet', 'dsp', 'original_price', 'new_price', 'requested_by', 'request_date'],
            order_by: 'creation asc',
            limit_page_length: 10
        }).then(function (data) {
            if (!data || !data.length) return;
            data.forEach(function (d) {
                if (window._pcr_open[d.name] || window._pcr_dismissed[d.name]) return;
                var already = window._pcr_queue.some(function(q) { return q.name === d.name; });
                if (already) return;
                // Verify the order still exists before queuing
                frappe.xcall('frappe.client.get_value', {
                    doctype: 'Order Form',
                    filters: { name: d.order_form },
                    fieldname: 'workflow_state'
                }).then(function (r) {
                    if (!r || !r.workflow_state) {
                        // Order no longer exists — auto-close this PCR silently
                        frappe.xcall('frappe.client.set_value', {
                            doctype: 'Price Change Request',
                            name: d.name,
                            fieldname: {
                                status: 'Rejected',
                                review_date: frappe.datetime.now_datetime(),
                                remarks: 'Auto-closed: associated order no longer exists'
                            }
                        }).catch(function () {});
                        window._pcr_dismissed[d.name] = true;
                        return;
                    }
                    pcr_enqueue(d);
                }).catch(function () {
                    // Network error — skip this cycle, try again next poll
                });
            });
        });
    }, 10000);

    // Notification click: force re-invoke dialog even if previously dismissed
    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[href*="price-change-request"]');
        if (!link) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        var docname = link.getAttribute('href').split('/').pop();
        frappe.xcall('frappe.client.get', {
            doctype: 'Price Change Request',
            name: docname
        }).then(function (pcr) {
            if (pcr.status === 'Pending') {
                // Clear dismissed state so dialog re-shows
                delete window._pcr_dismissed[pcr.name];
                delete window._pcr_open[pcr.name];
                window._pcr_queue = window._pcr_queue.filter(function(q) { return q.name !== pcr.name; });
                window.show_pcr_dialog(pcr);
            } else {
                frappe.show_alert({
                    message: 'This request was already ' + pcr.status.toLowerCase() + ' by ' + (pcr.reviewed_by || 'someone'),
                    indicator: pcr.status === 'Approved' ? 'green' : 'red'
                });
            }
        });
        var notifList = document.querySelector('.notifications-list');
        if (notifList) notifList.classList.remove('visible');
    }, true);
    }
});
})();
