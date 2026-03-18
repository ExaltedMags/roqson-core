(function () {
    const NS = "__roqson_pcr_popup";
    const POLL_INTERVAL_MS = 10000;
    const ROLES = ["Administrator", "President", "Manager", "System Manager"];

    if (window[NS]?.initialized) {
        return;
    }

    if (!ROLES.some((role) => frappe.user.has_role(role))) {
        return;
    }

    const state = (window[NS] = {
        initialized: true,
        openDialogs: {},
        dismissed: {},
        queue: [],
        pollHandle: null,
        clickHandlerBound: false,
    });

    function processQueue() {
        if (Object.keys(state.openDialogs).length > 0) return;
        const next = state.queue.shift();
        if (next) {
            showDialog(next);
        }
    }

    function enqueue(record) {
        if (!record?.name) return;
        if (state.openDialogs[record.name] || state.dismissed[record.name]) return;
        if (state.queue.some((queued) => queued.name === record.name)) return;
        state.queue.push(record);
        processQueue();
    }

    function closeDialog(recordName, dismissed = false) {
        delete state.openDialogs[recordName];
        if (dismissed) {
            state.dismissed[recordName] = true;
        }
        processQueue();
    }

    function reviewRequest(doc, status, dialog) {
        return frappe.xcall("frappe.client.set_value", {
            doctype: "Price Change Request",
            name: doc.name,
            fieldname: {
                status,
                reviewed_by: frappe.session.user,
                review_date: frappe.datetime.now_datetime(),
                remarks: dialog.get_value("remarks") || "",
            },
        }).then(() => {
            frappe.show_alert({
                message:
                    status === "Approved"
                        ? __("Price change approved")
                        : __("Price change rejected"),
                indicator: status === "Approved" ? "green" : "red",
            });
            dialog.hide();
            closeDialog(doc.name, false);
        });
    }

    function showDialog(doc) {
        if (state.openDialogs[doc.name]) {
            try {
                state.openDialogs[doc.name].show();
            } catch (e) {
                // Ignore stale dialog handles and recreate below on next open.
            }
            return;
        }

        const dialog = new frappe.ui.Dialog({
            title: __("Price Change Request"),
            size: "large",
            fields: [
                {
                    fieldtype: "HTML",
                    fieldname: "info",
                    options:
                        '<div style="font-size:14px;">'
                        + '<p style="color:red;font-weight:bold;margin-bottom:12px;">Selling Price has been changed</p>'
                        + '<table class="table table-bordered">'
                        + `<tr><td><b>Order</b></td><td><a href="/app/order-form/${doc.order_form}">${doc.order_form}</a></td></tr>`
                        + `<tr><td><b>Date</b></td><td>${doc.request_date ? doc.request_date.substring(0, 10) : ""}</td></tr>`
                        + `<tr><td><b>Item</b></td><td>${doc.item_description || doc.item || ""}</td></tr>`
                        + `<tr><td><b>Quantity</b></td><td>${doc.qty || ""}</td></tr>`
                        + `<tr><td><b>Customer / Outlet</b></td><td>${doc.customer_outlet || ""}</td></tr>`
                        + `<tr><td><b>Original Price</b></td><td>\u20b1 ${Number(doc.original_price || 0).toLocaleString()}</td></tr>`
                        + `<tr><td><b>Requested Price</b></td><td style="color:red;font-weight:bold;">\u20b1 ${Number(doc.new_price || 0).toLocaleString()}</td></tr>`
                        + `<tr><td><b>Requested By</b></td><td>${doc.requested_by || ""}${doc.dsp && doc.dsp !== doc.requested_by ? ` (DSP: ${doc.dsp})` : ""}</td></tr>`
                        + "</table></div>",
                },
                { fieldtype: "Small Text", fieldname: "remarks", label: "Remarks" },
            ],
            primary_action_label: __("Approve"),
            primary_action: function () {
                reviewRequest(doc, "Approved", dialog);
            },
            secondary_action_label: __("Reject"),
            secondary_action: function () {
                reviewRequest(doc, "Rejected", dialog);
            },
        });

        dialog.$wrapper.find(".modal-footer").prepend(
            '<button class="btn btn-default btn-sm pcr-view-full" style="position:absolute;left:15px;">View Full Form</button>'
        );
        dialog.$wrapper.find(".pcr-view-full").on("click", function () {
            dialog.hide();
            closeDialog(doc.name, false);
            frappe.set_route("Form", "Price Change Request", doc.name);
        });

        dialog.$wrapper.on("hidden.bs.modal", function () {
            if (state.openDialogs[doc.name]) {
                closeDialog(doc.name, true);
            }
        });

        state.openDialogs[doc.name] = dialog;
        dialog.show();
    }

    function autoCloseOrphanedRequest(doc) {
        return frappe.xcall("frappe.client.set_value", {
            doctype: "Price Change Request",
            name: doc.name,
            fieldname: {
                status: "Rejected",
                review_date: frappe.datetime.now_datetime(),
                remarks: "Auto-closed: associated order no longer exists",
            },
        }).catch(() => {});
    }

    function pollPendingRequests() {
        return frappe.xcall("frappe.client.get_list", {
            doctype: "Price Change Request",
            filters: { status: "Pending" },
            fields: [
                "name",
                "order_form",
                "item",
                "item_description",
                "qty",
                "customer_outlet",
                "dsp",
                "original_price",
                "new_price",
                "requested_by",
                "request_date",
            ],
            order_by: "creation asc",
            limit_page_length: 10,
        }).then((rows) => {
            if (!rows?.length) return;

            rows.forEach((doc) => {
                if (state.openDialogs[doc.name] || state.dismissed[doc.name]) return;
                if (state.queue.some((queued) => queued.name === doc.name)) return;

                frappe.xcall("frappe.client.get_value", {
                    doctype: "Order Form",
                    filters: { name: doc.order_form },
                    fieldname: "workflow_state",
                }).then((response) => {
                    if (!response || !response.workflow_state) {
                        state.dismissed[doc.name] = true;
                        return autoCloseOrphanedRequest(doc);
                    }
                    enqueue(doc);
                }).catch(() => {
                    // Ignore transient fetch issues; polling will retry.
                });
            });
        });
    }

    function bindNotificationClickHandler() {
        if (state.clickHandlerBound) return;
        state.clickHandlerBound = true;

        document.addEventListener("click", function (e) {
            const link = e.target.closest('a[href*="price-change-request"]');
            if (!link) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            const docname = link.getAttribute("href").split("/").pop();
            frappe.xcall("frappe.client.get", {
                doctype: "Price Change Request",
                name: docname,
            }).then((doc) => {
                if (doc.status === "Pending") {
                    delete state.dismissed[doc.name];
                    delete state.openDialogs[doc.name];
                    state.queue = state.queue.filter((queued) => queued.name !== doc.name);
                    showDialog(doc);
                } else {
                    frappe.show_alert({
                        message:
                            "This request was already "
                            + doc.status.toLowerCase()
                            + " by "
                            + (doc.reviewed_by || "someone"),
                        indicator: doc.status === "Approved" ? "green" : "red",
                    });
                }
            });

            const notifList = document.querySelector(".notifications-list");
            if (notifList) {
                notifList.classList.remove("visible");
            }
        }, true);
    }

    bindNotificationClickHandler();
    state.pollHandle = window.setInterval(pollPendingRequests, POLL_INTERVAL_MS);
})();
