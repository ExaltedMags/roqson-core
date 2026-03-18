(function () {
// Sales form behavior migrated from Client Scripts.

frappe.ui.form.on('Sales', {
    setup(frm) {
        // Validation for required fields handled mostly server-side or allowed to pass
        // since Sales table is a read-only mirror of Order Form items for standard users.
    },

    refresh(frm) {
        frm._last_status = frm.doc.status;

        recompute_sales_totals(frm);
        render_sales_totals_row(frm);
        remove_manual_completed_gate(frm);

        if (!frm.is_new()) {
            render_receipts_section(frm);
        }

        if (frm.fields_dict.items && frm.fields_dict.items.grid) {
            let grid = frm.fields_dict.items.grid;

            grid.cannot_add_rows = true;
            grid.cannot_delete_rows = true;

            const all_fields = ['item', 'qty', 'unit', 'unit_price', 'total', 'warehouse', 'is_promo', 'is_unreserved'];
            all_fields.forEach(f => {
                grid.update_docfield_property(f, 'read_only', 1);
                grid.update_docfield_property(f, 'reqd', 0);
            });

            if (grid.clear_custom_buttons) {
                grid.clear_custom_buttons();
            } else {
                grid.wrapper.find('.grid-custom-buttons').empty();
                grid.custom_buttons = {};
            }

            if (frm.doc.status === 'Pending' || frm.doc.status === 'Failed') {
                grid.add_custom_button(__('Unreserve Selected'), () => {
                    const selected = grid.get_selected_children();
                    if (!selected || selected.length === 0) {
                        frappe.msgprint(__('Please select at least one row.'));
                        return;
                    }

                    let changed = false;
                    selected.forEach(row => {
                        if (!row.is_unreserved) {
                            frappe.model.set_value(row.doctype, row.name, 'is_unreserved', 1);
                            changed = true;
                        }
                    });

                    if (changed) {
                        frm.refresh_field('items');
                        frappe.show_alert({ message: __('Unreserving items...'), indicator: 'orange' });
                        frm.save();
                    } else {
                        frappe.msgprint(__('Selected items are already unreserved.'));
                    }
                });

                grid.add_custom_button(__('Reserve Selected'), () => {
                    const selected = grid.get_selected_children();
                    if (!selected || selected.length === 0) {
                        frappe.msgprint(__('Please select at least one row.'));
                        return;
                    }

                    let changed = false;
                    selected.forEach(row => {
                        if (row.is_unreserved) {
                            frappe.model.set_value(row.doctype, row.name, 'is_unreserved', 0);
                            changed = true;
                        }
                    });

                    if (changed) {
                        frm.refresh_field('items');
                        frappe.show_alert({ message: __('Reserving items...'), indicator: 'blue' });
                        frm.save();
                    } else {
                        frappe.msgprint(__('Selected items are already reserved.'));
                    }
                });
            }

            grid.refresh();
        }

        add_pickup_actions(frm);
    },

    validate(frm) {
        if (frm.doc.status === 'Cancelled' && frm._last_status !== 'Cancelled') {
            const user_roles = frappe.user_roles;
            const can_cancel = user_roles.includes('Sales') ||
                user_roles.includes('Sales Manager') ||
                user_roles.includes('Sales User') ||
                user_roles.includes('System Manager') ||
                user_roles.includes('Administrator');

            if (!can_cancel) {
                frappe.msgprint({
                    title: __('Permission Denied'),
                    indicator: 'red',
                    message: __('Only Sales role and Admin can cancel a Sales record directly.')
                });
                frappe.validated = false;
                frm.set_value('status', frm._last_status);
                return;
            }

            if (frm.doc.order_ref && !frm.doc.__cancel_confirmed) {
                frappe.validated = false;
                frappe.confirm(
                    __('Cancelling this Sales record will also cancel the linked Order ({0}). Proceed?', [frm.doc.order_ref]),
                    function () {
                        frm.doc.__cancel_confirmed = true;
                        frm.save();
                    },
                    function () {
                        frm.set_value('status', frm._last_status);
                    }
                );
                return;
            }
        }

        recompute_sales_totals(frm);
    },

    items_add(frm) {
        recompute_sales_totals(frm);
    },

    items_remove(frm) {
        recompute_sales_totals(frm);
    },

    customer_link(frm) {
        if (frm.doc.customer_link) {
            frappe.db.get_value('Customer Information', frm.doc.customer_link, 'terms', (r) => {
                if (r && r.terms) {
                    frm.set_value('terms', r.terms);
                }
            });
        }
    }
});

frappe.ui.form.on('Sales Items Table', {
    qty(frm, cdt, cdn) {
        calculate_sales_row_total(frm, cdt, cdn);
        recompute_sales_totals(frm);
    },
    unit_price(frm, cdt, cdn) {
        calculate_sales_row_total(frm, cdt, cdn);
        recompute_sales_totals(frm);
    },
    item(frm, cdt, cdn) {
        setTimeout(() => {
            calculate_sales_row_total(frm, cdt, cdn);
            recompute_sales_totals(frm);
        }, 800);
    }
});

function add_pickup_actions(frm) {
    if (frm.doc.fulfillment_type !== 'Pick-up') {
        return;
    }

    const roles = frappe.user_roles;
    const can_ready = roles.includes('Administrator') || roles.includes('System Manager') || roles.includes('Warehouse');
    const can_confirm = can_ready || roles.includes('Manager');

    if (frm.doc.status === 'Pending' && can_ready) {
        frm.page.add_inner_button('Ready for Pickup', () => {
            frappe.confirm('Is this order ready for customer collection at the counter?', () => {
                frm.set_value('status', 'For Pickup');
                frm.save();
            });
        }).addClass('btn-primary').css({
            color: 'white',
            'background-color': '#2563EB',
            'border-color': '#2563EB'
        });
    }

    if ((frm.doc.status === 'Pending' || frm.doc.status === 'For Pickup') && can_confirm) {
        frm.page.add_inner_button('Confirm Pick-up', () => {
            const prompt = frm.doc.status === 'For Pickup'
                ? 'Has the customer collected these items from the warehouse?'
                : 'Has the customer collected these items?';
            frappe.confirm(prompt, () => {
                frm.set_value('status', 'Received');
                frm.save();
            });
        }).addClass('btn-primary').css({
            color: 'white',
            'background-color': '#166534',
            'border-color': '#166534'
        });
    }
}

function calculate_sales_row_total(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let total = flt(row.qty || 0) * flt(row.unit_price || 0);
    if (isNaN(total)) total = 0;
    if (flt(row.total) !== total) {
        frappe.model.set_value(cdt, cdn, 'total', total);
    }
}

function recompute_sales_totals(frm) {
    let subtotal = 0;
    let total_qty = 0;

    (frm.doc.items || []).forEach(row => {
        let row_total = flt(row.qty || 0) * flt(row.unit_price || 0);
        if (isNaN(row_total)) row_total = 0;
        if (flt(row.total) !== row_total) {
            row.total = row_total;
        }
        subtotal += row.total;
        total_qty += flt(row.qty || 0);
    });

    const allowed_vat_roles = ['Sales', 'Sales Manager', 'Sales User', 'Manager', 'System Manager', 'President', 'Dispatcher', 'Stock Manager', 'Administrator'];
    const can_see_vat = allowed_vat_roles.some(r => frappe.user_roles.includes(r));
    const is_dsp_only_vat = frappe.user_roles.includes('DSP') && !can_see_vat;
    frm.__no_vat = is_dsp_only_vat;

    let vat_amount = frm.__no_vat ? 0 : +(subtotal * 12 / 112).toFixed(2);
    let grand_total = subtotal;

    if (isNaN(grand_total)) grand_total = 0;

    frm.__totals = {
        subtotal: subtotal,
        total_qty: total_qty,
        vat_amount: vat_amount,
        grand_total: grand_total
    };

    if (frm.fields_dict.grand_total) {
        frm.set_value('grand_total', grand_total);
    }

    render_sales_totals_row(frm);
}

function render_sales_totals_row(frm) {
    setTimeout(() => {
        let grid = frm.fields_dict.items && frm.fields_dict.items.grid;
        if (!grid) return;

        let wrapper = grid.wrapper;
        wrapper.find('.sales-totals-footer-row').remove();

        if (!frm.__totals) return;

        let subtotal = frm.__totals.subtotal;
        let total_qty = frm.__totals.total_qty;
        let vat_amount = frm.__totals.vat_amount;
        let grand_total = frm.__totals.grand_total;
        let net_of_vat = +((subtotal - vat_amount).toFixed(2));

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

        let footer = $(`
            <div class="sales-totals-footer-row">
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

function remove_manual_completed_gate(frm) {
    frm.page.remove_inner_button('Mark as Completed');
    frm.page.remove_inner_button('Mark Completed');
    frm.page.remove_inner_button('Accounting');
}

function render_receipts_section(frm) {
    var html_field = frm.get_field('receipts_html');
    if (!html_field) return;

    html_field.$wrapper.html('<div style="color:#9ca3af;font-size:12px;padding:4px 0;">Loading receipts...</div>');

    frappe.call({
        method: 'roqson_core.api.get_receipt_history_for_sale',
        args: { sales_no: frm.doc.name },
        callback: function (r) {
            var rows = (r && r.message) ? r.message : [];

            if (!rows.length) {
                html_field.$wrapper.html(
                    '<div style="color:#6b7280;font-style:italic;padding:8px 0;">No receipts posted yet.</div>'
                );
                return;
            }

            var html = '<table class="table table-bordered table-condensed" style="font-size:12px;margin-bottom:0;">'
                + '<thead><tr>'
                + '<th>Receipt No.</th>'
                + '<th>Date</th>'
                + '<th>Payment Type</th>'
                + '<th style="text-align:right;">Amount Applied</th>'
                + '<th>Posted By</th>'
                + '</tr></thead><tbody>';

            rows.forEach(function (row) {
                var link = '<a href="/app/receipt/' + row.receipt_no + '">' + row.receipt_no + '</a>';
                html += '<tr>'
                    + '<td>' + link + '</td>'
                    + '<td>' + (row.date || '') + '</td>'
                    + '<td>' + (row.payment_type || '') + '</td>'
                    + '<td style="text-align:right;">' + frappe.format(row.amount_applied, { fieldtype: 'Currency' }) + '</td>'
                    + '<td>' + (row.user || '') + '</td>'
                    + '</tr>';
            });

            html += '</tbody></table>';
            html_field.$wrapper.html(html);
        },
        error: function () {
            html_field.$wrapper.html(
                '<div style="color:#9ca3af;font-style:italic;padding:8px 0;">Could not load receipts.</div>'
            );
        }
    });
}
})();
