#!/usr/bin/env bash
# FoxTerminal shell bootstrap for Ghostty (Linux / macOS).
#
# Ghostty launches this via the generated foxterminal-local.ghostty:
#   command = bash --noprofile --rcfile <path>/foxterminal-boot.sh -i
#
# Because Ghostty owns the terminal, this file only wires up the FoxTerminal
# environment and then hands over to cmd/foxterm-bash-init.sh.

# Keep the user's normal interactive shell setup.
if [ -f /etc/bash.bashrc ]; then . /etc/bash.bashrc; fi
if [ -f "${HOME}/.bashrc" ]; then . "${HOME}/.bashrc"; fi

__fox_boot_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOXTERM_ROOT="$(cd "${__fox_boot_dir}/../.." && pwd)"
FOXTERM_CMD_PATH_UNIX="${FOXTERM_ROOT}/cmd"

export FOXTERM=1
export FOXTERM_HOST=ghostty
export FOXTERM_ROOT
export FOXTERM_CMD_PATH_UNIX

case ":${PATH}:" in
  *":${FOXTERM_CMD_PATH_UNIX}:"*) ;;
  *) PATH="${FOXTERM_CMD_PATH_UNIX}:${PATH}"; export PATH ;;
esac

if [ -f "${FOXTERM_CMD_PATH_UNIX}/foxterm-bash-init.sh" ]; then
  . "${FOXTERM_CMD_PATH_UNIX}/foxterm-bash-init.sh"
else
  printf 'FoxTerminal: cmd/foxterm-bash-init.sh not found under %s\n' "${FOXTERM_ROOT}"
  printf 'Re-run the installer: bash FoxTerminal/install.sh\n'
fi

unset __fox_boot_dir
