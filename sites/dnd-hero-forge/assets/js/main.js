'use strict';

/* ══ State (з roster localStorage) ═══════════════════════════════════════ */
let state = {};

function scheduleSave() {
  if (typeof Roster !== 'undefined') Roster.scheduleSave(state);
}

function loadCharacter(id) {
  const ch = id ? Roster.get(id) : null;
  state = ch || Roster.createNew();
  enforceSubclassLevel();
  render();
}

function abilitiesNeedAssign() {
  return state.abilityMethod === 'standard' || state.abilityMethod === 'roll';
}

function getScorePool() {
  if (state.abilityMethod === 'standard') return [...DND.STANDARD_ARRAY];
  if (state.abilityMethod === 'roll' && state.selectedRollSet) return [...state.selectedRollSet];
  return null;
}

function getScoreOptionsFor(ability) {
  const pool = getScorePool();
  if (!pool) return null;
  const assigned = DND.ABILITIES.filter(a => a !== ability)
    .map(a => state.abilities[a]).filter(v => v > 0);
  const poolCopy = [...pool];
  assigned.forEach(v => {
    const idx = poolCopy.indexOf(v);
    if (idx >= 0) poolCopy.splice(idx, 1);
  });
  const opts = [...poolCopy];
  if (state.abilities[ability] > 0 && !opts.includes(state.abilities[ability])) {
    opts.push(state.abilities[ability]);
  }
  return opts.sort((a, b) => b - a);
}

function abilitiesFullyAssigned() {
  if (!abilitiesNeedAssign()) return true;
  const pool = getScorePool();
  if (!pool) return false;
  const vals = DND.ABILITIES.map(a => state.abilities[a]).filter(v => v > 0);
  if (vals.length !== 6) return false;
  const a = [...vals].sort((x, y) => x - y);
  const b = [...pool].sort((x, y) => x - y);
  return a.every((v, i) => v === b[i]);
}

function getBaseAbility(a) {
  const v = state.abilities[a];
  if (abilitiesNeedAssign() && (!v || v <= 0)) return null;
  return v || 8;
}

function getInventoryList() {
  return (state.customItems || []).map(c => ({
    id: c.id,
    name: c.name,
    desc: c.desc || ''
  }));
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ══ Math helpers ════════════════════════════════════════════════════════ */
function mod(score) { return Math.floor((score - 10) / 2); }
function fmtMod(m) { return m >= 0 ? `+${m}` : `${m}`; }

function profBonus(level) {
  return 2 + Math.floor((level - 1) / 4);
}

function getFinalAbilities() {
  const base = {};
  DND.ABILITIES.forEach(a => {
    const b = getBaseAbility(a);
    base[a] = b !== null ? b : 10;
  });
  const race = state.race ? DND.RACES[state.race] : null;
  if (!race) return base;

  DND.ABILITIES.forEach(a => {
    if (race.abilityBonus?.[a]) base[a] += race.abilityBonus[a];
  });

  const sub = state.subrace && race.subraces?.[state.subrace];
  if (sub?.abilityBonus) {
    DND.ABILITIES.forEach(a => {
      if (sub.abilityBonus[a]) base[a] += sub.abilityBonus[a];
    });
  }

  if (state.race === 'human' && state.subrace === 'variant') {
    state.variantBonuses.forEach(a => { if (a) base[a] += 1; });
  }
  if (state.race === 'halfElf') {
    state.variantBonuses.forEach(a => { if (a) base[a] += 1; });
  }

  return base;
}

function getProficientSkills() {
  const set = new Set(state.skillProficiencies);
  const bg = state.background ? DND.BACKGROUNDS[state.background] : null;
  if (bg) bg.skills.forEach(s => set.add(s));
  if (state.race === 'halfElf') state.extraSkills.forEach(s => set.add(s));
  if (state.subrace === 'variant' && state.race === 'human') state.extraSkills.forEach(s => set.add(s));
  return [...set];
}

function skillBonus(skillId) {
  const skill = DND.SKILLS.find(s => s.id === skillId);
  if (!skill) return 0;
  const abilities = getFinalAbilities();
  let bonus = mod(abilities[skill.ability]);
  const profs = getProficientSkills();
  if (profs.includes(skillId)) bonus += profBonus(state.level);
  if (state.skillExpertise.includes(skillId)) bonus += profBonus(state.level);
  return bonus;
}

function getClassData() {
  return state.class ? DND.CLASSES[state.class] : null;
}

function getSpellcasting() {
  const cls = getClassData();
  return cls?.spellcasting || null;
}

function getMaxHp() {
  const cls = getClassData();
  if (!cls) return 0;
  const con = mod(getFinalAbilities().con);
  let hp = cls.hitDie + con;
  for (let lv = 2; lv <= state.level; lv++) {
    const gain = state.hpMethod === 'max'
      ? Math.floor(cls.hitDie / 2) + 1 + con
      : Math.floor(cls.hitDie / 2) + 1 + con;
    hp += gain;
  }
  if (state.feats.includes('tough')) hp += state.level * 2;
  if (state.race === 'dwarf' && state.subrace === 'hill') hp += state.level;
  return hp;
}

function getAC() {
  const abilities = getFinalAbilities();
  const dexMod = mod(abilities.dex);
  const cls = getClassData();

  if (state.armorChoice === 'chain') return 16;
  if (state.armorChoice === 'scale') return 14 + Math.min(dexMod, 2);
  if (state.armorChoice === 'leather') return 11 + dexMod;
  if (state.armorChoice === 'shield') return 12 + dexMod;

  if (cls?.id === 'monk') return 10 + dexMod + mod(abilities.wis);
  if (cls?.id === 'barbarian') return 10 + dexMod + mod(abilities.con);
  return 10 + dexMod;
}

function getInitiative() { return mod(getFinalAbilities().dex); }

function getPassivePerception() {
  return 10 + skillBonus('perception');
}

function getSpellSaveDC() {
  const sc = getSpellcasting();
  if (!sc) return null;
  const abilities = getFinalAbilities();
  return 8 + profBonus(state.level) + mod(abilities[sc.ability]);
}

function getSpellAttack() {
  const sc = getSpellcasting();
  if (!sc) return null;
  const abilities = getFinalAbilities();
  return profBonus(state.level) + mod(abilities[sc.ability]);
}

function getSpellSlots() {
  const sc = getSpellcasting();
  if (!sc) return [];
  const lv = Math.min(state.level, 20);
  if (sc.pactMagic) return DND.SPELL_SLOTS.warlock[lv] || [];
  if (sc.halfCaster) return DND.SPELL_SLOTS.half[lv] || [];
  return DND.SPELL_SLOTS.full[lv] || [];
}

function getMaxSpellLevel() {
  const slots = getSpellSlots();
  return DND.getMaxSpellLevelForChar(state.level, slots);
}

function getSpellsAtLevel(level) {
  const key = `level${level}`;
  return (DND.SPELLS[key] || []).map(s => ({ ...s, spellLevel: level }));
}

function getAllLeveledSpells() {
  const all = [];
  for (let i = 1; i <= 9; i++) all.push(...getSpellsAtLevel(i));
  return all;
}

function getAvailableSpells() {
  const maxLv = getMaxSpellLevel();
  const list = [];
  for (let i = 1; i <= maxLv; i++) list.push(...getSpellsAtLevel(i));
  return list;
}

function renderMagicGuideHtml() {
  const slots = getSpellSlots();
  const maxLv = getMaxSpellLevel();
  const md = (s) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return `
    <div class="spell-guide">
      <h4>📖 Заговір vs заклинання</h4>
      <p>${md(DND.MAGIC_GUIDE.cantripVsSpell)}</p>
      <h4>⚔ Основна, бонусна дія та реакція</h4>
      <p>${md(DND.MAGIC_GUIDE.actions)}</p>
      <p class="spell-guide-note">${md(DND.MAGIC_GUIDE.spellLevelNote(state.level, maxLv, slots))}</p>
      <details class="spell-guide-details">
        <summary>📚 Компоненти, рятунки, CON/DEX та інші терміни</summary>
        <div class="spell-guide-details-body">
          <h4>🧪 Компоненти (В, С, М)</h4>
          <p>${md(DND.MAGIC_GUIDE.components)}</p>
          <h4>🎲 Рятунок і кидок атаки</h4>
          <p>${md(DND.MAGIC_GUIDE.savingThrows)}</p>
          <h4>💪 Характеристики: CON, DEX, МДР…</h4>
          <p>${md(DND.MAGIC_GUIDE.abilities)}</p>
          <h4>📏 Дистанція, тривалість, концентрація</h4>
          <p>${md(DND.MAGIC_GUIDE.spellTerms)}</p>
        </div>
      </details>
    </div>`;
}

function getCantripLimit() {
  const sc = getSpellcasting();
  if (!sc?.cantrips) return 0;
  return sc.cantrips[Math.min(state.level, 20) - 1] || 0;
}

function getSpellLimit(level) {
  const sc = getSpellcasting();
  if (!sc) return 0;
  if (sc.type === 'known' && sc.spellsKnown) {
    return sc.spellsKnown[Math.min(state.level, 20) - 1] || 0;
  }
  const slots = getSpellSlots();
  return slots.filter((_, i) => i + 1 <= level).reduce((a, b) => a + b, 0) || 0;
}

function pointBuyRemaining() {
  let spent = 0;
  DND.ABILITIES.forEach(a => {
    spent += DND.POINT_BUY_COSTS[state.abilities[a]] || 0;
  });
  return 27 - spent;
}

function getSubclassUnlockLevel() {
  return state.class ? DND.getSubclassUnlockLevel(state.class) : 3;
}

function isSubclassAvailable() {
  return state.level >= getSubclassUnlockLevel();
}

function enforceSubclassLevel() {
  if (!state.class) { state.subclass = null; return; }
  const unlock = getSubclassUnlockLevel();
  if (state.level < unlock) {
    state.subclass = null;
  } else if (!state.subclass) {
    state.subclass = Object.keys(DND.CLASSES[state.class].subclasses)[0];
  }
}

function getClassFeatures() {
  const cls = getClassData();
  if (!cls) return [];
  const feats = [];
  const unlock = getSubclassUnlockLevel();
  for (let lv = 1; lv <= state.level; lv++) {
    if (cls.features[lv]) {
      cls.features[lv].forEach(f => feats.push({ level: lv, name: f }));
    }
    if (state.subclass && state.level >= unlock && cls.subclasses?.[state.subclass]?.features?.[lv]) {
      cls.subclasses[state.subclass].features[lv].forEach(f => {
        feats.push({ level: lv, name: f, subclass: true });
      });
    }
  }
  return feats;
}

function getRacialTraits() {
  const race = state.race ? DND.RACES[state.race] : null;
  if (!race) return [];
  const traits = [...(race.traits || [])];
  const sub = state.subrace && race.subraces?.[state.subrace];
  if (sub?.traits) traits.push(...sub.traits);
  return traits;
}

/* ══ Background canvas ═══════════════════════════════════════════════════ */
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;

function resizeBg() {
  if (!bgCanvas) return;
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeBg);

const motes = Array.from({ length: 60 }, () => ({
  x: Math.random(), y: Math.random(),
  r: 0.5 + Math.random() * 2,
  phase: Math.random() * Math.PI * 2
}));

function drawBg(t) {
  if (!bgCanvas || !bgCtx) return;
  bgCtx.fillStyle = 'rgba(10,6,4,0.35)';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  motes.forEach(m => {
    const x = m.x * bgCanvas.width;
    const y = m.y * bgCanvas.height;
    const a = 0.12 + 0.18 * Math.sin(t * 0.0008 + m.phase);
    bgCtx.beginPath();
    bgCtx.arc(x, y, m.r, 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(212,168,64,${a})`;
    bgCtx.fill();
  });
  requestAnimationFrame(drawBg);
}

/* ══ Navigation ════════════════════════════════════════════════════════ */
function renderNav() {
  const nav = $('#wizardNav');
  nav.innerHTML = DND.WIZARD_STEPS.map((s, i) => `
    <button type="button" class="nav-item ${i === state.step ? 'active' : ''} ${i < state.step ? 'done' : ''}"
            data-step="${i}">${s.icon} ${s.title}</button>
  `).join('');
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.step = +btn.dataset.step;
      render();
    });
  });
  $('#stepIndicator').textContent = `${state.step + 1} / ${DND.WIZARD_STEPS.length}`;
  $('#btnPrev').disabled = state.step === 0;
  $('#btnNext').textContent = state.step === DND.WIZARD_STEPS.length - 1 ? 'Готово ✓' : 'Далі →';
}

function renderStatsGuideHtml(compact) {
  const md = (s) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const abilities = getFinalAbilities();
  const cls = getClassData();
  const sc = getSpellcasting();

  if (compact) {
    return `<details class="stats-guide stats-guide--compact">
      <summary>📊 Характеристики та навички</summary>
      <div class="stats-guide-body">
        <p class="stats-guide-intro">${md(DND.STATS_GUIDE.intro)}</p>
        ${DND.STATS_GUIDE.abilities.map(ab => {
          const v = abilities[ab.id] ?? 10;
          const m = mod(v);
          const spellNote = sc?.ability === ab.id ? ' · <em>твоя магія</em>' : '';
          const saveNote = cls?.saves?.includes(ab.id) ? ' · <em>рятунок класу</em>' : '';
          return `<div class="stats-ab-row">
            <span class="stats-ab-name">${ab.abbr} ${ab.name}</span>
            <span class="stats-ab-val">${v} (${fmtMod(m)})${spellNote}${saveNote}</span>
            <ul class="stats-ab-list">${ab.affects.map(a => `<li>${md(a)}</li>`).join('')}</ul>
          </div>`;
        }).join('')}
        <h4 class="stats-subtitle">Навички → характеристика</h4>
        <ul class="stats-skill-map">${DND.SKILLS.map(sk => {
          const prof = getProficientSkills().includes(sk.id);
          return `<li><span class="${prof ? 'skill-prof' : ''}">${sk.name}</span> → ${DND.getSkillAbilityLabel(sk.ability)}${prof ? ' ✓' : ''}</li>`;
        }).join('')}</ul>
        <h4 class="stats-subtitle">Похідні значення</h4>
        <ul class="stats-derived">${DND.STATS_GUIDE.derived.map(d =>
          `<li><strong>${d.label}:</strong> ${d.formula}</li>`).join('')}</ul>
      </div>
    </details>`;
  }

  return `<div class="stats-guide">
    <h4>📊 Що від чого залежить</h4>
    <p class="stats-guide-intro">${md(DND.STATS_GUIDE.intro)}</p>
    ${DND.STATS_GUIDE.abilities.map(ab => `
      <div class="stats-ab-block">
        <strong>${ab.abbr} — ${ab.name}</strong>
        <ul>${ab.affects.map(a => `<li>${md(a)}</li>`).join('')}</ul>
      </div>`).join('')}
    <h4>Навички (підхарактеристики)</h4>
    <p class="stats-guide-intro">Кожна навичка використовує <strong>одну</strong> характеристику + бонус майстерності, якщо володієш нею.</p>
    <ul class="stats-skill-map">${DND.SKILLS.map(sk =>
      `<li>${sk.name} → <strong>${DND.getSkillAbilityLabel(sk.ability)}</strong></li>`).join('')}</ul>
  </div>`;
}

/* ══ Sheet preview ═════════════════════════════════════════════════════ */
function renderSheet() {
  const abilities = getFinalAbilities();
  const cls = getClassData();
  const race = state.race ? DND.RACES[state.race] : null;
  const sub = state.subrace && race?.subraces?.[state.subrace];
  const sc = getSpellcasting();
  const slots = getSpellSlots();

  let html = `
    <div class="sheet-row"><span>Ім'я</span><span>${state.name || '—'}</span></div>
    <div class="sheet-row"><span>Рівень</span><span>${state.level}</span></div>
    <div class="sheet-row"><span>Клас</span><span>${cls?.name || '—'}</span></div>
    <div class="sheet-row"><span>Раса</span><span>${race?.name || '—'}${sub ? ' / ' + DND.I18n.subrace(sub.name) : ''}</span></div>
    <div class="sheet-row"><span>Бонус майстерності</span><span>${fmtMod(profBonus(state.level))}</span></div>
    <h3>Характеристики</h3>
    <div class="sheet-abilities">
      ${DND.ABILITIES.map(a => {
        const v = abilities[a];
        const m = mod(v);
        return `<div class="ability-box"><div class="ab-name">${DND.ABILITY_NAMES[a]}</div>
          <div class="ab-score">${v}</div><div class="ab-mod">${fmtMod(m)}</div></div>`;
      }).join('')}
    </div>
    <h3>Бій</h3>
    <div class="sheet-row"><span>Здоров'я (HP)</span><span>${getMaxHp()}</span></div>
    <div class="sheet-row"><span>Клас броні (AC)</span><span>${getAC()}</span></div>
    <div class="sheet-row"><span>Ініціатива</span><span>${fmtMod(getInitiative())}</span></div>
    <div class="sheet-row"><span>Швидкість</span><span>${race?.speed || 30} фт</span></div>
    <div class="sheet-row"><span>Пасивне сприйняття</span><span>${getPassivePerception()}</span></div>
  `;

  if (sc) {
    html += `<h3>Магія</h3>
      <div class="sheet-row"><span>Складність заклинань</span><span>${getSpellSaveDC()}</span></div>
      <div class="sheet-row"><span>Атака заклинанням</span><span>${fmtMod(getSpellAttack())}</span></div>`;
    if (slots.length) {
      html += `<div class="sheet-row"><span>Ячейки</span><span>${slots.map((s, i) => `${i+1}р:${s}`).join(' ')}</span></div>`;
    }
  }

  const profSkills = getProficientSkills();
  if (profSkills.length) {
    html += `<h3>Навички</h3>`;
    profSkills.forEach(id => {
      const sk = DND.SKILLS.find(s => s.id === id);
      if (sk) html += `<div class="sheet-row"><span>${sk.name}</span><span>${fmtMod(skillBonus(id))}</span></div>`;
    });
  }

  const inv = getInventoryList();
  if (inv.length) {
    html += `<h3>Інвентар</h3>`;
    inv.forEach(it => {
      html += `<div class="sheet-row sheet-row-inv"><span>${esc(it.name)}</span><span class="sheet-inv-desc">${esc(it.desc) || '—'}</span></div>`;
    });
  }

  html += renderStatsGuideHtml(true);

  $('#sheetBody').innerHTML = html;
}

/* ══ Step renderers ══════════════════════════════════════════════════════ */
function renderStep() {
  const steps = {
    basics: renderBasics,
    race: renderRace,
    class: renderClass,
    background: renderBackground,
    abilities: renderAbilities,
    skills: renderSkills,
    equipment: renderEquipment,
    spells: renderSpells,
    personality: renderPersonality,
    review: renderReview
  };
  const id = DND.WIZARD_STEPS[state.step].id;
  const panel = $('#stepPanel');
  panel.innerHTML = '';
  steps[id](panel);
}

function renderBasics(el) {
  el.innerHTML = `
    <h2 class="step-title">Основна інформація</h2>
    <p class="step-desc">Ім'я, рівень, вирівнювання та гравець.</p>
    <div class="field-grid">
      <div class="field"><label>Ім'я персонажа</label>
        <input type="text" id="inpName" value="${esc(state.name)}" placeholder="Арагорн"></div>
      <div class="field"><label>Ім'я гравця</label>
        <input type="text" id="inpPlayer" value="${esc(state.playerName)}" placeholder="Гравець 1"></div>
      <div class="field"><label>Рівень</label>
        <input type="number" id="inpLevel" min="1" max="20" value="${state.level}"></div>
      <div class="field"><label>Вирівнювання</label>
        <select id="inpAlignment">${DND.ALIGNMENTS.map(a =>
          `<option value="${esc(a)}" ${state.alignment === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
    </div>
    <div class="info-box">
      <strong>Рівень 1–20</strong> — у D&D персонаж росте до 20 рівня. Підклас, ячейки та риси відкриваються поступово (див. крок «Клас»).
      <br><small>Терміни D&D — українською з поясненням у дужках.</small>
    </div>`;

  $('#inpName').addEventListener('input', e => { state.name = e.target.value; renderSheet(); scheduleSave(); });
  $('#inpPlayer').addEventListener('input', e => { state.playerName = e.target.value; });
  $('#inpLevel').addEventListener('input', e => {
    state.level = Math.max(1, Math.min(20, +e.target.value || 1));
    enforceSubclassLevel();
    renderStep();
    renderSheet();
    scheduleSave();
  });
  $('#inpAlignment').addEventListener('change', e => { state.alignment = e.target.value; });
}

function renderRace(el) {
  el.innerHTML = `
    <h2 class="step-title">Раса та підраса</h2>
    <p class="step-desc">Обери расу SRD. Бонуси застосовуються автоматично.</p>
    <div class="card-grid" id="raceCards"></div>
    <div class="subrace-row" id="subraceArea"></div>`;

  const grid = $('#raceCards');
  Object.values(DND.RACES).forEach(r => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card ${state.race === r.id ? 'selected' : ''}`;
    const bonuses = Object.entries(r.abilityBonus || {}).map(([k, v]) => `${DND.ABILITY_NAMES[k]}+${v}`).join(', ');
    card.innerHTML = `<h4>${r.name}</h4><p>${r.size}, ${r.speed} фт${r.darkvision ? ', ' + t('Darkvision ' + r.darkvision) : ''}</p>
      <div class="tags">${bonuses ? `<span class="tag">${bonuses}</span>` : ''}<span class="tag">${Object.keys(r.subraces).length} підрас</span></div>`;
    card.addEventListener('click', () => {
      state.race = r.id;
      state.subrace = Object.keys(r.subraces)[0];
      state.variantBonuses = [];
      renderStep();
      renderSheet();
    });
    grid.appendChild(card);
  });
  renderSubraces();
}

function renderSubraces() {
  const area = $('#subraceArea');
  if (!state.race) { area.innerHTML = ''; return; }
  const race = DND.RACES[state.race];
  area.innerHTML = `<h4 style="font-family:var(--font-display);margin-bottom:8px">Підраса</h4>
    <div class="card-grid" id="subraceCards"></div>
    ${(state.race === 'human' && state.subrace === 'variant') || state.race === 'halfElf' ? '<div id="variantBonusArea"></div>' : ''}`;

  const grid = $('#subraceCards');
  Object.entries(race.subraces).forEach(([id, sub]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card ${state.subrace === id ? 'selected' : ''}`;
    const bonuses = Object.entries(sub.abilityBonus || {}).map(([k, v]) => `${DND.ABILITY_NAMES[k]}+${v}`).join(', ');
    card.innerHTML = `<h4>${DND.I18n.subrace(sub.name)}</h4>
      ${sub.traits ? `<p>${sub.traits.map(tr => t(tr)).join(' · ')}</p>` : ''}
      ${bonuses ? `<div class="tags"><span class="tag">${bonuses}</span></div>` : ''}`;
    card.addEventListener('click', () => {
      state.subrace = id;
      state.variantBonuses = [];
      renderStep();
      renderSheet();
    });
    grid.appendChild(card);
  });

  if ((state.race === 'human' && state.subrace === 'variant') || state.race === 'halfElf') {
    const need = state.race === 'halfElf' ? 2 : 2;
    const vb = $('#variantBonusArea');
    vb.innerHTML = `<p class="step-desc">Обери +1 до ${need} характеристик:</p>
      <div class="field-grid">${DND.ABILITIES.map(a => `
        <label class="skill-item"><input type="checkbox" data-var="${a}" ${state.variantBonuses.includes(a) ? 'checked' : ''}>
          <span class="skill-name">${DND.ABILITY_NAMES[a]} +1</span></label>`).join('')}</div>`;
    vb.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        const a = inp.dataset.var;
        if (inp.checked) {
          if (state.variantBonuses.length < need) state.variantBonuses.push(a);
          else { inp.checked = false; return; }
        } else {
          state.variantBonuses = state.variantBonuses.filter(x => x !== a);
        }
        renderSheet();
      });
    });
  }

  if (state.race && state.subrace) {
    const traits = getRacialTraits();
    area.innerHTML += `<div class="info-box"><strong>Расові риси:</strong><ul class="feature-list">
      ${traits.map(tr => `<li>${t(tr)}</li>`).join('')}</ul></div>`;
  }
}

function renderClass(el) {
  el.innerHTML = `
    <h2 class="step-title">Клас та підклас</h2>
    <p class="step-desc">Клас визначає кидки атаки, навички, заклинання та риси.</p>
    <div class="card-grid" id="classCards"></div>
    <div id="subclassArea"></div>
    <div id="classFeaturesArea"></div>`;

  const grid = $('#classCards');
  Object.values(DND.CLASSES).forEach(c => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card ${state.class === c.id ? 'selected' : ''}`;
    const saves = c.saves.map(s => DND.ABILITY_NAMES[s]).join(', ');
    card.innerHTML = `<h4>${c.name}</h4>
      <p>Куб здоров'я: d${c.hitDie} · Рятунки: ${saves}</p>
      <div class="tags"><span class="tag">${c.skills.choose} навички</span>
        ${c.spellcasting ? `<span class="tag">${t('Spellcaster')}</span>` : `<span class="tag">${t('Martial')}</span>`}</div>`;
    card.addEventListener('click', () => {
      state.class = c.id;
      enforceSubclassLevel();
      state.skillProficiencies = [];
      state.cantrips = [];
      state.spells = [];
      renderStep();
      renderSheet();
    });
    grid.appendChild(card);
  });
  renderSubclass();
}

function renderSubclass() {
  const area = $('#subclassArea');
  const featArea = $('#classFeaturesArea');
  if (!state.class) { area.innerHTML = ''; featArea.innerHTML = ''; return; }
  const cls = DND.CLASSES[state.class];
  const unlock = getSubclassUnlockLevel();
  const canPick = isSubclassAvailable();

  area.innerHTML = `
    <h4 class="subclass-heading">Підклас — від рівня ${unlock}</h4>
    ${canPick
      ? `<p class="spell-section-hint">Рівень ${state.level} — можеш обрати підклас.</p>`
      : `<p class="spell-section-hint locked-msg">🔒 Рівень ${state.level} — підклас буде доступний з <strong>рівня ${unlock}</strong>. Підніми рівень у кроці «Основи».</p>`}
    <div class="card-grid" id="subclassCards"></div>`;
  const grid = $('#subclassCards');
  Object.entries(cls.subclasses).forEach(([id, sub]) => {
    const card = document.createElement('button');
    card.type = 'button';
    const selected = canPick && state.subclass === id;
    card.className = `select-card ${selected ? 'selected' : ''} ${canPick ? '' : 'is-locked'}`;
    card.disabled = !canPick;
    card.innerHTML = `<h4>${DND.I18n.subclass(sub.name)}</h4>
      ${canPick ? '' : `<p class="lock-badge">з рівня ${unlock}</p>`}`;
    if (canPick) {
      card.addEventListener('click', () => {
        state.subclass = id;
        renderStep();
        renderSheet();
        scheduleSave();
      });
    }
    grid.appendChild(card);
  });

  const features = getClassFeatures();
  const progression = DND.buildProgressionTable(state.class, state.level, state.subclass);
  featArea.innerHTML = `
    <div class="info-box"><strong>Риси до рівня ${state.level}:</strong>
      <ul class="feature-list">${features.length
        ? features.map(f => `<li><strong>Рів.${f.level}${f.subclass ? ' ★' : ''}</strong> ${t(f.name)}</li>`).join('')
        : '<li>Поки лише базові риси класу — підклас з’явиться пізніше.</li>'}</ul>
    </div>
    <details class="progression-details">
      <summary>📈 Кар'єра класу 1–20 (правила PHB)</summary>
      <p class="spell-section-hint">Бонус майстерності, ячейки та риси по рівнях. Сірим — майбутнє; золотом — твій поточний рівень.</p>
      <div class="progression-wrap">
        <table class="progression-table">
          <thead><tr>
            <th>Lvl</th><th>БМ</th><th>Ячейки / макс.закл.</th><th>Риси класу</th><th>Підклас</th><th>Примітки</th>
          </tr></thead>
          <tbody>${progression.map(row => {
            const slotCell = cls.spellcasting
              ? `${row.slots}${row.maxSpellLv ? ` (до ${row.maxSpellLv}р)` : ''}${row.cantrips != null ? ` · ${row.cantrips} загов.` : ''}`
              : '—';
            const clsFeats = row.features.map(f => t(f)).join(', ') || '—';
            const subFeats = row.subclassFeatures.map(f => t(f)).join(', ') || (row.level < unlock ? '—' : '—');
            const notes = row.notes.join(' · ') || '';
            const clsRow = row.isCurrent ? 'progress-current' : row.isFuture ? 'progress-future' : '';
            return `<tr class="${clsRow}">
              <td>${row.level}</td>
              <td>+${row.prof}</td>
              <td>${slotCell}</td>
              <td>${clsFeats}</td>
              <td>${subFeats}</td>
              <td>${notes}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </details>`;
}

function renderBackground(el) {
  el.innerHTML = `
    <h2 class="step-title">Передісторія</h2>
    <p class="step-desc">Дає 2 навички, спорядження та особистісні підказки.</p>
    <div class="card-grid" id="bgCards"></div>`;

  const grid = $('#bgCards');
  Object.values(DND.BACKGROUNDS).forEach(bg => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `select-card ${state.background === bg.id ? 'selected' : ''}`;
    const sk = bg.skills.map(id => DND.SKILLS.find(s => s.id === id)?.name).join(', ');
    card.innerHTML = `<h4>${bg.name}</h4><p>Навички: ${sk}</p>
      <p style="margin-top:4px;font-size:0.82rem">${t(bg.feature)}</p>`;
    card.addEventListener('click', () => { state.background = bg.id; renderSheet(); renderStep(); scheduleSave(); });
    grid.appendChild(card);
  });
}

function renderAbilities(el) {
  el.innerHTML = `
    <h2 class="step-title">Характеристики</h2>
    <p class="step-desc">Купівля очками (27), стандартний набір, 4d6 (скинь найменший) або вручну.
      <br><strong>Важливо:</strong> при стандартному наборі та кидках <em>ти сам</em> розподіляєш значення по характеристиках — не автоматично!</p>
    <div class="method-bar" id="methodBar">
      <button type="button" class="method-btn ${state.abilityMethod === 'pointbuy' ? 'active' : ''}" data-m="pointbuy">Купівля очками</button>
      <button type="button" class="method-btn ${state.abilityMethod === 'standard' ? 'active' : ''}" data-m="standard">Стандартний набір</button>
      <button type="button" class="method-btn ${state.abilityMethod === 'roll' ? 'active' : ''}" data-m="roll">4d6 × 6</button>
      <button type="button" class="method-btn ${state.abilityMethod === 'manual' ? 'active' : ''}" data-m="manual">Вручну</button>
    </div>
    <div id="abilityExtra"></div>
    <div class="ability-panel" id="abilityPanel"></div>
    <p class="ability-warn" id="abilityWarn"></p>
    ${renderStatsGuideHtml(false)}`;

  $('#methodBar').querySelectorAll('.method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.abilityMethod = btn.dataset.m;
      if (state.abilityMethod === 'standard') {
        DND.ABILITIES.forEach(a => { state.abilities[a] = 0; });
      }
      if (state.abilityMethod === 'roll' && !state.rolledSets.length) rollAbilities();
      if (state.abilityMethod === 'pointbuy') {
        DND.ABILITIES.forEach(a => { state.abilities[a] = 8; });
      }
      renderStep();
      renderSheet();
      scheduleSave();
    });
  });

  const extra = $('#abilityExtra');
  const pool = getScorePool();

  if (state.abilityMethod === 'pointbuy') {
    extra.innerHTML = `<div class="info-box">Залишок очок: <strong id="pbRemain">${pointBuyRemaining()}</strong> / 27
      <br>Мінімум 8, максимум 15 <em>до</em> расових бонусів. Потім раса додає +1/+2 автоматично.</div>`;
  } else if (state.abilityMethod === 'standard') {
    extra.innerHTML = `<div class="info-box ability-assign-hint">
      <strong>Стандартний набір:</strong> розподіли ці 6 значень між характеристиками (кожне — один раз):
      <div class="ability-pool">${DND.STANDARD_ARRAY.map(v => {
        const used = DND.ABILITIES.filter(a => state.abilities[a] === v).length;
        const cnt = DND.STANDARD_ARRAY.filter(x => x === v).length;
        return `<span class="pool-chip ${used >= cnt ? 'used' : ''}">${v}</span>`;
      }).join('')}</div>
    </div>`;
  } else if (state.abilityMethod === 'roll') {
    extra.innerHTML = `<button type="button" class="btn ghost" id="btnReroll">🎲 Перекинути 6 наборів</button>
      <div class="roll-results" id="rollResults"></div>`;
    $('#btnReroll').addEventListener('click', () => {
      rollAbilities();
      state.selectedRollSet = null;
      DND.ABILITIES.forEach(a => { state.abilities[a] = 0; });
      renderStep(); renderSheet(); scheduleSave();
    });
    const rr = $('#rollResults');
    rr.innerHTML = '';
    if (state.rolledSets.length) {
      state.rolledSets.forEach((set, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `roll-die method-btn ${state.selectedRollSet === set ? 'active' : ''}`;
        b.textContent = `Набір ${i + 1}: ${set.join(', ')} (Σ${set.reduce((a, x) => a + x, 0)})`;
        b.addEventListener('click', () => {
          state.selectedRollSet = set;
          DND.ABILITIES.forEach(a => { state.abilities[a] = 0; });
          renderStep(); renderSheet(); scheduleSave();
        });
        rr.appendChild(b);
      });
    }
    if (state.selectedRollSet) {
      extra.innerHTML += `<div class="info-box ability-assign-hint" style="margin-top:12px">
        <strong>Обраний набір</strong> — розподіли по характеристиках:
        <div class="ability-pool">${state.selectedRollSet.map(v => `<span class="pool-chip">${v}</span>`).join('')}</div>
      </div>`;
    }
  } else {
    extra.innerHTML = `<div class="info-box">Вручну: будь-які значення 3–20 до расових бонусів.</div>`;
  }

  const panel = $('#abilityPanel');
  DND.ABILITIES.forEach(a => {
    const box = document.createElement('div');
    box.className = 'ability-control';
    const base = getBaseAbility(a);
    const final = getFinalAbilities()[a];
    const assign = abilitiesNeedAssign();

    if (assign && pool) {
      const opts = getScoreOptionsFor(a);
      box.innerHTML = `
        <div class="ab-label">${DND.ABILITY_NAMES[a]}</div>
        <select class="ab-select" data-ab="${a}">
          <option value="0">— обери значення —</option>
          ${opts.map(v => `<option value="${v}" ${state.abilities[a] === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <div class="ab-modifier">${base ? fmtMod(mod(base)) : '—'} → <strong>${base || '?'}</strong> з расою: <strong>${final}</strong> (${fmtMod(mod(final))})</div>`;
      box.querySelector('select').addEventListener('change', e => {
        state.abilities[a] = +e.target.value;
        renderStep(); renderSheet(); scheduleSave();
      });
    } else {
      box.innerHTML = `
        <div class="ab-label">${DND.ABILITY_NAMES[a]}</div>
        <div class="ab-btns">
          <button type="button" data-a="${a}" data-d="-1">−</button>
          <span class="ab-value">${state.abilities[a]}</span>
          <button type="button" data-a="${a}" data-d="1">+</button>
        </div>
        <div class="ab-modifier">база ${fmtMod(mod(state.abilities[a]))} → <strong>${final}</strong> з расою (${fmtMod(mod(final))})</div>`;
      box.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => adjustAbility(btn.dataset.a, +btn.dataset.d));
      });
    }
    panel.appendChild(box);
  });

  const warn = $('#abilityWarn');
  if (warn) {
    if (abilitiesNeedAssign() && !abilitiesFullyAssigned()) {
      warn.textContent = '⚠ Розподіли всі 6 значень — кожна характеристика має отримати рівно одне число з набору.';
    } else if (state.abilityMethod === 'pointbuy' && pointBuyRemaining() !== 0) {
      warn.textContent = `⚠ Витрать усі 27 очок (залишок: ${pointBuyRemaining()}).`;
    } else warn.textContent = '';
  }
}

function adjustAbility(a, delta) {
  const v = state.abilities[a] + delta;
  if (state.abilityMethod === 'pointbuy') {
    if (v < 8 || v > 15) return;
    const oldCost = DND.POINT_BUY_COSTS[state.abilities[a]];
    const newCost = DND.POINT_BUY_COSTS[v];
    if (pointBuyRemaining() - (newCost - oldCost) < 0) return;
  } else {
    if (v < 3 || v > 20) return;
  }
  state.abilities[a] = v;
  renderStep();
  renderSheet();
  scheduleSave();
}

function rollAbilities() {
  state.rolledSets = [];
  for (let s = 0; s < 6; s++) {
    const set = DND.ABILITIES.map(() => {
      const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6));
      dice.sort((a, b) => b - a);
      return dice[0] + dice[1] + dice[2];
    });
    state.rolledSets.push(set);
  }
}

function renderSkills(el) {
  const cls = getClassData();
  const maxSkills = cls ? cls.skills.choose : 0;
  const allowed = cls?.skills.from === 'any'
    ? DND.SKILLS.map(s => s.id)
    : (cls?.skills.from || []);

  el.innerHTML = `
    <h2 class="step-title">Навички та володіння</h2>
    <p class="step-desc">Обери ${maxSkills} навичок від класу. Передісторія та раса додаються автоматично.</p>
    ${cls ? `<div class="info-box">Рятувальні кидки: <strong>${cls.saves.map(s => DND.ABILITY_NAMES[s]).join(', ')}</strong>
      · Броня: ${DND.I18n.armorList(cls.armor) || 'немає'} · Зброя: ${DND.I18n.armorList(cls.weapons)}</div>` : ''}
    <p class="warn" id="skillWarn"></p>
    <div class="skill-list" id="skillList"></div>`;

  const list = $('#skillList');
  DND.SKILLS.forEach(sk => {
    if (allowed.length && !allowed.includes(sk.id)) return;
    const prof = state.skillProficiencies.includes(sk.id);
    const bgProf = state.background && DND.BACKGROUNDS[state.background]?.skills.includes(sk.id);
    const item = document.createElement('label');
    item.className = `skill-item ${prof || bgProf ? 'proficient' : ''}`;
    item.innerHTML = `
      <input type="checkbox" data-skill="${sk.id}" ${prof ? 'checked' : ''} ${bgProf ? 'disabled checked' : ''}>
      <span class="skill-name">${sk.name}</span>
      <span class="skill-ability">${DND.ABILITY_NAMES[sk.ability].slice(0,3)}</span>
      <span class="skill-bonus">${fmtMod(skillBonus(sk.id))}</span>`;
    item.querySelector('input').addEventListener('change', e => {
      const id = e.target.dataset.skill;
      if (e.target.checked) {
        if (state.skillProficiencies.length >= maxSkills) { e.target.checked = false; return; }
        state.skillProficiencies.push(id);
      } else {
        state.skillProficiencies = state.skillProficiencies.filter(s => s !== id);
      }
      updateSkillWarn(maxSkills);
      renderStep();
      renderSheet();
    });
    list.appendChild(item);
  });
  updateSkillWarn(maxSkills);

  if (state.race === 'halfElf') {
    list.insertAdjacentHTML('afterend', `<p class="step-desc" style="margin-top:16px">Напівельф: +2 додаткові навички (будь-які)</p>
      <div class="skill-list" id="halfElfSkills"></div>`);
    const heList = $('#halfElfSkills');
    DND.SKILLS.forEach(sk => {
      const prof = state.extraSkills.includes(sk.id);
      const item = document.createElement('label');
      item.className = `skill-item ${prof ? 'proficient' : ''}`;
      item.innerHTML = `
        <input type="checkbox" data-extra="${sk.id}" ${prof ? 'checked' : ''}>
        <span class="skill-name">${sk.name}</span>
        <span class="skill-bonus">${fmtMod(skillBonus(sk.id))}</span>`;
      item.querySelector('input').addEventListener('change', e => {
        const id = e.target.dataset.extra;
        if (e.target.checked) {
          if (state.extraSkills.length >= 2) { e.target.checked = false; return; }
          state.extraSkills.push(id);
        } else {
          state.extraSkills = state.extraSkills.filter(s => s !== id);
        }
        renderSheet();
        renderStep();
      });
      heList.appendChild(item);
    });
  }
}

function updateSkillWarn(max) {
  const w = $('#skillWarn');
  if (w) w.textContent = `Обрано ${state.skillProficiencies.length} / ${max}`;
}

function renderEquipment(el) {
  const cls = getClassData();

  el.innerHTML = `
    <h2 class="step-title">Спорядження та інвентар</h2>
    <p class="step-desc">Стартовий лут класу та передісторії, броня для AC, свій список речей.</p>
    <div class="field"><label>Тип броні (для AC)</label>
      <select id="inpArmor">
        <option value="none" ${state.armorChoice === 'none' ? 'selected' : ''}>Без броні (10 + СПР)</option>
        <option value="leather" ${state.armorChoice === 'leather' ? 'selected' : ''}>Шкіряна (11 + СПР)</option>
        <option value="scale" ${state.armorChoice === 'scale' ? 'selected' : ''}>Луската (14 + СПР, макс +2)</option>
        <option value="chain" ${state.armorChoice === 'chain' ? 'selected' : ''}>Кольчуга (16, без бонусу СПР)</option>
        <option value="shield" ${state.armorChoice === 'shield' ? 'selected' : ''}>Шкіра + щит (12 + СПР)</option>
      </select></div>
    <div class="equip-list" id="equipList"></div>
    <div class="inv-section">
      <h4>🎒 Інвентар</h4>
      <p class="spell-section-hint">Додавай предмети вручну — без магазину та цін. Золото й покупки вирішує DM у грі.</p>
      <div class="inv-custom-row">
        <input type="text" id="customItemName" placeholder="Назва предмета">
        <input type="text" id="customItemDesc" placeholder="Короткий опис (необов'язково)">
        <button type="button" class="btn ghost" id="btnAddCustom">+ Додати</button>
      </div>
      <div class="inv-preset-row">
        <span class="inv-preset-label">Швидко:</span>
        <div class="inv-preset-btns" id="invPresets"></div>
      </div>
      <div class="inv-custom-list" id="customItemList"></div>
    </div>`;

  $('#inpArmor').addEventListener('change', e => { state.armorChoice = e.target.value; renderSheet(); scheduleSave(); });

  const list = $('#equipList');
  if (!cls) {
    list.innerHTML = '<p class="warn">Спочатку обери клас — з\'явиться стартовий набір</p>';
  } else {
    cls.equipment.forEach((eq, i) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="equip" value="${i}" ${state.equipmentChoice === i ? 'checked' : ''}>
        <div><strong>Стартовий варіант ${i + 1}</strong><br>${eq.label}<br><small>${eq.items.join(' · ')}</small></div>`;
      label.querySelector('input').addEventListener('change', () => {
        state.equipmentChoice = i;
        state.selectedEquipment = eq.items;
        scheduleSave();
      });
      list.appendChild(label);
    });
  }

  if (state.background) {
    const bg = DND.BACKGROUNDS[state.background];
    list.innerHTML += `<div class="info-box"><strong>Від передісторії (безкоштовно):</strong> ${bg.equipment.join(', ')}</div>`;
  }

  const presets = $('#invPresets');
  const presetItems = ['longsword', 'dagger', 'healingPotion', 'rope', 'torch', 'backpack', 'holySymbol', 'arcaneFocus'];
  presetItems.forEach(pid => {
    const it = DND.getItem(pid);
    if (!it) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost inv-preset-btn';
    btn.textContent = it.name;
    btn.title = it.desc;
    btn.addEventListener('click', () => {
      if (!state.customItems) state.customItems = [];
      state.customItems.push({ id: crypto.randomUUID(), name: it.name, desc: it.desc });
      renderStep(); renderSheet(); scheduleSave();
    });
    presets.appendChild(btn);
  });

  const customList = $('#customItemList');
  const items = state.customItems || [];
  if (!items.length) {
    customList.innerHTML = '<p class="spell-section-hint">Поки порожньо — додай предмет вище.</p>';
  } else {
    items.forEach((c, idx) => {
      customList.innerHTML += `<div class="custom-item">
        <div><strong>${esc(c.name)}</strong>${c.desc ? `<br><small>${esc(c.desc)}</small>` : ''}</div>
        <button type="button" class="btn ghost" data-rm-custom="${idx}">✕</button>
      </div>`;
    });
  }
  customList.querySelectorAll('[data-rm-custom]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.customItems.splice(+btn.dataset.rmCustom, 1);
      renderStep(); scheduleSave();
    });
  });

  $('#btnAddCustom').addEventListener('click', () => {
    const name = $('#customItemName').value.trim();
    const desc = $('#customItemDesc').value.trim();
    if (!name) return;
    if (!state.customItems) state.customItems = [];
    state.customItems.push({ id: crypto.randomUUID(), name, desc });
    $('#customItemName').value = '';
    $('#customItemDesc').value = '';
    renderStep(); renderSheet(); scheduleSave();
  });
}

function renderSpells(el) {
  const sc = getSpellcasting();
  if (!sc) {
    el.innerHTML = `<h2 class="step-title">Заклинання</h2>
      <p class="step-desc">Твій клас не використовує заклинання на цьому етапі.</p>
      <div class="info-box">Воїнські класи без магії: Варвар, Воїн, Монах, Розбійник (без Містичного шахрая).</div>`;
    return;
  }

  const cantripMax = getCantripLimit();
  const spellMax = sc.type === 'known'
    ? (sc.spellsKnown ? sc.spellsKnown[Math.min(state.level, 20) - 1] : 0)
    : Math.min(6, state.level + 1);
  const maxSpellLv = getMaxSpellLevel();
  const availableSpells = getAvailableSpells();
  const availableIds = new Set(availableSpells.map(s => s.id));
  if (state.spells.length) {
    state.spells = state.spells.filter(id => availableIds.has(id));
  }

  let spellBlocks = '';
  if (maxSpellLv > 0) {
    spellBlocks = `<p class="spell-section-hint">Показані заклинання 1–${maxSpellLv}р (за твоїми ячейками). У D&D ячейки до <strong>9 рівня</strong> — каталог SRD на сайті теж до 9р.</p>`;
    for (let sl = 1; sl <= maxSpellLv; sl++) {
      spellBlocks += `<div class="spell-section spell-level-group">
        <h4>📜 ${sl} рівень ячейки</h4>
        <div class="spell-cards" id="spellChips${sl}"></div>
      </div>`;
    }
  } else {
    spellBlocks = '<p class="spell-section-hint">У тебе ще немає ячейок (паладин/рейнджер з 2 рівня) — обирай тільки заговори.</p>';
  }

  el.innerHTML = `
    <h2 class="step-title">Заклинання</h2>
    ${renderMagicGuideHtml()}
    <p class="step-desc">${sc.type === 'prepared' ? 'Підготовлені' : 'Відомі'} заклинання · характеристика: ${DND.ABILITY_NAMES[sc.ability]}
      · Заговори: ${state.cantrips.length}/${cantripMax} · Заклинання 1+р: ${state.spells.length}/${spellMax}</p>
    <div class="info-box">Складність (DC): <strong>${getSpellSaveDC()}</strong> · Атака: <strong>${fmtMod(getSpellAttack())}</strong>
      · Ячейки: ${getSpellSlots().map((s,i) => `${i+1}р×${s}`).join(', ') || 'немає — тільки заговори'}</div>
    <div class="spell-section">
      <h4>✨ Заговори (0 рівень) — не плутати з «заклинанням 1 рівня»</h4>
      <p class="spell-section-hint">Без ячейок. Кожен хід — 1 раз основною дією (не «скільки завгодно за один хід»).</p>
      <div class="spell-cards" id="cantripChips"></div>
    </div>
    ${spellBlocks}`;

  renderSpellCards('#cantripChips', DND.SPELLS.cantrips, state.cantrips, cantripMax, true);
  for (let sl = 1; sl <= maxSpellLv; sl++) {
    renderSpellCards(`#spellChips${sl}`, getSpellsAtLevel(sl), state.spells, spellMax, false);
  }
}

function renderSpellCards(sel, pool, selected, max, isCantrip) {
  const container = $(sel);
  const cls = state.class;
  const md = (s) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  container.innerHTML = '';
  const filtered = pool.filter(sp => sp.classes.includes(cls));
  if (!filtered.length) {
    container.innerHTML = '<p class="spell-section-hint">Немає доступних для цього класу.</p>';
    return;
  }
  filtered.forEach(sp => {
    const det = DND.getSpellDetail(sp.id);
    const isSel = selected.includes(sp.id);
    const spellLv = isCantrip ? 0 : (sp.spellLevel ?? det.level);
    const lvlLabel = spellLv === 0 ? 'заговір (0 рівень)' : `заклинання ${spellLv} рівня`;
    const dmg = DND.damageAtLevel(sp.id, state.level);
    const actionHelp = DND.getActionHelp(det.cast);
    const compHint = DND.explainComponents(det.components);
    const saveHint = DND.explainSave(det.save, getSpellAttack(), getSpellSaveDC());
    const durHint = DND.explainDuration(det.duration);
    const extraHint = DND.explainSpellExtra(sp.id);
    const card = document.createElement('div');
    card.className = `spell-card ${isSel ? 'selected' : ''}`;
    card.innerHTML = `
      <label class="spell-card-head">
        <input type="checkbox" ${isSel ? 'checked' : ''}>
        <div>
          <div class="spell-card-title">${DND.I18n.spell(sp.name, sp.school)}</div>
          <div class="spell-card-meta">${lvlLabel} · ${det.cast} · ${det.range}</div>
          ${actionHelp ? `<div class="spell-card-action">${actionHelp}</div>` : ''}
        </div>
      </label>
      <div class="spell-card-body">
        <p class="spell-damage-now">${md(dmg.now)}</p>
        <p><strong>Рятунок:</strong> ${det.save}${saveHint && saveHint !== det.save ? `<br><span class="spell-inline-hint">${saveHint}</span>` : ''}</p>
        <p><strong>Тривалість:</strong> ${det.duration}${durHint ? ` <span class="spell-inline-hint">— ${durHint}</span>` : ''}</p>
        <p><strong>Компоненти:</strong> ${det.components}${compHint ? `<br><span class="spell-inline-hint">${compHint}</span>` : ''}</p>
        <p>${md(det.desc)}</p>
        ${extraHint ? `<p class="spell-inline-hint spell-example">${extraHint}</p>` : ''}
        ${spellLv === 0
          ? '<p class="spell-freq"><em>Частота:</em> 1 раз за хід (основна дія). Ячейки не витрачаються — можеш кастувати кожен раунд бою.</p>'
          : `<p class="spell-freq"><em>Частота:</em> 1 ячейка ${spellLv} рівня за каст. Відновлення ячейок — довгий відпочинок.</p>`}
      </div>`;
    const cb = card.querySelector('input');
    cb.addEventListener('change', () => {
      const idx = selected.indexOf(sp.id);
      if (cb.checked) {
        if (selected.length < max) selected.push(sp.id);
        else { cb.checked = false; return; }
      } else if (idx >= 0) selected.splice(idx, 1);
      renderStep(); renderSheet(); scheduleSave();
    });
    container.appendChild(card);
  });
}


function renderPersonality(el) {
  const bg = state.background ? DND.BACKGROUNDS[state.background] : null;
  el.innerHTML = `
    <h2 class="step-title">Особистість та зовнішність</h2>
    <p class="step-desc">Риси характеру, ідеали, зв'язки, вади та опис.</p>
    ${bg ? `<div class="info-box"><strong>Підказки (${bg.name}):</strong><br>
      Риси: ${bg.personality.traits.join(' / ')}<br>
      Ідеали: ${bg.personality.ideals.join(' / ')}</div>` : ''}
    <div class="field-grid">
      <div class="field"><label>Риси характеру</label>
        <textarea id="inpTraits">${esc(state.personality.traits)}</textarea></div>
      <div class="field"><label>Ідеали</label>
        <textarea id="inpIdeals">${esc(state.personality.ideals)}</textarea></div>
      <div class="field"><label>Зв'язки</label>
        <textarea id="inpBonds">${esc(state.personality.bonds)}</textarea></div>
      <div class="field"><label>Вади</label>
        <textarea id="inpFlaws">${esc(state.personality.flaws)}</textarea></div>
      <div class="field"><label>Вік</label><input id="inpAge" value="${esc(state.appearance.age)}"></div>
      <div class="field"><label>Зріст</label><input id="inpHeight" value="${esc(state.appearance.height)}"></div>
      <div class="field"><label>Вага</label><input id="inpWeight" value="${esc(state.appearance.weight)}"></div>
      <div class="field"><label>Очі</label><input id="inpEyes" value="${esc(state.appearance.eyes)}"></div>
      <div class="field"><label>Шкіра</label><input id="inpSkin" value="${esc(state.appearance.skin)}"></div>
      <div class="field"><label>Волосся</label><input id="inpHair" value="${esc(state.appearance.hair)}"></div>
    </div>
    <div class="field"><label>Нотатки</label><textarea id="inpNotes">${esc(state.notes)}</textarea></div>`;

  const bind = (id, obj, key) => {
    $(id).addEventListener('input', e => { obj[key] = e.target.value; scheduleSave(); });
  };
  bind('#inpTraits', state.personality, 'traits');
  bind('#inpIdeals', state.personality, 'ideals');
  bind('#inpBonds', state.personality, 'bonds');
  bind('#inpFlaws', state.personality, 'flaws');
  bind('#inpAge', state.appearance, 'age');
  bind('#inpHeight', state.appearance, 'height');
  bind('#inpWeight', state.appearance, 'weight');
  bind('#inpEyes', state.appearance, 'eyes');
  bind('#inpSkin', state.appearance, 'skin');
  bind('#inpHair', state.appearance, 'hair');
  bind('#inpNotes', state, 'notes');
}

function renderReview(el) {
  const abilities = getFinalAbilities();
  const cls = getClassData();
  const race = state.race ? DND.RACES[state.race] : null;
  const bg = state.background ? DND.BACKGROUNDS[state.background] : null;

  el.innerHTML = `
    <h2 class="step-title">Огляд персонажа</h2>
    <p class="step-desc">Перевір усе перед експортом листа персонажа.</p>
    <div class="review-block"><h4>${state.name || 'Без імені'} — Рівень ${state.level}</h4>
      <p>${race?.name || '?'} ${cls?.name || '?'} · ${state.alignment}</p>
      <p>${bg?.name || 'Без передісторії'}</p></div>
    <div class="review-block"><h4>Характеристики</h4>
      ${DND.ABILITIES.map(a => `${DND.ABILITY_NAMES[a]}: ${abilities[a]} (${fmtMod(mod(abilities[a]))})`).join(' · ')}</div>
    <div class="review-block"><h4>Бій</h4>
      HP ${getMaxHp()} · AC ${getAC()} · Ініціатива ${fmtMod(getInitiative())} · Швидкість ${race?.speed || 30} фт</div>
    <div class="review-block"><h4>Навички</h4>
      ${getProficientSkills().map(id => {
        const sk = DND.SKILLS.find(s => s.id === id);
        return sk ? `${sk.name} ${fmtMod(skillBonus(id))}` : '';
      }).join(' · ') || '—'}</div>
    <div class="review-block"><h4>Риси класу</h4><ul class="feature-list">
      ${getClassFeatures().map(f => `<li>Рів.${f.level}: ${t(f.name)}</li>`).join('')}</ul></div>
    <div class="review-block"><h4>Расові риси</h4><ul class="feature-list">
      ${getRacialTraits().map(tr => `<li>${t(tr)}</li>`).join('')}</ul></div>
    ${getSpellcasting() ? `<div class="review-block"><h4>Заклинання</h4>
      Заговори: ${state.cantrips.map(id => t(DND.SPELLS.cantrips.find(s=>s.id===id)?.name)).join(', ') || '—'}<br>
      Заклинання: ${state.spells.map(id => t(getAllLeveledSpells().find(s=>s.id===id)?.name)).join(', ') || '—'}</div>` : ''}
    <div class="review-block"><h4>Інвентар</h4>
      ${getInventoryList().map(it => `• ${esc(it.name)}${it.desc ? ' — ' + esc(it.desc) : ''}`).join('<br>') || '—'}</div>
    <button type="button" class="btn primary" id="btnReviewExport">📋 Експортувати лист персонажа</button>`;

  $('#btnReviewExport').addEventListener('click', exportSheet);
}

/* ══ Export ══════════════════════════════════════════════════════════════ */
function buildCharacterJson() {
  return JSON.parse(JSON.stringify(state));
}

function exportSheet() {
  const abilities = getFinalAbilities();
  const cls = getClassData();
  const race = state.race ? DND.RACES[state.race] : null;
  const sub = state.subrace && race?.subraces?.[state.subrace];
  const bg = state.background ? DND.BACKGROUNDS[state.background] : null;
  const sc = getSpellcasting();

  let text = `
╔══════════════════════════════════════════════════════════════╗
║                    D&D 5e CHARACTER SHEET                     ║
╚══════════════════════════════════════════════════════════════╝

Ім'я: ${state.name || '—'}          Гравець: ${state.playerName || '—'}
Раса: ${race?.name || '—'}${sub ? ' (' + DND.I18n.subrace(sub.name) + ')' : ''}
Клас: ${cls?.name || '—'}${state.subclass && cls ? ' — ' + DND.I18n.subclass(cls.subclasses[state.subclass]?.name) : ''}
Рівень: ${state.level}              Вирівнювання: ${state.alignment}
Передісторія: ${bg?.name || '—'}
Бонус майстерності: ${fmtMod(profBonus(state.level))}

── ХАРАКТЕРИСТИКИ ──────────────────────────────────────────────
${DND.ABILITIES.map(a => {
  const pad = DND.ABILITY_NAMES[a].padEnd(12);
  return `${pad} ${abilities[a].toString().padStart(2)}  (${fmtMod(mod(abilities[a]))})`;
}).join('\n')}

── БІЙ ───────────────────────────────────────────────────────────
HP (здоров'я): ${getMaxHp()} (d${cls?.hitDie || '?'}+Тіло)    AC (броня): ${getAC()}
Ініціатива: ${fmtMod(getInitiative())}            Швидкість: ${race?.speed || 30} фт
Пасивне сприйняття: ${getPassivePerception()}
Куби здоров'я: ${state.level}d${cls?.hitDie || '?'}

── РЯТУВАЛЬНІ КИДКИ ─────────────────────────────────────────────
${cls ? cls.saves.map(s => `${DND.ABILITY_NAMES[s]}: ${fmtMod(mod(abilities[s]) + profBonus(state.level))} (майстерність)`).join('\n') : '—'}

── НАВИЧКИ ───────────────────────────────────────────────────────
${getProficientSkills().map(id => {
  const sk = DND.SKILLS.find(s => s.id === id);
  return sk ? `${sk.name.padEnd(22)} ${fmtMod(skillBonus(id))}` : '';
}).join('\n') || '—'}

── ВОЛОДІННЯ ─────────────────────────────────────────────────────
Броня: ${DND.I18n.armorList(cls?.armor) || '—'}
Зброя: ${DND.I18n.armorList(cls?.weapons) || '—'}
Інструменти: ${bg?.tools?.map(x => t(x)).join(', ') || '—'}

── СПОРЯДЖЕННЯ ───────────────────────────────────────────────────
Стартовий набір: ${state.selectedEquipment.length ? state.selectedEquipment.join(', ') : '(варіант ' + (state.equipmentChoice + 1) + ')'}
${bg ? 'Від передісторії: ' + bg.equipment.join(', ') : ''}

── ІНВЕНТАР ───────────────────────────────────────────────────────
${getInventoryList().map(it => `• ${it.name}${it.desc ? ' — ' + it.desc : ''}`).join('\n') || '—'}

── РАСОВІ РИСИ ───────────────────────────────────────────────────
${getRacialTraits().map(tr => '• ' + t(tr)).join('\n')}

── РИСИ КЛАСУ ────────────────────────────────────────────────────
${getClassFeatures().map(f => `Рів.${f.level}: ${t(f.name)}`).join('\n')}

── ПЕРЕДІСТОРІЯ ──────────────────────────────────────────────────
${bg ? t(bg.feature) : '—'}

── ОСОБИСТІСТЬ ───────────────────────────────────────────────────
Риси: ${state.personality.traits || '—'}
Ідеали: ${state.personality.ideals || '—'}
Зв'язки: ${state.personality.bonds || '—'}
Вади: ${state.personality.flaws || '—'}

── ЗОВНІШНІСТЬ ───────────────────────────────────────────────────
Вік: ${state.appearance.age || '—'}  Зріст: ${state.appearance.height || '—'}  Вага: ${state.appearance.weight || '—'}
Очі: ${state.appearance.eyes || '—'}  Шкіра: ${state.appearance.skin || '—'}  Волосся: ${state.appearance.hair || '—'}
`;

  if (sc) {
    text += `
── МАГІЯ ─────────────────────────────────────────────────────────
Характеристика заклинань: ${DND.ABILITY_NAMES[sc.ability]}
Складність (DC): ${getSpellSaveDC()}    Атака: ${fmtMod(getSpellAttack())}
Ячейки: ${getSpellSlots().map((s, i) => `${i + 1}р: ${s}`).join('  ') || '—'}

Заговори: ${state.cantrips.map(id => t(DND.SPELLS.cantrips.find(s => s.id === id)?.name)).join(', ') || '—'}
Заклинання: ${state.spells.map(id => {
  const all = getAllLeveledSpells();
  return t(all.find(s => s.id === id)?.name);
}).join(', ') || '—'}
`;
  }

  if (state.notes) text += `\n── НОТАТКИ ───────────────────────────────────────────────────────\n${state.notes}\n`;

  text += `\n────────────────────────────────────────────────────────────────\nGenerated by DnD Hero Forge · Fox Hub\n`;

  showOverlay('Лист персонажа', text.trim());
}

function exportJson() {
  showOverlay('JSON персонажа', JSON.stringify(buildCharacterJson(), null, 2));
}

function showOverlay(title, content) {
  $('#overlayTitle').textContent = title;
  $('#overlayContent').textContent = content;
  $('#overlay').hidden = false;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

/* ══ Init ════════════════════════════════════════════════════════════════ */
function renderRoster() {
  const list = $('#rosterList');
  if (!list) return;
  const chars = Roster.list();
  if (!chars.length) {
    list.innerHTML = '<li class="roster-hint">Ще немає збережених — натисни «+ Новий»</li>';
    return;
  }
  list.innerHTML = chars.map(ch => {
    const cls = ch.class ? DND.CLASSES[ch.class]?.name : '—';
    const race = ch.race ? DND.RACES[ch.race]?.name : '—';
    const active = ch.id === state.id ? ' active' : '';
    const label = ch.name || 'Без імені';
    return `<li class="roster-item${active}">
      <div class="roster-item-info">
        <div class="roster-item-name">${esc(label)}</div>
        <div class="roster-item-meta">Рів.${ch.level || 1} · ${race} · ${cls}</div>
      </div>
      <div class="roster-item-actions">
        <button type="button" data-open="${ch.id}">Відкрити</button>
        <button type="button" data-del="${ch.id}">🗑</button>
      </div>
    </li>`;
  }).join('');
  list.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      Roster.save(state);
      loadCharacter(btn.dataset.open);
      $('#rosterPanel').hidden = true;
    });
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Видалити цього персонажа?')) return;
      const id = btn.dataset.del;
      Roster.remove(id);
      if (state.id === id) loadCharacter(Roster.activeId());
      else renderRoster();
    });
  });
}

function render() {
  renderNav();
  renderStep();
  renderSheet();
  scheduleSave();
}

$('#btnPrev').addEventListener('click', () => {
  if (state.step > 0) { state.step--; render(); }
});
$('#btnNext').addEventListener('click', () => {
  const stepId = DND.WIZARD_STEPS[state.step].id;
  if (stepId === 'abilities') {
    if (abilitiesNeedAssign() && !abilitiesFullyAssigned()) {
      alert('Розподіли всі характеристики з набору перед тим як йти далі.');
      return;
    }
    if (state.abilityMethod === 'pointbuy' && pointBuyRemaining() !== 0) {
      alert(`Витрать усі очки Point Buy (залишок: ${pointBuyRemaining()}).`);
      return;
    }
  }
  if (state.step < DND.WIZARD_STEPS.length - 1) { state.step++; render(); }
  else exportSheet();
});
$('#btnExportSheet').addEventListener('click', exportSheet);
$('#btnExportJson').addEventListener('click', exportJson);
$('#overlayClose').addEventListener('click', () => { $('#overlay').hidden = true; });
$('#overlayCopy').addEventListener('click', () => {
  navigator.clipboard.writeText($('#overlayContent').textContent);
});
$('#btnRoster').addEventListener('click', () => {
  renderRoster();
  $('#rosterPanel').hidden = false;
});
$('#rosterClose').addEventListener('click', () => { $('#rosterPanel').hidden = true; });
$('#btnNewChar').addEventListener('click', () => {
  Roster.save(state);
  state = Roster.createNew();
  enforceSubclassLevel();
  render();
});
$('#btnSaveNow').addEventListener('click', () => {
  Roster.save(state);
  alert('Збережено: ' + (state.name || 'Без імені'));
  renderRoster();
});
$('#fileInput')?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = Roster.migrate(JSON.parse(reader.result));
      state = Roster.save(imported);
      enforceSubclassLevel();
      render();
    } catch { alert('Невірний JSON файл'); }
  };
  reader.readAsText(file);
});

function init() {
  if (typeof DND === 'undefined') {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif;color:#f5e6c8;background:#0a0604;min-height:100vh">'
      + '<h2>Помилка завантаження даних</h2><p>Файл <code>data.js</code> не завантажився — перевір консоль (F12).</p></div>';
    return;
  }
  const activeId = Roster.activeId();
  state = activeId ? Roster.get(activeId) : Roster.createNew();
  enforceSubclassLevel();
  resizeBg();
  if (bgCanvas) requestAnimationFrame(drawBg);
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
