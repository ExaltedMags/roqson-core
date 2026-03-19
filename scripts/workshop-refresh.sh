#!/bin/zsh
set -euo pipefail

BENCH_DIR="${BENCH_DIR:-$HOME/frappe-dev/frappe-bench}"
SITE="${SITE:-roqson.local}"
MODE="${1:-all}"

cd "$BENCH_DIR"

case "$MODE" in
  python)
    bench --site "$SITE" clear-cache
    ;;
  js|css|assets)
    bench build --app roqson_core
    bench --site "$SITE" clear-cache
    ;;
  workspace|fixtures)
    bench --site "$SITE" execute roqson_core.dev.local_setup.sync_local_shell
    bench --site "$SITE" clear-cache
    ;;
  gui|metadata)
    bench --site "$SITE" export-fixtures --app roqson_core
    bench --site "$SITE" execute roqson_core.dev.local_setup.sync_local_shell
    bench --site "$SITE" clear-cache
    ;;
  all)
    bench build --app roqson_core
    bench --site "$SITE" execute roqson_core.dev.local_setup.sync_local_shell
    bench --site "$SITE" clear-cache
    ;;
  *)
    echo "Usage: $0 [python|js|css|assets|workspace|fixtures|gui|metadata|all]" >&2
    exit 1
    ;;
esac

echo "Workshop refresh complete for mode: $MODE"
