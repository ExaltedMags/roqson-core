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
