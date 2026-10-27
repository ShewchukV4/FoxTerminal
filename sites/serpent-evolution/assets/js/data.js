/* FOX SERPENT: EVOLUTION — data tables */
window.FoxSerpent = window.FoxSerpent || {};
(function (FS) {
  "use strict";

  FS.VERSION = "1.4.0";
  FS.SAVE_SCHEMA = 2;
  FS.SAVE_KEY = "fox_serpent_evo_save_v1";
  FS.SAVE_BAK = "fox_serpent_evo_save_bak_v1";
  FS.GUIDE_VERSION = 5;
  FS.GUIDE_SEEN_KEY = "fox_serpent_evo_guide_v1";
  FS.MIGRATION_VERSION = 4;

  FS.CELL = 36;
  FS.CHUNK = 12;
  FS.DIRS = {
    U: { x: 0, y: -1, name: "up", opp: "D" },
    D: { x: 0, y: 1, name: "down", opp: "U" },
    L: { x: -1, y: 0, name: "left", opp: "R" },
    R: { x: 1, y: 0, name: "right", opp: "L" }
  };
  FS.DIR_KEYS = {
    KeyW: "U", ArrowUp: "U",
    KeyS: "D", ArrowDown: "D",
    KeyA: "L", ArrowLeft: "L",
    KeyD: "R", ArrowRight: "R"
  };

  FS.PLAYER_STEP = 1 / 5.5;
  FS.ENEMY_STEP_BASE = 1 / 3.5;
  FS.START_LENGTH = 3;
  FS.DEATH_LENGTH = 3;
  FS.FIRST_EXPAND_COST = 3;
  FS.EXPAND_COSTS = [3, 5, 6, 7, 8, 9];

  FS.COLORS = {
    bg: "#101b18",
    moss: "#1C3328",
    soil: "#243528",
    mint: "#b5d398",
    teal: "#7e9a62",
    amber: "#f2d597",
    berry: "#d68d74",
    fruit: "#ebbc68",
    pear: "#c4dcab",
    seed: "#C8D090",
    golden: "#f0d060",
    stone: "#4A5560",
    nest: "#A07850",
    text: "#eaf3df",
    danger: "#e7a18d",
    heart: "#eda99f",
    player: "#aace78",
    enemyCareful: "#7AA8C8",
    enemyIntercept: "#D08060",
    enemyTerritory: "#B090D0",
    enemyElder: "#C8A060"
  };

  FS.REGION_TYPES = {
    garden: {
      name: "Плодовий сад", danger: 0, food: 1.35, stones: 0.12,
      desc: "Багато плодів, широкі стежки, безпечний початок.",
      palette: "warm"
    },
    meadow: {
      name: "Квіткова галявина", danger: 0, food: 1.2, stones: 0.1,
      desc: "Відкриті простори й ягоди; добрі кільцеві маршрути.",
      palette: "bloom"
    },
    rocky: {
      name: "Кам’яні коридори", danger: 1, food: 0.7, stones: 0.42,
      desc: "Вузькі проходи між брилами — плануй довжину.",
      palette: "stone"
    },
    thicket: {
      name: "Зарості", danger: 1, food: 1.1, stones: 0.22,
      desc: "Звивисті стежки, щільніша рослинність.",
      palette: "dense"
    },
    shore: {
      name: "Берегова стежка", danger: 1, food: 1.0, stones: 0.18,
      desc: "Кільцеві маршрути біля води, груші й насіння.",
      palette: "cool"
    },
    corridor: {
      name: "Вузькі проходи", danger: 2, food: 0.55, stones: 0.38,
      desc: "Тіснота карає довге тіло; швидкі рішення.",
      palette: "narrow"
    },
    elder: {
      name: "Територія дорослих", danger: 3, food: 0.85, stones: 0.28,
      desc: "Сильна змія-патруль і цінна нагорода за перемогу.",
      palette: "elder"
    }
  };

  /*
   * ~48 nodes, 8 A/B forks. Branches: control / explore / tactics
   * effect.kind must have a consumer in talents.js / renderer / food / AI.
   */
  FS.TALENTS = {
    root: {
      id: "root", name: "Паростки", branch: "core", icon: "seed",
      desc: "Центр саду розвитку. Змійка пам’ятає галявину.",
      cost: 0, prereq: [], effect: { kind: "none" }
    },

    /* ——— Контроль ——— */
    turn_buffer: {
      id: "turn_buffer", name: "Гнучкий поворот", branch: "control", icon: "turn",
      desc: "Буфер команд повороту 2→3.",
      cost: 1, prereq: ["root"], effect: { kind: "turnBuffer", value: 3 }
    },
    hold_pace: {
      id: "hold_pace", name: "Рівний крок", branch: "control", icon: "pace",
      desc: "Утримання: +0.35 кроку/с (м’яко).",
      cost: 1, prereq: ["turn_buffer"], effect: { kind: "playerRate", add: 0.35 }
    },
    danger_hint: {
      id: "danger_hint", name: "Обережний погляд", branch: "control", icon: "eye",
      desc: "На паузі підсвічує небезпечну next-клітинку.",
      cost: 1, prereq: ["hold_pace"], effect: { kind: "pauseDanger", value: true }
    },
    growth_preview: {
      id: "growth_preview", name: "Передчуття росту", branch: "control", icon: "grow",
      desc: "HUD показує цільову довжину й pending growth.",
      cost: 1, prereq: ["danger_hint"], effect: { kind: "growthHud", value: true }
    },
    fork_maneuver: {
      id: "fork_maneuver", name: "Розвилка: маневр", branch: "control", fork: true, icon: "fork",
      desc: "Сильний маневр або серце.",
      cost: 2, prereq: ["growth_preview"],
      choices: {
        A: {
          id: "timely_maneuver", name: "Вчасний маневр",
          desc: "F: один крок крізь власне тіло (не стіни). CD 26 с.",
          effect: { kind: "phaseSelf", cd: 26 }
        },
        B: { id: "heart_c1", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    coil_control: {
      id: "coil_control", name: "Контроль кільця", branch: "control", icon: "coil",
      desc: "Flood-fill простору біля голови на HUD.",
      cost: 1, prereq: ["fork_maneuver"], effect: { kind: "spaceHud", value: true }
    },
    soft_brake: {
      id: "soft_brake", name: "М’яке гальмо", branch: "control", icon: "brake",
      desc: "V: на 1.4 с сповільнити власний tick (−35%). CD 22 с. Вороги без змін.",
      cost: 1, prereq: ["coil_control"], effect: { kind: "selfSlow", dur: 1.4, cd: 22, mul: 0.65 }
    },
    phase_cd: {
      id: "phase_cd", name: "Швидкий маневр", branch: "control", icon: "flash",
      desc: "Cooldown маневру −6 с (якщо взято).",
      cost: 1, prereq: ["soft_brake"], effect: { kind: "phaseCdCut", value: 6 }
    },
    fork_shed: {
      id: "fork_shed", name: "Розвилка: линяння", branch: "control", fork: true, icon: "fork",
      desc: "Контрольоване скорочення або серце.",
      cost: 2, prereq: ["phase_cd"],
      choices: {
        A: {
          id: "shedding", name: "Линяння",
          desc: "G: скинути до 3 сегментів поживи (ціна = пожива). CD 36 с.",
          effect: { kind: "shedNutrition", keep: 0, cd: 36 }
        },
        B: { id: "heart_c2", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    soft_start: {
      id: "soft_start", name: "М’який старт", branch: "control", icon: "shield",
      desc: "Після серця: +0.45 с grace стояння.",
      cost: 1, prereq: ["fork_maneuver"], effect: { kind: "heartGrace", add: 0.45 }
    },
    turn_master: {
      id: "turn_master", name: "Майстер повороту", branch: "control", icon: "turn",
      desc: "Буфер поворотів до 4.",
      cost: 2, prereq: ["fork_shed"], effect: { kind: "turnBuffer", value: 4 }
    },
    calm_hold: {
      id: "calm_hold", name: "Спокійне утримання", branch: "control", icon: "pace",
      desc: "Трохи повільніший, але стабільний hold (−0.15/с від бонусів).",
      cost: 1, prereq: ["hold_pace"], effect: { kind: "playerRate", add: -0.15 }
    },
    nest_anchor: {
      id: "nest_anchor", name: "Якір гнізда", branch: "control", icon: "nest",
      desc: "Біля гнізда підказка безпечних клітинок яскравіша.",
      cost: 1, prereq: ["soft_start"], effect: { kind: "nestGlow", value: true }
    },

    /* ——— Дослідження ——— */
    wide_eye: {
      id: "wide_eye", name: "Широкий зір", branch: "explore", icon: "eye",
      desc: "Камера трохи далі (+vision).",
      cost: 1, prereq: ["root"], effect: { kind: "vision", add: 2 }
    },
    forage: {
      id: "forage", name: "Уважний збір", branch: "explore", icon: "fruit",
      desc: "Їжа дає +12% досвіду.",
      cost: 1, prereq: ["wide_eye"], effect: { kind: "xpMul", mul: 1.12 }
    },
    ripe_map: {
      id: "ripe_map", name: "Карта дозрівання", branch: "explore", icon: "map",
      desc: "На мінікарті/HUD видно бутони й таймер ділянки.",
      cost: 1, prereq: ["forage"], effect: { kind: "ripeHud", value: true }
    },
    nearest_fruit: {
      id: "nearest_fruit", name: "Нюх плоду", branch: "explore", icon: "fruit",
      desc: "Стрілка до найближчого стиглого плоду.",
      cost: 1, prereq: ["ripe_map"], effect: { kind: "fruitArrow", value: true }
    },
    fork_scout: {
      id: "fork_scout", name: "Розвилка: розвідка", branch: "explore", fork: true, icon: "fork",
      desc: "Регіональний інтелект або серце.",
      cost: 2, prereq: ["nearest_fruit"],
      choices: {
        A: {
          id: "region_intel", name: "Огляд межі",
          desc: "На карті видно тип, небезпеку й вартість сусідів.",
          effect: { kind: "regionIntel", value: true }
        },
        B: { id: "heart_e1", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    first_visit: {
      id: "first_visit", name: "Перший крок", branch: "explore", icon: "flag",
      desc: "Перше відкриття ділянки: +1 XP бонусом після оплати.",
      cost: 1, prereq: ["fork_scout"], effect: { kind: "expandXp", value: 1 }
    },
    open_ready: {
      id: "open_ready", name: "Готовність до межі", branch: "explore", icon: "gate",
      desc: "Вартість розширення −1 пожива (мін. 2).",
      cost: 1, prereq: ["first_visit"], effect: { kind: "expandDiscount", value: 1 }
    },
    fork_garden: {
      id: "fork_garden", name: "Розвилка: сад", branch: "explore", fork: true, icon: "fork",
      desc: "Багатший сад або серце.",
      cost: 2, prereq: ["open_ready"],
      choices: {
        A: {
          id: "garden_bounty", name: "Щедрий сад",
          desc: "Стартова ділянка: +2 до місткості їжі.",
          effect: { kind: "gardenCapAdd", value: 2 }
        },
        B: { id: "heart_e2", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    ripe_speed: {
      id: "ripe_speed", name: "Швидке дозрівання", branch: "explore", icon: "time",
      desc: "Інтервал дозрівання ×0.85 (у межах cap).",
      cost: 2, prereq: ["fork_garden"], effect: { kind: "ripeSpeedMul", value: 0.85 }
    },
    nest_path: {
      id: "nest_path", name: "Стежка додому", branch: "explore", icon: "nest",
      desc: "Підказка чистого напрямку до гнізда.",
      cost: 1, prereq: ["forage"], effect: { kind: "nestPath", value: true }
    },
    calm_nest: {
      id: "calm_nest", name: "Спокійне гніздо", branch: "explore", icon: "nest",
      desc: "Біля гнізда вороги рідше тиснуть на голову.",
      cost: 1, prereq: ["nest_path"], effect: { kind: "nestSafety", value: true }
    },
    survey: {
      id: "survey", name: "Огляд галявини", branch: "explore", icon: "map",
      desc: "Landmark «видова галявина» дає більше інфо про сусідів.",
      cost: 1, prereq: ["fork_scout"], effect: { kind: "vistaBonus", value: true }
    },
    forage_xp2: {
      id: "forage_xp2", name: "Смачний досвід", branch: "explore", icon: "fruit",
      desc: "Ще +10% XP з їжі (стек).",
      cost: 2, prereq: ["ripe_speed"], effect: { kind: "xpMul", mul: 1.1 }
    },
    deep_scout: {
      id: "deep_scout", name: "Глибша розвідка", branch: "explore", icon: "eye",
      desc: "Vision +2 додатково.",
      cost: 1, prereq: ["wide_eye"], effect: { kind: "vision", add: 2 }
    },

    /* ——— Тактика ——— */
    read_space: {
      id: "read_space", name: "Читання простору", branch: "tactics", icon: "grid",
      desc: "На паузі силуети зайнятих клітинок чіткіші.",
      cost: 1, prereq: ["root"], effect: { kind: "pauseGrid", value: true }
    },
    bait_patience: {
      id: "bait_patience", name: "Терпіння", branch: "tactics", icon: "wait",
      desc: "Стоячи біля їжі: AI рідше йде прямо на тебе.",
      cost: 1, prereq: ["read_space"], effect: { kind: "standPressure", value: true }
    },
    body_wall: {
      id: "body_wall", name: "Стіна з тіла", branch: "tactics", icon: "wall",
      desc: "Підказка тактики перекриття при довжині ≥8.",
      cost: 1, prereq: ["bait_patience"], effect: { kind: "bodyWallHint", value: true }
    },
    stealth_stand: {
      id: "stealth_stand", name: "Тихе стояння", branch: "tactics", icon: "hide",
      desc: "Стоячи: дальність виявлення −30%.",
      cost: 1, prereq: ["body_wall"], effect: { kind: "stealthStand", mul: 0.7 }
    },
    fork_cold: {
      id: "fork_cold", name: "Розвилка: холод", branch: "tactics", fork: true, icon: "fork",
      desc: "Локальне сповільнення або серце.",
      cost: 2, prereq: ["stealth_stand"],
      choices: {
        A: {
          id: "cold_blood", name: "Холодна кров",
          desc: "C: 2.2 с slow у радіусі 5. CD 30 с.",
          effect: { kind: "coldBlood", radius: 5, dur: 2.2, cd: 30, slowMul: 0.45 }
        },
        B: { id: "heart_t1", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    enemy_label: {
      id: "enemy_label", name: "Ім’я суперника", branch: "tactics", icon: "tag",
      desc: "Показує ім’я й архетип найближчого ворога.",
      cost: 1, prereq: ["fork_cold"], effect: { kind: "enemyLabel", value: true }
    },
    spawn_warn: {
      id: "spawn_warn", name: "Попередження межі", branch: "tactics", icon: "warn",
      desc: "Довше попередження перед небезпечним розширенням.",
      cost: 1, prereq: ["enemy_label"], effect: { kind: "spawnWarn", value: true }
    },
    fork_foresight: {
      id: "fork_foresight", name: "Розвилка: передчуття", branch: "tactics", fork: true, icon: "fork",
      desc: "Передчуття кроку або серце.",
      cost: 2, prereq: ["spawn_warn"],
      choices: {
        A: {
          id: "foresight", name: "Передчуття",
          desc: "Показує наступний intent видимого ворога.",
          effect: { kind: "foresight", value: true }
        },
        B: { id: "heart_t2", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    rival_memory: {
      id: "rival_memory", name: "Пам’ять суперника", branch: "tactics", icon: "trophy",
      desc: "Перемога над змією: +1 XP (чесна нагорода).",
      cost: 1, prereq: ["read_space"], effect: { kind: "killXp", value: 1 }
    },
    territory_xp: {
      id: "territory_xp", name: "Виживання на межі", branch: "tactics", icon: "flag",
      desc: "+XP за час на небезпечній території (рідко, з лімітом).",
      cost: 2, prereq: ["fork_foresight"], effect: { kind: "dangerXp", value: true }
    },
    fork_quiet: {
      id: "fork_quiet", name: "Розвилка: тиша", branch: "tactics", fork: true, icon: "fork",
      desc: "Глибша маскування або серце.",
      cost: 2, prereq: ["stealth_stand"],
      choices: {
        A: {
          id: "quiet_path", name: "Тиха стежка",
          desc: "Стоячи: виявлення ще −20% (стек із тихим стоянням).",
          effect: { kind: "stealthStand", mul: 0.8 }
        },
        B: { id: "heart_t3", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    kill_bonus: {
      id: "kill_bonus", name: "Тріумф", branch: "tactics", icon: "trophy",
      desc: "Перемога над розумною змією: +2 XP замість 1.",
      cost: 2, prereq: ["rival_memory"], effect: { kind: "killXp", value: 2 }
    },
    fork_grace: {
      id: "fork_grace", name: "Розвилка: запасний удар", branch: "tactics", fork: true, icon: "fork",
      desc: "Довший grace після серця або ще одне серце.",
      cost: 2, prereq: ["territory_xp"],
      choices: {
        A: {
          id: "long_grace", name: "Довгий подих",
          desc: "Grace після серця +0.7 с.",
          effect: { kind: "heartGrace", add: 0.7 }
        },
        B: { id: "heart_t4", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    pattern_collect: {
      id: "pattern_collect", name: "Візерунки шкіри", branch: "tactics", icon: "scale",
      desc: "Відкриває косметичні візерунки після перемог (без колізій).",
      cost: 1, prereq: ["kill_bonus"], effect: { kind: "cosmetics", value: true }
    },
    pressure_read: {
      id: "pressure_read", name: "Читання тиску", branch: "tactics", icon: "grid",
      desc: "Показує, чи ворог зараз «полює» чи патрулює.",
      cost: 1, prereq: ["enemy_label"], effect: { kind: "aiStateHud", value: true }
    },

    /* ——— Господарство ——— */
    soil_sense: {
      id: "soil_sense", name: "Відчуття ґрунту", branch: "house", icon: "soil",
      desc: "Грядки на сухій землі ростуть трохи швидше (посадка вже без таланту).",
      cost: 1, prereq: ["root"], effect: { kind: "farmSpeedMul", value: 0.9 }
    },
    earth_hand: {
      id: "earth_hand", name: "Землероб", branch: "house", icon: "farm",
      desc: "Менший штраф звичайного ґрунту для ферм.",
      cost: 1, prereq: ["soil_sense"], effect: { kind: "soilIgnore", value: true }
    },
    plan_build: {
      id: "plan_build", name: "Планувальник", branch: "house", icon: "plan",
      desc: "У панелі B видно причину відмови чіткіше (завжди).",
      cost: 1, prereq: ["earth_hand"], effect: { kind: "buildPreview", value: true }
    },
    fork_garden_care: {
      id: "fork_garden_care", name: "Розвилка: сад", branch: "house", fork: true, icon: "fork",
      desc: "Друга ферма для садівника або серце.",
      cost: 2, prereq: ["plan_build"],
      choices: {
        A: {
          id: "tended_garden", name: "Доглянутий сад",
          desc: "Садівник обслуговує другу ферму в радіусі.",
          effect: { kind: "gardenerRadius", value: 8 }
        },
        B: { id: "heart_h1", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    harvest_cap: {
      id: "harvest_cap", name: "Склад I", branch: "house", icon: "crate",
      desc: "+4 місткості базового складу їжі.",
      cost: 1, prereq: ["fork_garden_care"], effect: { kind: "pantryCapAdd", value: 4 }
    },
    clear_route: {
      id: "clear_route", name: "Чіткий маршрут", branch: "house", icon: "path",
      desc: "Носій швидше на стежках (логістика).",
      cost: 1, prereq: ["harvest_cap"], effect: { kind: "pathLogistics", value: true }
    },
    fork_crew: {
      id: "fork_crew", name: "Розвилка: команда", branch: "house", fork: true, icon: "fork",
      desc: "Другий союзник або серце.",
      cost: 2, prereq: ["clear_route"],
      choices: {
        A: {
          id: "crew_two", name: "Другий працівник",
          desc: "Ліміт союзників +1.",
          effect: { kind: "allyCapAdd", value: 1 }
        },
        B: { id: "heart_h2", name: "+1 серце", desc: "Одноразовий порятунок.", effect: { kind: "heart", value: 1 } }
      }
    },
    careful_worker: {
      id: "careful_worker", name: "Обережний працівник", branch: "house", icon: "hide",
      desc: "Союзник раніше йде додому при ворогові поруч.",
      cost: 1, prereq: ["fork_crew"], effect: { kind: "allyFlee", value: true }
    },
    field_sign: {
      id: "field_sign", name: "Польовий знак", branch: "house", icon: "warn",
      desc: "Провідник/садівник підсвічує видимого ворога.",
      cost: 1, prereq: ["careful_worker"], effect: { kind: "allyWarn", value: true }
    },
    farm_speed: {
      id: "farm_speed", name: "Швидкий цикл", branch: "house", icon: "time",
      desc: "Усі ферми ×0.9 до часу циклу.",
      cost: 2, prereq: ["earth_hand"], effect: { kind: "farmSpeedMul", value: 0.9 }
    }
  };

  /*
   * 4 vertical columns — col 0..3, row 0..n
   * Pixel layout computed in UI: NODE_W=132, NODE_H=52, GAP_X=28, GAP_Y=16
   * Never put two nodes on same (col,row).
   */
  FS.TALENT_COLS = {
    control: 0, house: 1, explore: 2, tactics: 3, core: 1.5
  };
  FS.TALENT_LAYOUT = [
    { id: "root", col: 1.5, row: 0 },
    /* control col 0 */
    { id: "turn_buffer", col: 0, row: 1 },
    { id: "hold_pace", col: 0, row: 2 },
    { id: "calm_hold", col: 0, row: 3 },
    { id: "danger_hint", col: 0, row: 4 },
    { id: "growth_preview", col: 0, row: 5 },
    { id: "fork_maneuver", col: 0, row: 6 },
    { id: "soft_start", col: 0, row: 7 },
    { id: "coil_control", col: 0, row: 8 },
    { id: "nest_anchor", col: 0, row: 9 },
    { id: "soft_brake", col: 0, row: 10 },
    { id: "phase_cd", col: 0, row: 11 },
    { id: "fork_shed", col: 0, row: 12 },
    { id: "turn_master", col: 0, row: 13 },
    /* house col 1 */
    { id: "soil_sense", col: 1, row: 1 },
    { id: "earth_hand", col: 1, row: 2 },
    { id: "farm_speed", col: 1, row: 3 },
    { id: "plan_build", col: 1, row: 4 },
    { id: "fork_garden_care", col: 1, row: 5 },
    { id: "harvest_cap", col: 1, row: 6 },
    { id: "clear_route", col: 1, row: 7 },
    { id: "fork_crew", col: 1, row: 8 },
    { id: "careful_worker", col: 1, row: 9 },
    { id: "field_sign", col: 1, row: 10 },
    /* explore col 2 */
    { id: "wide_eye", col: 2, row: 1 },
    { id: "deep_scout", col: 2, row: 2 },
    { id: "forage", col: 2, row: 3 },
    { id: "nest_path", col: 2, row: 4 },
    { id: "calm_nest", col: 2, row: 5 },
    { id: "ripe_map", col: 2, row: 6 },
    { id: "nearest_fruit", col: 2, row: 7 },
    { id: "fork_scout", col: 2, row: 8 },
    { id: "survey", col: 2, row: 9 },
    { id: "first_visit", col: 2, row: 10 },
    { id: "open_ready", col: 2, row: 11 },
    { id: "fork_garden", col: 2, row: 12 },
    { id: "ripe_speed", col: 2, row: 13 },
    { id: "forage_xp2", col: 2, row: 14 },
    /* tactics col 3 */
    { id: "read_space", col: 3, row: 1 },
    { id: "rival_memory", col: 3, row: 2 },
    { id: "kill_bonus", col: 3, row: 3 },
    { id: "pattern_collect", col: 3, row: 4 },
    { id: "bait_patience", col: 3, row: 5 },
    { id: "body_wall", col: 3, row: 6 },
    { id: "stealth_stand", col: 3, row: 7 },
    { id: "fork_quiet", col: 3, row: 8 },
    { id: "fork_cold", col: 3, row: 9 },
    { id: "enemy_label", col: 3, row: 10 },
    { id: "pressure_read", col: 3, row: 11 },
    { id: "spawn_warn", col: 3, row: 12 },
    { id: "fork_foresight", col: 3, row: 13 },
    { id: "territory_xp", col: 3, row: 14 },
    { id: "fork_grace", col: 3, row: 15 }
  ];

  FS.TALENT_NODE = { w: 132, h: 52, gapX: 28, gapY: 16, pad: 24 };

  FS.talentPixel = function (lay) {
    var N = FS.TALENT_NODE;
    return {
      x: N.pad + lay.col * (N.w + N.gapX),
      y: N.pad + lay.row * (N.h + N.gapY),
      cx: N.pad + lay.col * (N.w + N.gapX) + N.w / 2,
      cy: N.pad + lay.row * (N.h + N.gapY) + N.h / 2,
      w: N.w, h: N.h
    };
  };

  FS.talentTreeBounds = function () {
    var N = FS.TALENT_NODE;
    var maxCol = 0, maxRow = 0;
    FS.TALENT_LAYOUT.forEach(function (L) {
      if (L.col > maxCol) maxCol = L.col;
      if (L.row > maxRow) maxRow = L.row;
    });
    return {
      w: Math.ceil(N.pad * 2 + (maxCol + 1) * (N.w + N.gapX)),
      h: Math.ceil(N.pad * 2 + (maxRow + 1) * (N.h + N.gapY))
    };
  };

  FS.talentLayoutOverlaps = function () {
    var boxes = FS.TALENT_LAYOUT.map(function (L) {
      var p = FS.talentPixel(L);
      return { id: L.id, x: p.x, y: p.y, r: p.x + p.w, b: p.y + p.h };
    });
    var hits = [];
    for (var i = 0; i < boxes.length; i++) {
      for (var j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], b = boxes[j];
        if (a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y) hits.push(a.id + "+" + b.id);
      }
    }
    return hits;
  };

  FS.OBJECT_LEGEND = [
    { kind: "food", name: "Плід", look: "фрукт/ягоди", action: "Пройди головою — +пожива", color: "amber" },
    { kind: "tree", name: "Дерево", look: "стовбур + крона", action: "F поруч — заготівля; гілки лише під кроною", color: "wood" },
    { kind: "wood", name: "Гілки", look: "в’язка під деревом", action: "Підбери головою — +деревина", color: "wood" },
    { kind: "stump", name: "Пень", look: "пеньок", action: "F поруч — заготівля +2–3", color: "wood" },
    { kind: "bush", name: "Плодовий кущ", look: "квітка/кущ", action: "Підказка місця їжі", color: "mint" },
    { kind: "farm_ready", name: "Готовий урожай", look: "фрукт на грядці", action: "Стань на грядку або садівник", color: "amber" },
    { kind: "drop_pad", name: "Майданчик видачі", look: "квадрат біля гнізда", action: "Сюди носять плоди", color: "nest" },
    { kind: "poi", name: "Місце інтересу", look: "окрема іконка", action: "F / підтвердження взаємодії", color: "amber" },
    { kind: "fence", name: "Паркан", look: "дерев’яна огорожа", action: "Блокує ворогів", color: "wood" },
    { kind: "gate", name: "Ворота", look: "ворота", action: "Свої проходять, вороги — ні", color: "wood" },
    { kind: "enemy_nest", name: "Чуже гніздо", look: "ворожий вхід", action: "Патруль / рейди", color: "danger" }
  ];

  FS.BUILD_COSTS = {
    fence: { wood: 1, name: "Паркан" },
    gate: { wood: 2, name: "Ворота" },
    block: { wood: 2, name: "Блок" },
    plot: { wood: 2, nutrition: 1, name: "Грядка" },
    hut: { wood: 5, name: "Домівка" },
    shed: { wood: 4, name: "Склад деревини" },
    larder: { wood: 4, name: "Склад їжі" }
  };

  FS.HELP = [
    "WASD — крок. Відпусти — зупинись. Вороги рухаються далі.",
    "Пожива на змійці 0–9 = довжина 3–12. Базовий склад їжі — окремо (F біля гнізда/комори).",
    "Грядка — на будь-якій сухій вільній землі. Їжа росте лише на грядках.",
    "Деревина — гілки під деревом; F біля дерева — заготівля.",
    "B — будівництво. ЛКМ ставити · ПКМ скасувати · X знести. Паркан-ряд = увесь або нічого.",
    "Tab — земля · T — таланти · H — гайд · Пробіл — пауза"
  ];

  FS.LONG_GOALS = [
    { id: "regions3", title: "Три землі", detail: "Відкрий 3 різні типи територій" },
    { id: "branch_done", title: "Гілка до кінця", detail: "Заверши одну гілку дерева" },
    { id: "garden_master", title: "Садовник", detail: "Покращ сад вузлом і дочекайся повного врожаю" },
    { id: "arch_wins", title: "Архетипи", detail: "Перехитри 2 різних архетипи змій" },
    { id: "patterns", title: "Візерунки", detail: "Збери 3 косметичні візерунки шкіри" }
  ];
})(window.FoxSerpent);
