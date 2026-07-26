'use strict';

/* Заклинання 4–9 рівня (D&D 5e SRD) + деталі та урон */

const SPELL_LEVELS_HIGH = {
  level4: [
    { id: 'banishment', name: 'Banishment', school: 'Abjuration', classes: ['cleric', 'paladin', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'blight', name: 'Blight', school: 'Necromancy', classes: ['druid', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'confusion', name: 'Confusion', school: 'Enchantment', classes: ['bard', 'druid', 'sorcerer', 'wizard'] },
    { id: 'dimensionDoor', name: 'Dimension Door', school: 'Conjuration', classes: ['bard', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'greaterInvisibility', name: 'Greater Invisibility', school: 'Illusion', classes: ['bard', 'sorcerer', 'wizard'] },
    { id: 'guardianOfFaith', name: 'Guardian of Faith', school: 'Conjuration', classes: ['cleric'] },
    { id: 'iceStorm', name: 'Ice Storm', school: 'Evocation', classes: ['druid', 'sorcerer', 'wizard'] },
    { id: 'polymorph', name: 'Polymorph', school: 'Transmutation', classes: ['bard', 'druid', 'sorcerer', 'wizard'] },
    { id: 'stoneskin', name: 'Stoneskin', school: 'Abjuration', classes: ['druid', 'ranger', 'sorcerer', 'wizard'] },
    { id: 'wallOfFire', name: 'Wall of Fire', school: 'Evocation', classes: ['druid', 'sorcerer', 'wizard'] }
  ],
  level5: [
    { id: 'coneOfCold', name: 'Cone of Cold', school: 'Evocation', classes: ['sorcerer', 'wizard'] },
    { id: 'dominatePerson', name: 'Dominate Person', school: 'Enchantment', classes: ['bard', 'sorcerer', 'wizard'] },
    { id: 'flameStrike', name: 'Flame Strike', school: 'Evocation', classes: ['cleric'] },
    { id: 'greaterRestoration', name: 'Greater Restoration', school: 'Abjuration', classes: ['bard', 'cleric', 'druid'] },
    { id: 'holdMonster', name: 'Hold Monster', school: 'Enchantment', classes: ['bard', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'massCureWounds', name: 'Mass Cure Wounds', school: 'Evocation', classes: ['bard', 'cleric', 'druid'] },
    { id: 'raiseDead', name: 'Raise Dead', school: 'Necromancy', classes: ['bard', 'cleric', 'paladin'] },
    { id: 'telekinesis', name: 'Telekinesis', school: 'Transmutation', classes: ['sorcerer', 'wizard'] },
    { id: 'wallOfStone', name: 'Wall of Stone', school: 'Evocation', classes: ['druid', 'sorcerer', 'wizard'] }
  ],
  level6: [
    { id: 'chainLightning', name: 'Chain Lightning', school: 'Evocation', classes: ['sorcerer', 'wizard'] },
    { id: 'circleOfDeath', name: 'Circle of Death', school: 'Necromancy', classes: ['sorcerer', 'warlock', 'wizard'] },
    { id: 'disintegrate', name: 'Disintegrate', school: 'Transmutation', classes: ['sorcerer', 'wizard'] },
    { id: 'heal', name: 'Heal', school: 'Evocation', classes: ['cleric', 'druid'] },
    { id: 'massSuggestion', name: 'Mass Suggestion', school: 'Enchantment', classes: ['bard', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'sunbeam', name: 'Sunbeam', school: 'Evocation', classes: ['druid', 'sorcerer', 'wizard'] },
    { id: 'trueSeeing', name: 'True Seeing', school: 'Divination', classes: ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'wallOfIce', name: 'Wall of Ice', school: 'Evocation', classes: ['wizard'] }
  ],
  level7: [
    { id: 'delayedBlastFireball', name: 'Delayed Blast Fireball', school: 'Evocation', classes: ['sorcerer', 'wizard'] },
    { id: 'etherealness', name: 'Etherealness', school: 'Transmutation', classes: ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'fireStorm', name: 'Fire Storm', school: 'Evocation', classes: ['cleric', 'druid'] },
    { id: 'forcecage', name: 'Forcecage', school: 'Evocation', classes: ['bard', 'warlock', 'wizard'] },
    { id: 'planeShift', name: 'Plane Shift', school: 'Conjuration', classes: ['cleric', 'druid', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'prismaticSpray', name: 'Prismatic Spray', school: 'Evocation', classes: ['sorcerer', 'wizard'] },
    { id: 'regenerate', name: 'Regenerate', school: 'Transmutation', classes: ['bard', 'cleric', 'druid'] },
    { id: 'resurrection', name: 'Resurrection', school: 'Necromancy', classes: ['cleric'] },
    { id: 'reverseGravity', name: 'Reverse Gravity', school: 'Transmutation', classes: ['druid', 'sorcerer', 'wizard'] },
    { id: 'teleport', name: 'Teleport', school: 'Conjuration', classes: ['bard', 'sorcerer', 'wizard'] }
  ],
  level8: [
    { id: 'antimagicField', name: 'Antimagic Field', school: 'Abjuration', classes: ['cleric', 'wizard'] },
    { id: 'dominateMonster', name: 'Dominate Monster', school: 'Enchantment', classes: ['bard', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'earthquake', name: 'Earthquake', school: 'Evocation', classes: ['cleric', 'druid', 'sorcerer'] },
    { id: 'feeblemind', name: 'Feeblemind', school: 'Enchantment', classes: ['bard', 'druid', 'warlock', 'wizard'] },
    { id: 'holyAura', name: 'Holy Aura', school: 'Abjuration', classes: ['cleric'] },
    { id: 'incendiaryCloud', name: 'Incendiary Cloud', school: 'Conjuration', classes: ['sorcerer', 'wizard'] },
    { id: 'maze', name: 'Maze', school: 'Conjuration', classes: ['wizard'] },
    { id: 'mindBlank', name: 'Mind Blank', school: 'Abjuration', classes: ['bard', 'wizard'] },
    { id: 'powerWordStun', name: 'Power Word Stun', school: 'Enchantment', classes: ['bard', 'sorcerer', 'warlock', 'wizard'] }
  ],
  level9: [
    { id: 'astralProjection', name: 'Astral Projection', school: 'Necromancy', classes: ['cleric', 'warlock', 'wizard'] },
    { id: 'foresight', name: 'Foresight', school: 'Divination', classes: ['bard', 'druid', 'warlock', 'wizard'] },
    { id: 'gate', name: 'Gate', school: 'Conjuration', classes: ['cleric', 'sorcerer', 'wizard'] },
    { id: 'imprisonment', name: 'Imprisonment', school: 'Abjuration', classes: ['warlock', 'wizard'] },
    { id: 'massHeal', name: 'Mass Heal', school: 'Evocation', classes: ['cleric'] },
    { id: 'meteorSwarm', name: 'Meteor Swarm', school: 'Evocation', classes: ['sorcerer', 'wizard'] },
    { id: 'powerWordKill', name: 'Power Word Kill', school: 'Enchantment', classes: ['bard', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'truePolymorph', name: 'True Polymorph', school: 'Transmutation', classes: ['bard', 'druid', 'warlock', 'wizard'] },
    { id: 'trueResurrection', name: 'True Resurrection', school: 'Necromancy', classes: ['cleric', 'druid'] },
    { id: 'wish', name: 'Wish', school: 'Conjuration', classes: ['sorcerer', 'wizard'] }
  ]
};

Object.assign(DND.SPELLS, SPELL_LEVELS_HIGH);

const SPELL_DETAILS_HIGH = {
  banishment: {
    level: 4, cast: '1 дія', range: '9 м (30 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — виганяє на інший план', save: 'ХАР рятунок',
    desc: 'Ціль з іншого плану повертається додому; інші — зникають, поки тримаєш концентрацію. Ячейка 4р.'
  },
  blight: {
    level: 4, cast: '1 дія', range: '9 м (30 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '8d8 (8–64) некротичного', save: 'CON рятунок на половину',
    desc: 'Виснажує життєву силу. Рослини автоматично провалюють. Ячейка 4р.'
  },
  confusion: {
    level: 4, cast: '1 дія', range: '27 м (90 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — хаотична поведінка', save: 'МДР рятунок',
    desc: 'Сфера 3 м: істоти можуть блукати, бити союзників, нічого не робити. Концентрація. Ячейка 4р.'
  },
  dimensionDoor: {
    level: 4, cast: '1 дія', range: '150 м (500 фт)', duration: 'Миттєво', components: 'В',
    damage: 'Немає — телепорт', save: 'Ні',
    desc: 'Телепорт тебе + 1 союзника на відстань до 150 м. Можна взяти з собою кого влізе в 1.5 м. Ячейка 4р.'
  },
  greaterInvisibility: {
    level: 4, cast: '1 дія', range: 'Дотик', duration: 'Концентрація, до 1 хв', components: 'В, С',
    damage: 'Немає — невидимість', save: 'Ні',
    desc: 'Ціль **повністю невидима**, навіть коли атакує (на відміну від звичайної Invisibility). Концентрація. Ячейка 4р.'
  },
  guardianOfFaith: {
    level: 4, cast: '1 дія', range: '9 м (30 фт)', duration: '8 годин', components: 'В',
    damage: '20 (20–20) святості при вході в зону', save: 'DEX рятунок на половину',
    desc: 'Привидний страж 3×3 м. Ворог при вході — урон, потім DEX рятунок. Не концентрація. Ячейка 4р.'
  },
  iceStorm: {
    level: 4, cast: '1 дія', range: '90 м (300 фт)', duration: 'Миттєво', components: 'В, С, М',
    damage: '2d8 (2–16) дроблячого + 4d6 (4–24) холоду', save: 'DEX рятунок на половину',
    desc: 'Циліндр льоду й граду. Складна місцевість. Ячейка 4р.'
  },
  polymorph: {
    level: 4, cast: '1 дія', range: '18 м (60 фт)', duration: 'Концентрація, до 1 год', components: 'В, С, М',
    damage: 'Немає — перетворення', save: 'МДР рятунок',
    desc: 'Перетворює істоту на **звіря** CR ≤ рівня ячейки (4р = CR 4). Статі замінюються звіриними. Концентрація. При 0 HP у формі — повертається зі залишковим уроном.'
  },
  stoneskin: {
    level: 4, cast: '1 дія', range: 'Дотик', duration: 'Концентрація, до 1 год', components: 'В, С, М',
    damage: 'Немає — опір до фізичного урону', save: 'Ні',
    desc: 'Ціль отримує **опір** до немагічного дроблячого/колючого/рублячого. Концентрація. Ячейка 4р.'
  },
  wallOfFire: {
    level: 4, cast: '1 дія', range: '36 м (120 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: '5d8 (5–40) вогню', save: 'DEX рятунок на половину',
    desc: 'Стіна вогню до 18 м довжиною. Урон при появі й при проходженні. Концентрація. Ячейка 4р.'
  },
  coneOfCold: {
    level: 5, cast: '1 дія', range: 'На себе (конус 18 м)', duration: 'Миттєво', components: 'В, С, М',
    damage: '8d8 (8–64) холоду', save: 'CON рятунок на половину',
    desc: 'Конус холодного повітря. Ячейка 5р.'
  },
  dominatePerson: {
    level: 5, cast: '1 дія', range: '18 м (60 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С',
    damage: 'Немає — підкорення', save: 'МДР рятунок',
    desc: 'Гуманоїд виконує твої накази. Повторний рятунок при отриманні урону. Концентрація. Ячейка 5р.'
  },
  flameStrike: {
    level: 5, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В, С, М',
    damage: '4d6 (4–24) вогню + 4d6 (4–24) святості', save: 'DEX рятунок на половину',
    desc: 'Стовп вогню з неба. Ячейка 5р.'
  },
  greaterRestoration: {
    level: 5, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В, С, М (діаманти 100+ зм)',
    damage: 'Немає — знімає прокляття, зменшення статів, божевілля', save: 'Ні',
    desc: 'Потужне очищення. Витрачає М-компонент. Ячейка 5р.'
  },
  holdMonster: {
    level: 5, cast: '1 дія', range: '27 м (90 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — параліч', save: 'МДР рятунок щораунду',
    desc: 'Як Hold Person, але на **будь-яку істоту**. Концентрація. Ячейка 5р.'
  },
  massCureWounds: {
    level: 5, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В, С',
    damage: 'Лікування: 3d8 (3–24) + мод. заклинань до 6 цілей', save: 'Ні',
    desc: 'Лікує групу союзників у сфері 6 м. Ячейка 5р.'
  },
  raiseDead: {
    level: 5, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В, С, М (діаманти 500+ зм)',
    damage: 'Немає — оживлення', save: 'Ні',
    desc: 'Повертає мертвого (мертвий ≤ 10 днів, не старий, тіло ціле). Мінус −4 до атак/перевірок 24 год. Ячейка 5р.'
  },
  telekinesis: {
    level: 5, cast: '1 дія', range: '18 м (60 фт)', duration: 'Концентрація, до 10 хв', components: 'В, С',
    damage: 'Немає — рух предметів/істот', save: 'СИЛ рятунок (якщо істота)',
    desc: 'Піднімаєш до 500 кг, рухаєш бонусною дією. Концентрація. Ячейка 5р.'
  },
  wallOfStone: {
    level: 5, cast: '1 дія', range: '36 м (120 фт)', duration: 'Концентрація, до 10 хв', components: 'В, С, М',
    damage: 'Немає — стіна з каменю', save: 'Ні',
    desc: 'Нерухома кам\'яна стіна до 18×3×0.3 м. Можна зробити постійною. Концентрація. Ячейка 5р.'
  },
  chainLightning: {
    level: 6, cast: '1 дія', range: '45 м (150 фт)', duration: 'Миттєво', components: 'В, С, М',
    damage: '10d8 (10–80) блискавки', save: 'DEX рятунок на половину',
    desc: 'Б\'є ціль + до 3 додаткових в межах 9 м від попередньої. Ячейка 6р.'
  },
  circleOfDeath: {
    level: 6, cast: '1 дія', range: '45 м (150 фт)', duration: 'Миттєво', components: 'В, С, М',
    damage: '8d6 (8–48) некротичного', save: 'CON рятунок на половину',
    desc: 'Сфера 18 м радіусом. Ячейка 6р.'
  },
  disintegrate: {
    level: 6, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В, С, М',
    damage: '10d6 (10–60) сили', save: 'DEX рятунок',
    desc: 'При провалі — ціль і немагічні речі зникають. Великий урон по одній цілі. Ячейка 6р.'
  },
  heal: {
    level: 6, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В, С',
    damage: 'Лікування: 70 HP (фіксовано)', save: 'Ні',
    desc: 'Миттєво відновлює 70 HP і знімає сліпоту/глухоту/хвороби. Ячейка 6р.'
  },
  massSuggestion: {
    level: 6, cast: '1 дія', range: '18 м (60 фт)', duration: '24 години', components: 'В, М',
    damage: 'Немає — підказка дій', save: 'МДР рятунок',
    desc: 'До 12 істот виконують розумну «підказку» (не самогубство). Ячейка 6р.'
  },
  sunbeam: {
    level: 6, cast: '1 дія', range: 'На себе (лінія 18 м)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: '6d8 (6–48) святості', save: 'CON рятунок на половину',
    desc: 'Промінь сонця кожен хід. Нежить має disadvantage. Концентрація. Ячейка 6р.'
  },
  trueSeeing: {
    level: 6, cast: '1 дія', range: 'Дотик', duration: '1 година', components: 'В, С, М (смола 25+ зм)',
    damage: 'Немає — істинний зір', save: 'Ні',
    desc: 'Бачить невидиме, ілюзії, ефірних істот, оригінальну форму перевертнів. Ячейка 6р.'
  },
  wallOfIce: {
    level: 6, cast: '1 дія', range: '36 м (120 фт)', duration: 'Концентрація, до 10 хв', components: 'В, С, М',
    damage: '10d6 (10–60) холоду при руйнуванні панелі', save: 'DEX рятунок на половину',
    desc: 'Крижана стіна. Концентрація. Ячейка 6р.'
  },
  delayedBlastFireball: {
    level: 7, cast: '1 дія', range: '45 м (150 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: '12d6 (12–72) вогню (+1d6/раунд)', save: 'DEX рятунок на половину',
    desc: 'Куля накопичує силу кожен раунд. Концентрація. Ячейка 7р.'
  },
  etherealness: {
    level: 7, cast: '1 дія', range: 'На себе', duration: 'До 8 годин', components: 'В, С',
    damage: 'Немає — ефірний план', save: 'Ні',
    desc: 'Ти (і до 3 союзників за ячейку вище) переходите на Ефірний план. Ячейка 7р.'
  },
  fireStorm: {
    level: 7, cast: '1 дія', range: '45 м (150 фт)', duration: 'Миттєво', components: 'В, С',
    damage: '7d10 (7–70) вогню', save: 'DEX рятунок на половину',
    desc: 'До 10 кубів 3 м з вогнем — гнучка зона. Ячейка 7р.'
  },
  forcecage: {
    level: 7, cast: '1 дія', range: '30 м (100 фт)', duration: '1 година', components: 'В, С, М (рубін 1500+ зм)',
    damage: 'Немає — клітка з сили', save: 'Ні',
    desc: 'Куб 6 м з магічної сили. Телепорт DEX рятунок. Не концентрація. Ячейка 7р.'
  },
  planeShift: {
    level: 7, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В, С, М',
    damage: 'Немає — інший план', save: 'ХАР рятунок (недобровільно)',
    desc: 'Переміщення на інший план існування. Ячейка 7р.'
  },
  prismaticSpray: {
    level: 7, cast: '1 дія', range: 'На себе (конус 18 м)', duration: 'Миттєво', components: 'В, С',
    damage: '10d6 (10–60) різних типів', save: 'DEX рятунок',
    desc: '8 променів випадкових ефектів. Складне заклинання — кожен промінь окремо. Ячейка 7р.'
  },
  regenerate: {
    level: 7, cast: '1 дія', range: 'Дотик', duration: '1 година', components: 'В, С, М',
    damage: 'Лікування: 4d8 (4–32) + 15 HP/хв 1 год', save: 'Ні',
    desc: 'Відростає відірвані кінцівки. Ячейка 7р.'
  },
  resurrection: {
    level: 7, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В, С, М (діаманти 1000+ зм)',
    damage: 'Немає — повне оживлення', save: 'Ні',
    desc: 'Мертвий до 100 років, не нежить/конструкт. Штраф −4 на 24 год. Ячейка 7р.'
  },
  reverseGravity: {
    level: 7, cast: '1 дія', range: '30 м (100 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — падіння з висоти', save: 'DEX рятунок (утриматися)',
    desc: 'Циліндр 15 м — «підлога» стає стелею. Падіння = урон. Концентрація. Ячейка 7р.'
  },
  teleport: {
    level: 7, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В',
    damage: 'Немає — телепорт групи', save: 'Ні',
    desc: 'До 8 істот на відоме місце. Таблиця точності — можливі помилки. Ячейка 7р.'
  },
  antimagicField: {
    level: 8, cast: '1 дія', range: 'На себе (сфера 3 м)', duration: 'Концентрація, до 1 год', components: 'В, С, М',
    damage: 'Немає — придушує магію', save: 'Ні',
    desc: 'У сфері **не працює магія** — заклинання, магічні предмети. Концентрація. Ячейка 8р.'
  },
  dominateMonster: {
    level: 8, cast: '1 дія', range: '18 м (60 фт)', duration: 'Концентрація, до 1 год', components: 'В, С',
    damage: 'Немає — підкорення', save: 'МДР рятунок',
    desc: 'Будь-яка істота під твоїм контролем. Концентрація. Ячейка 8р.'
  },
  earthquake: {
    level: 8, cast: '1 дія', range: '150 м (500 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає прямого — руйнування, збиття', save: 'DEX рятунок',
    desc: 'Коло 30 м: тріщини, завали, складна місцевість. Концентрація. Ячейка 8р.'
  },
  feeblemind: {
    level: 8, cast: '1 дія', range: '45 м (150 фт)', duration: 'Миттєво', components: 'В, С, М',
    damage: '4d6 (4–24) психічного', save: 'ІНТ рятунок',
    desc: 'При провалі — ІНТ і ХАР = 1, не кастує. Повторний рятунок кожні 30 днів. Ячейка 8р.'
  },
  holyAura: {
    level: 8, cast: '1 дія', range: 'На себе (сфера 9 м)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — захист союзників', save: 'Ні',
    desc: 'Союзники: перевага на рятунки, атаки по них з disadvantage. Концентрація. Ячейка 8р.'
  },
  incendiaryCloud: {
    level: 8, cast: '1 дія', range: '45 м (150 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С',
    damage: '10d8 (10–80) вогню/раунд', save: 'DEX рятунок на половину',
    desc: 'Хмара вогню рухається 6 м/раунд. Концентрація. Ячейка 8р.'
  },
  maze: {
    level: 8, cast: '1 дія', range: '45 м (150 фт)', duration: 'Концентрація, до 10 хв', components: 'В, С',
    damage: 'Немає — ізольований лабіринт', save: 'Ні',
    desc: 'Ціль у міжвимірному лабіринті. Втеча — ІНТ перевірка DC 20. Концентрація. Ячейка 8р.'
  },
  mindBlank: {
    level: 8, cast: '1 дія', range: 'Дотик', duration: '24 години', components: 'В, С',
    damage: 'Немає — імунітет до читання думок', save: 'Ні',
    desc: 'Імунітет до психічного урону, читання думок, емоцій. Ячейка 8р.'
  },
  powerWordStun: {
    level: 8, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В',
    damage: 'Немає — оглушення', save: 'Ні',
    desc: 'Істота з ≤150 HP **автоматично** оглушена. Рятунку немає — лише поріг HP. Ячейка 8р.'
  },
  astralProjection: {
    level: 9, cast: '1 дія', range: '3 м (10 фт)', duration: 'Спеціальна', components: 'В, С, М',
    damage: 'Немає — астральний вихід', save: 'Ні',
    desc: 'Душа виходить у Астральний план. Тіло в стазисі. Ячейка 9р.'
  },
  foresight: {
    level: 9, cast: '1 дія', range: 'Дотик', duration: '8 годин', components: 'В, С, М',
    damage: 'Немає — перевага на все', save: 'Ні',
    desc: 'Ціль: перевага на атаки/перевірки/рятунки, вороги з disadvantage. **Не концентрація.** Ячейка 9р.'
  },
  gate: {
    level: 9, cast: '1 дія', range: '18 м (60 фт)', duration: 'Концентрація, до 1 хв', components: 'В, С, М',
    damage: 'Немає — портал', save: 'Ні',
    desc: 'Портал на інший план або виклик істоти за ім\'ям. Концентрація. Ячейка 9р.'
  },
  imprisonment: {
    level: 9, cast: '1 дія', range: '9 м (30 фт)', duration: 'Доки не розвіється', components: 'В, С, М',
    damage: 'Немає — вічне ув\'язнення', save: 'МДР рятунок',
    desc: 'Ціль у стазисі (камінь, ланцюги тощо). Розвіювання — особливий компонент. Ячейка 9р.'
  },
  massHeal: {
    level: 9, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В, С',
    damage: 'Лікування: 700 HP розподілити між будь-якою кількістю цілей', save: 'Ні',
    desc: 'Розподіляєш 700 HP як хочеш. Знімає сліпоту/глухоту. Ячейка 9р.'
  },
  meteorSwarm: {
    level: 9, cast: '1 дія', range: '1.6 км (1 миля)', duration: 'Миттєво', components: 'В, С',
    damage: '20d6 (20–120) вогню + 20d6 (20–120) дроблячого', save: 'DEX рятунок на половину',
    desc: 'Чотири метеори — найпотужніший урон у грі. Ячейка 9р (17+ lvl персонажа).'
  },
  powerWordKill: {
    level: 9, cast: '1 дія', range: '18 м (60 фт)', duration: 'Миттєво', components: 'В',
    damage: 'Смерть — ≤100 HP', save: 'Ні',
    desc: 'Істота з **≤100 HP миттєво помирає**. Без рятунку. Ячейка 9р.'
  },
  truePolymorph: {
    level: 9, cast: '1 дія', range: '9 м (30 фт)', duration: 'Концентрація, до 1 год', components: 'В, С, М',
    damage: 'Немає — повне перетворення', save: 'МДР рятунок',
    desc: 'Перетворення в **будь-яку істоту** CR ≤ рівня ячейки або об\'єкт. Концентрація. Ячейка 9р.'
  },
  trueResurrection: {
    level: 9, cast: '1 дія', range: 'Дотик', duration: 'Миттєво', components: 'В, С, М (діаманти 25000+ зм)',
    damage: 'Немає — повне воскресіння', save: 'Ні',
    desc: 'Оживляє кого завгодно, навіть без тіла. Ячейка 9р.'
  },
  wish: {
    level: 9, cast: '1 дія', range: 'На себе', duration: 'Миттєво', components: 'В',
    damage: 'Залежить від бажання', save: 'Ні',
    desc: 'Найпотужніше заклинання: копія будь-якого 8р заклинання, воскресіння групи, зміна реальності. DM вирішує межі. **33% шанс** ніколи більше не кастувати Wish. Ячейка 9р.'
  }
};

Object.assign(DND.SPELL_DETAILS, SPELL_DETAILS_HIGH);

/* Урон для високих рівнів — підключається в damageAtLevel */
DND.SPELL_DAMAGE_HIGH = {
  banishment: 'без урону — вигнання',
  blight: '8d8 (8–64) некротичного',
  iceStorm: '2d8 + 4d6 холоду/дроблячого',
  wallOfFire: '5d8 (5–40) вогню',
  coneOfCold: '8d8 (8–64) холоду',
  flameStrike: '4d6 вогню + 4d6 святості',
  chainLightning: '10d8 (10–80) блискавки',
  circleOfDeath: '8d6 (8–48) некротичного',
  disintegrate: '10d6 (10–60) сили',
  sunbeam: '6d8 (6–48) святості',
  delayedBlastFireball: '12d6 (12–72)+ вогню',
  fireStorm: '7d10 (7–70) вогню',
  prismaticSpray: 'до 10d6 (10–60)',
  incendiaryCloud: '10d8 (10–80)/раунд',
  meteorSwarm: '20d6 вогню + 20d6 дроблячого',
  feeblemind: '4d6 (4–24) психічного',
  heal: '70 HP',
  massHeal: '700 HP розподілити',
  powerWordKill: 'смерть при ≤100 HP',
  powerWordStun: 'оглушення при ≤150 HP'
};

DND.explainSpellExtra = (function(orig) {
  return function(spellId) {
    const extra = {
      polymorph: '🐻 Перетворюєш ворога в кролика/ведмедя — бій закінчується, поки тримаєш концентрацію.',
      counterspell: '⚡ Реакція на чужий каст. 3р+ — кинь d20+мод проти DC 10+рівень їхнього заклинання.',
      wish: '⭐ Найсильніше в грі. DM дозволяє «майже все», але є ризик втратити Wish назавжди.',
      meteorSwarm: '☄️ Топ урон D&D. Потрібен 17 рівень персонажа (ячейка 9р).',
      powerWordKill: '💀 Одне слово — миттєва смерть, якщо у цілі ≤100 HP. Без рятунку.'
    };
    if (extra[spellId]) return extra[spellId];
    return orig ? orig(spellId) : '';
  };
})(DND.explainSpellExtra);
