// Client Script: Address Script
(function () {
// STEP 4 — Create a new Client Script
// DocType: PH Address
// This handles cascading dropdowns on the PH Address form and quick entry popup

frappe.ui.form.on("PH Address", {

    refresh(frm) {
        // Re-apply cascade filters on load
        frm.set_query("custom_citymunicipality", function() {
            if (frm.doc.custom_province) {
                return { filters: { province: frm.doc.custom_province } };
            }
            return {};
        });
        frm.set_query("custom_barangay", function() {
            if (frm.doc.custom_citymunicipality) {
                return { filters: { city_municipality: frm.doc.custom_citymunicipality } };
            }
            return {};
        });
    },

    // Province changed → clear downstream
    custom_province(frm) {
        frm.set_value("custom_citymunicipality", "");
        frm.set_value("custom_barangay", "");
        frm.set_query("custom_citymunicipality", function() {
            return { filters: { province: frm.doc.custom_province || "" } };
        });
        frm.set_query("custom_barangay", function() {
            return { filters: {} };
        });
    },

    // City/Municipality changed → clear barangay, auto-fill province
    custom_citymunicipality(frm) {
        frm.set_value("custom_barangay", "");
        frm.set_query("custom_barangay", function() {
            return {
                filters: { city_municipality: frm.doc.custom_citymunicipality || "" }
            };
        });
        if (frm.doc.custom_citymunicipality) {
            frappe.db.get_value("PH City Municipality", frm.doc.custom_citymunicipality, "province")
                .then(r => {
                    if (r.message && r.message.province && !frm.doc.custom_province) {
                        frm.set_value("custom_province", r.message.province);
                    }
                });
        }
    },

    // Barangay changed → auto-fill city/municipality and province
    custom_barangay(frm) {
        if (!frm.doc.custom_barangay) return;
        frappe.db.get_value("PH Barangay", frm.doc.custom_barangay, ["city_municipality", "province"])
            .then(r => {
                if (r.message) {
                    if (!frm.doc.custom_citymunicipality && r.message.city_municipality) {
                        frm.set_value("custom_citymunicipality", r.message.city_municipality);
                    }
                    if (!frm.doc.custom_province && r.message.province) {
                        frm.set_value("custom_province", r.message.province);
                    }
                }
            });
    }

});
})();
