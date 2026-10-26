/* FOX GENESIS — game data tables (classic script, file:// safe) */
window.FoxGenesis = window.FoxGenesis || {};
(function (FG) {
  "use strict";

  FG.VERSION = "1.0.0";
  FG.SAVE_SCHEMA = 1;
  FG.WORLD_W = 4200;
  FG.WORLD_H = 4200;
  FG.TILE = 48;

  FG.COLORS = {
    bgDeep: "#07141C",
    ink: "#0A101C",
    mint: "#69E0BE",
    teal: "#55C9DB",
    amber: "#F0B66A",
    lilac: "#AD8CDE",
    text: "#E5EEE8",
    danger: "#E0746A",
    ally: "#7BCF9A",
    neutral: "#A8B8B0"
  };

  FG.BIOMES = {
    grove: {
      id: "grove",
      name: "Світний ліс",
      color: "#0C2A24",
      accent: "#69E0BE",
      fog: "#061510",
      danger: 0.25,
      desc: "Галявини, висока трава, хижаки на межі світла."
    },
    swamp: {
      id: "swamp",
      name: "Спорові болота",
      color: "#122418",
      accent: "#8BCF6A",
      fog: "#0A180E",
      danger: 0.55,
      desc: "В’язкість, отруйні хмари, фільтри рятують."
    },
    crystal: {
      id: "crystal",
      name: "Кришталеве нагір’я",
      color: "#121824",
      accent: "#8AB4E8",
      fog: "#090E18",
      danger: 0.6,
      desc: "Вузькі проходи, тверді панцири, мінерали."
    },
    roots: {
      id: "roots",
      name: "Підземні корені",
      color: "#1A120C",
      accent: "#F0B66A",
      fog: "#0C0804",
      danger: 0.65,
      desc: "Темрява, риття, вібрації, засідки."
    },
    tide: {
      id: "tide",
      name: "Припливні водойми",
      color: "#0A1C28",
      accent: "#55C9DB",
      fog: "#061018",
      danger: 0.5,
      desc: "Мілководдя, течії, плавальні маршрути."
    }
  };

  FG.SLOTS = [
    { id: "head", name: "Голова / чуття", max: 1 },
    { id: "attack", name: "Атака", max: 2 },
    { id: "back", name: "Спина / захист", max: 2 },
    { id: "move", name: "Рух", max: 2 },
    { id: "aux", name: "Допоміжний", max: 1 }
  ];

  /* 24 functional organs + late split */
  FG.ORGANS = {
    jaws: {
      id: "jaws", slot: "attack", group: "attack", name: "Сильні щелепи",
      hint: "Повільний укус, що пробиває частину броні.",
      cost: { biomass: 12 }, load: 8, mass: 6,
      unlockHint: "Переможи броньованого травоїдного або знайди кістковий зразок у лісі.",
      color: "#E8A090"
    },
    needles: {
      id: "needles", slot: "attack", group: "attack", name: "Голкова залоза",
      hint: "Дальний залп із розкидом.",
      cost: { biomass: 14 }, load: 7, mass: 4,
      unlockHint: "Збери колючий зразок на краю галявини.",
      color: "#C8E8D0"
    },
    acid: {
      id: "acid", slot: "attack", group: "attack", name: "Кислотний мішок",
      hint: "Снаряд і коротка небезпечна калюжа.",
      cost: { biomass: 16, sample: 1 }, load: 9, mass: 5,
      unlockHint: "Дослідюй спорові болота або кислотну істоту.",
      color: "#B6E86A"
    },
    electric: {
      id: "electric", slot: "attack", group: "attack", name: "Електричний орган",
      hint: "Заряд і стрибок розряду між близькими цілями.",
      cost: { biomass: 18, mineral: 4 }, load: 10, mass: 5,
      unlockHint: "Кришталеве нагір’я або електрична істота.",
      color: "#7EC8F0"
    },
    tentacle: {
      id: "tentacle", slot: "attack", group: "attack", name: "Щупальце",
      hint: "Притягує малу ціль або чіпляється за опору.",
      cost: { biomass: 13 }, load: 6, mass: 4,
      unlockHint: "Припливні водойми / водяний засадник.",
      color: "#AD8CDE"
    },
    tailmace: {
      id: "tailmace", slot: "attack", group: "attack", name: "Хвостова булава",
      hint: "Круговий удар із відштовхуванням.",
      cost: { biomass: 15 }, load: 9, mass: 8,
      unlockHint: "Важкий бій з ривковим хижаком.",
      color: "#D0A080"
    },
    carapace: {
      id: "carapace", slot: "back", group: "defense", name: "Сегментний панцир",
      hint: "Броня з додатковою масою.",
      cost: { biomass: 14, mineral: 6 }, load: 12, mass: 14,
      unlockHint: "Броньований травоїдний або мінерали нагір’я.",
      color: "#8A9AA8"
    },
    spikes: {
      id: "spikes", slot: "back", group: "defense", name: "Реактивні шипи",
      hint: "Відповідь на контактну атаку.",
      cost: { biomass: 12 }, load: 7, mass: 5,
      unlockHint: "Перший серйозний бій у лісі.",
      color: "#E0C090"
    },
    filmshield: {
      id: "filmshield", slot: "back", group: "defense", name: "Плівковий щит",
      hint: "Поглинає один удар, потім відновлюється поза боєм.",
      cost: { biomass: 16 }, load: 8, mass: 3,
      unlockHint: "Порятунок пораненої істоти / сховище.",
      color: "#A8E0F0"
    },
    sporeburst: {
      id: "sporeburst", slot: "back", group: "defense", name: "Споровий викид",
      hint: "Захисна хмара для відступу.",
      cost: { biomass: 11 }, load: 5, mass: 3,
      unlockHint: "Споровий носій на болотах.",
      color: "#90C070"
    },
    dashlegs: {
      id: "dashlegs", slot: "move", group: "move", name: "Ривкові лапи",
      hint: "Швидке переміщення через небезпечну зону.",
      cost: { biomass: 10 }, load: 5, mass: 4,
      unlockHint: "Перша мутація — майже завжди доступна біля старту.",
      color: "#69E0BE",
      starter: true
    },
    diggers: {
      id: "diggers", slot: "move", group: "move", name: "Рийні кінцівки",
      hint: "Проходження ґрунтових бар’єрів і коротка підземна засідка.",
      cost: { biomass: 15, mineral: 2 }, load: 8, mass: 6,
      unlockHint: "Підземні корені / копач.",
      color: "#C8A070"
    },
    membrane: {
      id: "membrane", slot: "move", group: "move", name: "Плавальна мембрана",
      hint: "Плавання та менший вплив течій.",
      cost: { biomass: 14 }, load: 6, mass: 3,
      unlockHint: "Припливні водойми.",
      color: "#55C9DB"
    },
    climbers: {
      id: "climbers", slot: "move", group: "move", name: "Чіпкі лапи",
      hint: "Рух через корені й скельні переходи.",
      cost: { biomass: 12 }, load: 6, mass: 4,
      unlockHint: "Кришталеві стежки / корені.",
      color: "#B09070"
    },
    gasbags: {
      id: "gasbags", slot: "move", group: "move", name: "Газові камери",
      hint: "Коротке зависання над мілкою перешкодою.",
      cost: { biomass: 13 }, load: 7, mass: 2,
      unlockHint: "Спори + висота на болотах.",
      color: "#D0E8C0"
    },
    vibesense: {
      id: "vibesense", slot: "head", group: "sense", name: "Вібраційне чуття",
      hint: "Сигнали руху за близькими перешкодами.",
      cost: { biomass: 11 }, load: 4, mass: 2,
      unlockHint: "Підземні корені.",
      color: "#F0B66A"
    },
    biolume: {
      id: "biolume", slot: "head", group: "sense", name: "Біолюмінесценція",
      hint: "Світло й приманка; більша помітність.",
      cost: { biomass: 9 }, load: 3, mass: 1,
      unlockHint: "Світний ліс — раннє відкриття.",
      color: "#69E0BE",
      starterPool: true
    },
    camouflage: {
      id: "camouflage", slot: "aux", group: "sense", name: "Камуфляж",
      hint: "Менша помітність під час повільного руху в укритті.",
      cost: { biomass: 12 }, load: 4, mass: 1,
      unlockHint: "Спостереження / сховок у траві.",
      color: "#7A9A80"
    },
    filter: {
      id: "filter", slot: "aux", group: "sense", name: "Фільтрувальний орган",
      hint: "Стійкість до спор і заражених ресурсів.",
      cost: { biomass: 13 }, load: 5, mass: 3,
      unlockHint: "Спорові болота.",
      color: "#A0D090"
    },
    regen: {
      id: "regen", slot: "aux", group: "sense", name: "Регенеративна залоза",
      hint: "Лікування поза боєм за біомасу.",
      cost: { biomass: 14 }, load: 6, mass: 3,
      unlockHint: "Відновлювальна камера / зразок у гнізді.",
      color: "#E090A0"
    },
    web: {
      id: "web", slot: "attack", group: "control", name: "Павутинна залоза",
      hint: "Пастки й уповільнення з видимими нитками.",
      cost: { biomass: 15 }, load: 7, mass: 3,
      unlockHint: "Павутинний мисливець / сховище.",
      color: "#E8E0D0"
    },
    pheromone: {
      id: "pheromone", slot: "head", group: "control", name: "Феромонний вузол",
      hint: "Команди союзникам і короткий груповий бонус.",
      cost: { biomass: 16, sample: 1 }, load: 5, mass: 2,
      unlockHint: "Колонія / друга порода.",
      color: "#AD8CDE"
    },
    symbiont: {
      id: "symbiont", slot: "aux", group: "control", name: "Симбіотична кишеня",
      hint: "Маленький супутник: захист або підтримка.",
      cost: { biomass: 18, sample: 1 }, load: 8, mass: 4,
      unlockHint: "Симбіотична подія / інкубатор.",
      color: "#90D0C0"
    },
    parasite: {
      id: "parasite", slot: "attack", group: "control", name: "Паразитичний відросток",
      hint: "Тимчасове керування слабкою істотою; сильних лише дезорієнтує.",
      cost: { biomass: 20, sample: 2 }, load: 9, mass: 3,
      unlockHint: "Паразит / пізня експедиція.",
      color: "#C070A0"
    },
    splitform: {
      id: "splitform", slot: "aux", group: "late", name: "Подвійна форма",
      hint: "Дві керовані форми: одне активне тіло, друге з обмеженою автономією.",
      cost: { biomass: 40, mineral: 12, sample: 3 }, load: 16, mass: 8,
      unlockHint: "Після кількох поколінь і підготовки до Великої зміни.",
      color: "#F0B66A",
      late: true
    }
  };

  FG.SYNERGIES = [
    {
      id: "web_electric",
      name: "Провідна пастка",
      needs: ["web", "electric"],
      desc: "Розряд іде вздовж павутинних ниток і вражає зв’язаних."
    },
    {
      id: "acid_needles",
      name: "Кислотні голки",
      needs: ["acid", "needles"],
      desc: "Голки залишають короткий кислотний ефект."
    },
    {
      id: "dig_vibe",
      name: "Підземний радар",
      needs: ["diggers", "vibesense"],
      desc: "Видимі підземні орієнтири й точніший вихід із засідки."
    },
    {
      id: "camo_parasite",
      name: "Тихий паразит",
      needs: ["camouflage", "parasite"],
      desc: "Легше підкрастися; атака знімає маскування."
    },
    {
      id: "carapace_tail",
      name: "Страж проходу",
      needs: ["carapace", "tailmace"],
      desc: "Повільний захисник краще утримує вузький прохід."
    },
    {
      id: "phero_regen",
      name: "Жива зграя",
      needs: ["pheromone", "regen"],
      desc: "Слабке групове лікування біля командира за біомасу."
    },
    {
      id: "lume_spore",
      name: "Світлова приманка",
      needs: ["biolume", "sporeburst"],
      desc: "Приманює здобич; деякі хижаки теж реагують."
    },
    {
      id: "membrane_electric",
      name: "Водна дуга",
      needs: ["membrane", "electric"],
      desc: "Більша зона провідності у воді з видимим телеграфом."
    }
  ];

  FG.BUILDINGS = {
    heart: { id: "heart", name: "Серце гнізда", cost: { biomass: 0, mineral: 0 }, radius: 120, desc: "Повернення, запас і родовід." },
    incubator: { id: "incubator", name: "Інкубатор", cost: { biomass: 25, mineral: 8 }, radius: 80, desc: "Вирощує союзників із порід." },
    archive: { id: "archive", name: "Генетичний архів", cost: { biomass: 18, mineral: 10 }, radius: 70, desc: "Гени, рецепти, спеціалізації." },
    garden: { id: "garden", name: "Поживний сад", cost: { biomass: 20, mineral: 4 }, radius: 90, desc: "Повільне відновлення їжі." },
    store: { id: "store", name: "Сховище", cost: { biomass: 15, mineral: 12 }, radius: 70, desc: "Запас для експедицій." },
    turret: { id: "turret", name: "Захисний наріст", cost: { biomass: 22, mineral: 14 }, radius: 160, desc: "Стріляє / затримує ворогів." },
    healbay: { id: "healbay", name: "Відновлювальна камера", cost: { biomass: 24, mineral: 8 }, radius: 80, desc: "Лікує і повертає у стрій." },
    tunnel: { id: "tunnel", name: "Тунельний вузол", cost: { biomass: 35, mineral: 20 }, radius: 60, desc: "Зв’язок між гніздами." }
  };

  FG.ROLES = {
    guard: { id: "guard", name: "Захисник", color: "#8AB4E8" },
    hunter: { id: "hunter", name: "Мисливець", color: "#E0746A" },
    gatherer: { id: "gatherer", name: "Збирач", color: "#69E0BE" },
    scout: { id: "scout", name: "Розвідник", color: "#F0B66A" },
    support: { id: "support", name: "Підтримка", color: "#AD8CDE" }
  };

  FG.ENEMY_ARCHETYPES = [
    { id: "pack", name: "Зграйний мисливець", hp: 28, speed: 95, dmg: 6, range: "melee", color: "#C07060" },
    { id: "dasher", name: "Ривковий хижак", hp: 36, speed: 130, dmg: 10, style: "dash", color: "#E09050" },
    { id: "armorherb", name: "Броньований травоїдний", hp: 70, speed: 45, dmg: 8, style: "tank", armor: 8, color: "#8A9AA0" },
    { id: "acidshot", name: "Кислотний стрілець", hp: 32, speed: 70, dmg: 7, style: "ranged", color: "#A0D050" },
    { id: "spore", name: "Споровий носій", hp: 40, speed: 55, dmg: 5, style: "cloud", color: "#80B070" },
    { id: "digger", name: "Копач", hp: 38, speed: 80, dmg: 9, style: "burrow", color: "#B09060" },
    { id: "spark", name: "Електрична істота", hp: 34, speed: 85, dmg: 8, style: "chain", color: "#70C0E0" },
    { id: "parasite", name: "Паразит", hp: 24, speed: 100, dmg: 5, style: "parasite", color: "#C070A0" },
    { id: "tideambush", name: "Водний засадник", hp: 42, speed: 90, dmg: 9, style: "ambush", color: "#4090B0" },
    { id: "nestguard", name: "Охоронець гнізда", hp: 55, speed: 60, dmg: 11, style: "guard", color: "#D0A060" },
    { id: "scout", name: "Мобільний розвідник", hp: 22, speed: 140, dmg: 4, style: "flee", color: "#F0C070" },
    { id: "support", name: "Підтримка зграї", hp: 30, speed: 75, dmg: 4, style: "buff", color: "#A090D0" }
  ];

  FG.BOSSES = [
    { id: "grove_boss", biome: "grove", name: "Корінь-вартовий", hp: 220, phases: 2, reward: "biolume" },
    { id: "swamp_boss", biome: "swamp", name: "Спорова матка", hp: 260, phases: 2, reward: "filter" },
    { id: "crystal_boss", biome: "crystal", name: "Дзеркальний панцир", hp: 280, phases: 2, reward: "electric" },
    { id: "roots_boss", biome: "roots", name: "Глухий рийник", hp: 300, phases: 2, reward: "diggers" },
    { id: "tide_boss", biome: "tide", name: "Припливний крокодил", hp: 290, phases: 2, reward: "membrane" }
  ];

  FG.EVENTS = [
    { id: "migration", name: "Міграція", warn: "Зграї змінюють маршрути.", cd: 180 },
    { id: "drought", name: "Посуха", warn: "Рослини сохнуть, їжі менше.", cd: 240 },
    { id: "mushroom", name: "Грибний викид", warn: "Спори в повітрі.", cd: 200 },
    { id: "tide", name: "Приплив", warn: "Вода змінює шляхи.", cd: 160 },
    { id: "rareprey", name: "Рідкісна здобич", warn: "Цінна істота поруч.", cd: 220 },
    { id: "raid", name: "Напад на гніздо", warn: "Хижаки йдуть на колонію!", cd: 300 },
    { id: "incubator", name: "Покинутий інкубатор", warn: "Можна вивчити породу.", cd: 260 },
    { id: "wounded", name: "Поранена істота", warn: "Потребує порятунку.", cd: 180 },
    { id: "war", name: "Боротьба колоній", warn: "Чужі воюють між собою.", cd: 280 },
    { id: "rift", name: "Відкрита тріщина", warn: "Новий прохід у корені.", cd: 240 },
    { id: "sporefog", name: "Споровий туман", warn: "Бачення обмежене.", cd: 200 },
    { id: "bloom", name: "Тимчасове цвітіння", warn: "Багато ресурсів.", cd: 220 }
  ];

  FG.FORMS = {
    mobile: { id: "mobile", name: "Рухлива", speed: 1.12, armor: 0.9, slots: { attack: 2, move: 2, back: 1, head: 1, aux: 1 } },
    armored: { id: "armored", name: "Панцирна", speed: 0.88, armor: 1.25, slots: { attack: 1, move: 1, back: 2, head: 1, aux: 1 } },
    segmented: { id: "segmented", name: "Сегментна", speed: 1.0, armor: 1.0, slots: { attack: 2, move: 2, back: 2, head: 1, aux: 1 } },
    symbiotic: { id: "symbiotic", name: "Симбіотична", speed: 1.0, armor: 0.95, slots: { attack: 1, move: 2, back: 1, head: 1, aux: 2 } }
  };

  FG.TUTORIAL_STEPS = [
    { id: "move", text: "WASD — рух. Миша — погляд." },
    { id: "food", text: "Підійди до світного плоду й натисни F." },
    { id: "danger", text: "Уникай червоного телеграфа атаки." },
    { id: "mutate", text: "Відкрий M — встанови перший орган у гнізді або з бібліотеки." },
    { id: "nest", text: "Знайди серце гнізда (світлий круг) і натисни F." },
    { id: "ally", text: "У колонії (C) вирости союзника й дай наказ." }
  ];

  FG.HELP_TEXT = [
    "WASD — рух · Миша — напрямок",
    "ЛКМ — атака · ПКМ — здібність органа",
    "Q / E — інші здібності · Shift — ривок",
    "F — взаємодія / збір / гніздо",
    "Tab — карта · M — еволюція · C — колонія",
    "Пробіл — тактична пауза · Esc — меню",
    "Перебудова тіла застосовується лише в гнізді."
  ];
})(window.FoxGenesis);
