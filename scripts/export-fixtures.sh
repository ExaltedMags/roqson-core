#!/bin/zsh
set -euo pipefail

BENCH_DIR="${BENCH_DIR:-$HOME/frappe-dev/frappe-bench}"
SITE="${SITE:-roqson.local}"
APP="${APP:-roqson_core}"

cd "$BENCH_DIR"

echo "Exporting fixtures for app: $APP on site: $SITE"
bench --site "$SITE" export-fixtures --app "$APP"
bench --site "$SITE" clear-cache

cat <<EOF
Fixture export complete.

Next steps:
  1. Review the changed files under the app's fixtures/
  2. Run: roqson refresh gui
  3. Test in localhost
  4. Commit the fixture changes if correct
EOF
