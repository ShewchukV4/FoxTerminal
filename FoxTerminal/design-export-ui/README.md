# FoxTerminal UI Design Export

Standalone visual copies of FoxTerminal Companion bars / panels for redesign.

**Give this whole folder** to a designer or another AI.  
Open `index.html` in a browser (double-click). No Firefox/Zen extension needed.

## What’s inside

| File | What it is |
|------|------------|
| `index.html` | Gallery / entry |
| `mocks/popup.html` | Extension popup (~360px) |
| `mocks/sidebar.html` | Side panel (all tabs mocked) |
| `mocks/translate-overlay.html` | Floating translate box on a fake page |
| `css/popup.css` | Popup styles (current) |
| `css/sidebar.css` | Sidebar / glass styles (current) |
| `css/zen-userChrome.css` | Zen browser chrome theme CSS |
| `css/zen-userContent.css` | Zen about: pages accents |
| `js/themes.js` | Theme palette definitions (terminal colors) |
| `js/demo.js` | Tiny demo interactions (tabs, theme swatches) |
| `BRIEF.md` | Design brief / constraints for redesign |

## Surfaces to redesign

1. **Popup** — compact action launcher + theme chips  
2. **Sidebar** — terminal / sessions / themes / translate / settings  
3. **Translate overlay** — draggable glass card on web pages  
4. **Zen chrome** (optional) — toolbar/tabs via `userChrome` variables  

## Design goals (current product direction)

- Dark “liquid glass”: blur, translucency, soft borders  
- Themeable via CSS variables (`--fox-accent`, `--fox-bg`, …)  
- Same color language as FoxTerminal CLI themes (`orange`, `slate`, `arthas`, `pride`, …)  
- Ukrainian UI labels OK to keep or restyle  

## Hand-off tip

Prefer returning:

- updated CSS (and HTML structure if needed)  
- Figma/screens optional  
- keep CSS variable names if possible so engineering can drop styles back into the addon  

Source of truth in repo after redesign:

- `FoxTerminal/firefox-addon/popup.html` + `styles.css`  
- `FoxTerminal/firefox-addon/sidebar.html` + `sidebar.css`  
- `FoxTerminal/zen/userChrome.css`  
