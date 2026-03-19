(function () {
// Trips Form Bundle
// Generated on: 2026-03-18

// =====================================================
// Trips (Unified) - Order-centric + Row Preview + Main-Page Features
// + Server-stamped timestamps (non-bypassable)
// Apply as ONE Client Script on DocType: "Trips"
// ERPNext 15 / Frappe 15
// =====================================================

// -------------------- Constants --------------------
const TRIP_DOCTYPE = "Trips";
const CHILD_TABLE_FIELD = "table_cpme";
const CHILD_ROW_DOCTYPE = "Trips Table";
const ORDER_LINK_FIELD = "sales_no";
const ORDER_PREVIEW_HTML_FIELD = "order_details_html";
const CHILD_PLAINTEXT_FIELD = "items_preview";
const TRIP_OUTLET_FIELD = "outlet";
const TRIP_CONTACT_FIELD = "contact_number";
const TRIP_ADDRESS_FIELD = "address";
const TRIP_CONTACT_PERSON_FIELD = "contact_person";
const TRIP_PREFERRED_DATETIME_FIELD = "preferred_datetime";       // Date field
const TRIP_PREFERRED_TIME_FIELD = "preferred_delivery_time";      // Time field
const ARRIVAL_TIME_FIELD = "arrival_time";
const COMPLETION_TIME_FIELD = "completion_time";
const TIME_IN_BUTTON_FIELD = "time_in_button";
const TIME_OUT_BUTTON_FIELD = "time_out_button";
const PROOF_FIELD = "proof_of_delivery";
const PROOF_TS_FIELD = "proof_time_stamp";
const SIGNATURE_FIELD = "customer_signature";
const SIGNATURE_TS_FIELD = "signature_timestamp";
const DELIVERY_STATUS_FIELD = "delivery_status";
const REASON_FAILURE_FIELD = "reason_for_failure";
const FAILED_STATUS_VALUE = "Failed";
const OFFENDING_HTML_FIELD = "offending_items_html";
const OFFENDING_DATA_FIELD = "offending_items_data";
const WRONG_INCOMPLETE_VALUE = "Wrong/incomplete order";
const CLAIMS_DID_NOT_ORDER_VALUE = 'Claims "did not order"';
const REQUIRE_TRIP_SAVED_BEFORE_TIME_ACTIONS = true;
const MAKE_REASON_REQUIRED_WHEN_FAILED = true;
const ORDER_DOCTYPE = "Sales";
const ORDER_OUTLET_FIELD = "customer_link";
const ORDER_ITEMS_TABLE_FIELD = "items";
const ORDER_CONTACT_CANDIDATES = ["contact_number", "contact_no", "mobile_no", "phone", "phone_no"];
const ORDER_ADDRESS_CANDIDATES = ["address", "delivery_address", "shipping_address", "address_display"];
const ORDER_CONTACT_PERSON_FIELD = "contact_person";
const ORDER_PREFERRED_DATE_FIELD = "preferred_delivery_date";
const ORDER_PREFERRED_TIME_FIELD = "preferred_delivery_time";
const PRODUCT_DOCTYPE = "Product";
const PRODUCT_NAME_FIELD_IN_ORDER_ITEMS = "items";
const PRODUCT_DESC_FIELD = "item_description";
const ORDER_ITEM_LINK_FIELD = "item";
const ALLOWED_STATUSES = ["Pending"];

const REQUIRE_TRIP_SAVED_BEFORE_SELECTING_ORDERS = false;
const PREVIEW_ITEMS_COUNT = 2;
const USE_PREVIEW_IN_CHILD_ROW_HTML = true;
const STAMP_API_METHOD = "roqson_core.api.stamp";
const TIME_FIELDS_TO_NORMALIZE = [
  "dispatch_time",
  ARRIVAL_TIME_FIELD,
  COMPLETION_TIME_FIELD,
  PROOF_TS_FIELD,
  SIGNATURE_TS_FIELD,
  TRIP_PREFERRED_DATETIME_FIELD,
  TRIP_PREFERRED_TIME_FIELD
];
const DEBUG = false;

// =====================================================================
// ORDER EXCLUSIVITY
// =====================================================================
const RELEASING_DELIVERY_STATUSES = ["Failed", "Cancelled"];
const AUTO_FINALIZABLE_WORKFLOW_STATES = ["In Transit", "Arrived", "Delivered"];
const AUTO_RECEIVE_ACTION = "Mark Delivered";
const AUTO_FAIL_ACTION = "Mark Delivery Failed";
const HIDDEN_WORKFLOW_ACTIONS = ["Time In", "Time Out", AUTO_RECEIVE_ACTION, AUTO_FAIL_ACTION];
const LEGACY_ALWAYS_HIDDEN_FIELDS = [
  "custom_delivery_timeline_controls",
  "custom_arrival_time",
  "custom_completion_time",
  "naming_series",
];
const FINALIZED_WORKFLOW_STATES = ["Completed", "Received", "Failed"];
const ARRIVAL_VISIBLE_STATES = ["Arrived", "Delivered", ...FINALIZED_WORKFLOW_STATES];
const COMPLETION_VISIBLE_STATES = ["Delivered", ...FINALIZED_WORKFLOW_STATES];

// -------------------- Utils --------------------
function dbg(...args) {
  if (DEBUG) console.log("[TT]", ...args);
}

function warn(...args) {
  if (DEBUG) console.warn("[TT]", ...args);
}

function get_root() {
  return typeof window !== "undefined" ? window : globalThis;
}

function get_optional_global(name) {
  const root = get_root();
  return typeof root[name] === "function" ? root[name] : null;
}

function get_workflow_state(frm) {
  return (frm.doc?.workflow_state || "").trim();
}

function has_df(frm, fieldname) {
  if (!fieldname) return false;
  return !!frappe.meta.get_docfield(frm.doctype, fieldname, frm.doc.name) || 
         (frm.fields_dict && !!frm.fields_dict[fieldname]);
}

function pick_first_present(obj, candidates) {
  for (const k of candidates) {
    if (obj?.[k]) return obj[k];
  }
  return null;
}

function get_row(cdt, cdn) {
  return locals?.[cdt]?.[cdn];
}

function get_grid(frm) {
  return frm.fields_dict?.[CHILD_TABLE_FIELD]?.grid;
}

function get_grid_form_by_cdn(frm, table_fieldname, cdn) {
  const grid = frm.fields_dict?.[table_fieldname]?.grid;
  const grid_row = grid?.grid_rows_by_docname?.[cdn];
  return grid_row?.grid_form || null;
}

function set_row_html(frm, cdn, html) {
  const grid_form = get_grid_form_by_cdn(frm, CHILD_TABLE_FIELD, cdn);
  const html_field = grid_form?.fields_dict?.[ORDER_PREVIEW_HTML_FIELD];
  if (html_field?.$wrapper) html_field.$wrapper.html(html);
}

function clear_row_html(frm, cdn) {
  set_row_html(frm, cdn, "");
}

function bind_row_html_actions(frm, cdn) {
  const grid_form = get_grid_form_by_cdn(frm, CHILD_TABLE_FIELD, cdn);
  const html_field = grid_form?.fields_dict?.[ORDER_PREVIEW_HTML_FIELD];
  if (!html_field?.$wrapper) return;
  if (html_field.$wrapper.__tt_bound) return;
  html_field.$wrapper.__tt_bound = true;

  html_field.$wrapper.on("click", ".tt-show-more-items", async function (e) {
    e.preventDefault();
    e.stopPropagation();
    const order_name = $(this).attr("data-order");
    if (!order_name) return;
    try {
      await open_order_items_dialog(frm, order_name);
    } catch (err) {
      console.error(err);
      frappe.msgprint("Failed to open items dialog.");
    }
  });

  html_field.$wrapper.on("click", ".tt-open-order", function (e) {
    e.preventDefault();
    e.stopPropagation();
    const order_name = $(this).attr("data-order");
    if (!order_name) return;
    frappe.set_route("Form", ORDER_DOCTYPE, order_name);
  });
}

function child_field_exists(row, fieldname) {
  return row && Object.prototype.hasOwnProperty.call(row, fieldname);
}

async function set_child_value_if_exists(cdt, cdn, fieldname, value) {
  const row = get_row(cdt, cdn);
  if (!child_field_exists(row, fieldname)) return;
  await frappe.model.set_value(cdt, cdn, fieldname, value);
}

async function set_parent_value(frm, fieldname, value) {
  const df = frappe.meta.get_docfield(frm.doctype, fieldname, frm.doc.name);
  if (!df) {
    warn(`[Parent Set] docfield not found: ${fieldname}`);
    return;
  }
  await frm.set_value(fieldname, value);
  frm.refresh_field(fieldname);
  dbg(`[Parent Set] ${fieldname} =`, frm.doc?.[fieldname]);
}

// -------------------- Time-field normalization --------------------
function normalize_time_value(val) {
  if (!val || typeof val !== "string") return val;
  const datetime_match = val.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(:\d{2})?.*)$/);
  if (datetime_match) {
    return datetime_match[1] + " " + normalize_time_value(datetime_match[2]);
  }
  const time_match = val.match(/^(\d{1,2})(:\d{2}(:\d{2})?.*)$/);
  if (time_match) {
    return time_match[1].padStart(2, "0") + time_match[2];
  }
  return val;
}

function normalize_all_time_fields(frm) {
  let fixed = 0;
  for (const fieldname of TIME_FIELDS_TO_NORMALIZE) {
    if (!has_df(frm, fieldname)) continue;
    const raw = frm.doc[fieldname];
    if (!raw) continue;
    const normalized = normalize_time_value(raw);
    if (normalized !== raw) {
      dbg(`[Time Normalize] ${fieldname}: "${raw}" ? "${normalized}"`);
      frm.doc[fieldname] = normalized;
      fixed++;
    }
  }
  if (fixed > 0) {
    for (const fieldname of TIME_FIELDS_TO_NORMALIZE) {
      if (!has_df(frm, fieldname)) continue;
      const ctrl = frm.fields_dict[fieldname];
      if (ctrl) ctrl.last_value = frm.doc[fieldname];
    }
  }
}

// -------------------- Parent UI visibility logic --------------------
function update_parent_visibility(frm) {
  [TRIP_CONTACT_FIELD, TRIP_CONTACT_PERSON_FIELD, TRIP_ADDRESS_FIELD].forEach(f => {
    if (has_df(frm, f)) frm.toggle_display(f, true);
  });

  if (has_df(frm, PROOF_TS_FIELD)) {
    frm.toggle_display(PROOF_TS_FIELD, !!frm.doc?.[PROOF_FIELD] || !!frm.doc?.[PROOF_TS_FIELD]);
  }
  if (has_df(frm, SIGNATURE_TS_FIELD)) {
    frm.toggle_display(SIGNATURE_TS_FIELD, !!frm.doc?.[SIGNATURE_FIELD] || !!frm.doc?.[SIGNATURE_TS_FIELD]);
  }
  if (has_df(frm, REASON_FAILURE_FIELD) && has_df(frm, DELIVERY_STATUS_FIELD)) {
    const is_failed = frm.doc?.[DELIVERY_STATUS_FIELD] === FAILED_STATUS_VALUE;
    frm.toggle_display(REASON_FAILURE_FIELD, is_failed);
    if (MAKE_REASON_REQUIRED_WHEN_FAILED) {
      frm.set_df_property(REASON_FAILURE_FIELD, "reqd", !!is_failed);
    }
  }
  update_offending_items_visibility(frm);
}

const SAVED_ONLY_FIELDS = [
  "time_tracking",
  "customer_signature_section",
  "delivery_status",
  "proof_of_delivery",
  "customer_signature",
];

function hide_legacy_helper_fields(frm) {
  for (const fieldname of LEGACY_ALWAYS_HIDDEN_FIELDS) {
    if (has_df(frm, fieldname)) {
      frm.toggle_display(fieldname, false);
    }
  }
}

function update_time_tracking_visibility(frm) {
  const workflow_state = get_workflow_state(frm);
  const is_saved = !frm.is_new();
  const has_arrival = !!frm.doc?.[ARRIVAL_TIME_FIELD];
  const has_completion = !!frm.doc?.[COMPLETION_TIME_FIELD];
  const show_time_tracking = is_saved && !["Pending", "Draft", "Cancelled"].includes(workflow_state);
  const show_arrival = has_arrival || ARRIVAL_VISIBLE_STATES.includes(workflow_state);
  const show_completion = has_completion || COMPLETION_VISIBLE_STATES.includes(workflow_state);
  const show_time_in_button = is_saved && workflow_state === "In Transit" && !has_arrival;
  const show_time_out_button = is_saved && workflow_state === "Arrived" && !has_completion;

  if (has_df(frm, "time_tracking")) {
    frm.toggle_display("time_tracking", show_time_tracking || show_time_in_button || show_time_out_button || show_arrival || show_completion);
  }
  if (has_df(frm, ARRIVAL_TIME_FIELD)) {
    frm.toggle_display(ARRIVAL_TIME_FIELD, show_arrival);
  }
  if (has_df(frm, COMPLETION_TIME_FIELD)) {
    frm.toggle_display(COMPLETION_TIME_FIELD, show_completion);
  }
  if (has_df(frm, TIME_IN_BUTTON_FIELD)) {
    frm.toggle_display(TIME_IN_BUTTON_FIELD, show_time_in_button);
  }
  if (has_df(frm, TIME_OUT_BUTTON_FIELD)) {
    frm.toggle_display(TIME_OUT_BUTTON_FIELD, show_time_out_button);
  }
}

function update_saved_only_visibility(frm) {
  const is_saved = !frm.is_new() && !["Draft", "Pending"].includes(get_workflow_state(frm));
  for (const f of SAVED_ONLY_FIELDS) {
    if (frappe.meta.get_docfield(frm.doctype, f, frm.doc.name)) {
      frm.toggle_display(f, is_saved);
    }
  }
}

// -------------------- Offending Items --------------------
const OFFENDING_ITEMS_REASONS = [WRONG_INCOMPLETE_VALUE, CLAIMS_DID_NOT_ORDER_VALUE];
function is_offending_items_applicable(frm) {
  const is_failed = frm.doc?.[DELIVERY_STATUS_FIELD] === FAILED_STATUS_VALUE;
  const reason = frm.doc?.[REASON_FAILURE_FIELD];
  return is_failed && OFFENDING_ITEMS_REASONS.includes(reason);
}

function update_offending_items_visibility(frm) {
  const show = is_offending_items_applicable(frm);
  if (has_df(frm, OFFENDING_HTML_FIELD)) frm.toggle_display(OFFENDING_HTML_FIELD, show);
  if (has_df(frm, OFFENDING_DATA_FIELD)) frm.toggle_display(OFFENDING_DATA_FIELD, false);
  if (show) render_offending_items_ui(frm);
  if (!show && frm.doc?.[OFFENDING_DATA_FIELD]) frm.set_value(OFFENDING_DATA_FIELD, "");
}

function get_offending_data(frm) {
  const raw = frm.doc?.[OFFENDING_DATA_FIELD];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function set_offending_data(frm, data) {
  const json = JSON.stringify(data || []);
  frm.set_value(OFFENDING_DATA_FIELD, json);
  frm.dirty();
  dbg("[Offending] Data set:", data);
}

function escapeHtml(value) {
  return frappe.utils.escape_html(String(value || ""));
}

function get_trip_order_names(frm) {
  const rows = frm.doc?.[CHILD_TABLE_FIELD] || [];
  return rows.map(r => r[ORDER_LINK_FIELD]).filter(Boolean);
}

async function get_products_desc_map(frm, product_ids) {
  const ids = [...new Set((product_ids || []).filter(Boolean))];
  frm.__product_desc_cache = frm.__product_desc_cache || {};
  const result = {};
  for (const product_id of ids) {
    if (!frm.__product_desc_cache[product_id]) {
      try {
        const res = await frappe.db.get_value(PRODUCT_DOCTYPE, product_id, PRODUCT_DESC_FIELD);
        frm.__product_desc_cache[product_id] = res?.message?.[PRODUCT_DESC_FIELD] || product_id;
      } catch (e) {
        frm.__product_desc_cache[product_id] = product_id;
      }
    }
    result[product_id] = frm.__product_desc_cache[product_id];
  }
  return result;
}

function build_order_items_checkboxes(order_name, items, selected_set) {
  if (!items.length) return `<div class="text-muted" style="padding:4px 0;">No items in this order.</div>`;

  let html = "";
  for (const it of items) {
    const key = `${order_name}|||${it.product_id}`;
    const is_checked = selected_set.has(key) ? "checked" : "";
    const qty_label = it.qty ? ` <span class="text-muted">(x${escapeHtml(String(it.qty))})</span>` : "";
    html += `
      <label style="display:flex; align-items:center; padding:5px 0; cursor:pointer; gap:8px; margin:0;">
        <input type="checkbox" class="tt-offending-check"
               data-order="${escapeHtml(order_name)}"
               data-product-id="${escapeHtml(it.product_id)}"
               data-product-name="${escapeHtml(it.product_name)}"
               ${is_checked}
               style="margin:0; width:15px; height:15px; flex-shrink:0;" />
        <span>${escapeHtml(it.product_name)}${qty_label}</span>
      </label>`;
  }
  return html;
}

function build_offending_summary(data, show_order_grouping) {
  if (!data.length) return "";

  let html = `<div style="margin-top:10px; padding:10px 12px; background:#fff8f8; border:1px solid #f5c6cb; border-radius:6px;">`;
  html += `<div style="font-weight:600; margin-bottom:6px; color:#721c24; font-size:12px;">Summary</div>`;

  if (show_order_grouping) {
    const grouped = {};
    for (const d of data) {
      if (!grouped[d.order]) grouped[d.order] = [];
      grouped[d.order].push(d.product_name);
    }
    for (const [order, items] of Object.entries(grouped)) {
      html += `<div style="margin-bottom:4px;"><span style="font-weight:500; font-size:12px;">${escapeHtml(order)}:</span> <span style="font-size:12px;">${items.map(i => escapeHtml(i)).join(", ")}</span></div>`;
    }
  } else {
    html += `<div style="font-size:12px;">${data.map(d => escapeHtml(d.product_name)).join(", ")}</div>`;
  }

  html += `</div>`;
  return html;
}

function render_offending_items_readonly(frm) {
  const wrapper = frm.fields_dict?.[OFFENDING_HTML_FIELD]?.$wrapper;
  if (!wrapper) return;

  const data = get_offending_data(frm);
  const order_names = get_trip_order_names(frm);
  const show_grouping = order_names.length > 1;

  if (!data.length) {
    wrapper.html(`<div class="text-muted" style="padding:8px 0;">No offending items recorded.</div>`);
    return;
  }

  wrapper.html(`
    <div style="margin:4px 0 12px 0;">
      <label class="control-label" style="margin-bottom:8px; display:block; font-weight:600;">Offending Item/s</label>
      ${build_offending_summary(data, show_grouping)}
    </div>
  `);
}

async function render_offending_items_ui(frm) {
  const wrapper = frm.fields_dict?.[OFFENDING_HTML_FIELD]?.$wrapper;
  if (!wrapper) return;

  const order_names = get_trip_order_names(frm);
  const data = get_offending_data(frm);

  if (!order_names.length) {
    wrapper.html(`<div class="text-muted" style="padding:8px 0;">No orders in this trips.</div>`);
    return;
  }

  const order_docs = {};
  const all_product_ids = [];
  for (const oname of order_names) {
    try {
      const doc = await get_order_doc_cached(frm, oname, { force_fetch: false });
      if (doc) {
        order_docs[oname] = doc;
        const items = doc[ORDER_ITEMS_TABLE_FIELD] || [];
        items.forEach(it => {
          const pid = it?.[ORDER_ITEM_LINK_FIELD];
          if (pid) all_product_ids.push(pid);
        });
      }
    } catch (e) {
      console.error(`[TT][Offending] Failed to fetch order ${oname}`, e);
    }
  }

  const desc_map = await get_products_desc_map(frm, all_product_ids);
  const order_items_map = {};
  for (const oname of order_names) {
    const doc = order_docs[oname];
    if (!doc) continue;
    const items = doc[ORDER_ITEMS_TABLE_FIELD] || [];
    order_items_map[oname] = items.map(it => {
      const pid = it?.[ORDER_ITEM_LINK_FIELD] || "";
      return { product_id: pid, product_name: desc_map[pid] || pid, qty: it.qty ?? "" };
    });
  }

  const selected_set = new Set(data.map(d => `${d.order}|||${d.product_id}`));
  let html = `<div class="tt-offending-container" style="margin:4px 0 12px 0;">`;
  html += `<label class="control-label" style="margin-bottom:8px; display:block; font-weight:600;">Offending Item/s</label>`;

  if (order_names.length === 1) {
    const oname = order_names[0];
    html += build_order_items_checkboxes(oname, order_items_map[oname] || [], selected_set);
  } else {
    for (const oname of order_names) {
      const items = order_items_map[oname] || [];
      const selected_count = items.filter(it => selected_set.has(`${oname}|||${it.product_id}`)).length;
      const badge = selected_count > 0
        ? `<span class="badge badge-danger" style="margin-left:8px; background:#e74c3c; color:#fff; border-radius:10px; padding:2px 8px; font-size:11px;">${selected_count} selected</span>`
        : "";
      html += `
        <div class="tt-offending-order" style="border:1px solid #e8e8e8; border-radius:6px; margin-bottom:8px; overflow:hidden;">
          <div class="tt-offending-order-header" data-order="${escapeHtml(oname)}"
               style="padding:10px 12px; background:#fafafa; cursor:pointer; display:flex; align-items:center; justify-content:space-between; user-select:none;">
            <div><span style="font-weight:500;">${escapeHtml(oname)}</span>${badge}</div>
            <span class="tt-offending-chevron" style="transition:transform 0.2s; font-size:12px;">&#9658;</span>
          </div>
          <div class="tt-offending-order-body" data-order="${escapeHtml(oname)}" style="display:none; padding:8px 12px;">
            ${build_order_items_checkboxes(oname, items, selected_set)}
          </div>
        </div>`;
    }
  }

  html += build_offending_summary(data, order_names.length > 1);
  html += `</div>`;
  wrapper.html(html);

  wrapper.find(".tt-offending-order-header").off("click.tt").on("click.tt", function () {
    const body = wrapper.find(`.tt-offending-order-body[data-order="${$(this).attr("data-order")}"]`);
    const chevron = $(this).find(".tt-offending-chevron");
    if (body.is(":visible")) {
      body.slideUp(150);
      chevron.css("transform", "rotate(0deg)");
    } else {
      body.slideDown(150);
      chevron.css("transform", "rotate(90deg)");
    }
  });

  wrapper.find(".tt-offending-check").off("change.tt").on("change.tt", function () {
    const order = $(this).attr("data-order");
    const product_id = $(this).attr("data-product-id");
    const product_name = $(this).attr("data-product-name");
    const checked = $(this).is(":checked");

    let current_data = get_offending_data(frm);
    if (checked) {
      const exists = current_data.some(d => d.order === order && d.product_id === product_id);
      if (!exists) current_data.push({ order, product_id, product_name });
    } else {
      current_data = current_data.filter(d => !(d.order === order && d.product_id === product_id));
    }

    set_offending_data(frm, current_data);
    render_offending_items_ui(frm);
  });
}

// -------------------- Data Fetching --------------------
async function get_order_doc_cached(frm, order_name, { force_fetch = false } = {}) {
  frm.__order_cache = frm.__order_cache || {};
  if (!force_fetch && frm.__order_cache[order_name]) return frm.__order_cache[order_name];
  const r = await frappe.call({ method: "frappe.client.get", args: { doctype: ORDER_DOCTYPE, name: order_name } });
  const sales_doc = r?.message || null;
  if (sales_doc && sales_doc.order_ref) {
    try {
      const or2 = await frappe.call({ method: "frappe.client.get", args: { doctype: "Order Form", name: sales_doc.order_ref } });
      const order_doc = or2?.message;
      if (order_doc) {
        const supplement = [
          ...ORDER_CONTACT_CANDIDATES,
          ...ORDER_ADDRESS_CANDIDATES,
          ORDER_CONTACT_PERSON_FIELD,
          ORDER_PREFERRED_DATE_FIELD,
          ORDER_PREFERRED_TIME_FIELD,
        ];
        for (const f of supplement) {
          if (!sales_doc[f] && order_doc[f]) sales_doc[f] = order_doc[f];
        }
      }
    } catch (e) {
      warn("[Order Cache] Failed supplemental Order Form fetch", e);
    }
  }
  frm.__order_cache[order_name] = sales_doc;
  return sales_doc;
}

async function fetch_order_form_extra_fields(sales_doc) {
  let cp = sales_doc?.[ORDER_CONTACT_PERSON_FIELD] || "";
  let pd = sales_doc?.[ORDER_PREFERRED_DATE_FIELD] || "";
  let pt = sales_doc?.[ORDER_PREFERRED_TIME_FIELD] || "";
  if ((!cp || !pd || !pt) && sales_doc?.order_ref) {
    const r = await frappe.db.get_value("Order Form", sales_doc.order_ref, [ORDER_CONTACT_PERSON_FIELD, ORDER_PREFERRED_DATE_FIELD, ORDER_PREFERRED_TIME_FIELD]);
    const v = r?.message || {};
    cp = cp || v[ORDER_CONTACT_PERSON_FIELD] || "";
    pd = pd || v[ORDER_PREFERRED_DATE_FIELD] || "";
    pt = pt || v[ORDER_PREFERRED_TIME_FIELD] || "";
  }
  return { contact_person: cp, preferred_date: pd, preferred_time: pt };
}

// -------------------- Sync & Selection --------------------
async function sync_parent_fields_with_first_row(frm, exclude_cdn) {
  if (frm.__tt_sync_lock) return;
  frm.__tt_sync_lock = true;
  try {
    const rows = (frm.doc[CHILD_TABLE_FIELD] || []).filter(r => !r.__removed && r.name !== exclude_cdn);
    const first = rows.find(r => r[ORDER_LINK_FIELD]);
    if (!first) {
      const f = [TRIP_OUTLET_FIELD, TRIP_CONTACT_FIELD, TRIP_ADDRESS_FIELD, TRIP_CONTACT_PERSON_FIELD, TRIP_PREFERRED_DATETIME_FIELD, TRIP_PREFERRED_TIME_FIELD];
      f.forEach(k => { if (has_df(frm, k)) { frm.doc[k] = ""; frm.refresh_field(k); } });
      frm.dirty();
      return;
    }
    const order_doc = await get_order_doc_cached(frm, first[ORDER_LINK_FIELD]);
    if (!order_doc) return;
    const { contact_person, preferred_date, preferred_time } = await fetch_order_form_extra_fields(order_doc);
    await set_parent_value(frm, TRIP_OUTLET_FIELD, order_doc[ORDER_OUTLET_FIELD]);
    await set_parent_value(frm, TRIP_CONTACT_FIELD, pick_first_present(order_doc, ORDER_CONTACT_CANDIDATES));
    await set_parent_value(frm, TRIP_ADDRESS_FIELD, pick_first_present(order_doc, ORDER_ADDRESS_CANDIDATES));
    if (has_df(frm, TRIP_CONTACT_PERSON_FIELD)) await set_parent_value(frm, TRIP_CONTACT_PERSON_FIELD, contact_person);
    if (has_df(frm, TRIP_PREFERRED_DATETIME_FIELD)) await set_parent_value(frm, TRIP_PREFERRED_DATETIME_FIELD, preferred_date);
    if (has_df(frm, TRIP_PREFERRED_TIME_FIELD)) await set_parent_value(frm, TRIP_PREFERRED_TIME_FIELD, preferred_time);
  } finally {
    setTimeout(() => { frm.__tt_sync_lock = false; }, 300);
  }
}

async function handle_order_selected(frm, cdt, cdn) {
  const row = get_row(cdt, cdn);
  const val = row?.[ORDER_LINK_FIELD];
  if (!val) { clear_row_html(frm, cdn); await sync_parent_fields_with_first_row(frm); return; }
  
  const doc = await get_order_doc_cached(frm, val);
  if (!doc) return;
  if (row.idx === 1) await sync_parent_fields_with_first_row(frm);
  else if (frm.doc[TRIP_OUTLET_FIELD] && doc[ORDER_OUTLET_FIELD] !== frm.doc[TRIP_OUTLET_FIELD]) {
    frappe.msgprint(`Only orders from "${frm.doc[TRIP_OUTLET_FIELD]}" allowed.`);
    frappe.model.set_value(cdt, cdn, ORDER_LINK_FIELD, "");
    return;
  }
  await render_order_details_from_doc(frm, cdt, cdn, doc);
}

async function render_order_details_from_doc(frm, cdt, cdn, doc) {
  const items = doc[ORDER_ITEMS_TABLE_FIELD] || [];
  const preview = items.slice(0, PREVIEW_ITEMS_COUNT).map(i => i.item).join(", ");
  await frappe.model.set_value(cdt, cdn, CHILD_PLAINTEXT_FIELD, preview);
  set_row_html(frm, cdn, `<div style="padding:10px;">${preview}</div>`);
  bind_row_html_actions(frm, cdn);
}

function set_order_query(frm) {
  frm.set_query(ORDER_LINK_FIELD, CHILD_TABLE_FIELD, () => ({
    filters: { status: "Pending", [ORDER_OUTLET_FIELD]: frm.doc[TRIP_OUTLET_FIELD] || undefined }
  }));
}

// -------------------- Multi-driver UI --------------------
const TT_DRIVER_TABLE = "driver_assignments";
const TT_ITEM_TABLE = "delivery_items";
const TT_SALES_TABLE = "table_cpme";
const TT_ITEM_ROW_DOCTYPE = "Trips Delivery Item";

function tt_user_is_driver_only() {
  const roles = frappe.user_roles || [];
  return roles.includes("Driver") && !roles.includes("Administrator") && !roles.includes("System Manager") && !roles.includes("Dispatcher");
}

async function tt_resolve_current_driver_names(frm) {
  if (!tt_user_is_driver_only()) {
    frm.__tt_driver_names = [];
    return;
  }
  const rows = await frappe.db.get_list("Driver", {
    fields: ["name"],
    filters: { full_name: frappe.user.full_name(), status: "Active" },
    limit: 20,
  });
  frm.__tt_driver_names = (rows || []).map(row => row.name);
}

function tt_hide_deprecated_fields(frm) {
  ["driverhelper"].forEach(field => {
    if (frm.fields_dict[field]) frm.toggle_display(field, false);
  });
  if (frm.fields_dict[PROOF_FIELD]) frm.toggle_display(PROOF_FIELD, true);
  if (frm.fields_dict[PROOF_TS_FIELD]) frm.toggle_display(PROOF_TS_FIELD, true);
  if (tt_user_is_driver_only() && frm.fields_dict.information_section) {
    frm.toggle_display("information_section", false);
  }
}

function tt_has_selected_sales(frm) {
  return (frm.doc[TT_SALES_TABLE] || []).filter(r => !r.__removed).some(row => !!row.sales_no);
}

async function tt_get_sales_doc(frm, salesNo) {
  frm.__tt_sales_doc_cache = frm.__tt_sales_doc_cache || {};
  if (!salesNo) return null;
  if (!frm.__tt_sales_doc_cache[salesNo]) {
    frm.__tt_sales_doc_cache[salesNo] = await frappe.db.get_doc("Sales", salesNo);
  }
  return frm.__tt_sales_doc_cache[salesNo];
}

async function tt_sync_delivery_items(frm, exclude_cdn) {
  const salesRows = (frm.doc[TT_SALES_TABLE] || []).filter(r => !r.__removed && r.name !== exclude_cdn);
  const existing_splits = {};

  (frm.doc[TT_ITEM_TABLE] || []).forEach(row => {
    const base_key = [row.sales_no || "", row.sales_item_row || "", row.item_code || ""].join("::");
    if (!existing_splits[base_key]) existing_splits[base_key] = [];
    existing_splits[base_key].push({
      assigned_driver: row.assigned_driver || "",
      delivered: row.delivered || 0,
      quantity: row.quantity || 0,
      liters_per_unit: row.liters_per_unit || 0,
      total_liters: row.total_liters || 0,
      item_name: row.item_name || "",
    });
  });

  frm.clear_table(TT_ITEM_TABLE);

  for (const salesRow of salesRows) {
    const salesNo = salesRow.sales_no;
    if (!salesNo) continue;
    const salesDoc = await tt_get_sales_doc(frm, salesNo);
    const items = (salesDoc && salesDoc.items) || [];

    for (const item of items) {
      const itemCode = item.item || "";
      const salesItemRow = item.name || "";
      const base_key = [salesNo, salesItemRow, itemCode].join("::");
      const splits = existing_splits[base_key] || [];
      const full_qty = item.qty || 0;

      let itemName = (splits[0] && splits[0].item_name) || itemCode;
      if (itemName === itemCode && itemCode) {
        try {
          const res = await frappe.db.get_value("Product", itemCode, "item_description");
          if (res?.message?.item_description) {
            itemName = res.message.item_description;
          }
        } catch (e) {}
      }

      const liters_per_unit = (splits[0] && splits[0].liters_per_unit) || 0;

      if (splits.length > 1) {
        for (const split of splits) {
          frm.add_child(TT_ITEM_TABLE, {
            sales_no: salesNo,
            order_no: salesDoc.order_ref || "",
            sales_item_row: salesItemRow,
            item_code: itemCode,
            item_name: itemName,
            quantity: split.quantity,
            liters_per_unit: split.liters_per_unit || liters_per_unit,
            total_liters: split.total_liters || 0,
            assigned_driver: split.assigned_driver || "",
            delivered: split.delivered || 0,
          });
        }
      } else {
        const previous = splits[0] || {};
        frm.add_child(TT_ITEM_TABLE, {
          sales_no: salesNo,
          order_no: salesDoc.order_ref || "",
          sales_item_row: salesItemRow,
          item_code: itemCode,
          item_name: itemName,
          quantity: full_qty,
          liters_per_unit: previous.liters_per_unit || liters_per_unit,
          total_liters: previous.total_liters || 0,
          assigned_driver: previous.assigned_driver || "",
          delivered: previous.delivered || 0,
        });
      }
    }
  }

  frm.refresh_field(TT_ITEM_TABLE);
}

function tt_toggle_delivery_table(frm) {
  const show = tt_has_selected_sales(frm);
  if (frm.fields_dict[TT_ITEM_TABLE]) frm.toggle_display(TT_ITEM_TABLE, show);
}

function tt_filter_delivery_rows(frm) {
  const grid = frm.fields_dict[TT_ITEM_TABLE]?.grid;
  if (!grid) return;
  const driverNames = frm.__tt_driver_names || [];
  grid.grid_rows.forEach(row => {
    const assigned = row.doc.assigned_driver || "";
    const show = !tt_user_is_driver_only() || !assigned || driverNames.includes(assigned);
    $(row.row).toggle(show);
  });
}

function tt_find_driver_assignment_row(frm, driverName) {
  return (frm.doc[TT_DRIVER_TABLE] || []).find(row => row.driver === driverName);
}

function tt_ensure_driver_rows_from_items(frm) {
  const drivers = [];
  (frm.doc[TT_ITEM_TABLE] || []).forEach(row => {
    const driver = row.assigned_driver || "";
    if (driver && !drivers.includes(driver)) drivers.push(driver);
  });
  let changed = false;
  drivers.forEach(driver => {
    if (!tt_find_driver_assignment_row(frm, driver)) {
      frm.add_child(TT_DRIVER_TABLE, { driver });
      changed = true;
    }
  });
  if (changed) frm.refresh_field(TT_DRIVER_TABLE);
}

function tt_recompute_driver_assignment_summary(frm) {
  tt_ensure_driver_rows_from_items(frm);
  const counts = {};
  (frm.doc[TT_ITEM_TABLE] || []).forEach(row => {
    const driver = row.assigned_driver || "";
    if (!driver) return;
    counts[driver] = (counts[driver] || 0) + 1;
  });
  (frm.doc[TT_DRIVER_TABLE] || []).forEach(row => {
    const count = counts[row.driver || ""] || 0;
    row.assigned_items = count ? `${count} item(s)` : "";
  });
  frm.refresh_field(TT_DRIVER_TABLE);
}

function tt_apply_driver_query(frm) {
  frm.set_query("assigned_driver", TT_ITEM_TABLE, function () {
    return { filters: { status: "Active" } };
  });
}

async function tt_sync_items_from_driver_table(frm, sourceDriver) {
  const itemRows = frm.doc[TT_ITEM_TABLE] || [];
  if (!itemRows.length || !sourceDriver) return;
  const driverRows = (frm.doc[TT_DRIVER_TABLE] || []).filter(row => !!row.driver);
  if (driverRows.length === 1) {
    for (const row of itemRows) {
      if (row.assigned_driver !== sourceDriver) {
        await frappe.model.set_value(TT_ITEM_ROW_DOCTYPE, row.name, "assigned_driver", sourceDriver);
      }
    }
    return;
  }
  for (const row of itemRows) {
    if (!row.assigned_driver) {
      await frappe.model.set_value(TT_ITEM_ROW_DOCTYPE, row.name, "assigned_driver", sourceDriver);
    }
  }
}

async function tt_assign_all_items_to_driver(frm, driverName) {
  if (!driverName) return;
  if (!tt_find_driver_assignment_row(frm, driverName)) {
    frm.add_child(TT_DRIVER_TABLE, { driver: driverName });
    frm.refresh_field(TT_DRIVER_TABLE);
  }
  const rows = frm.doc[TT_ITEM_TABLE] || [];
  for (const row of rows) {
    if (!row.name) continue;
    await frappe.model.set_value(TT_ITEM_ROW_DOCTYPE, row.name, "assigned_driver", driverName);
  }
  frm.refresh_field(TT_ITEM_TABLE);
  tt_recompute_driver_assignment_summary(frm);
  tt_filter_delivery_rows(frm);
}

function tt_remove_custom_button_if_present(frm, label) {
  if (typeof frm.remove_custom_button === "function") {
    frm.remove_custom_button(label);
    frm.remove_custom_button(label, "Actions");
  }
}

function tt_add_bulk_assign_button(frm) {
  tt_remove_custom_button_if_present(frm, "Assign All To Driver");
  tt_remove_custom_button_if_present(frm, "Apply Driver to All Items");
  if (!tt_has_selected_sales(frm)) return;
  if (tt_user_is_driver_only()) return;

  const grid = frm.fields_dict[TT_DRIVER_TABLE]?.grid;
  if (!grid || !grid.wrapper) return;
  grid.wrapper.find(".btn-apply-driver-all").remove();

  const $btn = $('<button class="btn btn-xs btn-default btn-apply-driver-all" style="margin: 4px 0 4px 8px;">Apply Driver to All Items</button>');
  $btn.on("click", () => {
    const dialog = new frappe.ui.Dialog({
      title: "Apply Driver to All Items",
      fields: [{
        label: "Driver",
        fieldname: "driver",
        fieldtype: "Link",
        options: "Driver",
        get_query: () => ({ filters: { status: "Active" } }),
      }],
      primary_action_label: "Apply",
      primary_action: async (values) => {
        if (!values.driver) {
          frappe.msgprint("Select a driver first.");
          return;
        }
        const different_rows = (frm.doc[TT_ITEM_TABLE] || []).filter(
          row => row.assigned_driver && row.assigned_driver !== values.driver
        );
        const do_assign = async () => {
          await tt_assign_all_items_to_driver(frm, values.driver);
          dialog.hide();
        };
        if (different_rows.length > 0) {
          frappe.confirm("This will overwrite driver assignments for all rows. Proceed?", do_assign, () => {});
        } else {
          await do_assign();
        }
      },
    });
    dialog.show();
  });

  const $addRow = grid.wrapper.find(".grid-add-row").first();
  const $gridBtns = grid.wrapper.find(".grid-buttons").first();
  if ($addRow.length) $addRow.after($btn);
  else if ($gridBtns.length) $gridBtns.append($btn);
  else grid.wrapper.find(".grid-footer").first().append($btn);
}

function tt_validate_rows_for_driver(frm, driverName) {
  const assigned = (frm.doc[TT_ITEM_TABLE] || []).filter(row => row.assigned_driver === driverName);
  if (!assigned.length) frappe.throw("No delivery items are assigned to this driver.");
  if (assigned.some(row => !row.delivered)) frappe.throw("All assigned items must be checked off before marking delivery as complete.");
}

function tt_add_submit_button(frm) {
  if (!tt_user_is_driver_only()) return;
  const driverNames = frm.__tt_driver_names || [];
  const target = (frm.doc[TT_DRIVER_TABLE] || []).find(row => driverNames.includes(row.driver) && !row.submitted);
  if (!target) return;
  frm.add_custom_button("Submit My Delivery", async () => {
    tt_validate_rows_for_driver(frm, target.driver);
    const has_pod = target.proof_of_delivery || frm.doc.proof_of_delivery;
    if (!has_pod) frappe.throw("Upload proof of delivery before submitting.");
    target.submitted = 1;
    target.submitted_by = frappe.session.user;
    frm.refresh_field(TT_DRIVER_TABLE);
    await frm.save();
  });
}

function tt_split_delivery_row(frm, cdt, cdn) {
  const row = locals[cdt] && locals[cdt][cdn];
  if (!row) return;
  const max_qty = row.quantity || 0;
  if (max_qty <= 1) {
    frappe.msgprint("Cannot split: quantity must be greater than 1 to split between drivers.");
    return;
  }
  const dialog = new frappe.ui.Dialog({
    title: "Split Delivery for Another Driver",
    fields: [{
      label: "Quantity to assign to new row",
      fieldname: "split_qty",
      fieldtype: "Float",
      reqd: 1,
      description: `Must be between 1 and ${max_qty - 1}. Remaining ${max_qty} will be split.`,
    }],
    primary_action_label: "Split",
    primary_action(values) {
      const split_qty = parseFloat(values.split_qty || 0);
      if (!split_qty || split_qty <= 0 || split_qty >= max_qty) {
        frappe.msgprint(`Invalid quantity. Must be between 1 and ${max_qty - 1}.`);
        return;
      }
      const remaining = max_qty - split_qty;
      frappe.model.set_value(cdt, cdn, "quantity", remaining);
      frappe.model.set_value(cdt, cdn, "total_liters", (row.liters_per_unit || 0) * remaining);
      frm.add_child(TT_ITEM_TABLE, {
        sales_no: row.sales_no || "",
        order_no: row.order_no || "",
        sales_item_row: row.sales_item_row || "",
        item_code: row.item_code || "",
        item_name: row.item_name || "",
        quantity: split_qty,
        liters_per_unit: row.liters_per_unit || 0,
        total_liters: (row.liters_per_unit || 0) * split_qty,
        assigned_driver: "",
        delivered: 0,
      });
      frm.refresh_field(TT_ITEM_TABLE);
      tt_recompute_driver_assignment_summary(frm);
      dialog.hide();
      frappe.show_alert({ message: "Row split. Assign a driver to the new row.", indicator: "green" }, 4);
    },
  });
  dialog.show();
}

// -------------------- UI Helpers --------------------
function hide_redundant_workflow_actions(frm) {
  if (!frm.page) return;
  HIDDEN_WORKFLOW_ACTIONS.forEach(a => frm.page.remove_inner_button(a, "Actions"));
}

function enforce_archive_lock(frm) {
  if (!frm.doc.archived && frm.doc.workflow_state !== 'Cancelled') return;
  frm.set_read_only();
  frm.disable_save();
}

async function refresh_delivery_ui_if_available(frm) {
  const was_dirty = frm.is_dirty();
  await tt_resolve_current_driver_names(frm);
  tt_hide_deprecated_fields(frm);
  await tt_sync_delivery_items(frm);
  tt_toggle_delivery_table(frm);
  tt_apply_driver_query(frm);
  tt_recompute_driver_assignment_summary(frm);
  tt_filter_delivery_rows(frm);
  tt_add_submit_button(frm);
  tt_add_bulk_assign_button(frm);
  if (!was_dirty) {
    frm.doc.__unsaved = 0;
    if (frm.toolbar && typeof frm.toolbar.refresh === "function") {
      frm.toolbar.refresh();
    }
  }
}

async function sync_delivery_items_if_available(frm) {
  await tt_sync_delivery_items(frm);
}

function apply_failure_reason_rules_if_available(frm, cdt, cdn) {
  const handler = get_optional_global("apply_failure_reason_rules");
  if (handler) {
    handler(frm, cdt, cdn);
  }
}

// =====================================================================
// CONSOLIDATED HANDLERS
// =====================================================================

frappe.ui.form.on("Trips", {
  setup(frm) {
    set_order_query(frm);
  },
  onload(frm) {
    enforce_archive_lock(frm);
    if (frm.is_new()) {
      frm.set_value('dispatcher', frappe.session.user);
      frm.set_value(TRIP_PREFERRED_DATETIME_FIELD, frappe.datetime.get_today());
    }
    if (has_df(frm, "trip_no")) {
      frm.set_df_property("trip_no", "read_only", 1);
    }
    // Child table row formatter
    const grid = frm.fields_dict[CHILD_TABLE_FIELD]?.grid;
    if (grid) {
      grid.get_field(ORDER_LINK_FIELD).formatter = (v, d) => v ? `${v}${d.outlet_name ? ' - ' + d.outlet_name : ''}` : v;
    }
  },
  async refresh(frm) {
    normalize_all_time_fields(frm);
    hide_redundant_workflow_actions(frm);
    hide_legacy_helper_fields(frm);
    update_parent_visibility(frm);
    update_time_tracking_visibility(frm);
    update_saved_only_visibility(frm);
    enforce_archive_lock(frm);
    
    // Breadcrumb logic
    if (frm.doc.trip_no) {
      const label = "Trip #" + frm.doc.trip_no;
      frm.page.set_title(label);
      $(".breadcrumb li:last-child a, .breadcrumb li:last-child span").each(function() {
        if ($(this).text().trim().startsWith("TRIP-")) $(this).text(label);
      });
    }

    // Custom Printing
    frm.remove_custom_button(__('Billing Statement'), __('Print'));
    frm.add_custom_button(__('Billing Statement'), () => {
      frappe.route_options = { print_format: 'Billing Statement' };
      frappe.set_route('print', frm.doctype, frm.doc.name);
    }, __('Print'));

    // Delivery UI (Multi-driver)
    await refresh_delivery_ui_if_available(frm);

    const salesGrid = frm.fields_dict[TT_SALES_TABLE]?.grid;
    if (salesGrid && !salesGrid.__tt_delete_patched && typeof salesGrid.delete_rows === "function") {
      salesGrid.__tt_delete_patched = true;
      const originalDeleteRows = salesGrid.delete_rows.bind(salesGrid);
      salesGrid.delete_rows = function() {
        originalDeleteRows();
        setTimeout(function() {
          refresh_delivery_ui_if_available(frm);
        }, 200);
      };
    }
  },
  on_submit(frm) {
    (frm.doc[CHILD_TABLE_FIELD] || []).forEach(row => {
      if (row.sales_no) {
        frappe.db.get_value('Sales', row.sales_no, 'order_ref').then(r => {
          const ref = r?.message?.order_ref;
          if (ref) frappe.db.set_value('Order Form', ref, 'trip_ticket', frm.doc.name);
        });
      }
    });
  },
  [`${CHILD_TABLE_FIELD}_remove`](frm) {
    sync_parent_fields_with_first_row(frm);
  },
  [DELIVERY_STATUS_FIELD](frm) {
    update_parent_visibility(frm);
  },
  [REASON_FAILURE_FIELD](frm) {
    update_offending_items_visibility(frm);
  },
  workflow_state(frm) {
    update_parent_visibility(frm);
    update_time_tracking_visibility(frm);
    update_saved_only_visibility(frm);
  }
});

frappe.ui.form.on("Trips Table", {
  async sales_no(frm, cdt, cdn) {
    await handle_order_selected(frm, cdt, cdn);
    await sync_delivery_items_if_available(frm);
    tt_toggle_delivery_table(frm);
    tt_recompute_driver_assignment_summary(frm);
    tt_filter_delivery_rows(frm);
    tt_add_bulk_assign_button(frm);
  },
  async form_render(frm, cdt, cdn) {
    const row = get_row(cdt, cdn);
    if (row?.[ORDER_LINK_FIELD]) {
      const doc = await get_order_doc_cached(frm, row[ORDER_LINK_FIELD]);
      if (doc) await render_order_details_from_doc(frm, cdt, cdn, doc);
    }
    apply_failure_reason_rules_if_available(frm, cdt, cdn);
  },
  delivery_status(frm, cdt, cdn) {
    apply_failure_reason_rules_if_available(frm, cdt, cdn);
  }
});

frappe.ui.form.on("Trips Driver Assignment", {
  async driver(frm, cdt, cdn) {
    const row = locals[cdt] && locals[cdt][cdn];
    tt_apply_driver_query(frm);
    if (row && row.driver) {
      await tt_sync_items_from_driver_table(frm, row.driver);
    }
    tt_recompute_driver_assignment_summary(frm);
    tt_filter_delivery_rows(frm);
    tt_add_bulk_assign_button(frm);
  },
  async vehicle(frm) {
    tt_recompute_driver_assignment_summary(frm);
    tt_filter_delivery_rows(frm);
  }
});

frappe.ui.form.on("Trips Delivery Item", {
  async assigned_driver(frm) {
    tt_recompute_driver_assignment_summary(frm);
    tt_filter_delivery_rows(frm);
    tt_add_bulk_assign_button(frm);
  },
  delivered(frm) {
    tt_recompute_driver_assignment_summary(frm);
    tt_filter_delivery_rows(frm);
  },
  form_render(frm, cdt, cdn) {
    tt_recompute_driver_assignment_summary(frm);
    tt_filter_delivery_rows(frm);
    if (!tt_user_is_driver_only()) {
      const grid = frm.fields_dict[TT_ITEM_TABLE] && frm.fields_dict[TT_ITEM_TABLE].grid;
      const grid_row = grid && grid.grid_rows_by_docname && grid.grid_rows_by_docname[cdn];
      if (grid_row && grid_row.grid_form && grid_row.grid_form.wrapper) {
        const $form = $(grid_row.grid_form.wrapper);
        $form.find(".btn-split-delivery-row").remove();
        const $btn = $('<button class="btn btn-xs btn-default btn-split-delivery-row" style="margin-top:10px;">Split for Another Driver</button>');
        $btn.on("click", () => tt_split_delivery_row(frm, cdt, cdn));
        $form.find(".form-layout").first().append($btn);
      }
    }
  },
  delivery_items_remove(frm) {
    const grid = frm.fields_dict[TT_ITEM_TABLE] && frm.fields_dict[TT_ITEM_TABLE].grid;
    if (grid) {
      grid.cannot_add_rows = false;
      grid.refresh();
    }
    tt_recompute_driver_assignment_summary(frm);
    tt_filter_delivery_rows(frm);
  }
});
})();
