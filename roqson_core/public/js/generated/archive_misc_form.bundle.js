// Client Script: Archive Brands Form
(function () {
frappe.ui.form.on("Brands", {

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

// Client Script: Archive NOB Form
(function () {
frappe.ui.form.on("Nature of Business", {

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

// Client Script: Archive Promo Form
(function () {
frappe.ui.form.on("Promos", {

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

// Client Script: Archive SP Form
(function () {

frappe.ui.form.on("Sales Personnel", {

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

// Client Script: Archive Territories Form
(function () {
frappe.ui.form.on("Territories", {

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

// Client Script: Archive Vehicles Form
(function () {

frappe.ui.form.on("Vehicles", {

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

// Client Script: Archive Warehouses Form
(function () {
frappe.ui.form.on("Warehouses", {

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
