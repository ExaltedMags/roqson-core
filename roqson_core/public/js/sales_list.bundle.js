(function () {
// Sales list behavior migrated from Client Scripts.

var SL_WIDTHS = {
    'sl-col-id': '160px',
    'sl-col-status': '110px',
    'sl-col-ftype': '0px',
    'sl-col-ref': '150px',
    'sl-col-customer': '300px',
    'sl-col-address': '400px',
    'sl-col-total': '140px',
    'sl-col-date': '130px',
};
var SL_ALL_CLS = Object.keys(SL_WIDTHS);
var SL_HIDDEN = ['sl-col-ftype'];

var SL_LABEL_MAP = {
    'display name': 'sl-col-id',
    'status': 'sl-col-status',
    'fulfillment type': 'sl-col-ftype',
    'order ref.': 'sl-col-ref',
    'order ref': 'sl-col-ref',
    'customer': 'sl-col-customer',
    'address': 'sl-col-address',
    'grand total': 'sl-col-total',
    'date created': 'sl-col-date',
};

function sl_apply_style(col, cls) {
    var w = SL_WIDTHS[cls];
    if (!w) return;
    SL_ALL_CLS.forEach(function (c) { col.classList.remove(c); });
    col.classList.add(cls);
    var base = 'flex:0 0 ' + w + ' !important;min-width:' + w + ' !important;max-width:' + w + ' !important;'
        + 'padding-left:8px;padding-right:8px;box-sizing:border-box;white-space:nowrap;overflow:hidden;';
    if (cls === 'sl-col-status') {
        col.setAttribute('style', base + 'display:flex !important;align-items:center;justify-content:center;');
    } else if (cls === 'sl-col-total') {
        col.setAttribute('style', base + 'display:flex !important;align-items:center;justify-content:flex-end;');
    } else if (cls === 'sl-col-id') {
        col.setAttribute('style', base + 'font-weight:700;');
    } else {
        col.setAttribute('style', base);
    }
}

function sl_style_columns(page) {
    if (!page) return;

    var colClasses = [];
    var headerRow = page.querySelector('.list-row-head');
    if (headerRow) {
        Array.from(headerRow.querySelectorAll('.list-row-col')).forEach(function (col) {
            if (col.classList.contains('list-subject')) return;
            if (col.classList.contains('tag-col')) {
                col.style.setProperty('display', 'none', 'important');
                colClasses.push('__tag');
                return;
            }
            var text = (col.textContent || '').trim().toLowerCase();
            if (text === 'tag') {
                col.style.setProperty('display', 'none', 'important');
                colClasses.push('__tag');
                return;
            }
            var cls = SL_LABEL_MAP[text] || null;
            colClasses.push(cls);

            col.style.cssText = '';
            SL_ALL_CLS.forEach(function (c) { col.classList.remove(c); });
            if (cls && SL_HIDDEN.indexOf(cls) >= 0) {
                col.style.setProperty('display', 'none', 'important');
            } else if (cls) {
                sl_apply_style(col, cls);
            }
        });
    }

    page.querySelectorAll('.list-row-container .list-row').forEach(function (row) {
        var ci = 0;
        Array.from(row.querySelectorAll('.list-row-col')).forEach(function (col) {
            if (col.classList.contains('list-subject')) return;

            col.style.cssText = '';
            SL_ALL_CLS.forEach(function (c) { col.classList.remove(c); });

            var cls = ci < colClasses.length ? colClasses[ci] : null;
            ci++;

            if (!cls || cls === '__tag') {
                if (col.classList.contains('tag-col')) {
                    col.style.setProperty('display', 'none', 'important');
                }
                return;
            }
            if (SL_HIDDEN.indexOf(cls) >= 0) {
                col.style.setProperty('display', 'none', 'important');
            } else {
                sl_apply_style(col, cls);
            }
        });
    });
}

function sl_fix_ids(listview) {
    if (!listview || !listview.$result) return;
    listview.$result.find('.list-row-container').each(function () {
        var $c = $(this);
        var docName = $c.attr('data-name');
        if (!docName) {
            var $cb = $c.find('.list-row-checkbox[data-name]');
            if ($cb.length) docName = $cb.attr('data-name');
        }
        if (!docName) {
            var $any = $c.find('[data-name]').first();
            if ($any.length) docName = $any.attr('data-name');
        }
        if (!docName) return;

        var $idCol = $c.find('.sl-col-id');
        if ($idCol.length) {
            $idCol.text(docName);
        }

        $c.find('.list-subject a').each(function () {
            if ($.trim($(this).text()) === '-') {
                $(this).text(docName).attr('title', docName);
            }
        });
    });
}

var SALES_STATE_COLORS = {
    'Pending': { bg: '#FEFCE8', text: '#854D0E', border: 'rgba(133, 77, 14, 0.15)' },
    'Dispatching': { bg: '#F0FDFA', text: '#134E4A', border: 'rgba(19, 78, 74, 0.15)' },
    'In Transit': { bg: '#EFF6FF', text: '#1E40AF', border: 'rgba(30, 64, 175, 0.15)' },
    'For Pickup': { bg: '#EFF6FF', text: '#1E40AF', border: 'rgba(30, 64, 175, 0.15)' },
    'Received': { bg: '#F0FDF4', text: '#166534', border: 'rgba(22, 101, 52, 0.15)' },
    'Failed': { bg: '#FEF2F2', text: '#991B1B', border: 'rgba(153, 27, 27, 0.15)' },
    'Completed': { bg: '#ECFDF5', text: '#065F46', border: 'rgba(6, 95, 70, 0.15)' },
    'Cancelled': { bg: '#FFF1F2', text: '#9F1239', border: 'rgba(159, 18, 57, 0.15)' },
};

function sales_badge_html(colors, label) {
    if (!colors) return label;
    var s = 'background-color:' + colors.bg + ';color:' + colors.text + ';'
        + 'border:1px solid ' + colors.border + ';border-radius:9999px;'
        + 'padding:2px 10px;font-size:11px;font-weight:600;'
        + 'white-space:nowrap;display:inline-block;line-height:1.4;';
    return '<span style="' + s + '">' + label + '</span>';
}

frappe.listview_settings.Sales = {
    add_fields: ['status', 'customer_link', 'address', 'grand_total', 'order_ref', 'creation_date', 'fulfillment_type'],

    formatters: {
        status: function (value) {
            var colors = SALES_STATE_COLORS[value];
            return colors ? sales_badge_html(colors, value) : value;
        },
        fulfillment_type: function (value) {
            return '<span style="font-weight:600;color:#555;">' + (value || 'Delivery') + '</span>';
        }
    },

    onload: function (listview) {
        roqson_add_copy_action(listview, 'Sales', 'Sales');
        setTimeout(function () {
            if (listview.filter_area && listview.filter_area.filter_list) {
                var filters = listview.filter_area.get();
                if (filters.length > 0 && !listview.__cleared) {
                    listview.filter_area.clear();
                    listview.__cleared = true;
                }
            }
        }, 200);

        function injectCSS() {
            var existing = document.getElementById('sl-list-css');
            if (existing) existing.remove();
            var el = document.createElement('style');
            el.id = 'sl-list-css';
            el.textContent = '\
#page-List\\/Sales\\/List .list-row-activity .comment-count,\
#page-List\\/Sales\\/List .list-row-activity .mx-2,\
#page-List\\/Sales\\/List .list-row-activity .list-row-like { display:none !important; }\
#page-List\\/Sales\\/List .list-header-meta .list-liked-by-me { display:none !important; }\
#page-List\\/Sales\\/List .list-subject {\
    flex:0 0 200px !important; min-width:200px !important; max-width:200px !important;\
    overflow:hidden !important; display:flex !important; align-items:center !important;\
}\
#page-List\\/Sales\\/List .list-header-subject .list-header-meta { display:none !important; }\
#page-List\\/Sales\\/List .list-row-head .level-left,\
#page-List\\/Sales\\/List .list-row-container .list-row .level-left {\
    flex:0 0 auto !important; min-width:0 !important; max-width:none !important; overflow:visible !important;\
}\
#page-List\\/Sales\\/List .list-row-head .level-right,\
#page-List\\/Sales\\/List .list-row-container .list-row .level-right {\
    flex:0 0 0px !important; min-width:0px !important; max-width:0px !important; overflow:hidden !important; display:none !important;\
}\
#page-List\\/Sales\\/List .list-row-col { margin-right:0 !important; }\
#page-List\\/Sales\\/List .tag-col { display:none !important; }\
#page-List\\/Sales\\/List .list-row-head,\
#page-List\\/Sales\\/List .list-row-container .list-row {\
    min-width:1630px !important; flex-wrap:nowrap !important; display:flex !important;\
}\
#page-List\\/Sales\\/List .layout-main-section { overflow:visible !important; }\
#page-List\\/Sales\\/List .frappe-list,\
#page-List\\/Sales\\/List .layout-main-section-wrapper { overflow:visible !important; }\
#page-List\\/Sales\\/List .result {\
    overflow-x:auto !important; -webkit-overflow-scrolling:touch;\
}\
#page-List\\/Sales\\/List .list-row-col.hidden-xs,\
#page-List\\/Sales\\/List .list-row-col.hidden-sm,\
#page-List\\/Sales\\/List .list-row-col.hidden-md,\
#page-List\\/Sales\\/List .list-row-head .list-row-col.hidden-xs,\
#page-List\\/Sales\\/List .list-row-head .list-row-col.hidden-sm,\
#page-List\\/Sales\\/List .list-row-head .list-row-col.hidden-md {\
    display:flex !important;\
}\
.row-locked { opacity:0.5; background-color:#f9f9f9 !important; pointer-events:none; }\
';
            document.head.appendChild(el);
        }

        function removeCSS() {
            var x = document.getElementById('sl-list-css');
            if (x) x.remove();
        }

        injectCSS();

        if (!listview.__sl_route_handler) {
            listview.__sl_route_handler = true;
            frappe.router.on('change', function () {
                var route = frappe.get_route();
                if (route && route[0] === 'List' && route[1] === 'Sales') injectCSS();
                else removeCSS();
            });
        }

        if (!listview.page.fields_dict.address_filter) {
            listview.page.add_field({
                fieldname: 'address_filter',
                fieldtype: 'Data',
                label: 'Filter by Address',
                change: function () {
                    var val = this.get_value();
                    listview.filter_area.filter_list.filters
                        .filter(function (f) { return f.fieldname === 'address'; })
                        .forEach(function (f) { f.remove(); });
                    if (val) listview.filter_area.add([['Sales', 'address', 'like', '%' + val + '%']]);
                    listview.filter_area.filter_list.apply();
                }
            });
        }

        listview.$result.on('change', '.list-row-checkbox', () => {
            frappe.listview_settings.Sales.handle_selection_lock(listview);
        });
    },

    refresh: function (listview) {
        this.add_bundle_actions(listview);
        this.handle_selection_lock(listview);

        var page = document.getElementById('page-List/Sales/List') || (listview.page.wrapper && listview.page.wrapper[0]);
        setTimeout(function () { sl_style_columns(page); sl_fix_ids(listview); }, 300);
        setTimeout(function () { sl_style_columns(page); sl_fix_ids(listview); }, 800);
        setTimeout(function () { sl_style_columns(page); sl_fix_ids(listview); }, 1500);
    },

    add_bundle_actions: function (listview) {
        var allowed_roles = ['Dispatch', 'Dispatcher', 'Administrator', 'System Manager', 'Manager', 'President'];
        var has_role = allowed_roles.some(function (role) { return frappe.user_roles.includes(role); });

        if (has_role) {
            listview.page.remove_inner_button('Create Trip');
            listview.page.remove_inner_button('Create Trip');
            listview.page.add_actions_menu_item('Create Trip', function () {
                var selected = listview.get_checked_items();
                if (!selected || !selected.length) return frappe.msgprint('Select at least one Sales record.');
                if (selected.some(function (d) { return d.status !== 'Pending'; })) return frappe.msgprint('Only Pending Sales records allowed.');
                if (selected.some(function (d) { return d.fulfillment_type === 'Pick-up'; })) return frappe.msgprint('Pick-up orders skip Trip.');

                frappe.db.get_doc('Sales', selected[0].name).then(sales_doc => {
                    frappe.model.with_doctype('Trips', () => {
                        let tt = frappe.model.get_new_doc('Trips');
                        tt.outlet = sales_doc.customer_link;
                        tt.address = sales_doc.address;
                        tt.contact_number = sales_doc.contact_number;
                        tt.contact_person = sales_doc.contact_person;

                        selected.forEach(s => {
                            let row = frappe.model.add_child(tt, 'table_cpme');
                            row.sales_no = s.name;
                            row.order_no = s.order_ref;
                        });
                        frappe.set_route('Form', 'Trips', tt.name);
                    });
                });
            });
        }
    },

    handle_selection_lock: function (listview) {
        setTimeout(function () {
            var selected = listview.get_checked_items();
            listview.$result.find('.list-row-checkbox').prop('disabled', false);
            listview.$result.find('.list-row').removeClass('row-locked');

            if ($('#selection-hint-msg').length === 0) {
                listview.$result.before('<div id="selection-hint-msg" style="display:none;padding:10px;margin-bottom:10px;background-color:#fcf8e3;border:1px solid #faebcc;color:#8a6d3b;border-radius:4px;font-weight:600;"><i class="fa fa-info-circle"></i> Only Pending Sales records with the same customer and delivery address can be bundled.</div>');
            }

            if (selected.length > 0) {
                var cust = selected[0].customer_link;
                var addr = selected[0].address;
                listview.data.forEach(function (d) {
                    if (!d.name) return;
                    if (d.customer_link !== cust || d.address !== addr || d.status !== 'Pending' || d.fulfillment_type === 'Pick-up') {
                        var $cb = listview.$result.find('.list-row-checkbox[data-name="' + d.name + '"]');
                        if ($cb.length && !$cb.prop('checked')) {
                            $cb.prop('disabled', true).closest('.list-row').addClass('row-locked');
                        }
                    }
                });
                $('#selection-hint-msg').slideDown(200);
            } else {
                listview.data.forEach(function (d) {
                    if (d.status !== 'Pending' || d.fulfillment_type === 'Pick-up') {
                        listview.$result.find('.list-row-checkbox[data-name="' + d.name + '"]').prop('disabled', true);
                    }
                });
                $('#selection-hint-msg').slideUp(200);
            }
        }, 100);
    }
};

function roqson_add_copy_action(listview, doctype, label) {
    if (!Array.isArray(frappe.user_roles) || frappe.user_roles.indexOf('System Manager') === -1) {
        return;
    }
    if (listview.__roqson_copy_action_added) {
        return;
    }
    listview.__roqson_copy_action_added = true;

    listview.page.add_action_item('Copy to New Draft', function () {
        var selected = listview.get_checked_items() || [];
        if (selected.length !== 1) {
            frappe.msgprint('Select exactly one ' + label + ' record to copy.');
            return;
        }
        if (!frappe.model || typeof frappe.model.copy_doc !== 'function') {
            frappe.msgprint('Copying is not available in this ERPNext build.');
            return;
        }

        frappe.dom.freeze('Preparing draft copy...');
        frappe.model.with_doctype(doctype, function () {
            frappe.db.get_doc(doctype, selected[0].name).then(function (source_doc) {
                var copied_doc = frappe.model.copy_doc(source_doc);
                roqson_prepare_copied_doc(copied_doc);
                frappe.dom.unfreeze();
                frappe.show_alert({
                    message: 'Draft copy opened. Review linked references before saving.',
                    indicator: 'blue'
                });
                frappe.set_route('Form', doctype, copied_doc.name);
            }).catch(function (err) {
                frappe.dom.unfreeze();
                console.error(err);
                frappe.msgprint('Unable to copy ' + label + '.');
            });
        });
    });
}

function roqson_prepare_copied_doc(doc) {
    if (!doc) {
        return;
    }
    delete doc.workflow_state;
    delete doc.status;
    delete doc.docstatus;
    delete doc.amended_from;
}
})();
