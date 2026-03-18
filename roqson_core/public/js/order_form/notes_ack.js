(function () {
// ── Notes Acknowledgment ─────────────────────────────────────────────────
// UI Rules:
// - Admins/Managers: See text editor + live checklist. Save is NOT blocked.
// - Sales: See text editor + live checklist. Save is NOT blocked.
// - DSP: Read-only checklist only. Save IS blocked until all items are checked.

frappe.ui.form.on('Order Form', {
    refresh(frm) {
        render_notes_panel(frm);
    },
    internal_notes(frm) {
        // When notes change, reset acknowledgments if an admin/manager/sales edited them
        // This ensures the checklist refreshes in real-time
        if (!is_dsp_only()) {
            reset_acknowledgments_silent(frm);
        }
        render_notes_panel(frm);
    },
    before_save(frm) {
        // FORCE logic only applied to DSP
        if (is_dsp_only()) {
            validate_acknowledgments(frm);
        }
    }
});

// ── Role helpers ───────────────────────────────────────────────────────────

function is_admin_user() {
    const adminRoles = ['Manager', 'President', 'Administrator', 'System Manager', 'Purchaser'];
    return adminRoles.some(r => frappe.user.has_role(r));
}

function is_dsp_only() {
    // Pure DSP: has DSP role but NOT Sales and NOT an Admin role
    if (frappe.user.has_role('Sales') || is_admin_user()) return false;
    return frappe.user.has_role('DSP');
}

function is_sales_user() {
    if (is_admin_user()) return false;
    return frappe.user.has_role('Sales');
}

// ── Acknowledgment storage helpers ─────────────────────────────────────────

function get_ack_data(frm) {
    try {
        return JSON.parse(frm.doc.notes_acknowledgments || '{}');
    } catch(e) {
        return {};
    }
}

function set_ack_data(frm, data) {
    frappe.model.set_value(frm.doctype, frm.docname, 'notes_acknowledgments', JSON.stringify(data));
}

function reset_acknowledgments_silent(frm) {
    const current = get_ack_data(frm);
    if (Object.keys(current).length === 0) return; 
    set_ack_data(frm, {});
}

// ── Note parsing ───────────────────────────────────────────────────────────

function parse_note_items(html) {
    if (!html || !html.trim()) return [];
    const $div = $('<div>').html(html);
    const items = [];
    let idx = 0;

    $div.find('li').each(function() {
        const $li = $(this);
        const text = $li.clone().find('ul, ol').remove().end().text().trim();
        if (text) {
            items.push({ id: 'item_' + idx, text: text });
            idx++;
        }
    });

    if (items.length === 0) {
        $div.find('p').each(function() {
            const text = $(this).text().trim();
            if (text) {
                items.push({ id: 'item_' + idx, text: text });
                idx++;
            }
        });
    }
    return items;
}

// ── Validation ─────────────────────────────────────────────────────────────

function validate_acknowledgments(frm) {
    const notes_html = frm.doc.internal_notes || '';
    if (!notes_html.trim()) return; 

    const note_items = parse_note_items(notes_html);
    if (note_items.length === 0) return;

    const ack_data = get_ack_data(frm);
    const unacked = note_items.filter(item => !ack_data[item.id]);

    if (unacked.length > 0) {
        frappe.validated = false;
        frappe.msgprint({
            title: __('Notes Acknowledgment Required'),
            indicator: 'red',
            message: __('As a DSP, you must acknowledge all {0} note item(s) on the Notes tab before saving.', [unacked.length])
        });
    }
}

// ── Main render function ───────────────────────────────────────────────────

function render_notes_panel(frm) {
    const panel_field = frm.fields_dict['notes_ack_panel'];
    if (!panel_field) return;
    const $panel_wrapper = panel_field.$wrapper;

    const notes_html = frm.doc.internal_notes || '';
    const ack_data = get_ack_data(frm);
    const note_items = parse_note_items(notes_html);

    // Visibility Logic
    // Only pure DSPs are blocked from editing. Others see the editor.
    frm.set_df_property('internal_notes', 'hidden', 0);
    frm.set_df_property('internal_notes', 'read_only', is_dsp_only() ? 1 : 0);
    // Everyone (Admin, Sales, DSP) now sees the panel if notes exist
    frm.set_df_property('notes_ack_panel', 'hidden', 0);

    $panel_wrapper.empty();

    if (!notes_html.trim()) {
        $panel_wrapper.html(
            '<div class="text-muted" style="padding:12px 0;font-size:13px;">' +
            '<i class="fa fa-info-circle"></i> No internal notes for this order.</div>'
        );
        return;
    }

    if (note_items.length === 0) {
        $panel_wrapper.html(
            '<div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:16px;margin-bottom:12px;">' +
            '<h6 style="margin:0 0 10px;font-weight:600;">Internal Notes Preview</h6>' +
            '<div style="font-size:13px;line-height:1.6;">' + notes_html + '</div>' +
            '</div>'
        );
        return;
    }

    // Build checklist
    const total = note_items.length;
    const acked_count = note_items.filter(item => ack_data[item.id]).length;
    const all_acked = acked_count === total;

    const progress_color = all_acked ? '#28a745' : (acked_count > 0 ? '#fd7e14' : '#dc3545');
    const progress_pct = Math.round((acked_count / total) * 100);

    let status_html = all_acked 
        ? '<span style="color:#28a745;font-weight:600;"><i class="fa fa-check-circle"></i> All items acknowledged</span>'
        : `<span style="color:${is_dsp_only() ? '#dc3545' : '#6c757d'};font-weight:600;">${acked_count} of ${total} items acknowledged</span>`;

    let items_html = note_items.map(item => {
        const is_acked = !!ack_data[item.id];
        const ack_info = ack_data[item.id];
        const ack_detail = is_acked ? `<small style="color:#6c757d;margin-left:8px;">✓ ${ack_info.acked_by} on ${ack_info.acked_on}</small>` : '';

        return `
            <div class="notes-ack-item" data-item-id="${item.id}" style="
                display:flex;align-items:flex-start;padding:10px 12px;
                margin-bottom:6px;border-radius:6px;cursor:pointer;
                background:${is_acked ? '#f0fff4' : '#fff8f8'};
                border:1px solid ${is_acked ? '#b7ebc8' : '#f5c6cb'};">
                <div style="flex-shrink:0;margin-right:10px;margin-top:2px;">
                    <input type="checkbox" class="notes-ack-checkbox" data-item-id="${item.id}" ${is_acked ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;">
                </div>
                <div style="flex:1;font-size:13px;line-height:1.5;${is_acked ? 'text-decoration:line-through;color:#6c757d;' : ''}">
                    ${item.text} ${ack_detail}
                </div>
            </div>`;
    }).join('');

    $panel_wrapper.html(`
        <div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin-top:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h6 style="margin:0;font-weight:600;">Notes Checklist ${is_dsp_only() ? '' : '(DSP Preview)'}</h6>
                <div>${status_html}</div>
            </div>
            <div style="background:#e9ecef;border-radius:4px;height:6px;margin-bottom:14px;">
                <div style="background:${progress_color};height:6px;border-radius:4px;width:${progress_pct}%;transition:width 0.3s;"></div>
            </div>
            <div class="notes-ack-items">${items_html}</div>
        </div>
    `);

    // Checkbox and Row click events
    $panel_wrapper.find('.notes-ack-checkbox').on('change', function() {
        const item_id = $(this).data('item-id');
        const current_ack = get_ack_data(frm);

        if ($(this).is(':checked')) {
            current_ack[item_id] = {
                acked_by: frappe.session.user,
                acked_on: frappe.datetime.now_datetime()
            };
        } else {
            delete current_ack[item_id];
        }

        set_ack_data(frm, current_ack);
        setTimeout(() => render_notes_panel(frm), 50);
    });

    $panel_wrapper.find('.notes-ack-item').on('click', function(e) {
        if ($(e.target).is('input[type="checkbox"]')) return;
        $(this).find('input[type="checkbox"]').trigger('click');
    });
}
})();
