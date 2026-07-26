#!/usr/bin/env bash

set -uo pipefail

URL_YOUTUBE="https://www.youtube.com/"
THEME_NAME="orange"
ACCENT_HEX="#DC7A14"
BASE_BG_HEX="#0B0F1A"
TEXT_HEX="#E6E6E6"
PANEL_HEX="#131C30"
DLG_BORDER_COLOR="BLUE"
DLG_TITLE_COLOR="WHITE"
DLG_TAG_COLOR="CYAN"
DLG_SELECTED_BG="BLUE"
THEME_HINT="Classic Fox look"

move_to() {
  local row=$1
  local col=$2
  printf '\e[%d;%dH' "$row" "$col"
}

hex_to_rgb() {
  local hex=${1#\#}
  printf "%d %d %d" "0x${hex:0:2}" "0x${hex:2:2}" "0x${hex:4:2}"
}

read_theme_line() {
  local file="$1"
  local line=""
  if [[ -f "$file" ]]; then
    IFS= read -r line < "$file" || true
  fi
  line="${line#$'\357\273\277'}"
  line="${line//$'\ufeff'/}"
  line="${line//$'\r'/}"
  printf "%s" "${line,,}"
}

read_theme() {
  local theme_file=""
  if [[ -n "${FOXTERM_THEME_FILE:-}" && -f "${FOXTERM_THEME_FILE}" ]]; then
    theme_file="${FOXTERM_THEME_FILE}"
  elif [[ -n "${FOXTERM_CMD_PATH_UNIX:-}" && -f "${FOXTERM_CMD_PATH_UNIX}/theme.txt" ]]; then
    theme_file="${FOXTERM_CMD_PATH_UNIX}/theme.txt"
  elif [[ -n "${FOXTERM_CMD_PATH_WIN:-}" ]]; then
    local try_unix
    try_unix=$(cygpath -u "${FOXTERM_CMD_PATH_WIN}\\theme.txt" 2>/dev/null || true)
    if [[ -n "$try_unix" && -f "$try_unix" ]]; then
      theme_file="$try_unix"
    fi
  fi

  THEME_NAME="orange"
  ACCENT_HEX="#DC7A14"
  BASE_BG_HEX="#0B0F1A"
  TEXT_HEX="#E6E6E6"
  PANEL_HEX="#131C30"
  DLG_BORDER_COLOR="YELLOW"
  DLG_TITLE_COLOR="WHITE"
  DLG_TAG_COLOR="YELLOW"
  DLG_SELECTED_BG="YELLOW"
  THEME_HINT="Classic Fox look"

  if [[ -n "$theme_file" ]]; then
    THEME_NAME="$(read_theme_line "$theme_file")"
    [[ -z "$THEME_NAME" ]] && THEME_NAME="orange"
  fi

  case "$THEME_NAME" in
    blue) ACCENT_HEX="#5A8CFF"; PANEL_HEX="#122038"; DLG_BORDER_COLOR="BLUE"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="BLUE"; THEME_HINT="Blue frost" ;;
    purple|violet|indigo) ACCENT_HEX="#8356E6"; PANEL_HEX="#1A1530"; DLG_BORDER_COLOR="MAGENTA"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="MAGENTA"; THEME_HINT="Violet pulse" ;;
    cyan|sky|ice) ACCENT_HEX="#6FC4F0"; PANEL_HEX="#102431"; DLG_BORDER_COLOR="CYAN"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="CYAN"; THEME_HINT="Ice stream" ;;
    teal|mint|emerald|forest) ACCENT_HEX="#4CB874"; PANEL_HEX="#10261A"; DLG_BORDER_COLOR="GREEN"; DLG_TAG_COLOR="GREEN"; DLG_SELECTED_BG="GREEN"; THEME_HINT="Forest terminal" ;;
    crimson|ruby|rose|coral|dnote) ACCENT_HEX="#C83B5C"; BASE_BG_HEX="#100B10"; PANEL_HEX="#2A1219"; DLG_BORDER_COLOR="RED"; DLG_TAG_COLOR="YELLOW"; DLG_SELECTED_BG="RED"; THEME_HINT="Red shadow" ;;
    lime|neon) ACCENT_HEX="#9BD94A"; PANEL_HEX="#152610"; DLG_BORDER_COLOR="GREEN"; DLG_TAG_COLOR="YELLOW"; DLG_SELECTED_BG="GREEN"; THEME_HINT="Neon glow" ;;
    amber|gold|peach|mocha|orange) ACCENT_HEX="#DC7A14"; PANEL_HEX="#2A1A11"; DLG_BORDER_COLOR="YELLOW"; DLG_TAG_COLOR="YELLOW"; DLG_SELECTED_BG="YELLOW"; THEME_HINT="Classic Fox look" ;;
    black) ACCENT_HEX="#5F6B7A"; BASE_BG_HEX="#080A0D"; TEXT_HEX="#D0D6DE"; PANEL_HEX="#13181E"; DLG_BORDER_COLOR="WHITE"; DLG_TAG_COLOR="WHITE"; DLG_SELECTED_BG="BLUE"; THEME_HINT="Steel dark" ;;
    white) ACCENT_HEX="#A0B4D8"; BASE_BG_HEX="#12161F"; TEXT_HEX="#E8EDF7"; PANEL_HEX="#1A2332"; DLG_BORDER_COLOR="BLUE"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="BLUE"; THEME_HINT="Polar clean" ;;
    slate) ACCENT_HEX="#7D93B0"; BASE_BG_HEX="#0C1422"; TEXT_HEX="#D9E4F5"; PANEL_HEX="#17243B"; DLG_BORDER_COLOR="BLUE"; DLG_TAG_COLOR="WHITE"; DLG_SELECTED_BG="BLUE"; THEME_HINT="Slate calm" ;;
    arthas-dark) ACCENT_HEX="#58B8FF"; BASE_BG_HEX="#060A12"; TEXT_HEX="#D7F1FF"; PANEL_HEX="#102033"; DLG_BORDER_COLOR="CYAN"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="CYAN"; THEME_HINT="Arthas dark" ;;
    arthas-light) ACCENT_HEX="#E8C36A"; BASE_BG_HEX="#120F07"; TEXT_HEX="#FFF1D0"; PANEL_HEX="#2A2011"; DLG_BORDER_COLOR="YELLOW"; DLG_TAG_COLOR="YELLOW"; DLG_SELECTED_BG="YELLOW"; THEME_HINT="Arthas light" ;;
    pride) ACCENT_HEX="#D44BBD"; BASE_BG_HEX="#0E0B16"; TEXT_HEX="#F2E9FF"; PANEL_HEX="#211133"; DLG_BORDER_COLOR="MAGENTA"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="MAGENTA"; THEME_HINT="Pride mode" ;;
    noir)
      ACCENT_HEX="#909090"
      BASE_BG_HEX="#0A0A0A"
      TEXT_HEX="#D8D8D8"
      PANEL_HEX="#111111"
      DLG_BORDER_COLOR="WHITE"
      DLG_TITLE_COLOR="WHITE"
      DLG_TAG_COLOR="WHITE"
      DLG_SELECTED_BG="WHITE"
      THEME_HINT="Monochrome noir"
      ;;
    *) ;;
  esac
}

apply_terminal_theme() {
  # Sync mintty colors to FoxTerminal palette (close to Windows Terminal look).
  printf '\e]10;%s\a' "$TEXT_HEX"   # foreground
  printf '\e]11;%s\a' "$BASE_BG_HEX" # background
  printf '\e]12;%s\a' "$ACCENT_HEX"  # cursor
}

paint_bg() {
  local cols lines y r g b blend lift
  local base_r base_g base_b acc_r acc_g acc_b
  cols=$(tput cols 2>/dev/null || echo 80)
  lines=$(tput lines 2>/dev/null || echo 24)
  read -r base_r base_g base_b <<< "$(hex_to_rgb "$BASE_BG_HEX")"
  read -r acc_r acc_g acc_b <<< "$(hex_to_rgb "$ACCENT_HEX")"
  for ((y=1; y<=lines; y++)); do
    if [[ "$THEME_NAME" == "noir" ]]; then
      r=$((base_r + (y * 14 / (lines + 1))))
      g=$r
      b=$r
    else
      blend=$((8 + (y * 16 / (lines + 1))))
      r=$(( (base_r * (100 - blend) + acc_r * blend) / 100 ))
      g=$(( (base_g * (100 - blend) + acc_g * blend) / 100 ))
      b=$(( (base_b * (100 - blend) + acc_b * blend) / 100 ))
      lift=$((y * 4 / (lines + 1)))
      ((r+=lift, g+=lift, b+=lift))
      ((r>255)) && r=255
      ((g>255)) && g=255
      ((b>255)) && b=255
    fi
    move_to "$y" 1
    printf '\e[48;2;%d;%d;%dm' "$r" "$g" "$b"
    printf "%*s" "$cols" ""
    printf '\e[0m'
  done
}

draw_frame() {
  local cols lines x ar ag ab
  cols=$(tput cols 2>/dev/null || echo 80)
  lines=$(tput lines 2>/dev/null || echo 24)
  read -r ar ag ab <<< "$(hex_to_rgb "$ACCENT_HEX")"
  printf '\e[38;2;%d;%d;%dm' "$ar" "$ag" "$ab"
  move_to 1 1; printf "+"
  for ((x=2; x<cols; x++)); do printf "-"; done
  printf "+"
  if ((lines > 2)); then
    for ((x=2; x<lines; x++)); do
      move_to "$x" 1; printf "|"
      move_to "$x" "$cols"; printf "|"
    done
  fi
  move_to "$lines" 1; printf "+"
  for ((x=2; x<cols; x++)); do printf "-"; done
  printf "+"
  printf '\e[0m'
}

draw_header() {
  local cols center ar ag ab
  cols=$(tput cols 2>/dev/null || echo 80)
  center=$(( (cols - 52) / 2 ))
  ((center < 2)) && center=2
  read -r ar ag ab <<< "$(hex_to_rgb "$ACCENT_HEX")"
  move_to 2 "$center"
  printf '\e[1;38;2;%d;%d;%dmFOXTERMINAL :: INTERFACE MODE\e[0m' "$ar" "$ag" "$ab"
  move_to 3 "$center"
  printf '\e[38;2;%d;%d;%dmtheme: %s  ·  %s\e[0m' "$ar" "$ag" "$ab" "$THEME_NAME" "$THEME_HINT"
}

draw_youtube_ascii_logo() {
  local cols left pr pg pb tr tg tb
  cols=$(tput cols 2>/dev/null || echo 80)
  left=$(( (cols - 44) / 2 ))
  ((left < 3)) && left=3
  read -r pr pg pb <<< "$(hex_to_rgb "$PANEL_HEX")"
  read -r tr tg tb <<< "$(hex_to_rgb "$TEXT_HEX")"

  move_to 6 "$left";  printf '\e[38;2;%d;%d;%dm############################################\e[0m' "$pr" "$pg" "$pb"
  move_to 7 "$left";  printf '\e[38;2;%d;%d;%dm##\e[0m\e[38;2;%d;%d;%dm            APPS QUICK PANEL            \e[0m\e[38;2;%d;%d;%dm##\e[0m' "$pr" "$pg" "$pb" "$tr" "$tg" "$tb" "$pr" "$pg" "$pb"
  move_to 8 "$left";  printf '\e[38;2;%d;%d;%dm##\e[0m\e[38;2;%d;%d;%dm  bind -> add alias for url/exe/script  \e[0m\e[38;2;%d;%d;%dm##\e[0m' "$pr" "$pg" "$pb" "$tr" "$tg" "$tb" "$pr" "$pg" "$pb"
  move_to 9 "$left";  printf '\e[38;2;%d;%d;%dm##\e[0m\e[38;2;%d;%d;%dm  youtube -> instant browser launch      \e[0m\e[38;2;%d;%d;%dm##\e[0m' "$pr" "$pg" "$pb" "$tr" "$tg" "$tb" "$pr" "$pg" "$pb"
  move_to 10 "$left"; printf '\e[38;2;%d;%d;%dm############################################\e[0m' "$pr" "$pg" "$pb"
}

draw_footer() {
  local lines
  lines=$(tput lines 2>/dev/null || echo 24)
  move_to $((lines - 1)) 3
  if [[ "$THEME_NAME" == "noir" ]]; then
    printf '\e[38;2;110;110;110mLeft pane = console, Right pane = app launcher (theme auto-sync)\e[0m'
  else
    printf '\e[38;2;160;180;220mLeft pane = console, Right pane = app launcher (theme auto-sync)\e[0m'
  fi
}

render_scene() {
  printf '\e[?25l'
  clear
  paint_bg
  draw_frame
  draw_header
  draw_youtube_ascii_logo
  draw_footer
}

open_youtube_via_repo() {
  local cmd_win bat_win ps1_win
  cmd_win=""
  bat_win=""
  ps1_win=""
  if [[ -n "${FOXTERM_CMD_PATH_UNIX:-}" ]]; then
    bat_win=$(cygpath -w "${FOXTERM_CMD_PATH_UNIX}/youtube.bat" 2>/dev/null || true)
    ps1_win=$(cygpath -w "${FOXTERM_CMD_PATH_UNIX}/youtube.ps1" 2>/dev/null || true)
    cmd_win=$(cygpath -w "${FOXTERM_CMD_PATH_UNIX}" 2>/dev/null || true)
  fi
  if [[ -n "${FOXTERM_CMD_PATH_WIN:-}" ]]; then
    [[ -z "$bat_win" ]] && bat_win="${FOXTERM_CMD_PATH_WIN}\\youtube.bat"
    [[ -z "$ps1_win" ]] && ps1_win="${FOXTERM_CMD_PATH_WIN}\\youtube.ps1"
    cmd_win="${FOXTERM_CMD_PATH_WIN}"
  fi
  if [[ -n "$bat_win" && -f "$(cygpath -u "$bat_win" 2>/dev/null || echo /nope)" && -n "$cmd_win" ]]; then
    cmd.exe /c "cd /d \"$cmd_win\" && call \"$bat_win\""
    return $?
  fi
  if [[ -n "$ps1_win" && -f "$(cygpath -u "$ps1_win" 2>/dev/null || echo /nope)" ]]; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ps1_win"
    return $?
  fi
  return 1
}

open_youtube() {
  local ok=1
  local ps_foreground='
    $url = "https://www.youtube.com/"
    $firefox = @(
      "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
      "$env:ProgramFiles(x86)\Mozilla Firefox\firefox.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($firefox) {
      Start-Process -FilePath $firefox -ArgumentList @("-new-tab", $url) | Out-Null
      Start-Sleep -Milliseconds 500
      try { (New-Object -ComObject WScript.Shell).AppActivate("Firefox") | Out-Null } catch {}
      exit 0
    }
    Start-Process $url | Out-Null
    Start-Sleep -Milliseconds 500
    try {
      $w = New-Object -ComObject WScript.Shell
      $null = $w.AppActivate("YouTube")
      $null = $w.AppActivate("Chrome")
      $null = $w.AppActivate("Edge")
      $null = $w.AppActivate("Firefox")
    } catch {}
  '
  if command -v youtube >/dev/null 2>&1; then
    youtube && return 0
  fi
  if open_youtube_via_repo; then
    return 0
  fi
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ps_foreground" && ok=0 || true
  if [[ $ok -eq 0 ]]; then return 0; fi
  explorer.exe "$URL_YOUTUBE" && return 0 || true
  cmd.exe /c start "" "$URL_YOUTUBE" && return 0 || true
  return 1
}

get_appbind_script_win() {
  local appbind_win=""
  if [[ -n "${FOXTERM_CMD_PATH_UNIX:-}" ]]; then
    appbind_win=$(cygpath -w "${FOXTERM_CMD_PATH_UNIX}/appbind.ps1" 2>/dev/null || true)
  fi
  if [[ -z "$appbind_win" && -n "${FOXTERM_CMD_PATH_WIN:-}" ]]; then
    appbind_win="${FOXTERM_CMD_PATH_WIN}\\appbind.ps1"
  fi
  printf "%s" "$appbind_win"
}

get_apps_script_win() {
  local apps_win=""
  if [[ -n "${FOXTERM_CMD_PATH_UNIX:-}" ]]; then
    apps_win=$(cygpath -w "${FOXTERM_CMD_PATH_UNIX}/apps.ps1" 2>/dev/null || true)
  fi
  if [[ -z "$apps_win" && -n "${FOXTERM_CMD_PATH_WIN:-}" ]]; then
    apps_win="${FOXTERM_CMD_PATH_WIN}\\apps.ps1"
  fi
  printf "%s" "$apps_win"
}

get_bind_rows() {
  local appbind_ps1 rows_raw line
  appbind_ps1="$(get_appbind_script_win)"
  if [[ -z "$appbind_ps1" ]]; then
    return 0
  fi
  rows_raw=$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$appbind_ps1" menu 2>/dev/null || true)
  while IFS= read -r line; do
    line="${line//$'\r'/}"
    [[ -z "$line" ]] && continue
    printf "%s\n" "$line"
  done <<< "$rows_raw"
}

is_bind_choice() {
  local name="$1"
  local i
  for i in "${!bind_names[@]}"; do
    if [[ "${bind_names[$i]}" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

open_bind_dialog() {
  local form_out status name target desc appbind_ps1 output
  form_out=$(
    dialog --stdout --colors --no-shadow --no-collapse \
      --title " Add bind " \
      --form "Create app alias for apps command.\nUse URL (https://...) or exe/script path." \
      15 72 0 \
      "Name:" 1 1 "" 1 18 46 0 \
      "Link/Path:" 2 1 "" 2 18 46 0 \
      "Description:" 3 1 "" 3 18 46 0
  )
  status=$?
  if [[ $status -ne 0 ]]; then
    return 0
  fi

  mapfile -t __bind_fields <<< "$form_out"
  name="${__bind_fields[0]:-}"
  target="${__bind_fields[1]:-}"
  desc="${__bind_fields[2]:-}"
  name="${name//$'\r'/}"
  target="${target//$'\r'/}"
  desc="${desc//$'\r'/}"

  if [[ -z "$name" || -z "$target" ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nName and Link/Path are required.\n" 8 46 >/dev/null
    return 0
  fi

  appbind_ps1="$(get_appbind_script_win)"
  if [[ -z "$appbind_ps1" ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nCannot resolve appbind.ps1 path.\n" 8 46 >/dev/null
    return 1
  fi

  output=$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$appbind_ps1" add "$name" "$target" --desc "$desc" 2>&1)
  status=$?
  if [[ $status -ne 0 ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nFailed to save bind:\n$output\n" 12 70 >/dev/null
    return 1
  fi

  dialog --stdout --title " Bind saved " \
    --msgbox "\nSaved alias: $name\nTarget: $target\n\nUse in console:\n  apps $name\n" 12 58 >/dev/null
  return 0
}

open_unbind_dialog() {
  local appbind_ps1 choice status output
  local local_names=()
  local local_descs=()
  local line name desc
  while IFS=$'\t' read -r name desc; do
    [[ -z "$name" ]] && continue
    local_names+=("$name")
    local_descs+=("$desc")
  done < <(get_bind_rows)

  if [[ ${#local_names[@]} -eq 0 ]]; then
    dialog --stdout --title " Delete bind " --msgbox "\nNo binds to delete yet.\n" 8 40 >/dev/null
    return 0
  fi

  local menu_args=()
  local i
  for i in "${!local_names[@]}"; do
    menu_args+=("${local_names[$i]}" "${local_descs[$i]}")
  done

  choice=$(
    dialog --stdout --colors --no-shadow --no-collapse \
      --title " Delete bind " \
      --menu "Select bind to delete" \
      16 64 8 \
      "${menu_args[@]}"
  )
  status=$?
  if [[ $status -ne 0 || -z "$choice" ]]; then
    return 0
  fi

  dialog --stdout --title " Confirm delete " \
    --yesno "\nDelete bind '$choice'?\n" 8 44
  status=$?
  if [[ $status -ne 0 ]]; then
    return 0
  fi

  appbind_ps1="$(get_appbind_script_win)"
  if [[ -z "$appbind_ps1" ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nCannot resolve appbind.ps1 path.\n" 8 46 >/dev/null
    return 1
  fi

  output=$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$appbind_ps1" del "$choice" 2>&1)
  status=$?
  if [[ $status -ne 0 ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nFailed to delete bind:\n$output\n" 12 70 >/dev/null
    return 1
  fi

  dialog --stdout --title " Bind removed " --msgbox "\nDeleted bind: $choice\n" 8 38 >/dev/null
  return 0
}

open_edit_bind_dialog() {
  local choice status appbind_ps1 fields target desc form_out output
  local local_names=()
  local local_descs=()
  local line name row_desc

  while IFS=$'\t' read -r name row_desc; do
    [[ -z "$name" ]] && continue
    local_names+=("$name")
    local_descs+=("$row_desc")
  done < <(get_bind_rows)

  if [[ ${#local_names[@]} -eq 0 ]]; then
    dialog --stdout --title " Edit bind " --msgbox "\nNo binds to edit yet.\n" 8 40 >/dev/null
    return 0
  fi

  local menu_args=()
  local i
  for i in "${!local_names[@]}"; do
    menu_args+=("${local_names[$i]}" "${local_descs[$i]}")
  done

  choice=$(
    dialog --stdout --colors --no-shadow --no-collapse \
      --title " Edit bind " \
      --menu "Select bind to edit" \
      16 64 8 \
      "${menu_args[@]}"
  )
  status=$?
  if [[ $status -ne 0 || -z "$choice" ]]; then
    return 0
  fi

  appbind_ps1="$(get_appbind_script_win)"
  if [[ -z "$appbind_ps1" ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nCannot resolve appbind.ps1 path.\n" 8 46 >/dev/null
    return 1
  fi

  fields=$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$appbind_ps1" get-fields "$choice" 2>/dev/null || true)
  IFS=$'\t' read -r _name target desc <<< "$fields"
  target="${target//$'\r'/}"
  desc="${desc//$'\r'/}"

  form_out=$(
    dialog --stdout --colors --no-shadow --no-collapse \
      --title " Edit bind: $choice " \
      --form "Update target and description for selected bind." \
      14 72 0 \
      "Link/Path:" 1 1 "$target" 1 18 46 0 \
      "Description:" 2 1 "$desc" 2 18 46 0
  )
  status=$?
  if [[ $status -ne 0 ]]; then
    return 0
  fi

  mapfile -t __edit_fields <<< "$form_out"
  target="${__edit_fields[0]:-}"
  desc="${__edit_fields[1]:-}"
  target="${target//$'\r'/}"
  desc="${desc//$'\r'/}"

  if [[ -z "$target" ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nLink/Path is required.\n" 8 40 >/dev/null
    return 0
  fi

  output=$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$appbind_ps1" edit "$choice" "$target" --desc "$desc" 2>&1)
  status=$?
  if [[ $status -ne 0 ]]; then
    dialog --stdout --title " Bind error " --msgbox "\nFailed to update bind:\n$output\n" 12 70 >/dev/null
    return 1
  fi

  dialog --stdout --title " Bind updated " --msgbox "\nUpdated bind: $choice\n" 8 40 >/dev/null
  return 0
}

run_bound_alias() {
  local name="$1"
  local apps_ps1 output status
  apps_ps1="$(get_apps_script_win)"
  if [[ -z "$apps_ps1" ]]; then
    dialog --stdout --title " Run bind error " --msgbox "\nCannot resolve apps.ps1 path.\n" 8 44 >/dev/null
    return 1
  fi

  output=$(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$apps_ps1" "$name" 2>&1)
  status=$?
  if [[ $status -ne 0 ]]; then
    dialog --stdout --title " Run bind error " --msgbox "\nBind '$name' failed:\n$output\n" 14 72 >/dev/null
    return 1
  fi
  return 0
}

if ! command -v dialog >/dev/null 2>&1; then
  clear
  echo "ncurses UI needs 'dialog' (ncurses frontend)."
  echo "Install package: dialog"
  echo
  echo "Fallback: press Enter to open YouTube, q to exit."
  while true; do
    IFS= read -rsn1 key || true
    case "$key" in
      q|Q) exit 0 ;;
      "") open_youtube; exit 0 ;;
    esac
  done
fi

write_dialog_rc() {
  tmp_rc="${TMPDIR:-/tmp}/foxterm-dialogrc-$$"
  if [[ "$THEME_NAME" == "noir" ]]; then
    cat > "$tmp_rc" <<'EOF'
use_colors = ON
use_shadow = OFF
screen_color = (WHITE,BLACK,OFF)
dialog_color = (WHITE,BLACK,OFF)
title_color = (WHITE,BLACK,ON)
border_color = (WHITE,BLACK,ON)
button_active_color = (BLACK,WHITE,ON)
button_inactive_color = (WHITE,BLACK,OFF)
item_color = (WHITE,BLACK,OFF)
item_selected_color = (BLACK,WHITE,ON)
tag_color = (WHITE,BLACK,ON)
tag_selected_color = (BLACK,WHITE,ON)
tag_key_color = (WHITE,BLACK,OFF)
tag_key_selected_color = (BLACK,WHITE,ON)
button_label_active_color = (BLACK,WHITE,ON)
button_label_inactive_color = (WHITE,BLACK,OFF)
check_color = (WHITE,BLACK,OFF)
check_selected_color = (BLACK,WHITE,ON)
entry_color = (WHITE,BLACK,OFF)
inputbox_color = (WHITE,BLACK,OFF)
inputbox_border_color = (WHITE,BLACK,ON)
searchbox_color = (WHITE,BLACK,OFF)
searchbox_title_color = (WHITE,BLACK,ON)
searchbox_border_color = (WHITE,BLACK,ON)
menubox_border_color = (WHITE,BLACK,ON)
menubox_color = (WHITE,BLACK,OFF)
msgbox_color = (WHITE,BLACK,OFF)
textbox_color = (WHITE,BLACK,OFF)
EOF
  else
    cat > "$tmp_rc" <<'EOF'
use_colors = ON
use_shadow = OFF
screen_color = (WHITE,BLACK,OFF)
dialog_color = (WHITE,BLACK,OFF)
title_color = (__TITLE__,BLACK,ON)
border_color = (__BORDER__,BLACK,ON)
button_active_color = (WHITE,__SELBG__,ON)
button_inactive_color = (WHITE,BLACK,OFF)
item_color = (WHITE,BLACK,OFF)
item_selected_color = (WHITE,__SELBG__,ON)
tag_color = (__TAG__,BLACK,ON)
tag_selected_color = (WHITE,__SELBG__,ON)
tag_key_color = (__TAG__,BLACK,ON)
tag_key_selected_color = (WHITE,__SELBG__,ON)
button_label_active_color = (WHITE,__SELBG__,ON)
button_label_inactive_color = (WHITE,BLACK,OFF)
menubox_border_color = (__BORDER__,BLACK,ON)
menubox_color = (WHITE,BLACK,OFF)
EOF
    sed -i \
      -e "s/__TITLE__/$DLG_TITLE_COLOR/g" \
      -e "s/__BORDER__/$DLG_BORDER_COLOR/g" \
      -e "s/__TAG__/$DLG_TAG_COLOR/g" \
      -e "s/__SELBG__/$DLG_SELECTED_BG/g" \
      "$tmp_rc" 2>/dev/null || true
  fi
  export DIALOGRC="$tmp_rc"
}

read_theme
apply_terminal_theme
write_dialog_rc
trap 'rm -f "${TMPDIR:-/tmp}/foxterm-dialogrc-$$" >/dev/null 2>&1 || true; printf "\e[?25h"; clear' EXIT

while true; do
  read_theme
  apply_terminal_theme
  write_dialog_rc
  render_scene
  bind_names=()
  bind_descs=()
  while IFS=$'\t' read -r bname bdesc; do
    [[ -z "$bname" ]] && continue
    bind_names+=("$bname")
    bind_descs+=("$bdesc")
  done < <(get_bind_rows)
  menu_items=(
    bind "Add app/site bind (name + link/path)"
    editbind "Edit existing bind"
    unbind "Delete existing bind"
  )
  for i in "${!bind_names[@]}"; do
    menu_items+=("${bind_names[$i]}" "${bind_descs[$i]}")
  done
  menu_items+=(
    youtube "Open YouTube (fast launch)"
    check "Check deps (tmux/dialog)"
    redraw "Redraw UI with current theme"
    exit "Close this UI pane"
  )

  choice=$(
    dialog --stdout --colors --no-shadow --mouse --no-collapse \
      --backtitle "FoxTerminal | Theme: $THEME_NAME" \
      --title " Apps " \
      --default-item bind \
      --menu "Select action" \
      18 66 10 \
      "${menu_items[@]}"
  )
  status=$?

  if [[ $status -ne 0 ]]; then
    exit 0
  fi

  case "$choice" in
    bind)
      open_bind_dialog
      ;;
    editbind)
      open_edit_bind_dialog
      ;;
    unbind)
      open_unbind_dialog
      ;;
    youtube)
      if ! open_youtube; then
        dialog --stdout --title " Launch error " --msgbox "\nCould not open YouTube automatically.\n\nTry in left pane:\n  youtube\n  cmd.exe /c start \"\" \"$URL_YOUTUBE\"\n" 10 60 >/dev/null
      fi
      ;;
    check)
      if [[ -n "${FOXTERM_CMD_PATH_UNIX:-}" ]]; then
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "${FOXTERM_CMD_PATH_UNIX}/interface-deps.ps1")" -Check
      else
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$FOXTERM_CMD_PATH_WIN\\interface-deps.ps1" -Check
      fi
      ;;
    redraw)
      read_theme
      apply_terminal_theme
      write_dialog_rc
      ;;
    exit)
      exit 0
      ;;
    *)
      if is_bind_choice "$choice"; then
        run_bound_alias "$choice"
      fi
      ;;
  esac
done
