import roqson

for name in ['Order Form: Totals Footer Row', 'Order Form: Footer Row Summary Tab']:
    body = roqson.get_script_body('Client Script', name)
    new_body = body.replace(
        '<div class="data-row row" style="font-size: 13px; background: var(--fg-color, #fff); ${style || \'\'}">',
        '<div class="data-row row roqson-footer-row ${style || \'\'}">'
    ).replace(
        '<div class="data-row row" style="font-weight: 700; font-size: 13px; background: var(--fg-color, #fff); border-top: 2px solid var(--border-color, #d1d8dd);">',
        '<div class="data-row row roqson-footer-row-header">'
    ).replace(
        '<div class="data-row row" style="font-weight: 700; font-size: 13px; background: var(--fg-color, #fff); border-top: 1px solid var(--border-color, #d1d8dd);">',
        '<div class="data-row row roqson-footer-row-total">'
    ).replace(
        '<div class="static-area ellipsis" style="padding-right: 8px;">Total Quantity</div>',
        '<div class="static-area ellipsis roqson-footer-label-pr">Total Quantity</div>'
    ).replace(
        "'color: var(--red, #e74c3c);'",
        "'roqson-footer-discount'"
    )
    if new_body != body:
        print(f"Updating {name}...")
        roqson.safe_update_script('Client Script', name, new_body)

print("Done updating footers.")
