// Client Script: PH Addresses
(function () {
frappe.ui.form.on("Address", {

    // On form load/refresh — re-apply filters if values already set
    refresh(frm) {
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
        // Sync custom_address_line_1 → address_line1 on load
        if (frm.doc.custom_address_line_1 && !frm.doc.address_line1) {
            frm.set_value("address_line1", frm.doc.custom_address_line_1);
        }
    },

    // Mirror custom_address_line_1 → standard address_line1 (required by ERPNext)
    custom_address_line_1(frm) {
        frm.set_value("address_line1", frm.doc.custom_address_line_1 || "");
    },

    // When province changes → clear downstream fields, update city/muni filter
    custom_province(frm) {
        frm.set_value("custom_citymunicipality", "");
        frm.set_value("custom_barangay", "");
        frm.set_value("city", "");
        frm.set_query("custom_citymunicipality", function() {
            return { filters: { province: frm.doc.custom_province || "" } };
        });
        frm.set_query("custom_barangay", function() {
            return { filters: {} };
        });
    },

    // When city/municipality changes → clear barangay, update filter,
    // auto-fill province, mirror to standard city field
    custom_citymunicipality(frm) {
        frm.set_value("custom_barangay", "");
        frm.set_query("custom_barangay", function() {
            return {
                filters: { city_municipality: frm.doc.custom_citymunicipality || "" }
            };
        });
        if (frm.doc.custom_citymunicipality) {
            frappe.db.get_value("PH City Municipality", frm.doc.custom_citymunicipality, ["province", "city_municipality_name"])
                .then(r => {
                    if (r.message) {
                        // Auto-fill province if not set
                        if (!frm.doc.custom_province && r.message.province) {
                            frm.set_value("custom_province", r.message.province);
                        }
                        // Mirror to standard city field (required by ERPNext)
                        frm.set_value("city", r.message.city_municipality_name || "");
                    }
                });
        } else {
            frm.set_value("city", "");
        }
    },

    // When barangay changes → auto-fill city/municipality and province if empty
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
    },

});
})();
