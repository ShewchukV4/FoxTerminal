#!/usr/bin/env bash

terminal="Unknown (unsupported)"
shell_name="Unknown"
in_ghostty=0

if [ -n "${GHOSTTY_RESOURCES_DIR:-}" ] || [ -n "${GHOSTTY_BIN_DIR:-}" ]; then
  terminal="Ghostty"
  in_ghostty=1
elif printf '%s' "${TERM_PROGRAM:-}" | grep -qi ghostty; then
  terminal="Ghostty"
  in_ghostty=1
elif printf '%s' "${TERM:-}" | grep -qi ghostty; then
  terminal="Ghostty"
  in_ghostty=1
elif [ -n "${TERM_PROGRAM:-}" ]; then
  terminal="${TERM_PROGRAM} (unsupported)"
elif [ -n "${TERM:-}" ]; then
  terminal="${TERM} (unsupported)"
fi

if [ -n "${BASH_VERSION:-}" ]; then
  shell_name="bash ${BASH_VERSION}"
elif [ -n "${SHELL:-}" ]; then
  shell_name="${SHELL}"
fi

if command -v ghostty >/dev/null 2>&1; then
  host="ghostty -> $(command -v ghostty)"
elif command -v winghostty >/dev/null 2>&1; then
  host="winghostty -> $(command -v winghostty)"
else
  host="Ghostty not installed"
fi

printf "=== FoxTerminal Check ===\n"
printf "Terminal: %s\n" "$terminal"
printf "Shell:    %s\n" "$shell_name"
printf "Host:     %s\n\n" "$host"
printf "Signals:\n"
printf "  TERM=%s\n" "${TERM:-<empty>}"
printf "  TERM_PROGRAM=%s\n" "${TERM_PROGRAM:-<empty>}"
printf "  TERM_PROGRAM_VERSION=%s\n" "${TERM_PROGRAM_VERSION:-<empty>}"
printf "  COLORTERM=%s\n" "${COLORTERM:-<empty>}"
printf "  GHOSTTY_RESOURCES_DIR=%s\n" "${GHOSTTY_RESOURCES_DIR:-<empty>}"
printf "  FOXTERM=%s\n" "${FOXTERM:-<empty>}"
printf "  FOXTERM_HOST=%s\n\n" "${FOXTERM_HOST:-<empty>}"

if [ "$in_ghostty" -eq 1 ]; then
  printf "FoxTerminal is running in its supported terminal.\n"
else
  printf "FoxTerminal only supports Ghostty.\n"
  printf "Install it from https://ghostty.org/download, then run: bash FoxTerminal/install.sh\n"
fi
