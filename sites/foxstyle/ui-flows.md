# FOXSTYLE — interaction flows

> **Ungoverned note:** `docs/loom/PRINCIPLES.md` у репо відсутній.  
> Дизайн керується `AGENTS.md` + фірмовою естетикою FoxOS (neon violet glass).

**Модальність:** GUI (primary) + CLI (secondary).

---

## 1. Inventory

| Surface | Role |
|---------|------|
| Overlay + Book shell | Modal appearance studio |
| Nav (13 sections) | Module switcher |
| Live preview mini | Real-time FoxOS desk mock |
| Settings main | Per-module controls |
| Apply / Export / Import | Commit & share theme |
| CLI section | Copyable FoxOS commands |
| `foxstyle` CLI | Terminal entry |

**Sections:** Themes · Colors · Buttons · Chrome-Bar · Windows · Panels · Motion · App Open · Typography · Backgrounds · Labs · Custom · CLI

---

## 2. Entry / exit

```
FoxOS desk / terminal
   │  foxstyle  |  home → FOXSTYLE  |  sites foxstyle
   ▼
Overlay fades in → book opens RIGHT→LEFT (fs-book-open)
   │
   ├─ Esc / Close → book-close → overlay out
   └─ Apply → persist style.json / localStorage + wave
```

---

## 3. Primary flows

### A. Pick preset
1. Themes → tile Dark/Light/Neon/FoxPurple/Custom  
2. Preview updates immediately  
3. Footer dirty → Apply commits

### B. Tweak one module
1. Nav → e.g. Chrome-Bar  
2. Slider opacity/blur → CSS vars live  
3. Mini chrome mirrors values  
4. Apply

### C. Custom from scratch
1. Custom section / preset Custom  
2. Set accents, texture, motion, per-element anims  
3. Export JSON → share / `foxstyle apply`

### D. Replay window open
1. Windows or App Open → change anim  
2. Preview window re-mounts with zoom/flip/fold/liquid

---

## 4. Layout ASCII

```
+==============================================================+
| FOXSTYLE                                      [live] [x]     |
+----------+------------------------+--------------------------+
| Themes   | LIVE PREVIEW           |                          |
| Colors * | +--------------------+ |  section title           |
| Buttons  | | chrome  .... 12:00 | |  +--------------------+  |
| Chrome   | |  +--------------+  | |  | card / rows        |  |
| Windows  | |  | ghostty win  |  | |  | slider  toggle     |  |
| ...      | |  +--------------+  | |  +--------------------+  |
| Labs     | |   [dock][ ][ ]     | |                          |
| CLI      | +--------------------+ |                          |
+----------+------------------------+--------------------------+
| 2 changes pending              [Export] [ APPLY ~~~~ ]       |
+==============================================================+
```

---

## 5. Motion character

- Panel: book hinge, 480–720ms liquid ease  
- Controls: 160–320ms standard; toggles elastic  
- Apply: wave ripple + preview sweep  
- Reduced motion: fades only

---

## 6. Density

Desktop-first 1440+. Dense Control Center rows; tiles for presets/anims. Nav collapses to icons &lt;1200px.

---

## 7. Validator checklist

- [x] Screen inventory listed  
- [x] Entry/exit defined  
- [x] Primary flows A–D  
- [x] ASCII layout  
- [x] Motion character  
- [x] PRINCIPLES absence flagged  
- [x] Artifact path: `sites/foxstyle/ui-flows.md`