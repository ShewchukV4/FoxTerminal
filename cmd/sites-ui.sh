#!/usr/bin/env bash

set -uo pipefail

SITES_FILE_WIN="${FOXTERM_SITES_FILE_WIN:-}"
CMD_PATH_WIN="${FOXTERM_CMD_PATH_WIN:-}"

open_url() {
  local raw_url="$1"
  local resolved_url="$raw_url"

  # Resolve relative paths to file:/// from the sites/ folder
  if [[ "$raw_url" != http://* && "$raw_url" != https://* && "$raw_url" != file://* ]]; then
    local cmd_parent=""
    if [[ -n "$CMD_PATH_WIN" ]]; then
      local sites_win="${CMD_PATH_WIN%\\cmd}\\sites"
      local cleaned="${raw_url#./}"
      local full_win="${sites_win}\\${cleaned//\//\\}"
      resolved_url="$(cygpath -u "$full_win" 2>/dev/null || true)"
      if [[ -n "$resolved_url" && -f "$resolved_url" ]]; then
        resolved_url="file:///$(cygpath -m "$resolved_url" 2>/dev/null || echo "$full_win")"
      else
        resolved_url="$raw_url"
      fi
    fi
  fi

  powershell.exe -NoProfile -ExecutionPolicy Bypass \
    -Command "Start-Process '$resolved_url'" >/dev/null 2>&1 || true
}

if ! command -v dialog >/dev/null 2>&1; then
  echo "Command 'dialog' is required for mintty UI."
  echo "Run: interface-deps -Install"
  exit 1
fi

# Default site (fallback when sites.json is not readable)
SITE_ID="typewriter"
SITE_NAME="Type Writer"
SITE_URL="./typewriter/index.html"
SITE_DESC="Typing practice website (local)"

# Load first site from sites.json if jq is available
if [[ -n "$SITES_FILE_WIN" ]] && command -v jq >/dev/null 2>&1; then
  SITES_UNIX="$(cygpath -u "$SITES_FILE_WIN" 2>/dev/null || true)"
  if [[ -n "$SITES_UNIX" && -f "$SITES_UNIX" ]]; then
    _id="$(jq -r '.[0].id // empty' "$SITES_UNIX" 2>/dev/null || true)"
    _nm="$(jq -r '.[0].name // empty' "$SITES_UNIX" 2>/dev/null || true)"
    _ur="$(jq -r '.[0].url // empty' "$SITES_UNIX" 2>/dev/null || true)"
    _ds="$(jq -r '.[0].description // empty' "$SITES_UNIX" 2>/dev/null || true)"
    [[ -n "$_id" ]] && SITE_ID="$_id"
    [[ -n "$_nm" ]] && SITE_NAME="$_nm"
    [[ -n "$_ur" ]] && SITE_URL="$_ur"
    [[ -n "$_ds" ]] && SITE_DESC="$_ds"
  fi
fi

tmp_rc="${TMPDIR:-/tmp}/foxterm-sites-dialogrc-$$"
cat > "$tmp_rc" <<'RCEOF'
use_colors = ON
use_shadow = OFF
screen_color = (WHITE,BLACK,OFF)
dialog_color = (WHITE,BLACK,OFF)
title_color  = (WHITE,BLACK,ON)
border_color = (CYAN,BLACK,ON)
button_active_color   = (WHITE,BLUE,ON)
button_inactive_color = (WHITE,BLACK,OFF)
item_color          = (WHITE,BLACK,OFF)
item_selected_color = (WHITE,BLUE,ON)
tag_color           = (CYAN,BLACK,ON)
tag_selected_color  = (WHITE,BLUE,ON)
RCEOF
export DIALOGRC="$tmp_rc"
trap 'rm -f "$tmp_rc" >/dev/null 2>&1 || true; clear' EXIT

while true; do
  choice=$(
    dialog --stdout --no-shadow --mouse \
      --backtitle "FoxTerminal | Sites" \
      --title " [ Sites ] " \
      --default-item "$SITE_ID" \
      --menu "Scroll: Up/Down   Open: Enter   Exit: Esc" \
      14 60 6 \
      "$SITE_ID" "$SITE_NAME  —  $SITE_DESC" \
      refresh "Reload" \
      exit    "Close"
  )
  status=$?

  [[ $status -ne 0 ]] && exit 0

  case "$choice" in
    "$SITE_ID") open_url "$SITE_URL" ;;
    refresh)    : ;;
    exit)       exit 0 ;;
  esac
done
