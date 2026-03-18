#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${HOME}/.local/bin"
TARGET_PATH="${TARGET_DIR}/roqson"

mkdir -p "$TARGET_DIR"

cat > "$TARGET_PATH" <<EOF
#!/bin/zsh
set -euo pipefail
"${ROOT_DIR}/scripts/roqson" "\$@"
EOF

chmod +x "$TARGET_PATH"

cat <<EOF
Installed roqson command at:
  ${TARGET_PATH}

If needed, add this to your shell profile:
  export PATH="\$HOME/.local/bin:\$PATH"

Then restart Terminal and run:
  roqson refresh
EOF
