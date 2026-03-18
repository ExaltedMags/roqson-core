// Client Script: Inventory Balance Auto Compute
(function () {
frappe.ui.form.on('Inventory Balance', {
    on_load: function(frm) {
        update_available(frm);
    },
    on_hand_quantity: function(frm) {
        update_available(frm);
    },
    committed_quantity: function(frm) {
        update_available(frm);
    }
});

function update_available(frm) {
    let on_hand = frm.doc.on_hand_quantity;
    let committed = frm.doc.committed_quantity;

    console.log('On Hand:', on_hand, 'Committed:', committed);

    on_hand = parseFloat(String(on_hand || 0).replace(/,/g,''));
    committed = parseFloat(String(committed || 0).replace(/,/g,''));

    frm.set_value('available_quantity', on_hand - committed);
}


})();
