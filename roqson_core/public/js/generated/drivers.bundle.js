// Client Script: Drivers: Filter Drivers
(function () {
frappe.ui.form.on('Drivers', {
    onload: function(frm) {
        frm.set_query("email", function() {
            return {
                query: "frappe.core.doctype.user.user.user_query",
                filters: {
                    role: "Driver"
                }
            };
        });
    }
});
})();
