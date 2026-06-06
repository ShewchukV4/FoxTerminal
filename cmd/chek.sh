#!/usr/bin/env bash

terminal="Unknown"
shell_name="Unknown"

if [ -n "${WT_SESSION:-}" ]; then
  terminal="Windows Terminal"
elif [ -n "${TERM_PROGRAM:-}" ]; then
  terminal="$TERM_PROGRAM"
elif [ -n "${TERM:-}" ]; then
  terminal="$TERM"
fi

if [ -n "${MSYSTEM:-}" ]; then
  shell_name="MSYS2/Git Bash"
elif [[ "${OSTYPE:-}" == cygwin* ]]; then
  shell_name="Cygwin Bash"
elif [ -n "${BASH_VERSION:-}" ]; then
  shell_name="bash"
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
