'use strict';

/* Пояснення магії та бою */
DND.MAGIC_GUIDE = {
  cantripVsSpell: `**Заговір (cantrip)** — заклинання 0 рівня. Не потребує ячейок — можеш кастувати **кожен хід**, не витрачаючи ячейки. Але **1 раз за хід** основною дією (у тебе лише одна основна дія). Сила зростає з твоїм загальним рівнем персонажа (не з рівнем ячейки).

**Заклинання 1+ рівня** — потрібна **ячейка** того ж рівня (або вищої). Ячейки відновлюються після **довгого відпочинку** (~8 год сну). На 1 рівні зазвичай є лише **ячейки 1 рівня** — тому Fireball (3 рівень) ще недоступний.`,

  actions: `**За хід у бою маєш:**

• **Основна дія (Action)** — 1 раз: атака зброєю, більшість заклинань («1 дія»), Dash, Dodge, Help тощо.

• **Бонусна дія (Bonus Action)** — 1 раз: лише якщо заклинання/здібність це дозволяє (напр. Healing Word, Hex). Не можеш зробити дві бонусні дії.

• **Реакція (Reaction)** — 1 раз між своїми ходами: Shield, Counterspell, Opportunity Attack.

• **Переміщення** — до швидкості (окремо від дій).

**Два заклинання за хід:** з рівня 2+ можеш кастувати заклинання **бонусною дією** + **основною** в один хід (правило «1 spell slot per turn» не застосовується до заговорів).`,

  spellLevelNote: (charLevel, maxSpellLv, slots) =>
    `Твій персонаж — **рівень ${charLevel}**. Зараз можеш кастувати заклинання до **${maxSpellLv} рівня** ячейки.`
    + (slots.length ? ` Ячейки: ${slots.map((s, i) => `${i + 1}р×${s}`).join(', ')}.` : ' Поки немає ячейок — лише заговори.')
    + (maxSpellLv < 9 ? ` У D&D ячейки ростуть до **9 рівня** (17–20 lvl персонажа).` : ''),

  components: `**Компоненти** — що потрібно, щоб кастувати заклинання:

• **В (Verbal)** — **слова**. Треба вимовляти заклинальні слова вголос. У **тиші** (Silence) або з **заклятими вустами** (gagged) — не кастуєш.

• **С (Somatic)** — **жести**. Вільна рука для рухів. Якщо руки зв’язані — не кастуєш (якщо немає Metamagic / особливих рис).

• **М (Material)** — **матеріали**. Предмет(и) з опису заклинання. Якщо в дужках **«… вартістю X зм»** — предмет **витрачається** при касті. Без М-компонента — не кастуєш (рукавиця з магічних предметів інколи замінює).

**Фокус (Focus)** — чарівна паличка / символ святого тощо може **замінити** М-компонент без зазначеної ціни. DM вирішує деталі.`,

  savingThrows: `**Рятунок (Saving Throw)** — **ворог / ціль** кидає кубик, не ти. Вона кидає **d20 + СВІЙ модифікатор характеристики** (напр. її Мудрість, якщо «МДР рятунок») **+ її бонус майстерності** (якщо володіє рятунками), щоб **встояти** проти твого заклинання.

• **Успіх** (результат ≥ твій DC) — часто **половина урону** або ефект слабший.
• **Провал** — повний урон або повний ефект.

**Твій DC (складність)** — число від **твоїх** характеристик: 8 + твій бонус майстерності + **твій** мод. характеристики заклинань (ІНТ для чарівника, МДР для клірика тощо). Показано в синій плашці вище.

**Кидок атаки заклинанням** — навпаки кидаєш **ти**: d20 + твій бонус атаки проти **КБ (броні) цілі**.`,

  abilities: `**Скорочення характеристик** (для рятунків і модифікаторів):

• **СИЛ (STR)** — Сила · **DEX** — Спритність · **CON** — Тіло (Витривалість)
• **ІНТ (INT)** — Інтелект · **МДР (WIS)** — Мудрість · **ХАР (CHA)** — Харизма

**Модифікатор** = (значення − 10) ÷ 2 (округлення вниз). Приклад: Тіло 14 → мод. **+2** → CON рятунок = d20 **+2** (+ бонус майстерності, якщо є).

**У заклинаннях:** «МДР рятунок» = **ціль** кидає рятунок, використовуючи **свою** Мудрість. «DEX рятунок» = **свою** Спритність. Твоя Мудрість тут **не** береться — вона лише для **твого DC**, якщо ти клірик/друїд.`,

  spellTerms: `**Інші терміни на картках:**

• **Дистанція** — на якій відстані можна націлити / вразити ціль.
• **Тривалість** — скільки діє ефект. **Концентрація (Concentration)** — тримаєш ефект, поки не отримаєш урон і не провалиш CON рятунок, не кастуєш інше концентраційне, не станеш без свідомості тощо.
• **Миттєво (Instantaneous)** — ефект зараз, не «висить» на цілі.
• **1 раунд / 1 хв / 1 год** — скільки часу в грі триває заклинання.
• **Автопопадання** — не треба кидок атаки й рятунку (напр. Magic Missile).
• **Опір / імунітет** — опір = половина урону; імунітет = 0 урону / ефект не діє.`
};

/** Бонус майстерності за рівнем (1–20) */
DND.profBonusAt = function(level) {
  return Math.floor((Math.min(Math.max(level, 1), 20) - 1) / 4) + 2;
};

/** Діапазон урону кубиків: 1d10 → 1d10 (1–10) */
DND.diceRange = function(notation) {
  const m = String(notation).match(/(\d+)d(\d+)/);
  if (!m) return notation;
  const n = +m[1], sides = +m[2];
  return `${n}d${sides} (${n}–${n * sides})`;
};

DND.getSubclassUnlockLevel = function(classId) {
  return DND.SUBCLASS_UNLOCK?.[classId] ?? 3;
};

DND.getSlotsForClass = function(classId, level) {
  const cls = DND.CLASSES[classId];
  if (!cls?.spellcasting) return [];
  const lv = Math.min(Math.max(level, 1), 20);
  const sc = cls.spellcasting;
  if (sc.pactMagic) return DND.SPELL_SLOTS.warlock[lv] || [];
  if (sc.halfCaster) return DND.SPELL_SLOTS.half[lv] || [];
  return DND.SPELL_SLOTS.full[lv] || [];
};

DND.formatSlotsShort = function(slots) {
  if (!slots?.length || !slots.some(s => s > 0)) return '—';
  return slots.map((c, i) => (c ? `${i + 1}р×${c}` : null)).filter(Boolean).join(', ');
};

/** Таблиця розвитку класу 1–20 (оригінальні слоти PHB) */
DND.buildProgressionTable = function(classId, currentLevel, subclassId) {
  const cls = DND.CLASSES[classId];
  if (!cls) return [];
  const unlock = DND.getSubclassUnlockLevel(classId);
  const rows = [];
  for (let lv = 1; lv <= 20; lv++) {
    const feats = cls.features[lv] ? [...cls.features[lv]] : [];
    if (DND.ASI_LEVELS.includes(lv) && !feats.some(f => /improvement|Score/i.test(f))) {
      feats.push('Ability Score Improvement');
    }
    const subFeats = [];
    if (subclassId && lv >= unlock && cls.subclasses?.[subclassId]?.features?.[lv]) {
      subFeats.push(...cls.subclasses[subclassId].features[lv]);
    }
    const slots = DND.getSlotsForClass(classId, lv);
    const maxSp = DND.getMaxSpellLevelForChar(lv, slots);
    const cantrips = cls.spellcasting?.cantrips?.[lv - 1];
    const notes = [];
    if (lv === unlock) notes.push('★ обрати підклас');
    if (DND.ASI_LEVELS.includes(lv)) notes.push('+2 до статів або Feat');
    rows.push({
      level: lv,
      prof: DND.profBonusAt(lv),
      features: feats,
      subclassFeatures: subFeats,
      slots: DND.formatSlotsShort(slots),
      maxSpellLv: maxSp,
      cantrips,
      notes,
      isCurrent: lv === currentLevel,
      isPast: lv < currentLevel,
      isFuture: lv > currentLevel
    });
  }
  return rows;
};

/** Гайд: характеристики, навички, від чого залежить бонус */
DND.STATS_GUIDE = {
  intro: '**Модифікатор** = (значення − 10) ÷ 2, округлення вниз. Приклад: 14 → **+2**. Нижче — що на що впливає у твого героя.',

  abilities: [
    { id: 'str', abbr: 'STR', name: 'Сила', affects: [
      'Атаки **ближнього бою** (меч, сокира)',
      'Урон силової зброї',
      'Навички: **Атлетика**',
      'Перенесення ваги, пошкодження дверей'
    ]},
    { id: 'dex', abbr: 'DEX', name: 'Спритність', affects: [
      '**КБ (AC)** у легкій/середній броні',
      '**Ініціатива** (хто ходить першим)',
      'Атаки **лук/арбалет**, фехтувальна зброя',
      'Навички: **Акробатика**, **Стелс**, **Спритність рук**',
      'Рятунок DEX (Fireball, ловушки)'
    ]},
    { id: 'con', abbr: 'CON', name: 'Тіло', affects: [
      '**Здоров\'я (HP)** — +mod за кожен рівень',
      'Рятунок CON (концентрація заклинань, отрута)',
      'Витримка, задуха, алкоголь'
    ]},
    { id: 'int', abbr: 'INT', name: 'Інтелект', affects: [
      '**Магія чарівника** — DC і атака заклинань',
      'Навички: **Магія**, **Історія**, **Розслідування**, **Природа**, **Релігія**',
      'Мови, загадки, логіка'
    ]},
    { id: 'wis', abbr: 'WIS', name: 'Мудрість', affects: [
      '**Магія клірика/друїда/рейнджера** — DC і атака',
      '**Пасивне сприйняття** (10 + мод + бонус якщо володієш)',
      'Навички: **Сприйняття**, **Медицина**, **Проникливість**, **Виживання**, **Догляд за тваринами**',
      'Рятунок МДР (Charm, Hold Person)'
    ]},
    { id: 'cha', abbr: 'CHA', name: 'Харизма', affects: [
      '**Магія барда/варлока/паладина/чаклуна** — DC і атака',
      'Навички: **Обман**, **Залякування**, **Виступ**, **Переконання**',
      'Рятунок ХАР (Banishment, Vicious Mockery)'
    ]}
  ],

  derived: [
    { label: 'Бонус навички', formula: 'мод. характеристики + бонус майстерності (якщо володієш)' },
    { label: 'КБ (AC)', formula: '10 + DEX (без броні) або формула броні + щит' },
    { label: 'HP', formula: 'куб класу + CON (1 рівень); далі +середнє куба + CON' },
    { label: 'Ініціатива', formula: 'мод. DEX' },
    { label: 'Складність заклинань', formula: '8 + майстерність + мод. магії класу' },
    { label: 'Рятунки класу', formula: 'мод. + майстерність (2 характеристики з листа класу)' }
  ]
};

DND.getSkillAbilityLabel = function(abilityId) {
  return DND.ABILITY_NAMES[abilityId] + ' (' + abilityId.toUpperCase() + ')';
};
DND.cantripDiceAtLevel = function(charLevel) {
  if (charLevel >= 17) return 4;
  if (charLevel >= 11) return 3;
  if (charLevel >= 5) return 2;
  return 1;
};

/** Урон/ефект з урахуванням поточного рівня персонажа */
DND.damageAtLevel = function(spellId, charLevel) {
  const det = DND.SPELL_DETAILS[spellId];
  if (!det) return { now: '—', later: '' };

  const dice = DND.cantripDiceAtLevel(charLevel);
  const dr = DND.diceRange;
  const map = {
    fireBolt: { now: `${dr(`${dice}d10`)} вогню`, later: dice < 4 ? `→ більше на 5 рівні` : '' },
    sacredFlame: { now: `${dr(`${dice}d8`)} святості`, later: dice < 4 ? `→ більше на 5/11/17 рівні` : '' },
    rayOfFrost: { now: `${dr(`${dice}d8`)} холоду`, later: '' },
    produceFlame: { now: `${dr(`${dice}d8`)} вогню`, later: '' },
    viciousMockery: { now: `${dr(`${dice}d4`)} психічного`, later: '' },
    eldritchBlast: {
      now: charLevel >= 17 ? `4 промені × ${dr('1d10')}` : charLevel >= 11 ? `3 × ${dr('1d10')}`
        : charLevel >= 5 ? `2 × ${dr('1d10')}` : dr('1d10') + ' сили',
      later: charLevel < 5 ? '→ 2 промені на 5 рівні' : ''
    },
    magicMissile: { now: '6–15 сили (3 стріли, без кидка)', later: '+1 стріла з ячейкою 2р+' },
    burningHands: { now: `${dr('3d6')} вогню в конусі`, later: '+1d6 за ячейку вище 1р' },
    thunderwave: { now: `${dr('2d8')} звуку`, later: '+1d8 за ячейку вище' },
    cureWounds: { now: `${dr('1d8')} + мод. заклинань HP`, later: '+1d8 за ячейку вище' },
    healingWord: { now: `${dr('1d4')} + мод. заклинань HP`, later: '' },
    guidingBolt: { now: `${dr('4d6')} святості — сильне на 1р`, later: '+1d6 з ячейкою 2р+' },
    hex: { now: `+${dr('1d6')} некротичного за попадання`, later: '' },
    huntersMark: { now: `+${dr('1d6')} за попадання`, later: '' },
    scorchingRay: { now: charLevel >= 3 ? `3 промені × ${dr('2d6')}` : 'потрібна ячейка 2р', later: '' },
    fireball: { now: charLevel >= 5 ? dr('8d6') + ' вогню в сфері' : 'з’явиться з ячейкою 3р (~5 lvl)', later: '' },
    lightningBolt: { now: charLevel >= 5 ? dr('8d6') + ' блискавки' : 'з’явиться з ячейкою 3р', later: '' },
    moonbeam: { now: charLevel >= 3 ? dr('2d10') + ' святості/раунд' : 'потрібна ячейка 2р', later: '' },
    holdPerson: { now: charLevel >= 3 ? 'параліч (без урону)' : 'потрібна ячейка 2р', later: '' },
    sleep: { now: `${dr('5d8')} HP сумарно — хто влізе, спить`, later: '' },
    armorOfAgathys: { now: '5 холоду при ударі + 5 тимч. HP', later: '+5 за ячейку вище' },
  };

  if (map[spellId]) {
    const m = map[spellId];
    let text = `**Зараз (рів.${charLevel}):** ${m.now}`;
    if (m.later) text += ` · ${m.later}`;
    return { now: text, later: m.later };
  }

  if (DND.SPELL_DAMAGE_HIGH?.[spellId]) {
    const det = DND.SPELL_DETAILS[spellId];
    const lv = det?.level || '?';
    const dmg = DND.SPELL_DAMAGE_HIGH[spellId];
    const needs = lv > charLevel ? ` (ячейка ${lv}р — з ~${lv === 9 ? 17 : lv === 8 ? 15 : lv === 7 ? 13 : lv === 6 ? 11 : lv === 5 ? 9 : lv === 4 ? 7 : 5} lvl)` : '';
    return { now: `**Ячейка ${lv}р:** ${dmg}${needs}`, later: '' };
  }

  if (det.level === 0) {
    const d = DND.cantripDiceAtLevel(charLevel);
    const scaled = det.damage
      .replace(/1d(\d+)/, `${d}d$1`)
      .replace(/1 промінь/, d > 1 ? `${d} кубики` : '1 кубик');
    return { now: `**Зараз (рів.${charLevel}):** ${scaled}`, later: d < 4 ? '→ більше кубиків на 5/11/17 рівні' : '' };
  }

  const clean = det.damage.replace(/\s*\(≈[\d.]+\)/g, '').replace(/— лише з ячейкою \d+ рівня/g, '');
  const label = det.damage.toLowerCase().includes('немає') || det.damage.toLowerCase().includes('лікування')
    ? '**Ефект**' : '**Урон/ефект (ячейка ' + det.level + 'р)**';
  return { now: `${label}: ${clean}`, later: '' };
};

DND.getMaxSpellLevelForChar = function(charLevel, slots) {
  for (let i = (slots?.length || 0) - 1; i >= 0; i--) {
    if (slots[i] > 0) return i + 1;
  }
  return 0;
};

DND.getActionHelp = function(cast) {
  if (!cast) return '';
  if (cast.includes('бонус')) return '⏱ Бонусна дія — окремо від основної, 1 раз за хід';
  if (cast.includes('реакці')) return '⏱ Реакція — 1 раз між ходами, не на своєму ході';
  if (cast.includes('1 дія')) return '⏱ Основна дія — стандартний каст у свій хід';
  return '';
};

/** Розшифровка компонентів В, С, М */
DND.explainComponents = function(components) {
  if (!components || components === '—') return '';
  const parts = [];
  const c = components.toUpperCase();
  if (c.includes('В') || c.includes('V')) parts.push('В = слова вголос');
  if (c.includes('С') || c.includes('S')) parts.push('С = жести вільною рукою');
  if (c.includes('М') || c.includes('M')) {
    const mat = components.match(/[МM]\s*(\([^)]+\))?/);
    parts.push(mat && mat[1]
      ? `М = предмет ${mat[1]}`
      : 'М = матеріальний компонент (предмет)');
  }
  return parts.join(' · ');
};

/** Розшифровка рядка «рятунок» на картці */
DND.explainSave = function(save, spellAttack, spellDc) {
  if (!save || save === '—' || save === 'Ні' || save.startsWith('Ні ')) {
    return save === 'Ні' || save === '—' ? 'Рятунок не потрібен — ефект без опору цілі.' : save;
  }
  const abbr = {
    DEX: 'Спритність (DEX)', CON: 'Тіло (CON)', STR: 'Сила (STR)',
    INT: 'Інтелект (INT)', 'ІНТ': 'Інтелект (INT)',
    WIS: 'Мудрість (WIS)', 'МДР': 'Мудрість (WIS)',
    CHA: 'Харизма (CHA)', 'ХАР': 'Харизма (CHA)'
  };
  for (const [key, name] of Object.entries(abbr)) {
    if (save.includes(key)) {
      let hint = `Ціль кидає d20 + **свій** мод. ${name} (не твій!)`;
      if (spellDc) hint += ` · має набрати ≥ **твій DC ${spellDc}** (від твоїх характеристик заклинань)`;
      if (save.includes('половину') || save.includes('0 урону')) hint += ' · успіх = менший ефект';
      return hint;
    }
  }
  if (save.includes('атаки заклинанням') || save.includes('Кидок атаки')) {
    const bonus = spellAttack != null ? (spellAttack >= 0 ? `+${spellAttack}` : `${spellAttack}`) : '?';
    return `Ти кидаєш d20 ${bonus} проти КБ (броні) цілі — це атака, не рятунок`;
  }
  if (save.includes('Автопопадання')) return 'Кидків немає — заклинання влучає само';
  if (save.includes('рятунку немає') && save.includes('Ні')) return 'Рятунку немає — ефект залежить від правил заклинання (див. опис)';
  return save;
};

/** Додаткова підказка для незвичних заклинань */
DND.explainSpellExtra = function(spellId) {
  if (spellId === 'sleep') {
    return '💤 Приклад: випало 18 → три гобліни по 6 HP сплять, великий бос — ні.';
  }
  return '';
};

/** Підказка до тривалості */
DND.explainDuration = function(duration) {
  if (!duration) return '';
  if (/концентраці/i.test(duration)) return 'Тримаєш концентрацію — не можна тримати два такі заклинання';
  if (duration === 'Миттєво') return 'Ефект одразу, не триває';
  return '';
};

/* Деталі заклинань та каталог інвентарю */
DND.SPELL_DETAILS = {
  fireBolt: {
    level: 0, cast: '1 дія', range: '36 м (120 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '1d10 вогню на 1–4 рівні',
    save: 'Кидок атаки заклинанням (d20 + бонус атаки)',
    desc: 'Струмінь вогню по одній цілі. Заговір — без ячейок, можна щоразу основною дією.'
  },
  light: {
    level: 0, cast: '1 дія', range: 'Дотик', duration: '1 година', components: 'В, М',
    damage: 'Немає',
    save: 'Ні',
    desc: 'Об\'єкт світиться яскравим світлом на 6 м + тьмяне світло ще 6 м. Можна накласти на предмет ворога — тоді DEX рятунок, при провалі світить.'
  },
  mageHand: {
    level: 0, cast: '1 дія', range: '9 м (30 фт)', duration: '1 хвилина', components: 'В, С',
    damage: 'Немає', save: 'Ні',
    desc: 'Привидна рука може піднімати до 4.5 кг, відкривати незачинені речі, передавати предмети. Не атакує і не активує магічні предмети.'
  },
  sacredFlame: {
    level: 0, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '1d8 святості на 1–4 рівні',
    save: 'DEX рятунок — при успіху 0 урону',
    desc: 'Полум\'я з неба на одну ціль. Ігнорує укриття. Заговір — 1 раз за хід основною дією, без ячейок.'
  },
  eldritchBlast: {
    level: 0, cast: '1 дія', range: '36 м (120 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '1 промінь 1d10 на 1–4 рівні',
    save: 'Кидок атаки на кожен промінь',
    desc: 'Містичний промінь. На 1 рівні — один промінь. Заговір без ячейок.'
  },
  viciousMockery: {
    level: 0, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В',
    damage: '1d4 психічного (зростає з рівнем)',
    save: 'МДР рятунок — при провалі також disadvantage на наступну атаку',
    desc: 'Висміюєш ворога. При провалі рятунку — урон і мінус до наступного кидка атаки.'
  },
  magicMissile: {
    level: 1, cast: '1 дія', range: '36 м (120 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '3 стріли по 1d4+1 (разом 3d4+3, ≈10)',
    save: 'Автопопадання — рятунку немає',
    desc: 'Три стріли в ціль (або різні). 1 ячейка 1 рівня. Основна дія.'
  },
  cureWounds: {
    level: 1, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В, С',
    damage: 'Лікування: 1d8 + мод. заклинань (+(1d8) за кожну ячейку вище)',
    save: 'Ні',
    desc: 'Доторкаєшся і відновлюєш HP. 1 ячейка 1 рівня. У бою — 1 раз на хід якщо два заклинання.'
  },
  burningHands: {
    level: 1, cast: '1 дія', range: 'На себе (конус 4.5 м)', duration: 'Миттєво', components: 'В, С',
    damage: '3d6 вогню (DEX рятунок на половину, +1d6 за ячейку вище)',
    save: 'DEX рятунок',
    desc: 'Конус вогню від пальців. 1 ячейка 1 рівня. Усі в конусі кидають рятунок.'
  },
  shield: {
    level: 1, cast: '1 реакція', range: 'На себе', duration: '1 раунд', components: 'В, С',
    damage: 'Немає — +5 AC до наступного ходу',
    save: 'Ні',
    desc: 'Реакція коли по тебе влучають атакою. +5 AC миттєво. Також імунітет до Magic Missile. 1 ячейка 1 рівня.'
  },
  bless: {
    level: 1, cast: '1 дія', range: '9 м (30 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — +1d4 до атак і рятунків союзникам (до 3 цілей)',
    save: 'Ні',
    desc: 'До 3 істот отримують +1d4 на атаки та рятунки. Концентрація — якщо втратиш концентрацію, ефект зникає.'
  },
  hex: {
    level: 1, cast: '1 бонусна дія', range: '27 м (90 фт)', duration: 'Концентрація, до 1 год', components: 'В, С, М',
    damage: '+1d6 некротичного при кожному твоєму уроні по цілі',
    save: 'Ні',
    desc: 'Проклинаєш ворога. Додатковий урон при кожному попаданні. Концентрація. Варлок часто кастує на бій.'
  },
  fireball: {
    level: 3, cast: '1 дія', range: '45 м (150 фт)', duration: 'Миттєво', components: 'В, С, М',
    damage: '8d6 вогню (≈28) — лише з ячейкою 3 рівня',
    save: 'DEX рятунок на половину',
    desc: 'Вибух 6 м радіус. На 1–2 рівні персонажа ще недоступний — потрібні ячейки 3 рівня (зазвичай з 5 рівня класу).'
  },
  lightningBolt: {
    level: 3, cast: '1 дія', range: 'Лінія 30 м', duration: 'Миттєво', components: 'В, С, М',
    damage: '8d6 блискавки — лише з ячейкою 3 рівня',
    save: 'DEX рятунок на половину',
    desc: 'Лінія блискавки. Недоступний поки немає ячейок 3 рівня.'
  },
  healingWord: {
    level: 1, cast: '1 бонусна дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В',
    damage: 'Лікування: 1d4 + мод. заклинань',
    save: 'Ні',
    desc: 'Швидке лікування бонусною дією — рятує союзника на 0 HP. 1 ячейка 1 рівня.'
  },
  detectMagic: {
    level: 1, cast: '1 дія', range: 'На себе', duration: 'Концентрація, до 10 хв', components: 'В, С',
    damage: 'Немає', save: 'Ні',
    desc: 'Відчуваєш магію в радіусі 9 м. Бачиш ауру школ магії. Концентрація.'
  },
  sleep: {
    level: 1, cast: '1 дія', range: '27 м (90 фт)', duration: '1 хвилина', components: 'В, С, М',
    damage: 'Усиплення — без прямого урону',
    save: 'Ні',
    desc: 'Кидаєш **5d8** — це скільки HP ворогів сумарно можеш усыпити в **сфері ~6 м**. Засинають **найслабші першими** (спочатку гобліни, не бос). Сплять **1 хв**; прокидаються від урону. На нежить і конструктів не діє. Рятунку немає.'
  },
  thunderwave: {
    level: 1, cast: '1 дія', range: 'На себе (куб 4.5 м)', duration: 'Миттєво', components: 'В, С',
    damage: '2d8 звуку (CON рятунок на половину) + відштовхування 3 м',
    save: 'CON рятунок',
    desc: 'Ударна хвиля навколо. Вороги відлітають при провалі. 1 ячейка 1 рівня.'
  },
  holdPerson: {
    level: 2, cast: '1 дія', range: '18 м (60 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — паралізує гуманоїда',
    save: 'МДР рятунок щораунду',
    desc: 'Ціль паралізована при провалі. Рятунок на кінці кожного ходу. Концентрація. 1 ячейка 2 рівня.'
  },
  counterspell: {
    level: 3, cast: '1 реакція', range: '18 м (60 фт)', duration: 'Миттєво', components: 'С',
    damage: 'Немає — скасовує заклинання',
    save: 'Ні — перевірка: твоє 3+рівень заклинання vs їхнє',
    desc: 'Реакція коли ворог кастує. Авто-успіх якщо їхнє заклинання 3 рівня або нижче. Інакше d20+мод vs DC 10+рівень.'
  },
  revivify: {
    level: 3, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В, С, М (діаманти 300+ зм)',
    damage: 'Повертає до життя з 1 HP (мертвий не більше 1 хвилини)',
    save: 'Ні',
    desc: 'Оживляє нещодавно померлого. 1 ячейка 3 рівня. Не повертає відірвані частини тіла.'
  },
  guidingBolt: {
    level: 1, cast: '1 дія', range: '36 м (120 фт)', duration: '1 раунд', components: 'В, С',
    damage: '4d6 святості (≈14) — сильне для 1 рівня',
    save: 'Кидок атаки заклинанням',
    desc: 'Один промінь. При попаданні — наступна атака по цій цілі з перевагою. 1 ячейка 1р.'
  },
  mistyStep: {
    level: 2, cast: '1 бонусна дія', range: 'На себе', duration: 'Миттєво', components: 'В',
    damage: 'Немає — телепорт 9 м',
    save: 'Ні',
    desc: 'Телепортуєшся на 9 м. Бонусна дія — можеш атакувати і втекти. 1 ячейка 2 рівня.'
  },
  scorchingRay: {
    level: 2, cast: '1 дія', range: '36 м (120 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '3×2d6 вогню (кожен промінь — окрема атака, +1 промінь на ячейку вище)',
    save: 'Кидок атаки кожним променем',
    desc: 'Три вогняні промені. 1 ячейка 2 рівня.'
  },
  moonbeam: {
    level: 2, cast: '1 дія', range: '36 м (120 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: '2d10 святості (CON рятунок на початку ходу в зоні)',
    save: 'CON рятунок щораунду в промені',
    desc: 'Стовп світла радіусом 1.5 м. Концентрація. Переворотники — disadvantage на рятунки.'
  },
  huntersMark: {
    level: 1, cast: '1 бонусна дія', range: '27 м (90 фт)', duration: 'Концентрація, до 1 год', components: 'В',
    damage: '+1d6 при кожному твоєму уроні по цілі',
    save: 'Ні',
    desc: 'Позначаєш ворога. Додатковий урон при попаданні. Концентрація. Рейнджерський must-have.'
  },
  armorOfAgathys: {
    level: 1, cast: '1 дія', range: 'На себе', duration: '1 година', components: 'В, С, М',
    damage: '5 холодного при ближньому уроні по тобі (+5 за ячейку вище) + тимчасові HP',
    save: 'Ні',
    desc: 'Лідяна броня: тимчасові HP і урон атакуючому в ближньому бою. Не концентрація.'
  },
  charmPerson: {
    level: 1, cast: '1 дія', range: '9 м (30 фт)', duration: '1 година', components: 'В, С',
    damage: 'Немає — ціль ставиться до тебе дружелюбно',
    save: 'МДР рятунок',
    desc: 'Гуманоїд стає дружнім. При атаці по тобі — ефект зникає. 1 ячейка 1 рівня.'
  },
  faerieFire: {
    level: 1, cast: '1 дія', range: '18 м (60 фт)', duration: 'Концентрація, до 1 хв', components: 'В',
    damage: 'Немає — підсвічує істот (атаки з перевагою)',
    save: 'DEX рятунок',
    desc: 'Куб 6 м. Істоти світяться — атаки по них з перевагою. Концентрація.'
  },
  rayOfFrost: {
    level: 0, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '1d8 холоду + швидкість −3 м до наступного ходу',
    save: 'Кидок атаки',
    desc: 'Промінь холоду. Заговір — без ячейок.'
  },
  prestidigitation: {
    level: 0, cast: '1 дія', range: '3 м (10 фт)', duration: 'До 1 години', components: 'В, С',
    damage: 'Немає', save: 'Ні',
    desc: 'Маленькі магічні фокуси: запалити свічку, очистити предмет, змінити смак їжі тощо.'
  },
  guidance: {
    level: 0, cast: '1 дія', range: 'Дотик', duration: 'Концентрація, до 1 хв', components: 'В, С',
    damage: 'Немає — +1d4 до однієї перевірки характеристики',
    save: 'Ні',
    desc: 'Союзник додає 1d4 до однієї ability check. Концентрація до 1 хв.'
  },
  produceFlame: {
    level: 0, cast: '1 дія', range: 'На себе', duration: '10 хвилин', components: 'В, С',
    damage: '1d8 вогню (кидок атаки на відстані 9 м)',
    save: 'Кидок атаки',
    desc: 'Полум\'я в долоні — світло або кидок як атака. Заговір.'
  },
  thaumaturgy: {
    level: 0, cast: '1 дія', range: '9 м (30 фт)', duration: 'До 1 хвилини', components: 'В',
    damage: 'Немає', save: 'Ні',
    desc: 'Маленькі чудеса: гучний голос, тремтіння землі, відкриті двері. Заговір.'
  },
  spiritualWeapon: {
    level: 2, cast: '1 бонусна дія', range: '18 м (60 фт)', duration: '1 хвилина', components: 'В, С',
    damage: '1d8+мод. заклинань сили (бонусна дія кожен хід — атака)',
    save: 'Кидок атаки',
    desc: 'Привидна зброя б\'є бонусною дією. Не концентрація! 1 ячейка 2 рівня.'
  }
};

DND.ITEMS = [
  { id: 'longsword', cat: 'weapon', name: 'Довгий меч', price: 15, desc: 'Військова рукопашна, 1d8 рублящий (1d10 двома руками). Вага 1.4 кг.' },
  { id: 'shortsword', cat: 'weapon', name: 'Короткий меч', price: 10, desc: 'Військова рукопашна, 1d6 колючий. Легка, фехтувальна. 1 кг.' },
  { id: 'rapier', cat: 'weapon', name: 'Рапіра', price: 25, desc: 'Військова рукопашна, 1d8 колючий. Finesse — можна СПР замість СИЛ.' },
  { id: 'greataxe', cat: 'weapon', name: 'Великий сокира', price: 30, desc: 'Військова дворучна, 1d12 рублящий. Важка, 3.5 кг.' },
  { id: 'handaxe', cat: 'weapon', name: 'Ручна сокира', price: 5, desc: 'Проста рукопашна/метальна, 1d6 рублящий, дальність 6/18 м.' },
  { id: 'dagger', cat: 'weapon', name: 'Кинджал', price: 2, desc: 'Проста рукопашна, 1d4 колючий. Finesse, легка, метальна 6/18 м.' },
  { id: 'longbow', cat: 'weapon', name: 'Довгий лук', price: 50, desc: 'Військова дистанційна, 1d8 колючий, дальність 45/180 м. Потрібна СИЛ 13.' },
  { id: 'lightCrossbow', cat: 'weapon', name: 'Легкий арбалет', price: 25, desc: 'Проста дистанційна, 1d8 колючий, дальність 24/96 м. Перезарядка.' },
  { id: 'javelin', cat: 'weapon', name: 'Спис-метальний', price: 0.5, desc: 'Проста метальна, 1d6 колючий, дальність 9/36 м.' },
  { id: 'quarterstaff', cat: 'weapon', name: 'Посох', price: 0.2, desc: 'Проста рукопашна, 1d6 дроблячий (1d8 двома руками). Універсальна.' },
  { id: 'leather', cat: 'armor', name: 'Шкіряна броня', price: 10, desc: 'Легка броня. AC = 11 + мод. СПР. Без штрафу до стелсу.' },
  { id: 'studded', cat: 'armor', name: 'Броня з заклепками', price: 45, desc: 'Легка броня. AC = 12 + мод. СПР.' },
  { id: 'chainShirt', cat: 'armor', name: 'Кольчужна сорочка', price: 50, desc: 'Середня броня. AC = 13 + СПР (макс +2). Потрібна СИЛ 13.' },
  { id: 'scaleMail', cat: 'armor', name: 'Луската кольчуга', price: 50, desc: 'Середня броня. AC = 14 + СПР (макс +2). Штраф до стелсу.' },
  { id: 'chainMail', cat: 'armor', name: 'Кольчуга', price: 75, desc: 'Важка броня. AC = 16. СПР макс 0. СИЛ 13. Штраф стелсу.' },
  { id: 'shield', cat: 'armor', name: 'Щит', price: 10, desc: '+2 AC. Займає одну руку. Можна з будь-якою бронею.' },
  { id: 'healingPotion', cat: 'consumable', name: 'Зілля лікування', price: 50, desc: 'Дія: випий — відновлює 2d4+2 HP. Найпопулярніший расходник.' },
  { id: 'antitoxin', cat: 'consumable', name: 'Антитоксин', price: 50, desc: '1 година: перевага на рятунки від отрути.' },
  { id: 'rations', cat: 'gear', name: 'Сухий пайок (1 день)', price: 0.5, desc: 'Їжа на 1 день подорожі.' },
  { id: 'waterskin', cat: 'gear', name: 'Бурдюк', price: 0.2, desc: '2 літри води.' },
  { id: 'rope', cat: 'gear', name: 'Мотузка (15 м)', price: 1, desc: 'Міцність 8. Скалолазіння, зв\'язування.' },
  { id: 'torch', cat: 'gear', name: 'Смолоскип', price: 0.01, desc: 'Яскраве світло 6 м, тьмяне 6 м. Горить 1 годину.' },
  { id: 'backpack', cat: 'gear', name: 'Рюкзак', price: 2, desc: 'Вміщує 1 куб.фт (≈12 кг нормально).' },
  { id: 'bedroll', cat: 'gear', name: 'Спальний мішок', price: 1, desc: 'Для довгого відпочинку в дикій природі.' },
  { id: 'tinderbox', cat: 'gear', name: 'Кремінь і кресало', price: 0.5, desc: 'Розпалювання вогню за 1 хвилину.' },
  { id: 'thievesTools', cat: 'tool', name: 'Інструменти злодія', price: 25, desc: 'Відмичка замків і знешкодження пасток. Потрібна майстерність.' },
  { id: 'healersKit', cat: 'tool', name: 'Аптечка', price: 5, desc: '10 використань. Стабілізує пораненого без Medicine check.' },
  { id: 'holySymbol', cat: 'gear', name: 'Священний символ', price: 5, desc: 'Фокус для божественної магії клірика/паладина.' },
  { id: 'arcaneFocus', cat: 'gear', name: 'Магічний фокус', price: 10, desc: 'Кристал/посох — замість матеріальних компонентів без ціни.' },
  { id: 'spellbook', cat: 'gear', name: 'Книга заклинань', price: 50, desc: 'Чарівник записує заклинання. 100 сторінок.' },
  { id: 'componentPouch', cat: 'gear', name: 'Мішечок компонентів', price: 25, desc: 'Матеріальні компоненти без вказаної ціни.' },
  { id: 'lantern', cat: 'gear', name: 'Ліхтар', price: 5, desc: 'Яскраве світло 9 м. Олія 0.1 зм/день.' },
  { id: 'crowbar', cat: 'gear', name: 'Лом', price: 2, desc: 'Перевантаження СИЛ при відкриванні дверей/решіток.' },
  { id: 'piton', cat: 'gear', name: 'Штифт (10 шт)', price: 0.5, desc: 'Для скелелазіння з мотузкою.' },
  { id: 'grapplingHook', cat: 'gear', name: 'Гак-кішка', price: 2, desc: 'Кинути на 6/18 м, закріпити мотузку.' },
  { id: 'manacles', cat: 'gear', name: 'Кайданки', price: 2, desc: 'СИЛ DC 20 або відмичка DC 15 щоб зняти.' },
  { id: 'mirror', cat: 'gear', name: 'Дзеркало (стальне)', price: 5, desc: 'Заглянути за кут, сигнали сонцем.' },
  { id: 'oil', cat: 'consumable', name: 'Олія (фляга)', price: 0.1, desc: 'Покрити 1×1 м — горить 2 раунди, 5 урону вогнем.' },
  { id: 'alchemistsFire', cat: 'consumable', name: 'Алхімічний вогонь', price: 50, desc: 'Метальна атака: 1d4 вогню на початку ходу цілі.' },
  { id: 'arrows', cat: 'ammo', name: 'Стріли (20 шт)', price: 1, desc: 'Боєприпас для лука.' },
  { id: 'bolts', cat: 'ammo', name: 'Болти (20 шт)', price: 1, desc: 'Боєприпас для арбалета.' }
];

DND.ITEM_CATS = {
  weapon: 'Зброя', armor: 'Броня', consumable: 'Расходники', gear: 'Спорядження',
  tool: 'Інструменти', ammo: 'Боєприпаси'
};

DND.getSpellDetail = function(id) {
  if (DND.SPELL_DETAILS[id]) return DND.SPELL_DETAILS[id];
  const isCantrip = DND.SPELLS.cantrips.some(s => s.id === id);
  return {
    level: isCantrip ? 0 : 1,
    cast: '1 дія', range: '—', duration: '—', components: 'В, С',
    damage: 'Див. опис', save: '—',
    desc: 'Детальний опис у Player\'s Handbook. Обери заклинання і уточни з DM.'
  };
};

DND.getItem = function(id) {
  return DND.ITEMS.find(i => i.id === id);
};

DND.parseGoldFromEquipment = function(equipList) {
  let gold = 0;
  (equipList || []).forEach(s => {
    const m = String(s).match(/(\d+)\s*gp/i);
    if (m) gold += +m[1];
  });
  return gold;
};
