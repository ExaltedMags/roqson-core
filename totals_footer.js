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

