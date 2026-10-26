/* FOX SERPENT: EVOLUTION — data tables */
window.FoxSerpent = window.FoxSerpent || {};
(function (FS) {
  "use strict";

  FS.VERSION = "1.0.0";
  FS.SAVE_SCHEMA = 1;
  FS.SAVE_KEY = "fox_serpent_evo_save_v1";
  FS.SAVE_BAK = "fox_serpent_evo_save_bak_v1";

  FS.CELL = 36;
  FS.CHUNK = 12; // start chunk size
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

  FS.PLAYER_STEP = 1 / 5.5; // ~5.5 steps/s hold
  FS.ENEMY_STEP_BASE = 1 / 3.5;
  FS.START_LENGTH = 3;
  FS.DEATH_LENGTH = 3;
  FS.CARGO_BASE = 8;
  FS.FIRST_EXPAND_COST = 12;

  FS.COLORS = {
    bg: "#0F1A14",
    moss: "#1C3328",
    soil: "#243528",
    mint: "#69E0BE",
    teal: "#4DB8A8",
    amber: "#E8B86A",
    berry: "#D46A8C",
    fruit: "#E09050",
    seed: "#C8D090",
    stone: "#4A5560",
    nest: "#A07850",
    text: "#E8F0EA",
    danger: "#E0746A",
    heart: "#E87890",
    player: "#5ECF9A",
    enemyCareful: "#7AA8C8",
    enemyIntercept: "#D08060",
    enemyTerritory: "#B090D0",
    enemyElder: "#C8A060"
  };

  FS.REGION_TYPES = {
    garden: { name: "Плодовий сад", danger: 0, food: 1.3, material: 0.8, stones: 0.15, desc: "Багато їжі, мало каміння." },
    rocky: { name: "Кам’янистий прохід", danger: 1, food: 0.7, material: 1.4, stones: 0.45, desc: "Матеріал і вузькі шляхи." },
    thicket: { name: "Заросла галявина", danger: 1, food: 1.1, material: 1.0, stones: 0.25, desc: "Густа рослинність і звивисті маршрути." },
    corridor: { name: "Вузькі коридори", danger: 2, food: 0.6, material: 1.1, stones: 0.35, desc: "Тіснота — ризик для довгої змії." },
    shore: { name: "Берегові стежки", danger: 1, food: 1.0, material: 1.0, stones: 0.2, desc: "Кільцеві маршрути біля води." },
    elder: { name: "Територія дорослих", danger: 3, food: 0.9, material: 1.2, stones: 0.3, desc: "Сильна змія й цінна нагорода." }
  };

  /* ~24 nodes, 6 forks A/B. B = expendable heart. */
  FS.TALENTS = {
    root: {
      id: "root", name: "Пробудження", branch: "core",
      desc: "Початок шляху. Змійка пам’ятає галявину.",
      cost: 0, prereq: [], effect: { kind: "none" }
    },
    // Movement branch
    turn_buffer: {
      id: "turn_buffer", name: "Гнучкий поворот", branch: "move",
      desc: "Більший буфер команд повороту (2→3).",
      cost: 1, prereq: ["root"], effect: { kind: "turnBuffer", value: 3 }
    },
    hold_pace: {
      id: "hold_pace", name: "Рівний крок", branch: "move",
      desc: "Утримання: +0.4 кроку/с.",
      cost: 1, prereq: ["turn_buffer"], effect: { kind: "playerRate", add: 0.4 }
    },
    length_sense: {
      id: "length_sense", name: "Відчуття довжини", branch: "move",
      desc: "Перед їжею видно +1 сегмент чіткіше; growth debt −10% часу візуально (логіка та сама, підказка довша).",
      cost: 1, prereq: ["hold_pace"], effect: { kind: "foodPreview", value: true }
    },
    fork_maneuver: {
      id: "fork_maneuver", name: "Розвилка: маневр", branch: "move", fork: true,
      desc: "Обери сильний талант або серце.",
      cost: 2, prereq: ["length_sense"],
      choices: {
        A: {
          id: "timely_maneuver", name: "Вчасний маневр",
          desc: "Раз на 28 с: один крок головою крізь власне тіло (не стіни/вороги). Активація — F.",
          effect: { kind: "phaseSelf", cd: 28 }
        },
        B: {
          id: "heart_move_1", name: "+1 серце",
          desc: "Одноразова спроба пережити смертельне зіткнення.",
          effect: { kind: "heart", value: 1 }
        }
      }
    },
    coil_control: {
      id: "coil_control", name: "Контроль кільця", branch: "move",
      desc: "Підказка flood-fill простору біля голови на HUD.",
      cost: 1, prereq: ["fork_maneuver"], effect: { kind: "spaceHud", value: true }
    },
    fork_shed: {
      id: "fork_shed", name: "Розвилка: линяння", branch: "move", fork: true,
      desc: "Линяння або серце.",
      cost: 2, prereq: ["coil_control"],
      choices: {
        A: {
          id: "shedding", name: "Линяння",
          desc: "G: зменшити довжину до max(3, length−5). CD 40 с. Ціна — реальна довжина.",
          effect: { kind: "shed", amount: 5, cd: 40, minLen: 3 }
        },
        B: {
          id: "heart_move_2", name: "+1 серце",
          desc: "Ще одна одноразова спроба.",
          effect: { kind: "heart", value: 1 }
        }
      }
    },
    // Sense branch
    wide_eye: {
      id: "wide_eye", name: "Широкий зір", branch: "sense",
      desc: "Камера трохи віддаляється; видно +2 клітинки краю.",
      cost: 1, prereq: ["root"], effect: { kind: "vision", add: 2 }
    },
    forage: {
      id: "forage", name: "Уважний збір", branch: "sense",
      desc: "Їжа дає +15% досвіду.",
      cost: 1, prereq: ["wide_eye"], effect: { kind: "xpMul", mul: 1.15 }
    },
    scout_mark: {
      id: "scout_mark", name: "Мітка переходу", branch: "sense",
      desc: "На карті видно вартість і тип сусідніх ділянок.",
      cost: 1, prereq: ["forage"], effect: { kind: "regionIntel", value: true }
    },
    fork_cargo: {
      id: "fork_cargo", name: "Розвилка: експедиція", branch: "sense", fork: true,
      cost: 2, prereq: ["scout_mark"],
      desc: "Місткість вантажу або серце.",
      choices: {
        A: {
          id: "long_expedition", name: "Довга експедиція",
          desc: "Місткість вантажу +6. Перша здача з нового регіону: +4 матеріали бонусом.",
          effect: { kind: "cargo", add: 6, firstDeliveryBonus: 4 }
        },
        B: {
          id: "heart_sense_1", name: "+1 серце",
          desc: "Одноразова спроба.",
          effect: { kind: "heart", value: 1 }
        }
      }
    },
    nest_bond: {
      id: "nest_bond", name: "Зв’язок із гніздом", branch: "sense",
      desc: "Після смерті втрачаєш на 25% менше незданого матеріалу.",
      cost: 1, prereq: ["fork_cargo"], effect: { kind: "deathLoss", mul: 0.75 }
    },
    fork_quiet: {
      id: "fork_quiet", name: "Розвилка: тиша", branch: "sense", fork: true,
      cost: 2, prereq: ["nest_bond"],
      desc: "Тиха стежка або серце.",
      choices: {
        A: {
          id: "quiet_path", name: "Тиха стежка",
          desc: "Стоячи: дальність виявлення ворогами −35%. Близький ворог усе одно бачить.",
          effect: { kind: "stealthStand", mul: 0.65 }
        },
        B: {
          id: "heart_sense_2", name: "+1 серце",
          desc: "Одноразова спроба.",
          effect: { kind: "heart", value: 1 }
        }
      }
    },
    // Tactics branch
    read_space: {
      id: "read_space", name: "Читання простору", branch: "tactics",
      desc: "На паузі видно силуети зайнятих клітинок чіткіше.",
      cost: 1, prereq: ["root"], effect: { kind: "pauseGrid", value: true }
    },
    bait_patience: {
      id: "bait_patience", name: "Терпіння", branch: "tactics",
      desc: "Стоячи біля їжі: ворог трохи рідше йде прямо на тебе (AI вага).",
      cost: 1, prereq: ["read_space"], effect: { kind: "standPressure", value: true }
    },
    body_wall: {
      id: "body_wall", name: "Стіна з тіла", branch: "tactics",
      desc: "Підказка: довжина ≥8 відкриває тактику перекриття проходів.",
      cost: 1, prereq: ["bait_patience"], effect: { kind: "bodyWallHint", value: true }
    },
    fork_cold: {
      id: "fork_cold", name: "Розвилка: холодна кров", branch: "tactics", fork: true,
      cost: 2, prereq: ["body_wall"],
      desc: "Сповільнення ворогів або серце.",
      choices: {
        A: {
          id: "cold_blood", name: "Холодна кров",
          desc: "C: на 2.2 с сповільнює змій у радіусі 5 клітинок. CD 32 с.",
          effect: { kind: "coldBlood", radius: 5, dur: 2.2, cd: 32, slowMul: 0.45 }
        },
        B: {
          id: "heart_tac_1", name: "+1 серце",
          desc: "Одноразова спроба.",
          effect: { kind: "heart", value: 1 }
        }
      }
    },
    foresight_prep: {
      id: "foresight_prep", name: "Уважність", branch: "tactics",
      desc: "Показує ім’я й архетип найближчого ворога.",
      cost: 1, prereq: ["fork_cold"], effect: { kind: "enemyLabel", value: true }
    },
    fork_foresight: {
      id: "fork_foresight", name: "Розвилка: передчуття", branch: "tactics", fork: true,
      cost: 2, prereq: ["foresight_prep"],
      desc: "Передчуття кроку ворога або серце.",
      choices: {
        A: {
          id: "foresight", name: "Передчуття",
          desc: "Показує наступний уже запланований крок видимого ворога й зону ризику 1 клітинка.",
          effect: { kind: "foresight", value: true }
        },
        B: {
          id: "heart_tac_2", name: "+1 серце",
          desc: "Одноразова спроба.",
          effect: { kind: "heart", value: 1 }
        }
      }
    },
    // Extra useful nodes
    soft_start: {
      id: "soft_start", name: "М’який старт", branch: "move",
      desc: "Після витрати серця: +0.4 с захисту стояння (не прохід крізь стіни).",
      cost: 1, prereq: ["fork_maneuver"], effect: { kind: "heartGrace", add: 0.4 }
    },
    material_eye: {
      id: "material_eye", name: "Око матеріалу", branch: "sense",
      desc: "Матеріал на карті підсвічується бурштином.",
      cost: 1, prereq: ["wide_eye"], effect: { kind: "materialGlow", value: true }
    },
    calm_nest: {
      id: "calm_nest", name: "Спокійне гніздо", branch: "sense",
      desc: "Біля гнізда (3 клітинки) перший ворог рідше атакує голову (AI вага).",
      cost: 1, prereq: ["forage"], effect: { kind: "nestSafety", value: true }
    },
    rival_memory: {
      id: "rival_memory", name: "Пам’ять суперника", branch: "tactics",
      desc: "Після смерті ворога +1 очко таланту (рідко, раз на змію).",
      cost: 1, prereq: ["read_space"], effect: { kind: "killXp", value: 1 }
    },
    grow_efficient: {
      id: "grow_efficient", name: "Щільний ріст", branch: "move",
      desc: "Кожна 4-та їжа не додає сегмент, лише досвід (контроль довжини).",
      cost: 2, prereq: ["coil_control"], effect: { kind: "skipGrowEvery", n: 4 }
    },
    open_ready: {
      id: "open_ready", name: "Готовність до межі", branch: "sense",
      desc: "Вартість першого розширення −2 матеріали.",
      cost: 1, prereq: ["scout_mark"], effect: { kind: "expandDiscount", value: 2 }
    }
  };

  FS.TALENT_LAYOUT = [
    { id: "root", x: 0, y: 0 },
    { id: "turn_buffer", x: -2, y: 1 },
    { id: "hold_pace", x: -2, y: 2 },
    { id: "length_sense", x: -2, y: 3 },
    { id: "fork_maneuver", x: -2, y: 4 },
    { id: "coil_control", x: -2, y: 5 },
    { id: "fork_shed", x: -2, y: 6 },
    { id: "soft_start", x: -3, y: 5 },
    { id: "grow_efficient", x: -1, y: 5 },
    { id: "wide_eye", x: 0, y: 1 },
    { id: "forage", x: 0, y: 2 },
    { id: "scout_mark", x: 0, y: 3 },
    { id: "fork_cargo", x: 0, y: 4 },
    { id: "nest_bond", x: 0, y: 5 },
    { id: "fork_quiet", x: 0, y: 6 },
    { id: "material_eye", x: 1, y: 2 },
    { id: "calm_nest", x: -1, y: 2 },
    { id: "open_ready", x: 1, y: 3 },
    { id: "read_space", x: 2, y: 1 },
    { id: "bait_patience", x: 2, y: 2 },
    { id: "body_wall", x: 2, y: 3 },
    { id: "fork_cold", x: 2, y: 4 },
    { id: "foresight_prep", x: 2, y: 5 },
    { id: "fork_foresight", x: 2, y: 6 },
    { id: "rival_memory", x: 3, y: 2 }
  ];

  FS.HELP = [
    "WASD / стрілки — крок. Відпусти — зупинишся. Вороги продовжують рухатися.",
    "Утримання — кроки за таймером гри (не ОС-повтор).",
    "Зіткнення голови зі стіною, тілом або іншою змією — смерть (або серце).",
    "Стоїш, а ворог врізається в твоє тіло (не голову) — гине ворог.",
    "Зіткнення голів — смертельне для обох.",
    "F — вчасний маневр (якщо взято) · G — линяння · C — холодна кров",
    "T — дерево · Tab — карта · Пробіл — пауза · Esc — меню",
    "Серце рятує один раз і не відновлюється."
  ];
})(window.FoxSerpent);
