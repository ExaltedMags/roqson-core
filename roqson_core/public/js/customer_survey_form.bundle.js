(function() {
    // Customer Survey Form - App Bundle
    // Consolidates all client-side logic previously held in DB Client Scripts

    frappe.ui.form.on('Customer Survey Form', {
        onload(frm) {
            // DSP Set Session
            if (frm.is_new()) {
                frm.set_value('dsp_name', frappe.session.user);
            }

            // Archive CSF Form (Locking)
            enforce_archive_lock(frm);

            // CSV: Fetch address
            load_business_address(frm);
        },

        refresh(frm) {
            // Notes Indicator CSF
            handle_notes_indicator(frm);

            // Archive CSF Form (Locking)
            enforce_archive_lock(frm);

            // CSV: Fetch address
            load_business_address(frm);

            // CSF: Add photos
            render_gallery(frm);

            // CSF: Get Last Order
            if (frm.doc.outlet) {
                load_last_order(frm);
            }
        },

        after_save(frm) {
            // CSF: Add photos - force reload so attachments rebind to new docname
            frm.reload_doc().then(() => {
                render_gallery(frm);
            });
        },

        outlet(frm) {
            // CSV: Fetch address
            load_business_address(frm);

            // CSF: Get Last Order
            if (frm.doc.outlet) {
                load_last_order(frm);
            } else {
                clear_last_order(frm);
            }
        },

        // Signature Handlers
        acknowledge_by(frm) {
            handle_signature(frm, 'acknowledge_by', 'signedby_1', 'date_and_time');
        },

        dsp_signature(frm) {
            handle_signature(frm, 'dsp_signature', 'signedby_2', 'date_and_time2');
        },

        received_sales_office(frm) {
            // Prevent DSP role from signing
            if (frappe.user.has_role("DSP") && frm.doc.received_sales_office) {
                frappe.msgprint(__("DSP users are not allowed to sign the Received Sales Office section."));
                frm.set_value('received_sales_office', '');
                return;
            }
            handle_signature(frm, 'received_sales_office', 'signedby_3', 'date_and_time3');
        }
    });

    // --- Helper Functions ---

    function handle_notes_indicator(frm) {
        let notes_key = "of_notes_seen_" + frm.doc.name + "_" + frappe.session.user;
        let last_seen = localStorage.getItem(notes_key);
        let has_notes = frm.doc.internal_notes && frm.doc.internal_notes.trim();
        let notes_modified = frm.doc.modified;

        // Remove existing badge
        frm.layout.tabs.forEach(tab => {
            let $btn = $(tab.tab_link).find('button');
            $btn.find('.notes-badge').remove();
        });

        // Show badge if there are notes and user hasn't seen them since last modification
        if (has_notes && (!last_seen || last_seen < notes_modified)) {
            frm.layout.tabs.forEach(tab => {
                if (tab.df && tab.df.fieldname === 'tab_3_tab') {
                    let $btn = $(tab.tab_link).find('button');
                    if (!$btn.find('.notes-badge').length) {
                        $btn.append('<span class="notes-badge" style="width: 8px; height: 8px; background: red; border-radius: 50%; display: inline-block; margin-left: 6px;"></span>');
                    }

                    // When user clicks the Notes tab, mark as seen and remove badge
                    $btn.off('click.notesbadge').on('click.notesbadge', function() {
                        localStorage.setItem(notes_key, new Date().toISOString());
                        $btn.find('.notes-badge').remove();
                    });
                }
            });
        }
    }

    function enforce_archive_lock(frm) {
        if (!frm.doc.archived) return;
        frm.set_read_only();
        frm.disable_save();
    }

    async function load_business_address(frm) {
        if (!frm.doc.outlet) {
            frm.set_value('business_address', '');
            return;
        }

        const { message: customer } = await frappe.db.get_value(
            'Customer Information',
            frm.doc.outlet,
            ['business_address']
        );

        if (!customer || !customer.business_address) {
            frm.set_value('business_address', '');
            return;
        }

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

        if (addr) {
            const formatted = [
                addr.address_line1,
                addr.custom_barangay,
                addr.custom_citymunicipality,
                addr.custom_province,
                addr.custom_zip_code
            ].filter(Boolean).join(', ');

            frm.set_value('business_address', formatted);
        } else {
            frm.set_value('business_address', '');
        }
    }

    function handle_signature(frm, sig_field, signed_field, time_field) {
        if (frm.doc[sig_field]) {
            frm.set_value(signed_field, frappe.session.user_fullname);
            frm.set_value(time_field, frappe.datetime.now_datetime());
        } else {
            frm.set_value(signed_field, '');
            frm.set_value(time_field, '');
        }
    }

    function render_gallery(frm) {
        const wrapper = frm.get_field('survey_photo_gallery').$wrapper;
        wrapper.empty();

        const btn = $('<button class="btn btn-primary btn-xs mb-3">Add Photos</button>');
        wrapper.append(btn);

        btn.on('click', () => {
            new frappe.ui.FileUploader({
                doctype: frm.doc.doctype,
                docname: frm.doc.name,
                allow_multiple: true,
                on_success() {
                    setTimeout(() => {
                        render_gallery(frm);
                    }, 600);
                }
            });
        });

        const grid = $(`
            <div style="
                display:grid;
                grid-template-columns:repeat(auto-fill,minmax(110px,1fr));
                gap:10px;
            ">
        `);
        wrapper.append(grid);

        frappe.call({
            method: "roqson_core.api.get_survey_photos",
            args: {
                doctype: frm.doc.doctype,
                docname: frm.doc.name
            },
            callback(r) {
                const files = r.message || [];
                files
                .filter(f => f.file_url && f.file_url.match(/\.(jpg|jpeg|png|webp)$/i))
                .forEach(file => {
                    const card = $(`
                        <div style="
                            position:relative;
                            aspect-ratio:1;
                            border:1px solid #ddd;
                            border-radius:8px;
                            overflow:hidden;
                        ">
                            <img src="${file.file_url}"
                                style="width:100%;height:100%;object-fit:cover;cursor:pointer;">
                        </div>
                    `);
                    card.find('img').on('click', () => {
                        new frappe.ui.Spotlight({
                            files: files.map(f => ({ src: f.file_url })),
                            index: files.indexOf(file)
                        }).show();
                    });
                    grid.append(card);
                });
            }
        });
    }

    function load_last_order(frm) {
        frappe.call({
            method: "roqson_core.api.get_last_outlet_order",
            args: {
                outlet: frm.doc.outlet
            },
            callback: function(r) {
                const sale = r.message;
                if (!sale) {
                    frm.get_field("last_order_summary").$wrapper.html(`
                        <div style="padding:12px;color:#777;">
                            No completed orders yet.
                        </div>
                    `);
                    return;
                }
                render_last_order_card(frm, sale);
            }
        });
    }

    function clear_last_order(frm) {
        frm.get_field("last_order_summary").$wrapper.html(`
            <div style="padding:12px;color:#777;">
                Select an outlet to view last order.
            </div>
        `);
    }

    function render_last_order_card(frm, sale_doc) {
        const order_date = frappe.datetime.str_to_user(sale_doc.creation_date);
        const days_since = frappe.datetime.get_day_diff(
            frappe.datetime.nowdate(),
            sale_doc.creation_date
        );

        let items_html = "";
        (sale_doc.items || []).forEach(row => {
            items_html += `• ${row.item_name} ×${row.qty}<br>`;
        });

        const html = `
            <div style="
                padding:14px;
                border:1px solid var(--border-color);
                border-radius:10px;
                background:#fafafa;
                line-height:1.6;
            ">
                <div style="font-weight:600;font-size:15px;">
                    Last Order
                </div>
                <div style="margin-top:4px;">
                    <a href="/app/sales/${sale_doc.name}" style="font-weight:600;">${sale_doc.name}</a>
                    <span style="color:#666;font-size:12px;margin-left:8px;">${order_date} (${days_since} days ago)</span>
                </div>
                <div style="margin-top:10px;font-size:13px;color:#444;">
                    ${items_html}
                </div>
                <div style="margin-top:10px;font-weight:600;text-align:right;color:var(--primary-color);">
                    Total: ${format_currency(sale_doc.grand_total)}
                </div>
            </div>
        `;
        frm.get_field("last_order_summary").$wrapper.html(html);
    }
})();
