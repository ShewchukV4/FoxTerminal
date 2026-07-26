# FoxTerminal Firefox Add-on (Personal)

This add-on is a local companion for Firefox that runs selected `FoxTerminal` commands through Native Messaging.

## What it can run

- `youtube`
- `ff open <alias-or-url>`
- `ser <query>`
- `gask <question>`
- `sites -Main`
- `sites -open <site-folder>`

## Side terminal panel

- Keyword in Firefox address bar: `ff`
- Type `ff`, press `Space`, then press `Enter` to open side panel.
- Inside side panel you can run commands and see output without leaving the page.
- Commands run through local Native Messaging host (local machine only).
- Built-in command in omnibox and side terminal: `history -clear` (clears Firefox browsing history).

## Sync with terminal (shared session)

If you want sidebar and terminal to share one command context:

1. Start sync daemon:
   - `ffsync start`
2. Work in synced terminal:
   - `ffsync shell`
3. Open Firefox sidebar (`ff` + Space + Enter).

In this mode both surfaces use one backend session (shared cwd and command stream).
Sidebar now attempts to auto-start the shared daemon on connect.
Also, when daemon is running, `wai` and `ff ...` typed in regular terminal auto-relay into shared session.

## Install (Zen Browser preferred)

FoxTerminal now opens links in **Zen Browser** by default (`fox-browser.ps1` / `FOXTERM_BROWSER`).

1. Register Native Messaging host (Firefox + Zen keys):
   - `foxaddon -Install`
   - or `foxzen host`
2. Open Zen:
   - `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and choose:
   - `FoxTerminal/firefox-addon/manifest.json`
   - or install signed Unlisted `.xpi` via `about:addons`
4. After code updates, use **Reload** in `about:debugging`.

Optional FoxTerminal look for Zen chrome:
- `foxzen theme`

## Important: temporary vs permanent

`Load Temporary Add-on` is removed every time Firefox restarts. That is normal.

To keep it after restart:

1. Pack XPI:
   - `powershell -ExecutionPolicy Bypass -File .\FoxTerminal\firefox-addon\native-host\pack-xpi.ps1`
   - or `foxaddon -Pack`
2. Install permanently:
   - **Firefox Developer Edition / Nightly:** `about:config` → `xpinstall.signatures.required = false`, then `about:addons` → gear → **Install Add-on From File** → choose the `.xpi`
   - **Regular Firefox:** sign as **Unlisted** on [AMO developer hub](https://addons.mozilla.org/developers/), then install the signed `.xpi`

Native Messaging host (`install-host.ps1`) stays registered across restarts; only the temporary extension itself is unloaded.

## Notes

- Extension ID in manifest: `foxterminal-companion@local`
- Native host name: `com.foxterminal.bridge`
- Host install is per-user (`HKCU`) and does not require admin rights.
- Address bar keyword is `ff` (omnibox mode):
  - Type `ff`, press Space/Tab, then:
    - `Enter` (open side terminal panel)
    - `history -clear`
    - `open youtube`
    - `open <alias-or-url>`
    - `ser <terms>`
    - `gask <question>`
    - `sites -Main`
