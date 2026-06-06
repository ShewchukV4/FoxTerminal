#!/usr/bin/env bash

# Optional user bash profile first.
if [ -f "$HOME/.bashrc" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.bashrc"
fi

export FOXTERM=1

# FOXTERM_CMD_PATH_UNIX is injected by term.ps1 launcher.
if [ -n "${FOXTERM_CMD_PATH_UNIX:-}" ] && [ -d "$FOXTERM_CMD_PATH_UNIX" ]; then
  export PATH="$FOXTERM_CMD_PATH_UNIX:$PATH"
fi

# Ensure core Unix tools are always available in PATH (tr/head/date/etc.).
for __fox_core_dir in /usr/bin /bin /usr/local/bin; do
  if [ -d "$__fox_core_dir" ] && [[ ":$PATH:" != *":$__fox_core_dir:"* ]]; then
    PATH="$__fox_core_dir:$PATH"
  fi
done
export PATH

# If Windows path was not injected, derive it from UNIX path.
if [ -z "${FOXTERM_CMD_PATH_WIN:-}" ] && [ -n "${FOXTERM_CMD_PATH_UNIX:-}" ]; then
  __fox_win_path_guess="$(cygpath -w "$FOXTERM_CMD_PATH_UNIX" 2>/dev/null || true)"
  if [ -n "$__fox_win_path_guess" ]; then
    export FOXTERM_CMD_PATH_WIN="$__fox_win_path_guess"
  fi
fi

# Force UTF-8 locale for proper Cyrillic input/output in readline.
if [ -z "${LANG:-}" ] || [ "${LANG#*UTF-8}" = "$LANG" ]; then
  export LANG=C.UTF-8
fi
export LC_ALL="${LC_ALL:-$LANG}"

# Prevent escaping non-ASCII characters as octal sequences (\260\320...).
bind "set input-meta on"
bind "set output-meta on"
bind "set convert-meta off"
bind "set enable-meta-key on"
bind "set meta-flag on"

__fox_theme_name="orange"
__fox_bg="#0B0F1A"
__fox_text="#E6E6E6"
__fox_accent="#DC7A14"
__fox_accent2="#F2953A"
__fox_accent3="#BD6610"
__fox_accent4="#FFB056"
__fox_sep=$'\uE0B0'

__fox_hex_to_rgb() {
  local hex=${1#\#}
  local r g b
  r=$((16#${hex:0:2}))
  g=$((16#${hex:2:2}))
  b=$((16#${hex:4:2}))
  printf "%d;%d;%d" "$r" "$g" "$b"
}

__fox_adjust_hex() {
  local hex=${1#\#}
  local num=$2
  local den=$3
  local r g b
  r=$((16#${hex:0:2} * num / den))
  g=$((16#${hex:2:2} * num / den))
  b=$((16#${hex:4:2} * num / den))
  ((r > 255)) && r=255
  ((g > 255)) && g=255
  ((b > 255)) && b=255
  ((r < 0)) && r=0
  ((g < 0)) && g=0
  ((b < 0)) && b=0
  printf "#%02X%02X%02X" "$r" "$g" "$b"
}

__fox_contrast_text() {
  local hex=${1#\#}
  local r g b luma
  r=$((16#${hex:0:2}))
  g=$((16#${hex:2:2}))
  b=$((16#${hex:4:2}))
  luma=$(( (2126 * r + 7152 * g + 722 * b) / 10000 ))
  if ((luma > 145)); then
    printf "#0B0F1A"
  else
    printf "#E6E6E6"
  fi
}

__fox_fg_code() {
  local rgb
  rgb=$(__fox_hex_to_rgb "$1")
  printf "\[\e[38;2;%sm\]" "$rgb"
}

__fox_bg_code() {
  local rgb
  rgb=$(__fox_hex_to_rgb "$1")
  printf "\[\e[48;2;%sm\]" "$rgb"
}

__fox_load_theme() {
  local theme_file=""
  if [ -n "${FOXTERM_CMD_PATH_UNIX:-}" ] && [ -f "$FOXTERM_CMD_PATH_UNIX/theme.txt" ]; then
    theme_file="$FOXTERM_CMD_PATH_UNIX/theme.txt"
  elif [ -n "${FOXTERM_CMD_PATH_WIN:-}" ]; then
    local candidate
    candidate="$(cygpath -u "$FOXTERM_CMD_PATH_WIN\\theme.txt" 2>/dev/null || true)"
    if [ -n "$candidate" ] && [ -f "$candidate" ]; then
      theme_file="$candidate"
    fi
  fi

  if [ -n "$theme_file" ]; then
    local __theme_line=""
    IFS= read -r __theme_line < "$theme_file" || true
    __theme_line="${__theme_line#$'\357\273\277'}"
    __theme_line="${__theme_line//$'\ufeff'/}"
    __theme_line="${__theme_line//$'\r'/}"
    __fox_theme_name="${__theme_line,,}"
  fi
  [ -z "$__fox_theme_name" ] && __fox_theme_name="orange"

  case "$__fox_theme_name" in
    blue) __fox_accent="#5A8CFF" ;;
    purple) __fox_accent="#A05AFF" ;;
    cyan) __fox_accent="#46DCC8" ;;
    crimson) __fox_accent="#D14A5A" ;;
    rose) __fox_accent="#E05A9A" ;;
    magenta) __fox_accent="#D44BBD" ;;
    violet) __fox_accent="#8356E6" ;;
    indigo) __fox_accent="#4E75D8" ;;
    sky) __fox_accent="#6FC4F0" ;;
    teal) __fox_accent="#36B8B3" ;;
    mint) __fox_accent="#6BD3B0" ;;
    emerald) __fox_accent="#4CB874" ;;
    lime) __fox_accent="#9BD94A" ;;
    gold) __fox_accent="#E0B148" ;;
    amber) __fox_accent="#E5943A" ;;
    peach) __fox_accent="#E7A37C" ;;
    coral) __fox_accent="#E07D69" ;;
    ruby) __fox_accent="#C83B5C" ;;
    slate) __fox_accent="#7D93B0" ;;
    ice) __fox_accent="#7CC8E8" ;;
    neon) __fox_accent="#7EF06B" ;;
    forest) __fox_accent="#4E8C66" ;;
    mocha) __fox_accent="#A17A5A" ;;
    black) __fox_accent="#4F5B6A" ;;
    white) __fox_accent="#CDD5E0" ;;
    *) __fox_accent="#DC7A14" ;;
  esac

  __fox_accent2="$(__fox_adjust_hex "$__fox_accent" 115 100)"
  __fox_accent3="$(__fox_adjust_hex "$__fox_accent" 85 100)"
  __fox_accent4="$(__fox_adjust_hex "$__fox_accent" 130 100)"
}

__fox_apply_terminal_colors() {
  # Keep mintty visuals aligned with FoxTerminal palette.
  printf '\e]10;%s\a' "$__fox_text"
  printf '\e]11;%s\a' "$__fox_bg"
  printf '\e]12;%s\a' "$__fox_accent"
}

__fox_git_branch() {
  local now
  printf -v now '%(%s)T' -1 2>/dev/null || now=0

  if [ "${__fox_git_cache_pwd:-}" = "$PWD" ] && [ -n "${__fox_git_cache_branch:-}" ]; then
    local age=$((now - ${__fox_git_cache_epoch:-0}))
    if (( age >= 0 && age < 2 )); then
      printf "%s" "$__fox_git_cache_branch"
      return
    fi
  fi

  local branch
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  __fox_git_cache_pwd="$PWD"
  __fox_git_cache_branch="$branch"
  __fox_git_cache_epoch="$now"
  printf "%s" "$branch"
}

__fox_segment() {
  local text=$1
  local bg=$2
  local next_bg=$3
  local fg sep
  fg="$(__fox_contrast_text "$bg")"
  sep="$__fox_sep"
  printf "%s%s %s %s%s%s%s%s%s" \
    "$(__fox_bg_code "$bg")" "$(__fox_fg_code "$fg")" "$text" \
    "$(__fox_bg_code "$next_bg")" "$(__fox_fg_code "$bg")" "$sep" \
    "\[\e[0m\]" "" ""
}

__fox_build_prompt() {
  local user branch time
  user="${FOXTERM_USER:-$USER}"
  branch="$(__fox_git_branch)"
  [ -z "$branch" ] && branch="shell"
  printf -v time '%(%H:%M)T' -1 2>/dev/null || time="--:--"

  local line1 line2
  line1="$(__fox_segment "FOXTERM" "$__fox_accent" "$__fox_accent2")"
  line1+="$(__fox_segment "$user" "$__fox_accent2" "$__fox_accent3")"
  line1+="$(__fox_segment "$branch" "$__fox_accent3" "$__fox_accent4")"
  line1+="$(__fox_segment "$time" "$__fox_accent4" "$__fox_bg")"
  line2="$(__fox_fg_code "$__fox_accent")>\[\e[0m\] "
  PS1="${line1}\n${line2}"
}

__fox_register_cmd_aliases() {
  if [ -z "${FOXTERM_CMD_PATH_UNIX:-}" ] || [ -z "${FOXTERM_CMD_PATH_WIN:-}" ]; then
    return
  fi

  __fox_bind_command() {
    local cmd_name=$1
    local body=$2
    if [[ "$cmd_name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
      eval "$cmd_name() { $body; }"
    else
      alias "$cmd_name=$body"
    fi
  }

  fox_run_ps1() {
    local n=$1
    shift || true
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$FOXTERM_CMD_PATH_WIN\\$n.ps1" "$@"
  }

  fox_run_bat() {
    local n=$1
    shift || true
    local bat_unix="$FOXTERM_CMD_PATH_UNIX/$n.bat"
    local bat_win
    bat_win="$(cygpath -w "$bat_unix" 2>/dev/null || true)"
    if [ -z "$bat_win" ]; then
      bat_win="$FOXTERM_CMD_PATH_WIN\\$n.bat"
    fi
    cmd.exe /c "$bat_win" "$@"
  }

  local file name
  for file in "$FOXTERM_CMD_PATH_UNIX"/*.ps1; do
    [ -f "$file" ] || continue
    name="${file##*/}"
    name="${name%.ps1}"
    case "$name" in
      foxauth|sw-script|interface-gui) continue ;;
    esac
    __fox_bind_command "$name" "fox_run_ps1 '$name' \"\$@\""
  done

  for file in "$FOXTERM_CMD_PATH_UNIX"/*.bat; do
    [ -f "$file" ] || continue
    name="${file##*/}"
    name="${name%.bat}"
    case "$name" in
      foxauth|sw-script|interface-gui) continue ;;
    esac
    if [ -f "$FOXTERM_CMD_PATH_UNIX/$name.ps1" ]; then
      continue
    fi
    __fox_bind_command "$name" "fox_run_bat '$name' \"\$@\""
  done

  # Common typo compatibility.
  sw() {
    fox_run_ps1 "sw-script" "$@"
    __fox_load_theme
    __fox_apply_terminal_colors
    __fox_build_prompt
  }
  iterface() { fox_run_ps1 "interface" "$@"; }
}

__fox_load_theme
__fox_apply_terminal_colors
__fox_register_cmd_aliases
PROMPT_COMMAND=__fox_build_prompt

chek() {
  local terminal="Unknown"
  local shell_name="bash"

  if [ "${TERM_PROGRAM:-}" = "mintty" ]; then
    terminal="mintty"
  elif [ -n "${TERM_PROGRAM:-}" ]; then
    terminal="$TERM_PROGRAM"
  elif [ -n "${WT_SESSION:-}" ]; then
    terminal="Windows Terminal"
  elif [ -n "${TERM:-}" ]; then
    terminal="$TERM"
  fi

  if [ -n "${MSYSTEM:-}" ]; then
    shell_name="MSYS2/Git Bash"
  elif [[ "${OSTYPE:-}" == cygwin* ]]; then
    shell_name="Cygwin Bash"
  fi

  printf "=== FoxTerminal Check ===\n"
  printf "Terminal: %s\n" "$terminal"
  printf "Shell:    %s\n\n" "$shell_name"
  printf "Signals:\n"
  printf "  WT_SESSION=%s\n" "${WT_SESSION:-<empty>}"
  printf "  TERM=%s\n" "${TERM:-<empty>}"
  printf "  TERM_PROGRAM=%s\n" "${TERM_PROGRAM:-<empty>}"
  printf "  OSTYPE=%s\n" "${OSTYPE:-<empty>}"
  printf "  MSYSTEM=%s\n" "${MSYSTEM:-<empty>}"
}

printf "FoxTerminal profile loaded for bash.\n\n"
