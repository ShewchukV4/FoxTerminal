#!/usr/bin/env bash

set -uo pipefail

SITES_FILE_WIN="${FOXTERM_SITES_FILE_WIN:-}"
CMD_PATH_WIN="${FOXTERM_CMD_PATH_WIN:-}"

open_url() {
  local raw_url="$1"
  local resolved_url="$raw_url"

  if [[ "$raw_url" != http://* && "$raw_url" != https://* && "$raw_url" != file://* ]]; then
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

if [[ -z "$SITES_FILE_WIN" ]] || ! command -v jq >/dev/null 2>&1; then
  echo "sites-ui requires jq and FOXTERM_SITES_FILE_WIN."
  exit 1
fi

SITES_UNIX="$(cygpath -u "$SITES_FILE_WIN" 2>/dev/null || true)"
if [[ -z "$SITES_UNIX" || ! -f "$SITES_UNIX" ]]; then
  echo "sites.json not found."
  exit 1
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

pick_category() {
  local -a args=()
  local id name blurb count i

  count="$(jq '.categories | length' "$SITES_UNIX" 2>/dev/null || echo 0)"
  if [[ "$count" -eq 0 ]]; then
    return 1
  fi

  for ((i = 0; i < count; i++)); do
    id="$(jq -r ".categories[$i].id" "$SITES_UNIX")"
    name="$(jq -r ".categories[$i].name" "$SITES_UNIX")"
    blurb="$(jq -r ".categories[$i].blurb" "$SITES_UNIX")"
    args+=("$id" "$name — $blurb")
  done

  dialog --stdout --no-shadow --mouse \
    --backtitle "FoxTerminal | Fox Hub" \
    --title " [ Категорії ] " \
    --menu "Обери розділ   Esc: exit" \
    16 72 8 \
    "${args[@]}"
}

pick_site() {
  local cat_id="$1"
  local -a args=()
  local id name desc count i idx

  count="$(jq --arg c "$cat_id" '[.categories[] | select(.id == $c) | .sites[]] | length' "$SITES_UNIX" 2>/dev/null || echo 0)"
  if [[ "$count" -eq 0 ]]; then
    return 1
  fi

  idx="$(jq --arg c "$cat_id" '[.categories[] | select(.id == $c)] | .[0].sites | to_entries[] | .key' "$SITES_UNIX" | head -1 | tr -d '\r')"

  for ((i = 0; i < count; i++)); do
    id="$(jq -r --arg c "$cat_id" --argjson n "$i" '.categories[] | select(.id == $c) | .sites[$n].id' "$SITES_UNIX")"
    name="$(jq -r --arg c "$cat_id" --argjson n "$i" '.categories[] | select(.id == $c) | .sites[$n].name' "$SITES_UNIX")"
    desc="$(jq -r --arg c "$cat_id" --argjson n "$i" '.categories[] | select(.id == $c) | .sites[$n].description' "$SITES_UNIX")"
    args+=("$id" "$name — $desc")
  done

  dialog --stdout --no-shadow --mouse \
    --backtitle "FoxTerminal | Fox Hub" \
    --title " [ $(jq -r --arg c "$cat_id" '.categories[] | select(.id == $c) | .name' "$SITES_UNIX") ] " \
    --menu "Enter: open   Esc: back" \
    18 78 10 \
    "${args[@]}"
}

resolve_site_url() {
  local cat_id="$1"
  local site_id="$2"
  jq -r --arg c "$cat_id" --arg s "$site_id" \
    '.categories[] | select(.id == $c) | .sites[] | select(.id == $s) | .url' \
    "$SITES_UNIX" 2>/dev/null
}

while true; do
  cat_choice="$(pick_category)"
  status=$?
  [[ $status -ne 0 ]] && exit 0

  while true; do
    site_choice="$(pick_site "$cat_choice")"
    status=$?
    [[ $status -ne 0 ]] && break

    url="$(resolve_site_url "$cat_choice" "$site_choice")"
    [[ -n "$url" && "$url" != "null" ]] && open_url "$url"
  done
done
