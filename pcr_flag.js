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

