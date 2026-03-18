// Client Script: DSP Territories
(function () {
frappe.ui.form.on('Territories', {
    setup: function(frm) {
        frm.set_query("assigned_dsp", function() {
            return {
                filters: {
                    designation: "DSP"
                }
            };
        });
    }
});
})();
