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

