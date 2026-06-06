#!/usr/bin/env bash

set -uo pipefail

URL_YOUTUBE="https://www.youtube.com/"
THEME_NAME="orange"
ACCENT_HEX="#DC7A14"
BASE_BG_HEX="#0B0F1A"
TEXT_HEX="#E6E6E6"
DLG_BORDER_COLOR="BLUE"
DLG_TITLE_COLOR="WHITE"
DLG_TAG_COLOR="CYAN"
DLG_SELECTED_BG="BLUE"

move_to() {
  local row=$1
  local col=$2
  printf '\e[%d;%dH' "$row" "$col"
}

hex_to_rgb() {
  local hex=${1#\#}
  printf "%d %d %d" "0x${hex:0:2}" "0x${hex:2:2}" "0x${hex:4:2}"
}

read_theme() {
  local theme_file=""
  if [[ -n "${FOXTERM_CMD_PATH_UNIX:-}" && -f "${FOXTERM_CMD_PATH_UNIX}/theme.txt" ]]; then
    theme_file="${FOXTERM_CMD_PATH_UNIX}/theme.txt"
  elif [[ -n "${FOXTERM_CMD_PATH_WIN:-}" ]]; then
    local try_unix
    try_unix=$(cygpath -u "${FOXTERM_CMD_PATH_WIN}\\theme.txt" 2>/dev/null || true)
    if [[ -n "$try_unix" && -f "$try_unix" ]]; then
      theme_file="$try_unix"
    fi
  fi

  if [[ -n "$theme_file" ]]; then
    THEME_NAME=$(tr -d '\r' < "$theme_file" | head -n1 | tr '[:upper:]' '[:lower:]')
    [[ -z "$THEME_NAME" ]] && THEME_NAME="orange"
  fi

  case "$THEME_NAME" in
    blue) ACCENT_HEX="#5A8CFF"; DLG_BORDER_COLOR="BLUE"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="BLUE" ;;
    purple|violet|indigo) ACCENT_HEX="#8356E6"; DLG_BORDER_COLOR="MAGENTA"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="MAGENTA" ;;
    cyan|sky|ice) ACCENT_HEX="#6FC4F0"; DLG_BORDER_COLOR="CYAN"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="CYAN" ;;
    teal|mint|emerald|forest) ACCENT_HEX="#4CB874"; DLG_BORDER_COLOR="GREEN"; DLG_TAG_COLOR="GREEN"; DLG_SELECTED_BG="GREEN" ;;
    crimson|ruby|rose|coral) ACCENT_HEX="#C83B5C"; DLG_BORDER_COLOR="RED"; DLG_TAG_COLOR="YELLOW"; DLG_SELECTED_BG="RED" ;;
    lime|neon) ACCENT_HEX="#9BD94A"; DLG_BORDER_COLOR="GREEN"; DLG_TAG_COLOR="YELLOW"; DLG_SELECTED_BG="GREEN" ;;
    amber|gold|peach|mocha|orange) ACCENT_HEX="#DC7A14"; DLG_BORDER_COLOR="YELLOW"; DLG_TAG_COLOR="YELLOW"; DLG_SELECTED_BG="YELLOW" ;;
    black) ACCENT_HEX="#5F6B7A"; DLG_BORDER_COLOR="WHITE"; DLG_TAG_COLOR="WHITE"; DLG_SELECTED_BG="BLUE" ;;
    white) ACCENT_HEX="#A0B4D8"; DLG_BORDER_COLOR="BLUE"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="BLUE" ;;
    *) ACCENT_HEX="#DC7A14"; DLG_BORDER_COLOR="BLUE"; DLG_TAG_COLOR="CYAN"; DLG_SELECTED_BG="BLUE" ;;
  esac
}

apply_terminal_theme() {
  # Sync mintty colors to FoxTerminal palette (close to Windows Terminal look).
  printf '\e]10;%s\a' "$TEXT_HEX"   # foreground
  printf '\e]11;%s\a' "$BASE_BG_HEX" # background
  printf '\e]12;%s\a' "$ACCENT_HEX"  # cursor
}

paint_bg() {
  local cols lines y r g b
  local base_r base_g base_b
  cols=$(tput cols 2>/dev/null || echo 80)
  lines=$(tput lines 2>/dev/null || echo 24)
  read -r base_r base_g base_b <<< "$(hex_to_rgb "$BASE_BG_HEX")"
  for ((y=1; y<=lines; y++)); do
    r=$((base_r + (y * 6 / (lines + 1))))
    g=$((base_g + (y * 8 / (lines + 1))))
    b=$((base_b + (y * 12 / (lines + 1))))
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
  center=$(( (cols - 36) / 2 ))
  ((center < 2)) && center=2
  read -r ar ag ab <<< "$(hex_to_rgb "$ACCENT_HEX")"
  move_to 2 "$center"
  printf '\e[1;38;2;%d;%d;%dmFOXTERMINAL :: INTERFACE MODE\e[0m' "$ar" "$ag" "$ab"
  move_to 3 "$center"
  printf '\e[38;2;160;200;240mclick or Enter to launch app\e[0m'
}

draw_youtube_ascii_logo() {
  local cols left
  cols=$(tput cols 2>/dev/null || echo 80)
  left=$(( (cols - 34) / 2 ))
  ((left < 3)) && left=3

  move_to 6 "$left";  printf '\e[38;2;230;50;45m##############################\e[0m'
  move_to 7 "$left";  printf '\e[38;2;230;50;45m##\e[0m\e[38;2;245;245;245m         Y O U T U B E        \e[0m\e[38;2;230;50;45m##\e[0m'
  move_to 8 "$left";  printf '\e[38;2;230;50;45m##\e[0m\e[38;2;245;245;245m            > PLAY <          \e[0m\e[38;2;230;50;45m##\e[0m'
  move_to 9 "$left";  printf '\e[38;2;230;50;45m##############################\e[0m'
}

draw_footer() {
  local lines
  lines=$(tput lines 2>/dev/null || echo 24)
  move_to $((lines - 1)) 3
  printf '\e[38;2;160;180;220mLeft pane = console, Right pane = app launcher\e[0m'
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

read_theme
apply_terminal_theme

tmp_rc="${TMPDIR:-/tmp}/foxterm-dialogrc-$$"
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
EOF
sed -i \
  -e "s/__TITLE__/$DLG_TITLE_COLOR/g" \
  -e "s/__BORDER__/$DLG_BORDER_COLOR/g" \
  -e "s/__TAG__/$DLG_TAG_COLOR/g" \
  -e "s/__SELBG__/$DLG_SELECTED_BG/g" \
  "$tmp_rc" 2>/dev/null || true
export DIALOGRC="$tmp_rc"
trap 'rm -f "$tmp_rc" >/dev/null 2>&1 || true; printf "\e[?25h"; clear' EXIT

while true; do
  render_scene
  choice=$(
    dialog --stdout --no-shadow --mouse --no-collapse \
      --backtitle "FoxTerminal | Theme: $THEME_NAME" \
      --title " Apps " \
      --default-item youtube \
      --menu "Select action" \
      12 46 4 \
      youtube "Open YouTube (fast launch)" \
      check "Check deps (tmux/dialog)" \
      redraw "Redraw UI with current theme" \
      exit "Close this UI pane"
  )
  status=$?

  if [[ $status -ne 0 ]]; then
    exit 0
  fi

  case "$choice" in
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
      ;;
    exit)
      exit 0
      ;;
  esac
done
