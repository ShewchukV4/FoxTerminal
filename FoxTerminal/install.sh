#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${HOME}"
CONFIG_FILE="${CONFIG_DIR}/.wezterm.lua"
SOURCE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wezterm.lua"

if [ ! -f "${SOURCE_FILE}" ]; then
  echo "Config not found: ${SOURCE_FILE}"
  exit 1
fi

cp "${SOURCE_FILE}" "${CONFIG_FILE}"
echo "Installed config to ${CONFIG_FILE}"

if command -v wezterm >/dev/null 2>&1; then
  BIN_DIR="${HOME}/.local/bin"
  mkdir -p "${BIN_DIR}"
  cat > "${BIN_DIR}/foxterminal" <<'EOF'
#!/usr/bin/env bash
exec wezterm "$@"
EOF
  chmod +x "${BIN_DIR}/foxterminal"
  echo "Created launcher: ${BIN_DIR}/foxterminal"
  echo "Make sure ${BIN_DIR} is in PATH."
else
  echo "WezTerm not found. Install it first."
fi
