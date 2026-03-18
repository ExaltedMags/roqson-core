// Client Script: Created By Status
(function () {
frappe.ui.form.on('Inventory Ledger', {
    refresh(frm) {
        update_created_by(frm);
    }
});

function update_created_by(frm) {
    if (!frm.doc.created_by) {
        frm.set_value('created_by', frappe.session.user);
    }
}

})();

// Client Script: Source Type For Manual Adjustments
(function () {
frappe.ui.form.on('Inventory Ledger', {
    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('source_type', 'Manual Adjustment');
            frm.set_value('created_by', frappe.session.user);
        }
    }
});

})();

// Client Script: Movement Type
(function () {
frappe.ui.form.on('Inventory Ledger', {
    onload(frm) {
        toggle_reference_fields(frm);
    },
    refresh(frm) {
        toggle_reference_fields(frm);
    },
    movement_type(frm) {
        toggle_reference_fields(frm);
    },
    source_type(frm) {
        toggle_reference_fields(frm);
    }
});

function toggle_reference_fields(frm) {
    // Always reset first
    frm.toggle_display('order_no', false);
    frm.toggle_display('stock_entry', false);

    frm.set_df_property('order_no', 'reqd', 0);
    frm.set_df_property('stock_entry', 'reqd', 0);

    // MANUAL ADJUSTMENT → no references
    if (frm.doc.source_type === "Manual Adjustment") {
        return;
    }

    // SYSTEM behavior (restore old logic)
    if (frm.doc.movement_type === "In") {
        frm.toggle_display('stock_entry', true);
        frm.set_df_property('stock_entry', 'reqd', 1);
    }

    if (["Out", "Reserved", "Return"].includes(frm.doc.movement_type)) {
        frm.toggle_display('order_no', true);
        frm.set_df_property('order_no', 'reqd', 1);
    }
}

})();

// Client Script: Fetch Rows
(function () {
frappe.ui.form.on('Inventory Ledger', {
    order_no(frm) {
        if (frm.doc.source_type !== 'System') return;
        if (!frm.doc.order_no) return;

        frappe.db.get_doc('Order Form', frm.doc.order_no).then(order => {
            if (!order.table_mkaq || !order.table_mkaq.length) return;

            frm.clear_table('table_jflv');

            order.table_mkaq.forEach(row => {
                let child = frm.add_child('table_jflv');
                child.product = row.items;
                child.qty = row.qty;
                child.unit = row.unit;
            });

            if (order.warehouse) {
                frm.set_value('warehouse', order.warehouse);
            }

            frm.refresh_field('table_jflv');
        });
    },

    stock_entry(frm) {
        if (frm.doc.source_type !== 'System') return;
        if (!frm.doc.stock_entry) return;

        frappe.db.get_doc('Inventory Entry', frm.doc.stock_entry).then(entry => {
            if (!entry.table_rvnc || !entry.table_rvnc.length) return;

            frm.clear_table('table_jflv');

            entry.table_rvnc.forEach(row => {
                let child = frm.add_child('table_jflv');
                child.product = row.product;
                child.qty = row.qty;
                child.unit = row.unit_of_measurement;
            });

            if (entry.target_warehouse) {
                frm.set_value('warehouse', entry.target_warehouse);
            }

            frm.refresh_field('table_jflv');
        });
    }
});

})();

// Client Script: Show reason and explanation
(function () {
frappe.ui.form.on('Inventory Ledger', {
    refresh(frm) {
        toggle_manual_fields(frm);
    },

    source_type(frm) {
        toggle_manual_fields(frm);
    }
});

function toggle_manual_fields(frm) {
    const show = frm.doc.source_type === "Manual Adjustment";

    frm.toggle_display("adjustment_reason", show);
    frm.toggle_display("explanation", show);
}

})();

// Client Script: Inventory Ledger Audit Trail
(function () {
frappe.ui.form.on('Inventory Ledger', {
    refresh(frm) {

        const wrapper = frm.fields_dict.remarks.$wrapper

        if (!frm.doc.stock_movement_log) {
            wrapper.html('<p style="color:#888;">No movement history yet</p>')
            return
        }

        const rows = frm.doc.stock_movement_log
            .split('\n')
            .map(r => {
                const [state, user, time] = r.split('|')
                return `
                    <tr>
                        <td>${state}</td>
                        <td>${user}</td>
                        <td>${time}</td>
                    </tr>
                `
            }).join('')

        wrapper.html(`
            <style>
                .stock-movement-table {
                    width:100%;
                    border-collapse:collapse;
                    font-size:13px;
                    table-layout:fixed;
                }

                .stock-movement-table th,
                .stock-movement-table td {
                    border:1px solid #eee;
                    padding:8px 10px;
                    white-space:normal;
                    word-wrap:break-word;
                }

                .stock-movement-table tbody tr:nth-child(even) {
                    background:#f8f9fa;
                }

                .stock-movement-table tbody tr:hover {
                    background:#eef2f6;
                }
            </style>

            <table class="stock-movement-table">
                <thead>
                    <tr>
                        <th>State</th>
                        <th>By</th>
                        <th>When</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `)
    }
})
})();

// Client Script: Movement Type Accessibility
(function () {
frappe.ui.form.on('Inventory Ledger', {

    onload(frm) {
        toggle_movement_type(frm);
    },

    refresh(frm) {
        toggle_movement_type(frm);
    },

    after_save(frm) {
        toggle_movement_type(frm);
    },

    source_type(frm) {
        toggle_movement_type(frm);
    }

});

function toggle_movement_type(frm) {

    if (!frm.fields_dict.movement_type) return;

    const is_system = frm.doc.source_type === "System";

    frm.set_df_property("movement_type", "read_only", is_system);

    const field = frm.fields_dict.movement_type;

    if (field && field.$input) {
        field.$input.prop("disabled", is_system);
        field.$wrapper.css("pointer-events", is_system ? "none" : "auto");
        field.$wrapper.css("opacity", is_system ? "0.7" : "1");
    }

    frm.refresh_field("movement_type");
}
})();
