# Design brief — FoxTerminal bars

## Product
Personal companion for **Zen Browser / Firefox**: side terminal, AI commands, translate, saved tab sessions, theme switcher that also tints the browser chrome.

## Please redesign
- Visual polish of popup + sidebar (layout, typography, spacing, glass look)
- Theme picker UX (currently chips / cards)
- Translate overlay card
- Optional: calmer, more premium liquid-glass language (less “default purple AI”)

## Constraints
- Popup width ≈ **360px**
- Sidebar is a **narrow vertical panel** (often 300–420px)
- Must work **dark-first**; themes change accent/background
- Keep structure understandable: tabs for Terminal / Sessions / Themes / Translate / Settings
- Animations OK if subtle (no heavy JS frameworks required)
- Ukrainian copy can stay

## CSS variables to preserve (ideal)
```
--fox-bg
--fox-bg-2
--fox-panel
--fox-panel-2
--fox-border
--fox-accent
--fox-accent-2
--fox-dim
--fox-text
--fox-ok
--fox-danger
--fox-gradient
--fox-glow-a
--fox-glow-b
--fox-blur
--fox-radius
```

## Theme examples (from CLI)
`orange`, `slate`, `blue`, `purple`, `cyan`, `noir`, `dnote`, `arthas-dark`, `arthas-light`, `apple`, pride variants, plus many `sw` colors (`ruby`, `neon`, `gold`, …).

## Out of scope
- Backend / native messaging / Ollama logic
- Real terminal execution
- Packaging the Firefox addon
