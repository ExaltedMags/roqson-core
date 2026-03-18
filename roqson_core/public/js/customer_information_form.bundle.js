frappe.ui.form.on('Customer Information', {
    onload(frm) {
        // From: Archive CI List (misnamed Form script)
        enforce_archive_lock(frm);

        // From: Sales Personnel
        if (frm.is_new()) {
            frm.set_value('dsp_name', frappe.session.user);
        }
    },

    refresh(frm) {
        // From: Archive CI List
        enforce_archive_lock(frm);
        setup_address_overrides(frm);
        intercept_address_quick_entry();
        setup_autosave_on_address_nav(frm);
        setup_submitted_doc_buttons(frm);

        // From: Order History Summary
        render_order_history(frm);

        // From: CI: Unlimited Credit Limit
        update_credit_display(frm);

        // From: CI: Edit Permissions
        check_edit_permissions(frm);

        // From: Customer Info: Address Helpers
        setup_address_copy_buttons(frm);
    },

    before_save(frm) {
        // From: Customer Info - Display Name
        if (frm.doc.owners_full_name) {
            frm.set_value('display_name', frm.doc.name + ' - ' + frm.doc.owners_full_name);
        } else {
            frm.set_value('display_name', frm.doc.name);
        }
    },

    validate(frm) {
        // From: CI: Edit Permissions
        check_edit_permissions(frm, true);
    },

    // --- Field Handlers ---

    is_unlimited_credit(frm) {
        update_credit_display(frm);
    },

    credit_limit(frm) {
        update_credit_display(frm);
    },

    residential_address(frm) {
        if (frm.doc.residential_address) {
            frappe.db.get_value("PH Address", frm.doc.residential_address, "address_line1")
                .then(r => {
                    if (r.message) {
                        frm.set_value("residential_address_display", r.message.address_line1);
                    }
                });
        } else {
            frm.set_value("residential_address_display", "");
        }
    },

    business_address(frm) {
        if (frm.doc.business_address) {
            frappe.db.get_value("PH Address", frm.doc.business_address, "address_line1")
                .then(r => {
                    if (r.message) {
                        frm.set_value("business_address_display", r.message.address_line1);
                    }
                });
        } else {
            frm.set_value("business_address_display", "");
        }
    },

    // Legacy handlers from Archive CI List (kept for safety if buttons use these triggers)
    same_as_residential_business(frm) {
        if (!frm.doc.residential_address) {
            frappe.msgprint(__("No Residential Address set."));
            return;
        }
        frm.set_value("business_address", frm.doc.residential_address);
    },

    same_as_residential_delivery(frm) {
        if (!frm.doc.residential_address) {
            frappe.msgprint(__("No Residential Address set."));
            return;
        }
        let already_exists = (frm.doc.outlet_address || []).some(
            row => row.addresses === frm.doc.residential_address
        );
        if (already_exists) {
            frappe.msgprint(__("Residential address is already in the Delivery Addresses table."));
            return;
        }
        let row = frappe.model.add_child(frm.doc, "Customer Information Outlet Address", "outlet_address");
        frappe.model.set_value(row.doctype, row.name, "addresses", frm.doc.residential_address);
        frm.refresh_field("outlet_address");
        frm.dirty();
    },

    same_as_business_delivery(frm) {
        if (!frm.doc.business_address) {
            frappe.msgprint(__("No Business Address set."));
            return;
        }
        let already_exists = (frm.doc.outlet_address || []).some(
            row => row.addresses === frm.doc.business_address
        );
        if (already_exists) {
            frappe.msgprint(__("Business address is already in the Delivery Addresses table."));
            return;
        }
        let row = frappe.model.add_child(frm.doc, "Customer Information Outlet Address", "outlet_address");
        frappe.model.set_value(row.doctype, row.name, "addresses", frm.doc.business_address);
        frm.refresh_field("outlet_address");
        frm.dirty();
    }
});

// --- Helper Functions ---

function enforce_archive_lock(frm) {
    if (frm.doc.archived) {
        frm.set_read_only();
        frm.disable_save();
    }
}

function setup_address_overrides(frm) {
    // Force fields to point to PH Address at runtime
    frm.get_field("residential_address").df.options = "PH Address";
    frm.get_field("business_address").df.options = "PH Address";
    frm.refresh_field("residential_address");
    frm.refresh_field("business_address");

    // Force child table addresses field to PH Address
    if (frm.fields_dict.outlet_address && frm.fields_dict.outlet_address.grid) {
        frm.fields_dict.outlet_address.grid.update_docfield_property(
            "addresses", "options", "PH Address"
        );
    }

    // Skip dropdown (force Create New) when address fields are empty
    frm.set_query("residential_address", function() {
        if (!frm.doc.residential_address) {
            return { filters: { name: ["like", "__NO_RESULTS__"] } };
        }
        return {};
    });

    frm.set_query("business_address", function() {
        if (!frm.doc.business_address) {
            return { filters: { name: ["like", "__NO_RESULTS__"] } };
        }
        return {};
    });

    // Same logic for the child table addresses field
    frm.set_query("addresses", "outlet_address", function(doc, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.addresses) {
            return { filters: { name: ["like", "__NO_RESULTS__"] } };
        }
        return {};
    });
}

function intercept_address_quick_entry() {
    if (window._ph_address_intercepted) return;
    window._ph_address_intercepted = true;

    let original_make_quick_entry = frappe.ui.form.make_quick_entry;
    frappe.ui.form.make_quick_entry = function(doctype, after_insert, init_callback, doc, force) {
        let result = original_make_quick_entry.apply(this, arguments);
        if (doctype === "PH Address") {
            let attempts = 0;
            let interval = setInterval(() => {
                attempts++;
                if (cur_dialog && cur_dialog.fields_dict && cur_dialog.fields_dict.custom_province) {
                    clearInterval(interval);
                    wire_cascade_to_dialog();
                } else if (attempts > 20) {
                    clearInterval(interval);
                    console.warn("PH Address dialog not ready after 20 attempts");
                }
            }, 100);
        }
        return result;
    };
}

function wire_cascade_to_dialog() {
    let d = cur_dialog;
    if (!d || !d.fields_dict) return;
    if (!d.fields_dict.custom_province) return;

    function set_df_query(field, query_fn) {
        d.fields_dict[field].df.get_query = query_fn;
        d.fields_dict[field].get_query = query_fn;
        if (d.fields_dict[field].$input) {
            d.fields_dict[field].$input.data("cache", {});
        }
    }

    // Province → filter city/municipality AND barangay, clear downstream
    d.fields_dict.custom_province.$input.off("awesomplete-selectcomplete.cascade");
    d.fields_dict.custom_province.$input.on("awesomplete-selectcomplete.cascade", function() {
        setTimeout(() => {
            let prov = d.get_value("custom_province");
            d.set_value("custom_citymunicipality", "");
            d.set_value("custom_barangay", "");
            if (prov) {
                set_df_query("custom_citymunicipality", function() {
                    return { filters: { province: prov }, page_length: 200 };
                });
                set_df_query("custom_barangay", function() {
                    return { filters: { province: prov }, page_length: 200 };
                });
            } else {
                set_df_query("custom_citymunicipality", function() { return {}; });
                set_df_query("custom_barangay", function() { return {}; });
            }
        }, 100);
    });

    // City/Municipality → narrow barangay filter further, auto-fill province
    d.fields_dict.custom_citymunicipality.$input.off("awesomplete-selectcomplete.cascade");
    d.fields_dict.custom_citymunicipality.$input.on("awesomplete-selectcomplete.cascade", function() {
        setTimeout(() => {
            let cm = d.get_value("custom_citymunicipality");
            d.set_value("custom_barangay", "");
            if (cm) {
                set_df_query("custom_barangay", function() {
                    return { filters: { city_municipality: cm }, page_length: 500 };
                });
                if (!d.get_value("custom_province")) {
                    frappe.db.get_value("PH City Municipality", cm, "province").then(r => {
                        if (r.message && r.message.province) {
                            let prov = r.message.province;
                            d.set_value("custom_province", prov);
                            set_df_query("custom_citymunicipality", function() {
                                return { filters: { province: prov }, page_length: 200 };
                            });
                        }
                    });
                }
            }
        }, 100);
    });

    // Barangay → auto-fill city/municipality and province
    d.fields_dict.custom_barangay.$input.off("awesomplete-selectcomplete.cascade");
    d.fields_dict.custom_barangay.$input.on("awesomplete-selectcomplete.cascade", function() {
        setTimeout(() => {
            let bgy = d.get_value("custom_barangay");
            if (!bgy) return;
            frappe.db.get_value("PH Barangay", bgy, ["city_municipality", "province"]).then(r => {
                if (r.message) {
                    if (!d.get_value("custom_citymunicipality") && r.message.city_municipality) {
                        d.set_value("custom_citymunicipality", r.message.city_municipality);
                        set_df_query("custom_barangay", function() {
                            return { filters: { city_municipality: r.message.city_municipality }, page_length: 500 };
                        });
                    }
                    if (!d.get_value("custom_province") && r.message.province) {
                        d.set_value("custom_province", r.message.province);
                        set_df_query("custom_citymunicipality", function() {
                            return { filters: { province: r.message.province }, page_length: 200 };
                        });
                    }
                }
            });
        }, 100);
    });
}

function setup_autosave_on_address_nav(frm) {
    ['residential_address', 'business_address'].forEach(fieldname => {
        let $btn = frm.fields_dict[fieldname]?.$input_area.find('.btn-open');
        if (!$btn || !$btn.length) return;

        $btn.off('click.autosave').on('click.autosave', async function(e) {
            if (!frm.is_dirty() && !frm.is_new()) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            let href = $(this).attr('href');

            try {
                await frm.save();
                window.location.href = href;
            } catch(err) {
                frappe.msgprint(__("Please fill in all required fields before editing the address."));
            }
        });
    });
}

function setup_submitted_doc_buttons(frm) {
    if (frm.doc.docstatus === 1 && !frm.doc.archived) {
        add_delivery_address_button(frm);
        add_business_representative_button(frm);
    }
}

function add_delivery_address_button(frm) {
    let wrapper = frm.fields_dict.outlet_address.$wrapper;
    wrapper.find(".add-delivery-address-btn").remove();

    let $btn = $(`<button class="btn btn-xs btn-default add-delivery-address-btn" style="margin-top:8px;">
        Add Delivery Address
    </button>`);

    wrapper.append($btn);

    $btn.on("click", function() {
        let d = new frappe.ui.Dialog({
            title: __("Add Delivery Address"),
            fields: [
                {
                    label: __("Address"),
                    fieldname: "addresses",
                    fieldtype: "Link",
                    options: "PH Address",
                    reqd: 1,
                    get_query: function() {
                        let existing = (frm.doc.outlet_address || [])
                            .map(r => r.addresses)
                            .filter(Boolean);
                        if (existing.length) {
                            return { filters: [["name", "not in", existing]] };
                        }
                        return {};
                    }
                }
            ],
            primary_action_label: __("Add"),
            primary_action(values) {
                d.hide();

                let next_idx = ((frm.doc.outlet_address || []).length) + 1;

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Customer Information Outlet Address",
                            parenttype: "Customer Information",
                            parent: frm.doc.name,
                            parentfield: "outlet_address",
                            idx: next_idx,
                            addresses: values.addresses
                        }
                    },
                    freeze: true,
                    freeze_message: __("Adding delivery address..."),
                    callback(r) {
                        if (!r.exc) {
                            frappe.show_alert({ message: __("Delivery address added."), indicator: "green" });
                            frm.reload_doc();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

function add_business_representative_button(frm) {
    let wrapper = frm.fields_dict.business_representatives.$wrapper;
    wrapper.find(".add-business-rep-btn").remove();

    let $btn = $(`<button class="btn btn-xs btn-default add-business-rep-btn" style="margin-top:8px;">
        Add Business Representative
    </button>`);

    wrapper.append($btn);

    $btn.on("click", function() {
        let d = new frappe.ui.Dialog({
            title: __("Add Business Representative"),
            fields: [
                {
                    label: __("Name"),
                    fieldname: "name1",
                    fieldtype: "Data",
                    reqd: 1
                },
                {
                    label: __("Position"),
                    fieldname: "position",
                    fieldtype: "Data",
                    reqd: 0
                },
                {
                    label: __("Contact Number"),
                    fieldname: "contact_number",
                    fieldtype: "Data",
                    reqd: 0
                }
            ],
            primary_action_label: __("Add"),
            primary_action(values) {
                d.hide();

                let next_idx = ((frm.doc.business_representatives || []).length) + 1;

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Business Representatives Table",
                            parenttype: "Customer Information",
                            parent: frm.doc.name,
                            parentfield: "business_representatives",
                            idx: next_idx,
                            name1: values.name1,
                            position: values.position || "",
                            contact_number: values.contact_number || ""
                        }
                    },
                    freeze: true,
                    freeze_message: __("Adding business representative..."),
                    callback(r) {
                        if (!r.exc) {
                            frappe.show_alert({ message: __("Business representative added."), indicator: "green" });
                            frm.reload_doc();
                        }
                    }
                });
            }
        });
        d.show();
    });
}

function render_order_history(frm) {
    if (!frm.doc.name) return;

    const wrapper = frm.fields_dict.order_history.$wrapper;
    let current_page = 1;
    const page_size = 20;

    wrapper.html(`
        <div style="margin-bottom:12px; display:flex; gap:8px; align-items:center;">
            <select class="form-control input-sm" id="order-status" style="width:160px;">
                <option value="">All Statuses</option>
                <option>Draft</option>
                <option>Approved</option>
                <option>Reserved</option>
                <option>Dispatched</option>
                <option>Delivered</option>
                <option>Canceled</option>
            </select>

            <div id="product-link-field" style="width:260px;"></div>

            <button class="btn btn-sm btn-primary" id="apply-filters">
                ${__('Apply')}
            </button>
        </div>

        <div id="order-history-content"></div>
    `);

    const content = wrapper.find('#order-history-content');

    const product_field = frappe.ui.form.make_control({
        parent: wrapper.find('#product-link-field'),
        df: {
            fieldtype: 'Link',
            fieldname: 'product_filter',
            options: 'Product',
            placeholder: __('Search product...'),
            get_query() {
                return {
                    filters: { archived: 0 }
                };
            }
        },
        render_input: true
    });

    product_field.refresh();

    function load_orders() {
        content.html(`<p style="color:#888;">${__('Loading order history...')}</p>`);

        frappe.call({
            method: 'roqson_core.api.get_customer_orders',
            args: {
                customer: frm.doc.name,
                status: wrapper.find('#order-status').val() || null,
                product: product_field.get_value() || null,
                page: current_page,
                page_size: page_size
            }
        }).then(res => {
            const data = res.message || {};
            render_orders_table(data.orders || [], data.has_more);
        });
    }

    function render_orders_table(orders, has_more) {
        if (!orders.length) {
            content.html(`<p style="color:#888;">${__('No orders found.')}</p>`);
            return;
        }

        const rows = orders.map(o => `
            <tr>
                <td class="col-order">
                    <a href="/app/order-form/${o.name}">
                        ${o.name}
                    </a>
                </td>
                <td class="col-date">
                    ${frappe.datetime.str_to_user(o.date)}
                </td>
                <td class="col-items">
                    ${o.items || ''}
                </td>
                <td class="col-qty">
                    ${o.total_qty || 0}
                </td>
                <td class="col-status">
                    ${o.workflow_state}
                </td>
            </tr>
        `).join('');

        content.html(`
            <style>
                .order-history-table {
                    width: 100%;
                    table-layout: fixed;
                }

                .order-history-table th,
                .order-history-table td {
                    vertical-align: top;
                    padding: 8px 10px;
                    white-space: normal;
                    word-wrap: break-word;
                }

                .col-order { width: 140px; white-space: nowrap; }
                .col-date { width: 110px; white-space: nowrap; }
                .col-items { width: auto; }
                .col-qty { width: 100px; text-align: center; white-space: nowrap; }
                .col-status { width: 120px; white-space: nowrap; }

                .order-history-table tbody tr:nth-child(even) { background-color: #f8f9fa; }
                .order-history-table tbody tr:hover { background-color: #eef2f6; }
            </style>

            <table class="table table-bordered order-history-table">
                <thead>
                    <tr>
                        <th class="col-order">${__('Order No')}</th>
                        <th class="col-date">${__('Date')}</th>
                        <th class="col-items">${__('Items')}</th>
                        <th class="col-qty">${__('Total Qty')}</th>
                        <th class="col-status">${__('Status')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <div style="display:flex; justify-content:space-between; margin-top:12px;">
                <button class="btn btn-sm btn-secondary" id="prev-page"
                    ${current_page === 1 ? 'disabled' : ''}>
                    ${__('Prev')}
                </button>

                <span>${__('Page')} ${current_page}</span>

                <button class="btn btn-sm btn-secondary" id="next-page"
                    ${!has_more ? 'disabled' : ''}>
                    ${__('Next')}
                </button>
            </div>
        `);
    }

    wrapper.off('click', '#apply-filters').on('click', '#apply-filters', () => {
        current_page = 1;
        load_orders();
    });

    wrapper.off('click', '#prev-page').on('click', '#prev-page', () => {
        if (current_page > 1) {
            current_page--;
            load_orders();
        }
    });

    wrapper.off('click', '#next-page').on('click', '#next-page', () => {
        current_page++;
        load_orders();
    });

    load_orders();
}

function update_credit_display(frm) {
    if (frm.doc.is_unlimited_credit) {
        frm.toggle_display('credit_limit', false);
        frm.toggle_display('credit_limit_display', true);
        frm.set_value('credit_limit', null);
        frm.set_value('credit_limit_display', 'Unlimited');
    } else {
        frm.toggle_display('credit_limit', true);
        frm.toggle_display('credit_limit_display', false);

        if (frm.doc.credit_limit) {
            frm.set_value(
                'credit_limit_display',
                format_currency(frm.doc.credit_limit)
            );
        } else {
            frm.set_value('credit_limit_display', format_currency(0));
        }
    }
}

function check_edit_permissions(frm, throw_err = false) {
    if (frm.doc.docstatus === 1) {
        const allowed_roles = ["Manager", "President"];
        const user_roles = frappe.user_roles || [];

        const can_edit = allowed_roles.some(role => user_roles.includes(role));

        if (!can_edit) {
            if (throw_err) {
                frappe.throw(
                    __("This Customer Information record has already been submitted and can only be edited by a Manager or the President. Please contact them if changes are required.")
                );
            } else {
                frm.disable_form();
                if (frm.page.btn_primary) {
                    frm.page.btn_primary.hide();
                }
            }
        }
    }
}

function setup_address_copy_buttons(frm) {
    // Buttons for copying/adding addresses
    const mapping = {
        'same_as_residential_business': () => copy_address_logic(frm, 'residential_address', 'business_address'),
        'same_as_business_residential': () => copy_address_logic(frm, 'business_address', 'residential_address'),
        'same_as_residential_delivery': () => add_to_delivery_table_logic(frm, 'residential_address'),
        'same_as_business_delivery': () => add_to_delivery_table_logic(frm, 'business_address')
    };

    Object.keys(mapping).forEach(fieldname => {
        if (frm.fields_dict[fieldname]) {
            frm.fields_dict[fieldname].$wrapper.find('button').off('click').on('click', mapping[fieldname]);
        }
    });
}

function copy_address_logic(frm, source_field, target_field) {
    if (!frm.doc[source_field]) {
        frappe.msgprint(__('Please select a {0} first.', [frappe.meta.get_label('Customer Information', source_field)]));
        return;
    }
    
    frm.set_value(target_field, frm.doc[source_field]);
    
    let source_display = source_field + '_display';
    let target_display = target_field + '_display';
    
    if (frm.doc[source_display]) {
        frm.set_value(target_display, frm.doc[source_display]);
    }
    
    frappe.show_alert({
        message: __('{0} copied to {1}', [
            frappe.meta.get_label('Customer Information', source_field),
            frappe.meta.get_label('Customer Information', target_field)
        ]),
        indicator: 'green'
    });
}

function add_to_delivery_table_logic(frm, source_field) {
    if (!frm.doc[source_field]) {
        frappe.msgprint(__('Please select a {0} first.', [frappe.meta.get_label('Customer Information', source_field)]));
        return;
    }

    let exists = (frm.doc.outlet_address || []).some(row => row.addresses === frm.doc[source_field]);
    if (exists) {
        frappe.show_alert({ message: __('Address already in Delivery Addresses'), indicator: 'orange' });
        return;
    }

    let row = frm.add_child('outlet_address');
    row.addresses = frm.doc[source_field];
    frm.refresh_field('outlet_address');
    
    frappe.show_alert({ message: __('Address added to Delivery list'), indicator: 'green' });
}
