// Client Script: Receipt: Form Controller
(function () {
// Receipt: Form Controller
// Handles auto-fill, payment field toggling, and Apply To grid logic.

var CHECK_FIELDS  = ['bank', 'check_no', 'check_date', 'deposit_bank_account', 'deposit_date'];
var BT_FIELDS     = ['bt_bank_account', 'bt_ref_no'];

function toggle_payment_fields(frm) {
    var pt = frm.doc.payment_type;
    var is_check = (pt === 'Check');
    var is_bt    = (pt === 'Bank Transfer');

    frm.toggle_display(CHECK_FIELDS, is_check);
    frm.toggle_reqd(CHECK_FIELDS, is_check);
    frm.toggle_display(BT_FIELDS, is_bt);
    frm.toggle_reqd(BT_FIELDS, is_bt);
}

function tt_apply_sales_query(frm) {
    frm.set_query('sales_no', 'apply_to', function() {
        // Using object syntax for maximum compatibility
        var filters = {
            'status': 'Received',
            'archived': 0
        };
        
        if (frm.doc.customer) {
            filters['customer_link'] = frm.doc.customer;
        }
        
        return {
            filters: filters
        };
    });
}

frappe.ui.form.on('Receipt', {

    onload: function(frm) {
        if (frm.is_new()) {
            frm.set_value('user', frappe.session.user);
        }
        toggle_payment_fields(frm);
    },

    refresh: function(frm) {
        toggle_payment_fields(frm);

        frm.set_query('customer', function() {
            return { doctype: 'Customer Information' };
        });

        tt_apply_sales_query(frm);
    },

    payment_type: function(frm) {
        toggle_payment_fields(frm);
    },

    customer: function(frm) {
        tt_apply_sales_query(frm);
        frm.refresh_field('apply_to');
    },

});

frappe.ui.form.on('Receipt Apply To', {

    sales_no: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        if (!row.sales_no) return;

        frappe.db.get_value('Sales', row.sales_no,
            ['creation_date', 'grand_total', 'outstanding_balance'],
            function(vals) {
                if (!vals) return;
                
                var balance = (vals.outstanding_balance !== null && vals.outstanding_balance !== undefined) 
                    ? vals.outstanding_balance 
                    : vals.grand_total;
                
                frappe.model.set_value(cdt, cdn, 'sale_date',        vals.creation_date || '');
                frappe.model.set_value(cdt, cdn, 'sale_grand_total', vals.grand_total || 0);
                frappe.model.set_value(cdt, cdn, 'outstanding_balance', balance);
                
                // NEW: Automatically fill Amount Applied with the current balance
                if (!row.amount_applied) {
                    frappe.model.set_value(cdt, cdn, 'amount_applied', balance);
                }
            }
        );
    },

    amount_applied: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        var grand_total = row.sale_grand_total || 0;
        var applied = row.amount_applied || 0;
        
        // Update the row balance (Remaining Balance)
        var preview = grand_total - applied;
        if (preview < 0) preview = 0;
        frappe.model.set_value(cdt, cdn, 'outstanding_balance', preview);

        // Update the parent Receipt Net Amount
        var total = 0;
        (frm.doc.apply_to || []).forEach(function(r) {
            total += r.amount_applied || 0;
        });
        frm.set_value('net_amount', total);
    },

});

})();
