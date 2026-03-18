with open("roqson_core/public/css/roqson_core.css", "r") as f:
    css = f.read()

order_form_css = """
/* === Order Form === */

/* Order Form UX Fix - Grid Mobile Fix */
@media (max-width: 991px) {
    .form-grid .grid-body, .form-grid .grid-heading-row {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
    }
    .form-grid .grid-row {
        min-width: 800px !important;
        display: flex !important;
        flex-wrap: nowrap !important;
    }
    .form-grid .grid-row .grid-static-col {
        min-width: 120px !important;
        flex: 1 1 0 !important;
        white-space: normal !important;
    }
    .form-grid .grid-heading-row .grid-row {
        min-width: 800px !important;
        display: flex !important;
        flex-wrap: nowrap !important;
    }
}

/* Order Form UX Fix - Map Height Fix */
.leaflet-container, .map-wrapper { 
    height: 250px !important; 
    min-height: 250px !important; 
}

/* Order Form Display - Enforce Readonly Visually */
.roqson-force-readonly {
    background-color: var(--control-bg, #f3f3f3) !important;
    cursor: not-allowed !important;
}

/* Order Form List Master - Custom Columns and Layout */
#page-List\\/Order\\ Form\\/List .list-row-activity .comment-count,
#page-List\\/Order\\ Form\\/List .list-row-activity .mx-2,
#page-List\\/Order\\ Form\\/List .list-row-activity .list-row-like { display: none !important; }
#page-List\\/Order\\ Form\\/List .list-header-meta .list-liked-by-me { display: none !important; }

#page-List\\/Order\\ Form\\/List .list-subject {
    flex: 0 0 30px !important; min-width: 30px !important; max-width: 30px !important;
    overflow: hidden !important;
}
#page-List\\/Order\\ Form\\/List .list-subject .level-item.bold,
#page-List\\/Order\\ Form\\/List .list-subject .level-item.ellipsis,
#page-List\\/Order\\ Form\\/List .list-header-subject .list-subject-title,
#page-List\\/Order\\ Form\\/List .list-header-subject .list-header-meta { display: none !important; }

#page-List\\/Order\\ Form\\/List .list-row-head .level-left,
#page-List\\/Order\\ Form\\/List .list-row-container .list-row .level-left {
    flex: 0 0 auto !important; min-width: 0 !important; max-width: none !important; overflow: visible !important;
}
#page-List\\/Order\\ Form\\/List .list-row-head .level-right,
#page-List\\/Order\\ Form\\/List .list-row-container .list-row .level-right {
    flex: 0 0 95px !important; min-width: 95px !important; max-width: 95px !important; overflow: hidden !important;
}

#page-List\\/Order\\ Form\\/List .list-row-head .level-right .list-count {
    white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
}

#page-List\\/Order\\ Form\\/List .list-row-col { margin-right: 0 !important; }

#page-List\\/Order\\ Form\\/List .of-col-id {
    flex: 0 0 140px !important; min-width: 140px !important; max-width: 140px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
    font-weight: 700;
}
#page-List\\/Order\\ Form\\/List .of-col-status {
    flex: 0 0 130px !important; min-width: 130px !important; max-width: 130px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
    display: flex !important; align-items: center !important;
}
#page-List\\/Order\\ Form\\/List .of-col-outlet {
    flex: 0 0 240px !important; min-width: 240px !important; max-width: 240px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-delivery-dt {
    flex: 0 0 150px !important; min-width: 150px !important; max-width: 150px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
    display: flex !important;
}
#page-List\\/Order\\ Form\\/List .of-col-address {
    flex: 0 0 220px !important; min-width: 220px !important; max-width: 220px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-reservation {
    flex: 0 0 110px !important; min-width: 110px !important; max-width: 110px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-createdby {
    flex: 0 0 130px !important; min-width: 130px !important; max-width: 130px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-date {
    flex: 0 0 110px !important; min-width: 110px !important; max-width: 110px !important;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 8px; padding-right: 8px; box-sizing: border-box;
}
#page-List\\/Order\\ Form\\/List .of-col-delivery-dt.hidden-xs { display: flex !important; }

#page-List\\/Order\\ Form\\/List .list-row-activity {
    flex: 0 0 95px !important; min-width: 95px !important; max-width: 95px !important;
}

#page-List\\/Order\\ Form\\/List .list-row-head,
#page-List\\/Order\\ Form\\/List .list-row-container .list-row {
    min-width: 1500px !important;
    flex-wrap: nowrap !important; display: flex !important;
}

#page-List\\/Order\\ Form\\/List .layout-main-section { overflow: visible !important; }
#page-List\\/Order\\ Form\\/List .result { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }

#page-List\\/Order\\ Form\\/List .list-row-col {
    overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;
}

/* Force ALL columns visible on all screen sizes */
#page-List\\/Order\\ Form\\/List .list-row-col.hidden-xs,
#page-List\\/Order\\ Form\\/List .list-row-col.hidden-sm,
#page-List\\/Order\\ Form\\/List .list-row-col.hidden-md,
#page-List\\/Order\\ Form\\/List .list-row-head .list-row-col.hidden-xs,
#page-List\\/Order\\ Form\\/List .list-row-head .list-row-col.hidden-sm,
#page-List\\/Order\\ Form\\/List .list-row-head .list-row-col.hidden-md {
    display: flex !important;
}

/* Ensure scroll container chain works on mobile/tablet */
#page-List\\/Order\\ Form\\/List .frappe-list,
#page-List\\/Order\\ Form\\/List .layout-main-section-wrapper {
    overflow: visible !important;
}
#page-List\\/Order\\ Form\\/List .result {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
}

/* DSP Mandatory fake asterisk */
.roqson-reqd-star {
    color: red;
    margin-left: 2px;
}
"""

css = css.replace("/* === Order Form === */", order_form_css)

with open("roqson_core/public/css/roqson_core.css", "w") as f:
    f.write(css)
