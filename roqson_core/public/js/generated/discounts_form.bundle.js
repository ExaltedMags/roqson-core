// Client Script: Toggle Discount Fields
(function () {
frappe.ui.form.on("Discounts", {  
    refresh: function(frm) {
        toggle_discount_applied(frm);
    },

    discount_type: function(frm) {
        toggle_discount_applied(frm);
    }
});

function toggle_discount_applied(frm) {
    console.log("Discount Type selected:", frm.doc.discount_type); 

    if (frm.doc.discount_type === "Percent") {
        frm.set_df_property('percent_', 'hidden', 0);  // show Percent (%)
        frm.set_df_property('amount', 'hidden', 1);    // hide Amount (PHP)
        frm.set_value('amount', 0);                    // reset hidden field
    } 
    else if (frm.doc.discount_type === "Amount") {
        frm.set_df_property('amount', 'hidden', 0);    // show Amount (PHP)
        frm.set_df_property('percent_', 'hidden', 1);  // hide Percent (%)
        frm.set_value('percent_', 0);                  // reset hidden field
    } 
    else {
        frm.set_df_property('percent_', 'hidden', 1);
        frm.set_df_property('amount', 'hidden', 1);
    }
}


})();

// Client Script: Discounts: Display Name
(function () {
frappe.ui.form.on('Discounts', {
    before_save: function(frm) {
        if(frm.doc.discount_name) {
            frm.set_value('display_name', frm.doc.discount_name);
        }
    }
});

})();

// Client Script: Archive Discounts Form
(function () {
 
frappe.ui.form.on("Discounts", {

  onload(frm) {
    enforce_archive_lock(frm);
  },

  refresh(frm) {
    enforce_archive_lock(frm);
  }

});

function enforce_archive_lock(frm) {

  if (!frm.doc.archived) return;

  // Make entire form read-only
  frm.set_read_only();

  // Disable save button
  frm.disable_save();
}


})();
