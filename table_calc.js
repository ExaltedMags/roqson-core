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
