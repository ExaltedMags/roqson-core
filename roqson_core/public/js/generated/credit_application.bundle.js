// Credit Application handler registry
(function () {
const root = typeof window !== "undefined" ? window : globalThis;

if (root.__roqson_credit_application_registry__) {
    return;
}

const registry = {
    handlers: {},

    collect(handlers) {
        Object.keys(handlers || {}).forEach((eventName) => {
            const handler = handlers[eventName];
            if (typeof handler !== "function") {
                return;
            }
            if (!this.handlers[eventName]) {
                this.handlers[eventName] = [];
            }
            this.handlers[eventName].push(handler);
        });
    },

    activate() {
        if (this.activated) {
            return;
        }

        const mergedHandlers = {};
        Object.keys(this.handlers).forEach((eventName) => {
            const chain = this.handlers[eventName].slice();
            mergedHandlers[eventName] = function () {
                let pending = null;
                let lastResult;

                chain.forEach((handler) => {
                    if (pending) {
                        pending = pending.then(() => handler.apply(this, arguments)).then((result) => {
                            lastResult = result;
                            return result;
                        });
                        return;
                    }

                    const result = handler.apply(this, arguments);
                    if (result && typeof result.then === "function") {
                        pending = Promise.resolve(result).then((resolved) => {
                            lastResult = resolved;
                            return resolved;
                        });
                    } else {
                        lastResult = result;
                    }
                });

                return pending || lastResult;
            };
        });

        frappe.ui.form.on("Credit Application", mergedHandlers);
        this.activated = true;
    }
};

root.__roqson_credit_application_registry__ = registry;
root.collectCreditApplicationHandlers = function (handlers) {
    registry.collect(handlers);
};
})();

// Client Script: Credit Application - Display Name
(function () {
collectCreditApplicationHandlers({
    customer: function(frm) {
        if(frm.doc.customer) {
            frappe.db.get_doc('Customer Information', frm.doc.customer)
            .then(doc => {
                frm.set_value('customer_name', doc.owners_full_name);
            });
        }
    }
});

})();

// Client Script: DSP Session
(function () {
frappe.provide('roqson.credit_application_bundle');
const creditApplicationBundle = roqson.credit_application_bundle;

collectCreditApplicationHandlers({
    onload(frm) {
        creditApplicationBundle.handle_onload(frm);
    }
});

creditApplicationBundle.handle_onload = async function handle_credit_application_onload(frm) {
    if (frm.__credit_application_onload_pending) {
        return frm.__credit_application_onload_pending;
    }

    frm.__credit_application_onload_pending = Promise.resolve()
        .then(() => creditApplicationBundle.run_onload(frm))
        .finally(() => {
            delete frm.__credit_application_onload_pending;
        });

    return frm.__credit_application_onload_pending;
};

creditApplicationBundle.run_onload = async function run_credit_application_onload(frm) {
    creditApplicationBundle.enforce_archive_lock(frm);
    await Promise.all([
        creditApplicationBundle.set_dsp_name_if_new(frm),
        creditApplicationBundle.load_customer_if_present(frm)
    ]);
};

creditApplicationBundle.set_dsp_name_if_new = function set_dsp_name_if_new(frm) {
    if (!frm.is_new()) {
        return Promise.resolve();
    }

    return frappe.db.get_value(
        "User",
        frappe.session.user,
        "full_name"
    ).then(r => {
        if (r?.message?.full_name) {
            return frm.set_value('dsp_name', r.message.full_name);
        }

        if (r?.full_name) {
            return frm.set_value('dsp_name', r.full_name);
        }
    });
};

})();

// Client Script: Fix Credit Application
(function () {
frappe.provide('roqson.credit_application_bundle');
const creditApplicationBundle = roqson.credit_application_bundle;

collectCreditApplicationHandlers({

    onload(frm) {
        creditApplicationBundle.handle_onload(frm);
    },

    refresh(frm) {
        creditApplicationBundle.handle_refresh(frm);
    },

    customer_information(frm) {
        creditApplicationBundle.load_customer_if_present(frm);
    }
});

creditApplicationBundle.handle_refresh = async function handle_credit_application_refresh(frm) {
    if (frm.__credit_application_refresh_pending) {
        return frm.__credit_application_refresh_pending;
    }

    frm.__credit_application_refresh_pending = Promise.resolve()
        .then(() => creditApplicationBundle.run_refresh(frm))
        .finally(() => {
            delete frm.__credit_application_refresh_pending;
        });

    return frm.__credit_application_refresh_pending;
};

creditApplicationBundle.run_refresh = async function run_credit_application_refresh(frm) {
    await creditApplicationBundle.load_customer_if_present(frm);
    creditApplicationBundle.enforce_archive_lock(frm);
    creditApplicationBundle.apply_car_linkback_refresh_state(frm);
    creditApplicationBundle.update_credit_display(frm);
    creditApplicationBundle.toggle_credit_term_rules(frm);
    creditApplicationBundle.apply_workflow_stage_lock(frm);
    frm._last_owner_signature = frm.doc.owner_with_signature_and_printed_date;
};


creditApplicationBundle.load_customer_if_present = async function load_customer_if_present(frm) {
    const customerInformation = frm.doc.customer_information;
    const requestToken = (frm.__credit_application_customer_load_token || 0) + 1;
    frm.__credit_application_customer_load_token = requestToken;

    if (!customerInformation) {
        creditApplicationBundle.clear_customer_fields(frm);
        return;
    }

    const { message: customer } = await frappe.db.get_value(
        'Customer Information',
        customerInformation,
        [
            'name_of_business',
            'tin_number',
            'business_mobile_address',
            'legal_form_of_business',
            'nature_of_business',
            'email_address',
            'year_established',
            'business_address',
            'credit_limit',
            'terms',
            'is_unlimited_credit'
        ]
    );

    if (!customer || creditApplicationBundle.is_stale_customer_load(frm, requestToken, customerInformation)) return;

    // =============================
    // BUSINESS FIELDS
    // =============================
    frm.set_value('name_of_business', customer.name_of_business || '');

    // Retrieve readable Nature of Business
    let readableNatureOfBusiness = customer.nature_of_business || '';

    if (customer.nature_of_business) {
        const { message: nob } = await frappe.db.get_value(
            'Nature of Business',
            customer.nature_of_business,
            'customer_group'
        );

        if (creditApplicationBundle.is_stale_customer_load(frm, requestToken, customerInformation)) return;

        readableNatureOfBusiness = nob?.customer_group || customer.nature_of_business;
    }

    frm.set_value('nature_of_business', readableNatureOfBusiness);

    frm.set_value('business_tin_number', customer.tin_number || '');
    frm.set_value('business_mobile_address', customer.business_mobile_address || '');
    frm.set_value('business_email_address', customer.email_address || '');
    frm.set_value('legal_form_of_business', customer.legal_form_of_business || '');
    frm.set_value('year_established', customer.year_established || '');
    frm.set_value('app_credit', customer.terms || '');

    // =============================
    // CREDIT DISPLAY
    // =============================
    if (customer.is_unlimited_credit == 1) {
        frm.set_value('c_line', 'Unlimited');
    } else {
        const numeric_limit = customer.credit_limit || 0;
        frm.set_value('c_line', format_currency(numeric_limit));
    }

    // =============================
    // ADDRESS
    // =============================
    if (customer.business_address) {

        const { message: addr } = await frappe.db.get_value(
            'PH Address',
            customer.business_address,
            [
                'address_line1',
                'custom_barangay',
                'custom_citymunicipality',
                'custom_province',
                'custom_zip_code'
            ]
        );

        if (creditApplicationBundle.is_stale_customer_load(frm, requestToken, customerInformation)) return;

        if (addr?.address_line1) {
            const formatted = [
                addr.address_line1,
                addr.custom_barangay,
                addr.custom_citymunicipality,
                addr.custom_province,
                addr.custom_zip_code
            ].filter(Boolean).join(', ');

            frm.set_value('business_address', formatted);
        } else {
            frm.set_value('business_address', customer.business_address);
        }

    } else {
        frm.set_value('business_address', '');
    }

    frappe.show_alert({
        message: 'Customer information loaded',
        indicator: 'green'
    });
};

creditApplicationBundle.is_stale_customer_load = function is_stale_customer_load(frm, requestToken, customerInformation) {
    return (
        frm.__credit_application_customer_load_token !== requestToken ||
        frm.doc.customer_information !== customerInformation
    );
};


// =============================
// CLEAR FIELDS
// =============================
creditApplicationBundle.clear_customer_fields = function clear_customer_fields(frm) {

    frm.set_value('business_address', '');
    frm.set_value('name_of_business', '');
    frm.set_value('business_tin_number', '');
    frm.set_value('business_mobile_address', '');
    frm.set_value('business_email_address', '');
    frm.set_value('legal_form_of_business', '');
    frm.set_value('nature_of_business', '');
    frm.set_value('year_established', '');
    frm.set_value('app_credit', '');
    frm.set_value('c_line', '');
};
})();

// Client Script: Signed By Fields
(function () {
collectCreditApplicationHandlers({

    // owner_with_signature_and_printed_date(frm) {
    //     if (frm.doc.owner_with_signature_and_printed_date) {
    //         frm.set_value("signedby_1", frappe.session.user);
    //     }
    // },

    approved_by(frm) {
        if (frm.doc.approved_by) {
            frm.set_value("signedby_2", frappe.session.user);
        }
    },

    ci_by(frm) {
        if (frm.doc.ci_by) {
            frm.set_value("signedby_3", frappe.session.user);
        }
    }

});

})();

// Client Script: Archive CA Form
(function () {
frappe.provide('roqson.credit_application_bundle');
const creditApplicationBundle = roqson.credit_application_bundle;

collectCreditApplicationHandlers({

  onload(frm) {
    creditApplicationBundle.handle_onload(frm);
  },

  refresh(frm) {
    creditApplicationBundle.handle_refresh(frm);
  }

});

creditApplicationBundle.enforce_archive_lock = function enforce_archive_lock(frm) {

  if (!frm.doc.archived) return;

  // Make entire form read-only
  frm.set_read_only();

  // Disable save button
  frm.disable_save();
};


})();

// Client Script: Credit Application - CAR Linkback
(function () {
frappe.provide('roqson.credit_application_bundle');
const creditApplicationBundle = roqson.credit_application_bundle;

// ============================================================
// Credit Application - CAR Linkback
// When a new Credit Application is created from a CAR:
//   1. Applies any prefilled route_options fields that
//      read_only fetch_from fields may have missed
//   2. After the CA is saved, links it back to the CAR
//      (sets CAR.credit_application = this CA's name)
// ============================================================

collectCreditApplicationHandlers({
    refresh(frm) {
        creditApplicationBundle.handle_refresh(frm);
    },

    after_save(frm) {
        // After the CA is saved, link it back to the originating CAR
        const car_name = sessionStorage.getItem('pending_car_name');
        if (!car_name || !frm.doc.name) return;

        // Clear session storage immediately to prevent double-linking
        sessionStorage.removeItem('pending_car_name');
        sessionStorage.removeItem('pending_car_outlet');

        // Update the CAR to link to this Credit Application
        frappe.call({
            method: 'frappe.client.set_value',
            args: {
                doctype: 'Credit Application Request',
                name: car_name,
                fieldname: 'credit_application',
                value: frm.doc.name
            },
            callback: function(r) {
                if (r.message) {
                    frappe.show_alert({
                        message: __('Linked to Credit Application Request: {0}', [car_name]),
                        indicator: 'green'
                    }, 5);
                    // Clear the intro banner
                    frm.set_intro('');
                }
            },
            error: function(e) {
                console.error('Failed to link CAR to CA:', e);
            }
        });
    }
});

creditApplicationBundle.apply_car_linkback_refresh_state = function apply_car_linkback_refresh_state(frm) {
    if (frm.doc.__islocal) {
        // Apply any remaining prefill from route_options
        // (route_options is cleared by Frappe after first set_value,
        //  but read_only fields may not receive them — re-apply here)
        const opts = frappe.route_options || {};
        const fill_if_blank = (field, val) => {
            if (val && !frm.doc[field]) {
                frm.set_value(field, val).catch(() => {});
            }
        };
        fill_if_blank('select_seay',           opts.select_seay);
        fill_if_blank('legal_form_of_business', opts.legal_form_of_business);
        fill_if_blank('business_address',       opts.business_address);
        fill_if_blank('name_of_business',       opts.name_of_business);
    }

    // Show a banner if this CA was created from a CAR
    const car_name = sessionStorage.getItem('pending_car_name');
    if (car_name && frm.doc.__islocal) {
        frm.set_intro(
            __('This Credit Application was created from Credit Application Request: <strong>{0}</strong>. It will be linked automatically upon saving.', [car_name]),
            'blue'
        );
    }
};
})();

// Client Script: CA: Unlimited Credit
(function () {
frappe.provide('roqson.credit_application_bundle');
const creditApplicationBundle = roqson.credit_application_bundle;

collectCreditApplicationHandlers({

    refresh(frm) {
        creditApplicationBundle.handle_refresh(frm);
    },

    unlimited_credit(frm) {
        creditApplicationBundle.update_credit_display(frm);
    },

    app_credit_line(frm) {
        creditApplicationBundle.update_credit_display(frm);
    },

    app_credit_terms(frm) {
        creditApplicationBundle.toggle_credit_term_rules(frm);
    }

});


creditApplicationBundle.update_credit_display = function update_credit_display(frm) {

    // If credit terms do not require a credit line, skip logic
    if (frm.doc.app_credit_terms === "COD" || frm.doc.app_credit_terms === "CASH") {
        return;
    }

    if (frm.doc.unlimited_credit) {

        frm.toggle_display('app_credit_line', false);
        frm.toggle_display('app_credit_line_display', true);

        frm.set_value('app_credit_line', null);
        frm.set_value('app_credit_line_display', 'Unlimited');

    } else {

        frm.toggle_display('app_credit_line', true);
        frm.toggle_display('app_credit_line_display', false);

        if (frm.doc.app_credit_line) {

            frm.set_value(
                'app_credit_line_display',
                format_currency(frm.doc.app_credit_line)
            );

        } else {

            frm.set_value(
                'app_credit_line_display',
                format_currency(0)
            );

        }

    }
};


creditApplicationBundle.toggle_credit_term_rules = function toggle_credit_term_rules(frm) {

    const no_credit_terms = ["COD", "CASH"];

    if (no_credit_terms.includes(frm.doc.app_credit_terms)) {

        // Hide credit line fields
        frm.toggle_display('app_credit_line', false);
        frm.toggle_display('app_credit_line_display', false);
        frm.toggle_display('unlimited_credit', false);

        // Clear values
        frm.set_value('app_credit_line', null);
        frm.set_value('app_credit_line_display', null);
        frm.set_value('unlimited_credit', 0);

    } else {

        // Show fields again
        frm.toggle_display('app_credit_line', true);
        frm.toggle_display('unlimited_credit', true);

        creditApplicationBundle.update_credit_display(frm);
    }

};
})();

// Client Script: CA: Credit Validation
(function () {
collectCreditApplicationHandlers({

    unlimited_credit(frm) {

        if (frm.doc.unlimited_credit) {
            frm.set_value('app_credit_line', null);
        }

        frm.toggle_enable('app_credit_line', !frm.doc.unlimited_credit);
    }

});
})();

// Client Script: CA: Workflow Stage Lock
(function () {
frappe.provide('roqson.credit_application_bundle');
const creditApplicationBundle = roqson.credit_application_bundle;

collectCreditApplicationHandlers({

    refresh(frm) {
        creditApplicationBundle.handle_refresh(frm);
    }

});

creditApplicationBundle.apply_workflow_stage_lock = function apply_workflow_stage_lock(frm) {
    const state = frm.doc.workflow_state;

    const role_map = {
        "Draft": ["DSP", "Manager", "President", "Sales"],
        "For Completion": ["Sales", "Manager", "President"],
        "Needs Review": ["Credit Investigator", "Manager", "President"],
        "Approved": ["Manager", "President", "Administrator"],
        "Rejected": ["Sales", "Manager", "President"]
    };

    const allowed_roles = role_map[state] || [];
    const user_roles = frappe.user_roles || [];

    const can_edit = allowed_roles.some(role =>
        user_roles.includes(role)
    );

    if (!can_edit) {
        frm.disable_form();

        if (frm.page.btn_primary) {
            frm.page.btn_primary.hide();
        }
    }
};
})();

// Client Script: CA: Block creation if unresolved exists
(function () {
collectCreditApplicationHandlers({

    customer_information: function(frm) {

        if (!frm.doc.customer_information) return;

        // --------------------------------------
        // Check if unresolved CA exists
        // --------------------------------------

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Credit Application",
                filters: {
                    customer_information: frm.doc.customer_information,
                    workflow_state: ["in", ["For Completion", "Needs Review"]]
                },
                fields: ["name", "workflow_state"],
                order_by: "creation desc",
                limit_page_length: 1
            },

            callback: function(r) {

                if (r.message && r.message.length) {

                    let existing = r.message[0];

                    frappe.throw({
                        title: "Existing Credit Application Found",
                        message: `
                        A Credit Application is already in progress for this customer.<br><br>
                        Credit ID: <b>${existing.name}</b><br>
                        Current Status: <b>${existing.workflow_state}</b><br><br>
                        Please resolve the existing application before creating a new one.
                        `
                    });

                }

                // --------------------------------------
                //  Fetch latest Approved CA
                // --------------------------------------

                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Credit Application",
                        filters: {
                            customer_information: frm.doc.customer_information,
                            workflow_state: "Approved"
                        },
                        fields: ["name"],
                        order_by: "creation desc",
                        limit_page_length: 1
                    },

                    callback: function(res) {

                        if (!res.message || !res.message.length) return;

                        let previous_ca = res.message[0].name;

                        frappe.call({
                            method: "frappe.client.get",
                            args: {
                                doctype: "Credit Application",
                                name: previous_ca
                            },

                            callback: function(data) {

                                let prev = data.message;

                                populate_previous_ca(frm, prev);

                                frappe.msgprint({
                                    title: "Previous Credit Application Found",
                                    message: `Fields were pre-filled from the latest approved Credit Application: <b>${prev.name}</b>.`,
                                    indicator: "blue"
                                });

                            }

                        });

                    }

                });

            }

        });

    }

});


// -------------------------------------------------
// Populate fields from previous Credit Application
// -------------------------------------------------

function populate_previous_ca(frm, prev) {

    // ------------------------
    // Business Information
    // ------------------------

    frm.set_value("nature_of_business", prev.nature_of_business);
    frm.set_value("legal_form_of_business", prev.legal_form_of_business);
    frm.set_value("business_address", prev.business_address);
    frm.set_value("business_email_address", prev.business_email_address);
    frm.set_value("business_tin_number", prev.business_tin_number);
    frm.set_value("business_mobile_address", prev.business_mobile_address);
    frm.set_value("year_established", prev.year_established);
    frm.set_value("name_of_business", prev.name_of_business);

    // ------------------------
    // Clear requested credit
    // ------------------------

    frm.set_value("app_credit_terms", null);
    frm.set_value("app_credit_line", null);
    frm.set_value("unlimited_credit", 0);

    // ------------------------
    // Copy child tables
    // ------------------------

    copy_table(frm, prev, "partners_incorporators_table");
    copy_table(frm, prev, "supplier_reference_table");
    copy_table(frm, prev, "bank_reference_table");
    copy_table(frm, prev, "table_ahmg");

}


// -------------------------------------------------
// Generic helper to copy child tables
// -------------------------------------------------

function copy_table(frm, prev, table) {

    frm.clear_table(table);

    (prev[table] || []).forEach(row => {

        let child = frm.add_child(table);

        Object.keys(row).forEach(field => {

            if (!["name", "parent", "parentfield", "parenttype", "doctype"].includes(field)) {
                child[field] = row[field];
            }

        });

    });

    frm.refresh_field(table);

}
})();

// Client Script: CA: Override Owners Signature
(function () {
collectCreditApplicationHandlers({

    approved_by(frm) {
        if (frm.doc.approved_by) {
            frm.set_value("signedby_2", frappe.session.user);
        }
    },

    ci_by(frm) {
        if (frm.doc.ci_by) {
            frm.set_value("signedby_3", frappe.session.user);
        }
    }

});
})();

// Client Script: CA: Date time for Owners Signature
(function () {
frappe.provide('roqson.credit_application_bundle');
const creditApplicationBundle = roqson.credit_application_bundle;

collectCreditApplicationHandlers({

    refresh(frm) {
        creditApplicationBundle.handle_refresh(frm);
    },

    owner_with_signature_and_printed_date(frm) {

        let current_signature = frm.doc.owner_with_signature_and_printed_date;

        if (current_signature && current_signature !== frm._last_owner_signature) {

            frm.set_value("date_signed", frappe.datetime.now_datetime());

            // update stored signature value
            frm._last_owner_signature = current_signature;
        }
    }

});
})();

(function () {
    const root = typeof window !== "undefined" ? window : globalThis;
    root.__roqson_credit_application_registry__?.activate();
})();
