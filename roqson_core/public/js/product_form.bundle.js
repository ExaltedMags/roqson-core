frappe.ui.form.on("Product", {
    onload(frm) {
        enforce_archive_lock(frm);
    },
    refresh(frm) {
        enforce_archive_lock(frm);
        fetch_inventory(frm);
    }
});

function enforce_archive_lock(frm) {
    if (!frm.doc.archived) return;
    
    // Make entire form read-only
    frm.set_read_only();
    
    // Disable save button
    frm.disable_save();
}

/**
 * Fetches real-time inventory for both warehouses (UG and SJ)
 * and updates the corresponding display fields.
 */
function fetch_inventory(frm) {
    if (!frm.doc.name || frm.is_new()) return;

    // Reset inventory fields to 0 before fetching
    const fields = [
        'in_qty', 'available_qty', 'reserved_qty', 'on_hand_qty',
        'in_qty_2', 'available_qty_2', 'reserved_qty_2', 'on_hand_qty_2'
    ];
    fields.forEach(f => frm.set_value(f, 0));

    frappe.call({
        method: "roqson_core.api.get_product_inventory",
        args: {
            product: frm.doc.name
        },
        callback: function(r) {
            if (!r.message) {
                frm.refresh_fields();
                return;
            }

            const rows = Array.isArray(r.message) ? r.message : [];
            const warehouseMap = buildWarehouseSlotMap(rows);

            rows.forEach(row => {
                const slot = warehouseMap.get(getWarehouseKey(row));
                if (!slot) return;

                frm.set_value(slot.in_qty, row.in_qty || 0);
                frm.set_value(slot.available_qty, row.available_qty || 0);
                frm.set_value(slot.reserved_qty, row.reserved_qty || 0);
                frm.set_value(slot.on_hand_qty, row.on_hand_qty || 0);
            });
            
            // Force UI refresh to show updated values
            frm.refresh_fields();
        }
    });
}

function getWarehouseKey(row) {
    return String(row.warehouse_label || row.warehouse_name || row.warehouse || "").trim().toLowerCase();
}

function buildWarehouseSlotMap(rows) {
    const slots = [
        {
            aliases: ["ug", "urdaneta", "urdaneta city"],
            fields: {
                in_qty: "in_qty",
                available_qty: "available_qty",
                reserved_qty: "reserved_qty",
                on_hand_qty: "on_hand_qty",
            },
        },
        {
            aliases: ["sj", "san jose"],
            fields: {
                in_qty: "in_qty_2",
                available_qty: "available_qty_2",
                reserved_qty: "reserved_qty_2",
                on_hand_qty: "on_hand_qty_2",
            },
        },
    ];

    const map = new Map();
    const fallbackRows = [];

    rows.forEach(row => {
        const key = getWarehouseKey(row);
        const matchingSlot = slots.find(slot => slot.aliases.some(alias => key.includes(alias)));
        if (matchingSlot) {
            map.set(key, matchingSlot.fields);
        } else {
            fallbackRows.push(key);
        }
    });

    fallbackRows.forEach((key, index) => {
        if (!map.has(key) && slots[index]) {
            map.set(key, slots[index].fields);
        }
    });

    return map;
}
