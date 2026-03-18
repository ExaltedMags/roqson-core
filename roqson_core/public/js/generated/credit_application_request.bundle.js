// Client Script: Credit Application Request - Sales Actions
(function () {
// ============================================================
// Credit Application Request - Sales Actions
// Adds "Create Credit Application" button for Sales/Admin
// on Credit Application Request form (Pending Review state).
// Fetches Customer Information and prefills all mappable
// Credit Application fields. CAR is linked back after save
// via the "Credit Application - CAR Linkback" client script.
// ============================================================

frappe.ui.form.on('Credit Application Request', {
    refresh(frm) {
        apply_car_sales_actions(frm);
    },
    workflow_state(frm) {
        apply_car_sales_actions(frm);
    }
});

function apply_car_sales_actions(frm) {
    frm.remove_custom_button('Create Credit Application', 'Actions');

    const is_sales = frappe.user_roles.includes('Sales')
        || frappe.user_roles.includes('System Manager')
        || frappe.user_roles.includes('President');
    const is_pending = frm.doc.workflow_state === 'Pending Review';
    const already_linked = !!(frm.doc.credit_application && frm.doc.credit_application.trim());

    if (!is_sales || !is_pending || already_linked || frm.doc.__islocal) return;

    frm.add_custom_button(__('Create Credit Application'), async () => {
        frappe.show_alert({ message: __('Fetching customer data...'), indicator: 'blue' }, 3);

        // Fetch the full Customer Information record
        let ci = null;
        try {
            const r = await frappe.call({
                method: 'frappe.client.get',
                args: { doctype: 'Customer Information', name: frm.doc.outlet }
            });
            ci = r.message;
        } catch(e) {
            console.error('Failed to fetch Customer Information:', e);
        }

        // Build route_options for Credit Application prefill
        // customer_information (Link) triggers fetch_from for: email, tin, phone, year_established, current_terms
        // We also manually pass the read_only fetched fields since new forms may not auto-trigger fetch_from
        const opts = {
            customer_information: frm.doc.outlet,
            dsp_name:             frm.doc.requested_by,
            app_credit_terms:     frm.doc.requested_terms
        };

        if (ci) {
            // Direct mappable fields from Customer Information to Credit Application
            if (ci.name_of_business)       opts.name_of_business        = ci.name_of_business;
            if (ci.legal_form_of_business) opts.legal_form_of_business  = ci.legal_form_of_business;
            if (ci.business_address)       opts.business_address         = ci.business_address;
            if (ci.email_address)          opts.business_email_address   = ci.email_address;
            if (ci.phone_number)           opts.business_mobile_number   = ci.phone_number;
            if (ci.tin_number)             opts.business_tin_number      = String(ci.tin_number);
            if (ci.year_established)       opts.year_established         = ci.year_established;
            if (ci.terms)                  opts.app_credit               = ci.terms;
            // Note: nature_of_business is a Link to "Nature of Business" doctype (NB-xxxxx)
            // and CA's select_seay is a hardcoded Select — they don't share a common value format.
            // Sales staff should fill select_seay manually.
        }

        frappe.route_options = opts;

        // Stash CAR name for linkback by the Credit Application client script
        sessionStorage.setItem('pending_car_name', frm.doc.name);
        sessionStorage.setItem('pending_car_outlet', frm.doc.outlet);

        frappe.new_doc('Credit Application');

    }, __('Actions'));
}
})();
