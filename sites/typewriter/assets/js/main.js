// ========== THEME ==========
function setTheme(name, btn) {
  document.documentElement.className = name === 'default' ? '' : 'mode-' + name;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ========== TABS ==========
function switchTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'speed') {
    renderHeatmap();
    renderWeakChars();
    renderMistakeWords();
    renderLeaderboard();
    initDailyChallenge();
  }
}

// ========== TEXTS ==========
const texts = {
  // ===== UKRAINIAN =====
  easy: [
    'кіт сів на мат і спав',
    'сонце світить в небі яскраво',
    'я люблю читати книги вдома',
    'мама варить смачний борщ щодня',
    'пес біжить по зеленому полю',
    'вода тече по каменю тихо',
    'діти грають в парку весело',
  ],
  medium: [
    'Програмування — це мистецтво вирішення задач за допомогою коду та логіки.',
    'Швидкість друку залежить від практики та правильного положення пальців на клавіатурі.',
    'Сліпий метод дозволяє друкувати текст не дивлячись на клавіатуру взагалі.',
    'Регулярні тренування допоможуть досягти швидкості понад сто слів за хвилину.',
    'Клавіші F та J мають спеціальні горбики для орієнтації пальців у темряві.',
    'Щоденна практика по двадцять хвилин дає кращий результат ніж рідкісні довгі сесії.',
  ],
  hard: [
    'Алгоритм сортування злиттям має часову складність O(n log n) у найгіршому випадку.',
    'Функціональне програмування базується на незмінності даних та чистих функціях без побічних ефектів.',
    'Розподілені системи вирішують проблеми консистентності через теорему CAP та протоколи консенсусу.',
    'Рекурсивна функція обчислення факторіалу викликає себе доти, доки не досягне базового випадку.',
    'Мікросервісна архітектура дозволяє масштабувати кожен компонент системи незалежно від інших.',
  ],
  // ===== ENGLISH =====
  easy_en: [
    'the cat sat on the mat and slept',
    'sun is shining bright in the blue sky',
    'i love reading books at home every day',
    'she cooks a tasty soup each morning',
    'the dog runs fast across the green field',
    'water flows slowly over the smooth stone',
    'kids play happily in the park all day',
  ],
  medium_en: [
    'Touch typing is the ability to type without looking at the keyboard using muscle memory.',
    'Regular practice of twenty minutes daily yields better results than rare long sessions.',
    'The keys F and J have small bumps to help you find the home row without looking.',
    'Speed and accuracy in typing improve together when you focus on correct finger placement.',
    'Consistent training helps you reach over one hundred words per minute with enough practice.',
    'Blind typing allows you to keep your eyes on the screen rather than the keyboard.',
  ],
  hard_en: [
    'The quick brown fox jumps over the lazy dog — this sentence contains every letter of the alphabet!',
    'Efficiency in touch typing comes from muscle memory developed through consistent daily practice sessions.',
    'Professional typists achieve speeds exceeding 120 WPM while maintaining accuracy above 98 percent.',
    'Keyboard shortcuts dramatically increase productivity when combined with excellent touch typing skills.',
    'Distributed systems solve consistency problems through the CAP theorem and consensus protocols.',
  ],
  code: [
    'const greet = (name) => `Hello, ${name}!`;',
    'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
    'const arr = [1,2,3,4,5].filter(x => x % 2 === 0).map(x => x * x);',
    'import React, { useState, useEffect } from "react";',
    'SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 10;',
    'async function fetchUser(id) { const res = await fetch(`/api/users/${id}`); return res.json(); }',
  ],
  numbers: [
    '1234 5678 9012 3456 7890 1111 2222 3333 4444 5555',
    'Телефон: +38 (097) 123-45-67 Поштовий індекс: 01001',
    'Pi = 3.14159265358979 e = 2.71828182845904',
    '2024 + 365 = 2389 × 12 ÷ 4 = 717.0 — 100 = 617',
    'IP: 192.168.1.1 Port: 8080 Version: 3.14.2-beta',
  ],
  it: [
    'API endpoint returns JSON with status 200 when authentication token is valid.',
    'Docker containers isolate applications using Linux namespaces and cgroups.',
    'const fetchData = async (url) => { const res = await fetch(url); return res.json(); };',
    'Git branching strategy: feature branches merge into develop via pull requests.',
    'TypeScript interfaces enforce type contracts at compile time for safer code.',
  ],
  it_ua: [
    'Контейнер Docker ізолює застосунок за допомогою просторів імен та груп контролю ресурсів.',
    'Гілки Git дозволяють розробникам працювати паралельно без конфліктів у головній гілці.',
    'Функція асинхронного запиту повертає проміс який вирішується після отримання відповіді сервера.',
    'Мікросервіси спілкуються через HTTP REST або асинхронні черги повідомлень типу Kafka.',
    'Інтерфейси TypeScript забезпечують контракти типів під час компіляції для безпечнішого коду.',
  ],
  medicine: [
    'Hypertension is a chronic condition characterized by elevated arterial blood pressure.',
    'Myocardial infarction occurs when coronary artery blood flow is blocked for an extended time.',
    'Antibiotics target bacterial cell wall synthesis, DNA replication, or protein translation.',
    'The hypothalamus regulates body temperature, hunger, thirst, and circadian rhythms.',
    'Vaccination induces adaptive immunity without causing the disease itself.',
  ],
  medicine_ua: [
    'Гіпертонія — це хронічний стан, що характеризується підвищеним артеріальним тиском.',
    'Інфаркт міокарда виникає коли кровопостачання серцевого м\'яза блокується тромбом.',
    'Антибіотики впливають на синтез клітинної стінки бактерій або реплікацію ДНК.',
    'Гіпоталамус регулює температуру тіла, голод, спрагу та циркадні ритми.',
    'Вакцинація формує адаптивний імунітет без виникнення самого захворювання.',
  ],
  book: [
    'It was the best of times, it was the worst of times, it was the age of wisdom.',
    'Call me Ishmael. Some years ago — never mind how long precisely — I thought I would sail about.',
    'All happy families are alike; each unhappy family is unhappy in its own way.',
    'The sky above the port was the color of television, tuned to a dead channel.',
    'It is a truth universally acknowledged that a single man must be in want of a wife.',
  ],
  book_ua: [
    'Ми всі — лише тіні і пил. Але кожна тінь має своє світло, і кожен пил свою зорю.',
    'Мрія — це не те що бачиш уві сні. Мрія — це те що не дає тобі спати.',
    'Людина народжується вільною, але всюди вона в кайданах.',
    'Не бійся йти повільно — бійся стояти на місці.',
    'Той хто читає книги завжди буде керувати тим хто дивиться телевізор.',
  ],
};

// ========== LESSONS ==========
const lessons = [
  // ===== LEVEL 1 — Домашній ряд =====
  { id:'l1_home1', level:1, name:'Домашній ряд — ASDF', keys:'A S D F', xp:10,
    text:'aaa sss ddd fff asd fas dsa fad sad dad fads adds' },
  { id:'l1_home2', level:1, name:'Домашній ряд — JKL;', keys:'J K L ;', xp:10,
    text:'jjj kkk lll ;;; jkl lkj kjl jll kll lkk jkk ljk' },
  { id:'l1_home3', level:1, name:'Обидві руки — ASDF JKL', keys:'ASDF JKL', xp:15,
    text:'ask dad fall glad half lad jak lass flask ask flag' },
  { id:'l1_g_h', level:1, name:'Центр — G та H', keys:'G H', xp:10,
    text:'ggg hhh ghg hgh glad hash gash hag gal hall aha' },
  { id:'l1_space', level:1, name:'Пробіл', keys:'ПРОБІЛ', xp:10,
    text:'a s d f g h j k l a f j d k s l g h ask had' },

  // ===== LEVEL 2 — Верхній та нижній ряди =====
  { id:'l2_er', level:2, name:'E та R', keys:'E R', xp:15,
    text:'red deer free tree seer here her era reef reel reed' },
  { id:'l2_ui', level:2, name:'U та I', keys:'U I', xp:15,
    text:'ruin suit quit fill silk skill hill bill will until' },
  { id:'l2_top_left', level:2, name:'Верх ліва — QWERT', keys:'Q W E R T', xp:20,
    text:'were quiet wrote quote tower sweet tweet quest water' },
  { id:'l2_top_right', level:2, name:'Верх права — YUIOP', keys:'Y U I O P', xp:20,
    text:'your pout type your pity upon opium yoyo potion' },
  { id:'l2_bot_left', level:2, name:'Низ ліва — ZXCVB', keys:'Z X C V B', xp:20,
    text:'zinc vibe box cave back exact civic next verb vibez' },
  { id:'l2_bot_right', level:2, name:'Низ права — NM,.', keys:'N M , .', xp:20,
    text:'name moon noon numb mint man calm damn common norm' },
  { id:'l2_full_alpha', level:2, name:'Весь алфавіт', keys:'A-Z', xp:30,
    text:'the quick brown fox jumps over the lazy dog pack my box' },

  // ===== LEVEL 3 — Цифри, Shift, пунктуація =====
  { id:'l3_nums_left', level:3, name:'Цифри 1-5', keys:'1 2 3 4 5', xp:20,
    text:'11 22 33 44 55 12 34 15 24 35 123 45 1234 5432 12345' },
  { id:'l3_nums_right', level:3, name:'Цифри 6-0', keys:'6 7 8 9 0', xp:20,
    text:'66 77 88 99 00 67 89 70 96 78 6789 0987 6070 9900' },
  { id:'l3_shift_cap', level:3, name:'Shift — великі літери', keys:'⇧ Shift', xp:25,
    text:'Hello World Anna Bob Cat Dog Elephant Frank Green Harry' },
  { id:'l3_punct_basic', level:3, name:'Базова пунктуація', keys:'. , ! ?', xp:25,
    text:'Hello, world! How are you? Fine, thanks. Really? Yes!' },
  { id:'l3_punct_adv', level:3, name:'Пунктуація — ; : \'\"', keys:'; : \' "', xp:25,
    text:"it's a dog's life: eat, sleep, bark. \"quote\" said: wow!" },
  { id:'l3_mixed', level:3, name:'Мікс: слова + цифри', keys:'A-Z 0-9', xp:35,
    text:'page 1 of 10, score: 99, version 3.14, call 097-123' },

  // ===== LEVEL 4 — Швидкість та реальні тексти =====
  { id:'l4_speed1', level:4, name:'Швидкісний спринт EN', keys:'⚡ FAST', xp:50,
    text:'the fast cat sat on a mat and ate a fat rat at that' },
  { id:'l4_speed2', level:4, name:'Слова з пробілами', keys:'⚡ WORDS', xp:50,
    text:'skill speed type touch blind fast word flow zone peak' },
  { id:'l4_symbols', level:4, name:'Символи — @ # $ % &', keys:'@ # $ %', xp:40,
    text:'email@site.com #tag $100 50% a&b user@host.net #1' },
  { id:'l4_brackets', level:4, name:'Дужки — () [] {}', keys:'( ) [ ]', xp:40,
    text:'(hello) [world] {code} (1+2) [0] {a:1} func(x) arr[0]' },
  { id:'l4_code1', level:4, name:'Код — змінні', keys:'CODE', xp:60,
    text:'let x = 10; const y = 20; var z = x + y; console.log(z);' },
  { id:'l4_code2', level:4, name:'Код — функції', keys:'CODE', xp:60,
    text:'function add(a, b) { return a + b; } add(1, 2);' },
  { id:'l4_ua1', level:4, name:'🇺🇦 Українські слова', keys:'УКР', xp:40,
    text:'клавіатура рядок символ швидкість тренування слово друк' },
  { id:'l4_ua2', level:4, name:'🇺🇦 Укр речення', keys:'УКР', xp:50,
    text:'сліпий метод друку допоможе тобі стати швидшим за інших' },
];

// XP system
let totalXP = 0;
let playerLevel = 1;

const XP_RANKS = [
  { min:0,    label:'🥚 Новачок' },
  { min:50,   label:'🐣 Учень' },
  { min:150,  label:'🐥 Практикант' },
  { min:300,  label:'⌨️ Друкар' },
  { min:500,  label:'🔥 Майстер' },
  { min:800,  label:'⚡ Профі' },
  { min:1200, label:'💎 Експерт' },
  { min:2000, label:'🏆 Легенда' },
];

function xpForLevel(lvl) { return Math.floor(100 * Math.pow(1.5, lvl - 1)); }

function addXP(amount) {
  totalXP += amount;
  // Level up check
  while (true) {
    const needed = xpForLevel(playerLevel);
    if (totalXP >= needed) {
      totalXP -= needed;
      playerLevel++;
      showToast(`🎉 РІВЕНЬ ${playerLevel}! +${amount} XP`);
    } else break;
  }
  updateXPUI();
  document.getElementById('xp-stat').textContent = totalXP;
}

function updateXPUI() {
  const needed = xpForLevel(playerLevel);
  const pct = Math.min((totalXP / needed) * 100, 100);
  document.getElementById('xp-level').textContent = playerLevel;
  document.getElementById('xp-bar').style.width = pct + '%';
  document.getElementById('xp-label').textContent = totalXP + ' XP';
  document.getElementById('xp-next').textContent = needed + ' XP';
  document.getElementById('xp-total').textContent = lessons.filter(l=>completedLessons[l.id]).reduce((s,l)=>s+l.xp,0) + ' XP зароблено';
  document.getElementById('lessons-done').textContent = Object.keys(completedLessons).length;
  const rank = [...XP_RANKS].reverse().find(r => playerLevel >= 1 && totalXP >= 0) ||
    XP_RANKS[0];
  // Find rank by total earned XP
  const totalEarned = lessons.filter(l=>completedLessons[l.id]).reduce((s,l)=>s+l.xp,0);
  const curRank = [...XP_RANKS].reverse().find(r => totalEarned >= r.min) || XP_RANKS[0];
  document.getElementById('xp-rank').textContent = curRank.label;
}

let completedLessons = {};
let activeLessonMode = false;
let lessonText = '';
let lessonPos = 0;
let currentLesson = null;
let lessonFilter = 'all';

function filterLessons(level, btn) {
  lessonFilter = level;
  document.querySelectorAll('#level-tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  buildLessonGrid();
}

function buildLessonGrid() {
  const grid = document.getElementById('lesson-grid');
  grid.innerHTML = '';
  const filtered = lessonFilter === 'all' ? lessons : lessons.filter(l => l.level === lessonFilter);
  // Group by level
  const byLevel = {};
  filtered.forEach(l => { if (!byLevel[l.level]) byLevel[l.level] = []; byLevel[l.level].push(l); });
  const LEVEL_COLORS = { 1:'#00f5d4', 2:'#f5a623', 3:'#ff4d6d', 4:'#c77dff' };
  const LEVEL_LABELS = { 1:'🟢 Рівень 1 — Основи', 2:'🟡 Рівень 2 — Розширення', 3:'🔴 Рівень 3 — Пунктуація & Цифри', 4:'💀 Рівень 4 — Майстер' };
  Object.keys(byLevel).sort().forEach(lvl => {
    const color = LEVEL_COLORS[lvl] || 'var(--accent)';
    const title = document.createElement('div');
    title.style.cssText = `grid-column:1/-1;font-family:var(--font-display);font-size:0.65rem;letter-spacing:2px;color:${color};padding:8px 0 4px;border-bottom:1px solid ${color}33;margin-bottom:4px;`;
    title.textContent = LEVEL_LABELS[lvl] || `Рівень ${lvl}`;
    title.style.display = 'block';
    // We'll insert a wrapper div for the title + cards per level
    const section = document.createElement('div');
    section.style.cssText = 'grid-column:1/-1;';
    section.appendChild(title);
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:8px;margin-bottom:12px;';
    byLevel[lvl].forEach(l => {
      const done = completedLessons[l.id];
      const perfect = completedLessons[l.id + '_perfect'];
      const el = document.createElement('div');
      el.className = 'lesson-card' + (currentLesson && currentLesson.id === l.id ? ' active' : '');
      el.style.borderColor = done ? color : '';
      el.innerHTML = `
        <div class="lesson-keys" style="color:${color}">${l.keys}</div>
        <div class="lesson-name">${l.name}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
          <span style="font-size:0.65rem;color:var(--accent2);font-family:var(--font-display)">+${l.xp} XP</span>
          ${perfect ? `<span title="Ідеально!" style="font-size:0.85rem">⭐</span>` : done ? `<span style="font-size:0.7rem;color:${color}">✓</span>` : ''}
        </div>`;
      el.onclick = () => startLesson(l);
      row.appendChild(el);
    });
    section.appendChild(row);
    grid.appendChild(section);
  });
}

function focusLessonInput() {
  const inp = document.getElementById('lesson-hidden-input');
  if (inp) inp.focus();
}

function cancelLesson() {
  activeLessonMode = false;
  currentLesson = null;
  document.getElementById('lesson-active-area').style.display = 'none';
  buildLessonGrid();
}

function startLesson(lesson) {
  currentLesson = lesson;
  activeLessonMode = true;
  lessonText = lesson.text;
  lessonPos = 0;
  lessonErrors = 0;

  // Auto-switch keyboard language
  const detectedLang = detectLang(lessonText);
  if (detectedLang !== currentLang) {
    currentLang = detectedLang;
    rebuildKeyboards();
  }

  document.getElementById('lesson-active-area').style.display = 'block';
  document.getElementById('lesson-active-title').textContent = `${lesson.name} · Рівень ${lesson.level}`;
  document.getElementById('lesson-xp-reward').textContent = `+${lesson.xp} XP`;
  document.getElementById('lesson-progress').style.width = '0%';

  renderLessonText();
  buildLessonGrid();
  focusLessonInput();
}

function renderLessonText() {
  const display = document.getElementById('lesson-text-display');
  display.innerHTML = '';
  for (let i = 0; i < lessonText.length; i++) {
    const span = document.createElement('span');
    span.className = 'char ' + (i === lessonPos ? 'current' : i < lessonPos ? 'correct' : 'pending');
    span.textContent = lessonText[i];
    display.appendChild(span);
  }
}

let lessonErrors = 0; // track mistakes in current lesson attempt

// Lesson-specific input handler
const lessonInput = document.getElementById('lesson-hidden-input');
lessonInput.addEventListener('keydown', (e) => {
  if (!activeLessonMode || !currentLesson) return;
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) { e.preventDefault(); return; }
  e.preventDefault();

  const typed = e.key;
  const expected = lessonText[lessonPos];

  if (typed === expected) {
    lessonPos++;
    renderLessonText();
    highlightKey(typed);
    document.getElementById('lesson-progress').style.width = (lessonPos / lessonText.length * 100) + '%';

    if (lessonPos >= lessonText.length) {
      // Lesson complete!
      const alreadyDone = completedLessons[currentLesson.id];
      const perfect = lessonErrors === 0;
      const baseXP = currentLesson.xp;
      const bonusXP = perfect ? Math.round(baseXP * 0.5) : 0; // +50% bonus for perfect
      const earnedXP = alreadyDone ? 0 : baseXP + bonusXP;

      completedLessons[currentLesson.id] = true;
      if (perfect && !alreadyDone) completedLessons[currentLesson.id + '_perfect'] = true;
      if (!alreadyDone) addXP(earnedXP);
      buildLessonGrid();
      updateXPUI();
      document.getElementById('lessons-done').textContent = Object.keys(completedLessons).length;

      if (perfect) {
        // Special perfect toast with star animation
        showToast(`⭐ ІДЕАЛЬНО! +${earnedXP} XP (бонус +${bonusXP} за 0 помилок!)`);
        // Shoot stars
        shootStars();
      } else {
        showToast(`✅ Урок завершено! +${earnedXP} XP · ${lessonErrors} помилок`);
      }

      activeLessonMode = false;
      currentLesson = null;
      lessonErrors = 0;
      document.getElementById('lesson-active-area').style.display = 'none';
    }
  } else {
    lessonErrors++;
    // Update error hint in title
    document.getElementById('lesson-active-title').textContent =
      `${currentLesson.name} · Рівень ${currentLesson.level} · ❌ ${lessonErrors} помилок`;

    const panel = document.getElementById('lesson-typing-panel');
    panel.classList.remove('shake');
    void panel.offsetWidth;
    panel.classList.add('shake');
    setTimeout(() => panel.classList.remove('shake'), 400);

    const chars = document.querySelectorAll('#lesson-text-display .char');
    if (chars[lessonPos]) {
      chars[lessonPos].className = 'char wrong-wait';
      setTimeout(() => { if (chars[lessonPos]) chars[lessonPos].className = 'char current'; }, 300);
    }
    highlightKey(typed);
  }
  lessonInput.value = '';
});

function shootStars() {
  for (let i = 0; i < 18; i++) {
    setTimeout(() => {
      const star = document.createElement('div');
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight * 0.6;
      star.textContent = ['⭐','✨','💫','🌟'][Math.floor(Math.random()*4)];
      star.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:${1.2+Math.random()*1.5}rem;pointer-events:none;z-index:9999;animation:star-pop 1s ease forwards;`;
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 1000);
    }, i * 60);
  }
}


let strictMode = false;
let strictWaiting = false; // true = wrong key pressed, waiting for correct

function toggleStrict(btn) {
  strictMode = !strictMode;
  btn.classList.toggle('on', strictMode);
  // Reset waiting state when toggling
  strictWaiting = false;
  // Re-render current char if mid-session
  if (currentText && pos < currentText.length) {
    const chars = document.querySelectorAll('#text-display .char');
    if (chars[pos]) chars[pos].className = 'char current';
  }
  showToast(strictMode ? '🔒 Суворий режим ON — чекаю правильну клавішу!' : '🔓 Суворий режим OFF');
}


let currentText = '';
let pos = 0;
let errors = 0;
let totalTyped = 0;
let startTime = null;
let timerInterval = null;
let countdownInterval = null;
let wpmHistory = [];
let combo = 0;
let maxCombo = 0;
let sessionMaxWPM = 0;
let sessionMaxAcc = 0;
let running = false;

// ========== KEYBOARD LAYOUTS ==========
const KEYBOARD_EN = [
  ['`','1','2','3','4','5','6','7','8','9','0','-','=','⌫'],
  ['Tab','q','w','e','r','t','y','u','i','o','p','[',']','\\'],
  ['Caps','a','s','d','f','g','h','j','k','l',';',"'",'Enter'],
  ['Shift','z','x','c','v','b','n','m',',','.','/','Shift'],
  ['Ctrl','Alt','Space','Alt','Ctrl']
];

// Ukrainian QWERTY layout (standard Windows Ukrainian)
const KEYBOARD_UA = [
  ["'", '1','2','3','4','5','6','7','8','9','0','-','=','⌫'],
  ['Tab','й','ц','у','к','е','н','г','ш','щ','з','х','ї','\\'],
  ['Caps','ф','і','в','а','п','р','о','л','д','ж','є','Enter'],
  ['Shift','я','ч','с','м','и','т','ь','б','ю','.','Shift'],
  ['Ctrl','Alt','Space','Alt','Ctrl']
];

// Map UA char → EN key position (for highlighting)
const UA_TO_EN_KEY = {
  'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p','х':'[','ї':']',
  'ф':'a','і':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k','д':'l','ж':';','є':"'",
  'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m','б':',','ю':'.', '.':'/'
};

const KEY_WIDTHS = {
  '⌫': 'wide-4', 'Tab': 'wide-3', 'Caps': 'wide-3',
  'Enter': 'wide-4', 'Shift': 'wide-5', 'Ctrl': 'wide-3',
  'Alt': 'wide-2', 'Space': 'space',
};

const HOME_KEYS_EN = ['f', 'j'];
const HOME_KEYS_UA = ['а', 'о'];

let currentLang = 'en'; // 'en' | 'ua'

function detectLang(text) {
  const uaChars = (text.match(/[а-яіїєґА-ЯІЇЄҐёЁ]/g) || []).length;
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;
  return uaChars > enChars ? 'ua' : 'en';
}

function buildKeyboard(id, lang) {
  const rows = lang === 'ua' ? KEYBOARD_UA : KEYBOARD_EN;
  const homeKeys = lang === 'ua' ? HOME_KEYS_UA : HOME_KEYS_EN;
  const kb = document.getElementById(id);
  kb.innerHTML = '';
  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';
    row.forEach(k => {
      const keyEl = document.createElement('div');
      const w = KEY_WIDTHS[k] || '';
      const isHome = homeKeys.includes(k);
      keyEl.className = 'key ' + w + (isHome ? ' home-key' : '');
      keyEl.textContent = k;
      // id based on EN equivalent for UA keys so highlighting works
      const enEquiv = UA_TO_EN_KEY[k] || k;
      keyEl.dataset.key = k;
      keyEl.dataset.en = enEquiv;
      keyEl.id = 'kbd_' + id + '_' + encodeKid(k);
      rowEl.appendChild(keyEl);
    });
    kb.appendChild(rowEl);
  });
}

function encodeKid(k) {
  return k.toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, c => c.charCodeAt(0).toString(16));
}

function rebuildKeyboards() {
  buildKeyboard('keyboard', currentLang);
  buildKeyboard('keyboard2', currentLang);
  const badge = document.getElementById('lang-badge');
  if (badge) badge.textContent = currentLang === 'ua' ? '🇺🇦 УКР' : '🇬🇧 EN';
}

rebuildKeyboards();
buildLessonGrid();

// ========== KEY HIGHLIGHTING (повна версія з Shift) ==========

// Символи що вимагають Shift (EN)
const SHIFT_CHARS_EN = new Set('!@#$%^&*()_+{}|:"<>?~ABCDEFGHIJKLMNOPQRSTUVWXYZ');
// Символи що вимагають Shift (UA — великі літери)
const SHIFT_CHARS_UA = new Set('ЙЦУКЕНГШЩЗХЇФІВАПТРСЛДЖЄЯЧСМИТЬБЮ');

function needsShift(ch) {
  return SHIFT_CHARS_EN.has(ch) || SHIFT_CHARS_UA.has(ch);
}

// Повна таблиця: символ → base клавіша
const CHAR_TO_KEY = {
  ' ':'Space','\n':'Enter',
  '!':'1','@':'2','#':'3','$':'4','%':'5',
  '^':'6','&':'7','*':'8','(':'9',')':'0',
  '_':'-','+':'=','{':'[','}':']','|':'\\',
  ':':';','"':"'",'<':',','>':'.','?':'/',
  '~':'`',
  // em-dash & en-dash
  '—':'-', '–':'-',
  // UA shifted → base key
  'Й':'й','Ц':'ц','У':'у','К':'к','Е':'е','Н':'н','Г':'г','Ш':'ш','Щ':'щ','З':'з','Х':'х','Ї':'ї',
  'Ф':'ф','І':'і','В':'в','А':'а','П':'п','Р':'р','О':'о','Л':'л','Д':'д','Ж':'ж','Є':'є',
  'Я':'я','Ч':'ч','С':'с','М':'м','И':'и','Т':'т','Ь':'ь','Б':'б','Ю':'ю',
};

// Chars that need special combos: ch → { keys, isAlt }
const SPECIAL_COMBOS = {
  '—': { keys:['Alt','-'], label:'Alt + -' },
  '–': { keys:['Alt','Shift','-'], label:'Alt+Shift+-' },
};

function highlightKey(ch, isHint = false) {
  if (isHint) {
    // HINT MODE: clear previous hints, set new persistent hint classes
    document.querySelectorAll('.key.next-hint').forEach(k => k.classList.remove('next-hint'));
    document.querySelectorAll('.key.shift-hint').forEach(k => k.classList.remove('shift-hint'));
  } else {
    // ACTIVE MODE: only clear previous active, never touch next-hint/shift-hint
    document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
  }

  const cls      = isHint ? 'next-hint' : 'active';
  const shiftCls = isHint ? 'shift-hint' : 'active';

  const special = SPECIAL_COMBOS[ch];
  const base    = CHAR_TO_KEY[ch] || ch;
  const lookup  = base.toLowerCase();
  const shiftNeeded = !special && needsShift(ch);
  const altNeeded   = !!special;

  ['keyboard','keyboard2'].forEach(kbId => {
    const kb = document.getElementById(kbId);
    if (!kb) return;
    kb.querySelectorAll('.key').forEach(k => {
      const kkey = (k.dataset.key || '').toLowerCase();
      const ken  = (k.dataset.en  || '').toLowerCase();
      const txt  = k.textContent.trim();
      const txtL = txt.toLowerCase();

      // Base key match
      if (kkey === lookup || ken === lookup || txtL === lookup) {
        k.classList.add(cls);
        if (!isHint) setTimeout(() => k.classList.remove(cls), 180);
      }
      // Shift
      if (shiftNeeded && txt === 'Shift') {
        k.classList.add(shiftCls);
        if (!isHint) setTimeout(() => k.classList.remove(shiftCls), 180);
      }
      // Alt for em-dash etc
      if (altNeeded && txt === 'Alt') {
        k.classList.add(cls);
        if (!isHint) setTimeout(() => k.classList.remove(cls), 180);
      }
    });
  });
}

// ========== HINT BANNER (показує combo над клавіатурою) ==========
function getKeyCombo(ch) {
  if (!ch) return null;
  if (ch === ' ') return { keys: ['Space'], label: 'Пробіл' };
  if (ch === '\n') return { keys: ['Enter'], label: 'Enter' };

  // Special combos (em-dash тощо)
  if (SPECIAL_COMBOS[ch]) return SPECIAL_COMBOS[ch];

  const base  = CHAR_TO_KEY[ch] || ch;
  const shift = needsShift(ch);
  const display = base.length === 1 ? base.toUpperCase() : base;
  if (shift) return { keys: ['Shift', display], label: `Shift + ${display}` };
  return { keys: [display], label: display };
}

function updateHintBanner() {
  const banner = document.getElementById('key-hint-banner');
  if (!banner) return;
  if (!nextKeyHint || !currentText || pos >= currentText.length) {
    banner.style.display = 'none';
    return;
  }
  const ch = currentText[pos];
  const combo = getKeyCombo(ch);
  if (!combo) { banner.style.display = 'none'; return; }

  const keySpans = combo.keys.map((k, i) =>
    `<kbd style="
      display:inline-flex;align-items:center;justify-content:center;
      min-width:38px;height:30px;padding:0 12px;
      background:var(--surface2);
      border:1px solid ${i === 0 && combo.keys.length > 1 ? 'var(--accent2)' : 'var(--accent)'};
      border-radius:5px;font-family:var(--font-display);font-size:0.72rem;
      color:${i === 0 && combo.keys.length > 1 ? 'var(--accent2)' : 'var(--accent)'};
      box-shadow:0 0 10px ${i === 0 && combo.keys.length > 1 ? 'var(--accent2)' : 'var(--accent)'}55;
      letter-spacing:1px;white-space:nowrap;
    ">${k}</kbd>`
  ).join(`<span style="color:var(--muted);font-size:0.9rem;margin:0 5px;font-weight:bold">+</span>`);

  banner.innerHTML =
    `<span style="font-size:0.6rem;color:var(--muted);font-family:var(--font-display);letter-spacing:2px;margin-right:8px">💡 НАТИСНИ:</span>` +
    keySpans +
    `<span style="font-size:0.7rem;color:var(--muted);margin-left:10px;font-family:var(--font-body)">= «${ch === ' ' ? '␣' : ch}»</span>`;
  banner.style.display = 'flex';
  banner.style.alignItems = 'center';
}

// ========== ФІЗИЧНЕ НАТИСКАННЯ — завжди підсвічується ==========
document.addEventListener('keydown', (e) => {
  // Map physical key to display character for keyboard highlight
  const phys = e.key;
  // Skip modifiers themselves (they are highlighted via Shift logic above)
  if (['Shift','Control','Alt','Meta','CapsLock','Dead'].includes(phys)) {
    // Highlight Shift key visually when pressed
    if (phys === 'Shift') {
      document.querySelectorAll('.key').forEach(k => {
        if (k.textContent.trim() === 'Shift') {
          k.classList.add('active');
          // Will be removed by keyup
        }
      });
    }
    return;
  }
  // Highlight the actual key pressed (independent of practice mode)
  const lookup = (CHAR_TO_KEY[phys] || phys).toLowerCase();
  ['keyboard','keyboard2'].forEach(kbId => {
    const kb = document.getElementById(kbId);
    if (!kb) return;
    kb.querySelectorAll('.key').forEach(k => {
      const kkey = (k.dataset.key || '').toLowerCase();
      const ken  = (k.dataset.en  || '').toLowerCase();
      if (kkey === lookup || ken === lookup) {
        k.classList.add('active');
        setTimeout(() => k.classList.remove('active'), 160);
      }
    });
  });
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    document.querySelectorAll('.key').forEach(k => {
      if (k.textContent.trim() === 'Shift') k.classList.remove('active');
    });
  }
});

// Patch processChar to update hint banner after each keypress
const _hintBannerOrig = processChar;
processChar = function(typed) {
  _hintBannerOrig(typed);
  if (nextKeyHint) {
    showNextKeyHint();
    updateHintBanner();
  }
};

// Patch renderText to also update hint banner
const _renderTextHint = renderText;
renderText = function() {
  _renderTextHint();
  if (nextKeyHint) {
    showNextKeyHint();
    updateHintBanner();
  } else {
    const banner = document.getElementById('key-hint-banner');
    if (banner) banner.style.display = 'none';
  }
};

// ========== PRACTICE LANGUAGE (separate from UI language) ==========
// currentUI = interface language (ua/en)
// practiceLang = language of typing texts + keyboard (ua/en), follows currentUI by default

let practiceLang = localStorage.getItem('tm_practice_lang') || 'ua';

function getPracticePool(diff) {
  // For bilingual categories, pick the right variant
  const langSuffix = practiceLang === 'en' ? '_en' : '';
  const candidates = [diff + langSuffix, diff];
  for (const key of candidates) {
    if (texts[key] && texts[key].length) return texts[key];
  }
  return texts.medium;
}

// ========== TEXT GENERATION ==========
function newText() {
  const diff = document.getElementById('difficulty').value;
  if (diff === 'custom') { openCustomModal(); return; }
  if (diff === 'mistakes') {
    if (!mistakeWords || !mistakeWords.length) { showToast('🏋️ Немає помилкових слів ще!'); return; }
    currentText = [...mistakeWords].sort(() => Math.random()-0.5).slice(0,20).join(' ');
  } else {
    const pool = getPracticePool(diff);
    currentText = pool[Math.floor(Math.random() * pool.length)];
  }
  // Force keyboard to match practiceLang
  const needed = practiceLang;
  if (needed !== currentLang) {
    currentLang = needed;
    rebuildKeyboards();
  }
  resetSession(false);
  renderText();
  focusInput();
}

function renderText() {
  const display = document.getElementById('text-display');
  display.innerHTML = '';
  for (let i = 0; i < currentText.length; i++) {
    const span = document.createElement('span');
    span.className = 'char ' + (i === 0 ? 'current' : 'pending');
    span.textContent = currentText[i];
    display.appendChild(span);
  }
  updateProgress();
}

function resetSession(regenerate = true) {
  pos = 0; errors = 0; totalTyped = 0; combo = 0;
  strictWaiting = false;
  running = false;
  clearInterval(timerInterval);
  clearInterval(countdownInterval);
  startTime = null;
  wpmHistory = [];
  document.getElementById('wpm').textContent = '0';
  document.getElementById('accuracy').textContent = '100%';
  document.getElementById('timer').textContent = '—';
  document.getElementById('combo-stat').textContent = 'x1';
  document.getElementById('combo-anim').textContent = '';
  document.getElementById('progress').style.width = '0%';
  renderWpmChart();
  if (regenerate) { newText(); }
}

function focusInput() {
  document.getElementById('hidden-input').focus();
}

function updateProgress() {
  const pct = currentText.length ? (pos / currentText.length * 100) : 0;
  document.getElementById('progress').style.width = pct + '%';
}

function calcWPM() {
  if (!startTime) return 0;
  const mins = (Date.now() - startTime) / 60000;
  return mins > 0 ? Math.round((pos / 5) / mins) : 0;
}

function calcAccuracy() {
  if (!totalTyped) return 100;
  return Math.max(0, Math.round(((totalTyped - errors) / totalTyped) * 100));
}

function renderWpmChart() {
  const chart = document.getElementById('wpm-chart');
  chart.innerHTML = '';
  if (!wpmHistory.length) return;
  const max = Math.max(...wpmHistory, 1);
  wpmHistory.forEach(v => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = (v / max * 76) + 'px';
    chart.appendChild(bar);
  });
}

function showCombo(n) {
  const el = document.getElementById('combo-anim');
  if (n >= 5) {
    el.textContent = n >= 20 ? `🔥 x${n} FIRE!` : n >= 10 ? `⚡ x${n} COMBO!` : `✦ x${n}`;
    el.style.color = n >= 20 ? 'var(--accent3)' : n >= 10 ? 'var(--accent2)' : 'var(--accent)';
  } else {
    el.textContent = '';
  }
  document.getElementById('combo-stat').textContent = 'x' + n;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  }, 2500);
}

// ========== TIMER ==========
function startCountdown() {
  const limit = parseInt(document.getElementById('timelimit').value);
  if (!limit) return;
  let remaining = limit;
  document.getElementById('timer').textContent = remaining + 's';
  countdownInterval = setInterval(() => {
    remaining--;
    document.getElementById('timer').textContent = remaining + 's';
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      finishSession();
    }
  }, 1000);
}

function finishSession() {
  running = false;
  clearInterval(timerInterval);
  clearInterval(countdownInterval);
  const wpm = calcWPM();
  const acc = calcAccuracy();
  const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

  if (wpm > sessionMaxWPM) { sessionMaxWPM = wpm; document.getElementById('record-wpm').textContent = wpm; }
  if (acc > sessionMaxAcc) { sessionMaxAcc = acc; document.getElementById('record-acc').textContent = acc + '%'; }
  if (maxCombo > parseInt(document.getElementById('record-combo').textContent || '0')) {
    document.getElementById('record-combo').textContent = maxCombo;
  }

  document.getElementById('res-wpm').textContent = wpm;
  document.getElementById('res-acc').textContent = acc + '%';
  document.getElementById('res-time').textContent = elapsed + 's';
  document.getElementById('res-combo').textContent = maxCombo;

  // XP for practice: based on WPM + accuracy
  const practiceXP = Math.max(5, Math.floor(wpm * (acc / 100) * 0.5));
  document.getElementById('res-xp').textContent = '+' + practiceXP;
  addXP(practiceXP);
  document.getElementById('result-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('result-modal').style.display = 'none';
}

// ========== INPUT HANDLING ==========
const input = document.getElementById('hidden-input');

function processChar(typed) {
  // Lesson mode now handled by separate lessonInput handler
  if (!currentText || pos >= currentText.length) return;

  // Start timer on first keypress
  if (!running && !startTime) {
    startTime = Date.now();
    running = true;
    timerInterval = setInterval(() => {
      const wpm = calcWPM();
      document.getElementById('wpm').textContent = wpm;
      wpmHistory.push(wpm);
      if (wpmHistory.length > 30) wpmHistory.shift();
      renderWpmChart();
    }, 1000);
    startCountdown();
  }

  const expected = currentText[pos];
  const correct = typed === expected;

  // ---- PERFECT MODE — rollback to word start on error ----
  if (repeatMode && !correct) {
    totalTyped++;
    errors++;
    combo = 0; showCombo(0);
    // Find start of current word (go back to last space or pos 0)
    let wordStart = pos;
    while (wordStart > 0 && currentText[wordStart - 1] !== ' ') wordStart--;
    // Rollback chars visual state
    const chars = document.querySelectorAll('#text-display .char');
    for (let i = wordStart; i <= pos; i++) {
      if (chars[i]) chars[i].className = 'char' + (i === wordStart ? ' current' : ' pending');
    }
    pos = wordStart;
    // Shake + flash
    const panel = document.getElementById('typing-panel');
    panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
    setTimeout(() => panel.classList.remove('shake'), 400);
    document.getElementById('accuracy').textContent = calcAccuracy() + '%';
    updateProgress();
    highlightKey(typed);
    showToast('🔁 Помилка! Повертаємось до початку слова');
    return;
  }

  // ---- STRICT MODE ----
  if (strictMode) {
    totalTyped++;
    if (!correct) {
      errors++;
      combo = 0;
      showCombo(0);
      strictWaiting = true;
      const chars = document.querySelectorAll('#text-display .char');
      chars[pos].className = 'char wrong-wait';
      const panel = document.getElementById('typing-panel');
      panel.classList.remove('shake');
      void panel.offsetWidth;
      panel.classList.add('shake');
      setTimeout(() => panel.classList.remove('shake'), 400);
      highlightKey(typed);
      document.getElementById('accuracy').textContent = calcAccuracy() + '%';
    } else {
      strictWaiting = false;
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      showCombo(combo);
      if (combo === 10) showToast('⚡ 10 комбо! Чудово!');
      if (combo === 25) showToast('🔥 25 комбо! Феноменально!');
      if (combo === 50) showToast('💥 50 комбо! ЛЕГЕНДА!');
      const chars = document.querySelectorAll('#text-display .char');
      chars[pos].className = 'char correct';
      pos++;
      if (pos < currentText.length) chars[pos].className = 'char current';
      highlightKey(typed);
      document.getElementById('accuracy').textContent = calcAccuracy() + '%';
      updateProgress();
      if (pos >= currentText.length) finishSession();
    }
    return;
  }

  // ---- NORMAL MODE ----
  totalTyped++;
  if (!correct) { errors++; combo = 0; showCombo(0); }
  else {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    showCombo(combo);
    if (combo === 10) showToast('⚡ 10 комбо! Чудово!');
    if (combo === 25) showToast('🔥 25 комбо! Феноменально!');
    if (combo === 50) showToast('💥 50 комбо! ЛЕГЕНДА!');
  }

  const chars = document.querySelectorAll('#text-display .char');
  chars[pos].className = 'char ' + (correct ? 'correct' : 'wrong');
  pos++;
  if (pos < currentText.length) chars[pos].className = 'char current';
  highlightKey(typed);
  document.getElementById('accuracy').textContent = calcAccuracy() + '%';
  updateProgress();
  if (pos >= currentText.length) finishSession();
}

// Use keydown for reliable single-char detection (works for all layouts including UA)
input.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' || e.key === 'Tab' ||
      e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' ||
      e.key === 'CapsLock' || e.key === 'Meta' || e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
      e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4' ||
      e.key === 'Escape' || e.key === 'Dead') {
    e.preventDefault();
    return;
  }
  // Allow single printable chars even with Alt (e.g. em-dash via Alt+-)
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    processChar(e.key);
    input.value = '';
  }
});

// ========== BOMB MODE ==========
let bombMode = false;
let bombInterval = null;
const BOMB_TIME = 3.0; // seconds per char before exploding
let bombRemaining = BOMB_TIME;

function toggleBomb(btn) {
  bombMode = !bombMode;
  btn.classList.toggle('on', bombMode);
  if (bombMode) btn.style.setProperty('border-color','#ff6b35');
  else btn.style.removeProperty('border-color');
  document.getElementById('bomb-bar-wrap').style.display = bombMode ? 'block' : 'none';
  showToast(bombMode ? '💣 Режим БОМБА! Не зупиняйся!' : '💣 Бомба вимкнена');
  if (!bombMode) { clearInterval(bombInterval); bombInterval = null; }
}

function startBombTimer() {
  clearInterval(bombInterval);
  bombRemaining = BOMB_TIME;
  updateBombBar();
  bombInterval = setInterval(() => {
    bombRemaining -= 0.1;
    updateBombBar();
    if (bombRemaining <= 0) {
      clearInterval(bombInterval);
      bombRemaining = 0;
      updateBombBar();
      // BOOM!
      const panel = document.getElementById('typing-panel');
      panel.classList.remove('boom','shake');
      void panel.offsetWidth;
      panel.classList.add('boom','shake');
      showToast('💥 БОМБА ВИБУХНУЛА! Занадто повільно!');
      setTimeout(() => finishSession(), 500);
    }
  }, 100);
}

function resetBombTimer() {
  if (!bombMode || !running) return;
  bombRemaining = BOMB_TIME;
  updateBombBar();
}

function updateBombBar() {
  const pct = (bombRemaining / BOMB_TIME) * 100;
  const bar = document.getElementById('bomb-bar');
  const txt = document.getElementById('bomb-timer-txt');
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = pct > 50 ? 'linear-gradient(90deg,#ff6b35,#ff4d6d)' :
                            pct > 25 ? 'linear-gradient(90deg,#ff4d6d,#ff0044)' : '#ff0044';
  }
  if (txt) txt.textContent = Math.max(0, bombRemaining).toFixed(1) + 's';
}

// ========== GHOST MODE ==========
let ghostMode = false;
let ghostRecord = null; // {wpmHistory: [], timestamps: []}
let ghostPos = 0;
let ghostInterval = null;

function toggleGhost(btn) {
  ghostMode = !ghostMode;
  btn.classList.toggle('on', ghostMode);
  if (ghostMode) btn.style.setProperty('border-color','#a78bfa');
  else btn.style.removeProperty('border-color');
  document.getElementById('ghost-info').style.display = ghostMode ? 'block' : 'none';
  if (!ghostRecord) {
    document.getElementById('ghost-wpm-display').textContent = 'Немає запису — спочатку зіграй!';
  }
  showToast(ghostMode ? '👻 Ghost режим ON! Змагайся з собою!' : '👻 Ghost режим OFF');
}

function startGhost() {
  if (!ghostMode || !ghostRecord) return;
  ghostPos = 0;
  clearInterval(ghostInterval);
  const chars = document.querySelectorAll('#text-display .char');
  ghostInterval = setInterval(() => {
    // Move ghost based on recorded timestamps
    if (!ghostRecord || ghostPos >= ghostRecord.timestamps.length) {
      clearInterval(ghostInterval); return;
    }
    const elapsed = Date.now() - startTime;
    while (ghostPos < ghostRecord.timestamps.length && ghostRecord.timestamps[ghostPos] <= elapsed) {
      ghostPos++;
    }
    // Draw ghost position
    document.querySelectorAll('#text-display .char.ghost-pos').forEach(c => c.classList.remove('ghost-pos'));
    const gp = Math.min(ghostPos, chars.length - 1);
    if (chars[gp]) chars[gp].classList.add('ghost-pos');
    // Show ahead/behind
    const diff = pos - ghostPos;
    document.getElementById('ghost-ahead').textContent =
      diff > 0 ? `+${diff} символів ПОПЕРЕДУ ✅` :
      diff < 0 ? `${diff} символів ПОЗАДУ ⚠️` : 'Рівно! 👻';
    document.getElementById('ghost-wpm-display').textContent = (ghostRecord.peakWPM || 0) + ' WPM';
  }, 100);
}

function saveGhostRecord(wpm, timestamps) {
  ghostRecord = { peakWPM: wpm, timestamps };
}

// ========== DAILY STREAK ==========
let streak = 0;
let maxStreak = 0;

function initStreak() {
  const today = new Date().toDateString();
  const saved = JSON.parse(localStorage.getItem('tm_streak') || '{}');
  const last = saved.lastDate || '';
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (last === today) {
    streak = saved.streak || 1;
    maxStreak = saved.maxStreak || streak;
  } else if (last === yesterday) {
    streak = (saved.streak || 0) + 1;
    maxStreak = Math.max(streak, saved.maxStreak || 0);
    saveStreak(today);
    if (streak > 1) showToast(`🔥 Стрік ${streak} днів! Так тримати!`);
  } else if (!last) {
    streak = 1; maxStreak = 1;
    saveStreak(today);
    showToast('🌱 Перший день! Починаємо стрік!');
  } else {
    // Streak broken
    streak = 1; maxStreak = saved.maxStreak || 1;
    saveStreak(today);
    showToast('💔 Стрік перервано. Починаємо знову!');
  }
  updateStreakUI(saved.lastDate || today);
}

function saveStreak(today) {
  localStorage.setItem('tm_streak', JSON.stringify({ streak, maxStreak, lastDate: today }));
}

function updateStreakUI(lastDate) {
  document.getElementById('streak-stat').textContent = '🔥' + streak;
  document.getElementById('streak-big').textContent = streak;
  document.getElementById('max-streak-display').textContent = maxStreak + ' днів';
  document.getElementById('last-visit-display').textContent = lastDate || '—';
  const msgs = ['Розпочни сьогодні! 💪', 'Чудовий початок! 🌱', 'Так тримати! 💪', 'Вже 3 дні! 🔥', 'Тижень поспіль! 🚀', 'Монстр друку! 👹'];
  document.getElementById('streak-msg').textContent = msgs[Math.min(streak, msgs.length-1)] || `${streak} днів поспіль! 🏆`;
  document.getElementById('streak-emoji').textContent = streak >= 7 ? '🏆' : streak >= 3 ? '🔥' : '✨';
}

// ========== SESSION HISTORY & PROGRESS CHART ==========
let sessionHistory = JSON.parse(localStorage.getItem('tm_sessions') || '[]');

function saveSession(wpm, acc) {
  const entry = { wpm, acc, date: new Date().toLocaleDateString('uk') };
  sessionHistory.push(entry);
  if (sessionHistory.length > 30) sessionHistory = sessionHistory.slice(-30);
  localStorage.setItem('tm_sessions', JSON.stringify(sessionHistory));
  renderSessionChart();
}

function renderSessionChart() {
  const chart = document.getElementById('session-chart');
  if (!chart) return;
  if (!sessionHistory.length) return;
  chart.innerHTML = '';
  const maxWPM = Math.max(...sessionHistory.map(s => s.wpm), 1);
  sessionHistory.forEach((s, i) => {
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:default';
    const bar = document.createElement('div');
    const h = Math.max(4, (s.wpm / maxWPM) * 90);
    const isLast = i === sessionHistory.length - 1;
    bar.style.cssText = `width:100%;height:${h}px;background:${isLast ? 'var(--accent)' : 'var(--accent)44'};border-radius:2px 2px 0 0;transition:height 0.3s;`;
    bar.title = `${s.date}: ${s.wpm} WPM, ${s.acc}%`;
    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.55rem;color:var(--muted);writing-mode:vertical-lr;transform:rotate(180deg);max-height:30px;overflow:hidden;';
    label.textContent = s.wpm;
    col.appendChild(bar);
    col.appendChild(label);
    chart.appendChild(col);
  });
}

// ========== HEATMAP ==========
const keyErrors = {}; // key -> error count

// Load persisted key errors
const _savedKeyErrors = JSON.parse(localStorage.getItem('tm_key_errors') || '{}');
Object.assign(keyErrors, _savedKeyErrors);

function recordKeyError(ch) {
  // Normalize: map UA capital to lower, use the EXPECTED char (not what was typed)
  const expected = (currentText && pos < currentText.length) ? currentText[pos] : ch;
  const k = expected.toLowerCase();
  keyErrors[k] = (keyErrors[k] || 0) + 1;
  // Persist every 5 errors to avoid too many writes
  const total = Object.values(keyErrors).reduce((a,b) => a+b, 0);
  if (total % 5 === 0) localStorage.setItem('tm_key_errors', JSON.stringify(keyErrors));
}

function renderHeatmap() {
  const container = document.getElementById('heatmap-keyboard');
  if (!container) return;

  const KB_EN = [
    ['`','1','2','3','4','5','6','7','8','9','0','-','='],
    ['q','w','e','r','t','y','u','i','o','p','[',']'],
    ['a','s','d','f','g','h','j','k','l',';',"'"],
    ['z','x','c','v','b','n','m',',','.','/'],
  ];
  const KB_UA = [
    ["'",'1','2','3','4','5','6','7','8','9','0','-','='],
    ['й','ц','у','к','е','н','г','ш','щ','з','х','ї'],
    ['ф','і','в','а','п','р','о','л','д','ж','є'],
    ['я','ч','с','м','и','т','ь','б','ю','.'],
  ];
  const KB = practiceLang === 'ua' ? KB_UA : KB_EN;

  container.innerHTML = '';
  const allErrors = Object.values(keyErrors);
  const maxErr = allErrors.length ? Math.max(...allErrors, 1) : 1;

  KB.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.style.cssText = 'display:flex;gap:3px;margin-bottom:3px;justify-content:center;flex-wrap:wrap;';
    row.forEach(k => {
      const el = document.createElement('div');
      const errs = keyErrors[k] || keyErrors[k.toUpperCase()] || 0;
      const intensity = errs / maxErr;
      // Heat color: cool (surface) → hot (accent/red)
      const r = Math.round(40 + 215 * intensity);
      const g = Math.round(40 * (1 - intensity));
      const b = Math.round(80 * (1 - intensity));
      const bg = errs === 0
        ? 'var(--surface2)'
        : `rgba(${r},${g},${b},${0.35 + intensity * 0.65})`;
      const border = errs === 0 ? 'var(--surface2)' : `rgba(${r},${g},${b},0.8)`;
      const textColor = errs === 0 ? 'var(--muted)' : (intensity > 0.5 ? '#fff' : 'var(--text)');
      el.style.cssText = `min-width:28px;height:26px;padding:0 4px;background:${bg};border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.6rem;color:${textColor};border:1px solid ${border};flex-shrink:0;cursor:default;position:relative;`;
      el.title = `${k.toUpperCase()}: ${errs} помилок`;
      el.textContent = k.toUpperCase();
      // Show count badge if errors
      if (errs > 0) {
        const badge = document.createElement('span');
        badge.style.cssText = 'position:absolute;top:-5px;right:-4px;background:#ff1744;color:#fff;font-size:0.45rem;padding:1px 3px;border-radius:3px;font-family:var(--font-display);line-height:1.2;';
        badge.textContent = errs;
        el.appendChild(badge);
      }
      rowEl.appendChild(el);
    });
    container.appendChild(rowEl);
  });

  // Show total error count
  const total = allErrors.reduce((a, b) => a + b, 0);
  const info = document.getElementById('heatmap-info');
  if (info) info.textContent = total ? `Всього помилок: ${total}` : 'Ще немає даних';
}

// ========== ACHIEVEMENTS ==========
const ACHIEVEMENTS = [
  { id:'first_key',   icon:'🎹', name:'ПЕРШИЙ КРОК',     desc:'Надрукуй перший символ',              check: ()=> totalTyped >= 1 },
  { id:'wpm30',       icon:'🐢', name:'30 WPM',          desc:'Досягни 30 слів/хв',                  check: ()=> sessionMaxWPM >= 30 },
  { id:'wpm60',       icon:'🚴', name:'60 WPM',          desc:'Досягни 60 слів/хв',                  check: ()=> sessionMaxWPM >= 60 },
  { id:'wpm100',      icon:'🚀', name:'100 WPM',         desc:'Досягни 100 слів/хв!',                check: ()=> sessionMaxWPM >= 100 },
  { id:'acc100',      icon:'🎯', name:'СНАЙПЕР',         desc:'Завершити сесію з 100% точністю',      check: ()=> calcAccuracy() === 100 && pos >= currentText.length },
  { id:'combo25',     icon:'⚡', name:'КОМБО x25',       desc:'Набери 25 символів без помилок',      check: ()=> maxCombo >= 25 },
  { id:'combo50',     icon:'🔥', name:'КОМБО x50',       desc:'Набери 50 символів без помилок!',     check: ()=> maxCombo >= 50 },
  { id:'lesson5',     icon:'📚', name:"5 УРОКІВ",        desc:'Пройди 5 уроків',                     check: ()=> Object.keys(completedLessons).filter(k=>!k.includes('_perfect')).length >= 5 },
  { id:'lesson_all',  icon:'🎓', name:'ВИПУСКНИК',       desc:'Пройди всі 26 уроків',                check: ()=> Object.keys(completedLessons).filter(k=>!k.includes('_perfect')).length >= 26 },
  { id:'perfect3',    icon:'⭐', name:'ПЕРФЕКЦІОНІСТ',   desc:'Пройди 3 уроки без помилок',          check: ()=> Object.keys(completedLessons).filter(k=>k.includes('_perfect')).length >= 3 },
  { id:'streak3',     icon:'🔥', name:'НА ВОГНІ',        desc:'3 дні поспіль',                       check: ()=> streak >= 3 },
  { id:'streak7',     icon:'🏆', name:'ТИЖДЕНЬ',         desc:'7 днів поспіль!',                     check: ()=> streak >= 7 },
  { id:'xp500',       icon:'💰', name:'500 XP',          desc:'Набери 500 XP',                       check: ()=> (playerLevel - 1) * 100 + totalXP >= 500 },
  { id:'bomb1',       icon:'💣', name:'САПЕР',           desc:'Пройди сесію в режимі Бомба',         check: ()=> bombMode && pos >= currentText.length },
  { id:'sessions10',  icon:'📈', name:'10 СЕСІЙ',        desc:'Зіграй 10 сесій',                     check: ()=> sessionHistory.length >= 10 },
  { id:'ghost_win',   icon:'👻', name:'МИСЛИВЕЦЬ ПРИМАР','desc':'Обжени Ghost на 5+ символів',       check: ()=> ghostMode && (pos - ghostPos) >= 5 },
  { id:'ua_lesson',   icon:'🇺🇦', name:'ПАТРІОТ',        desc:'Пройди урок з українською розкладкою', check: ()=> completedLessons['l4_ua1'] || completedLessons['l4_ua2'] },
  { id:'speed_demon', icon:'😈', name:'ДЕМОН ШВИДКОСТІ', desc:'WPM > 80 і точність > 95%',           check: ()=> sessionMaxWPM >= 80 && sessionMaxAcc >= 95 },
];

let unlockedAchievements = JSON.parse(localStorage.getItem('tm_ach') || '[]');
let newAchievements = [];

function checkAchievements() {
  let newUnlocked = false;
  ACHIEVEMENTS.forEach(a => {
    if (!unlockedAchievements.includes(a.id) && a.check()) {
      unlockedAchievements.push(a.id);
      newAchievements.push(a.id);
      newUnlocked = true;
      localStorage.setItem('tm_ach', JSON.stringify(unlockedAchievements));
      setTimeout(() => showAchievementToast(a), 800);
    }
  });
  if (newUnlocked) renderAchievements();
}

function showAchievementToast(a) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:80px;right:30px;background:var(--surface);border:1px solid var(--accent2);border-radius:6px;padding:14px 18px;z-index:300;animation:slide-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;box-shadow:0 0 20px rgba(245,166,35,0.4);max-width:260px;`;
  t.innerHTML = `<div style="font-family:var(--font-display);font-size:0.6rem;color:var(--accent2);letter-spacing:2px;margin-bottom:4px">🏆 ДОСЯГНЕННЯ!</div><div style="font-size:1.4rem;margin-bottom:4px">${a.icon}</div><div style="font-family:var(--font-display);font-size:0.7rem;color:var(--text);letter-spacing:1px">${a.name}</div><div style="font-size:0.7rem;color:var(--muted);margin-top:2px">${a.desc}</div>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.animation = 'slide-out 0.4s ease forwards'; setTimeout(() => t.remove(), 400); }, 3500);
}

function renderAchievements() {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const unlocked = unlockedAchievements.length;
  const total = ACHIEVEMENTS.length;
  document.getElementById('ach-count').textContent = `${unlocked} / ${total}`;
  document.getElementById('ach-progress-bar').style.width = (unlocked/total*100) + '%';

  // Unlocked first
  const sorted = [...ACHIEVEMENTS].sort((a,b) => {
    const ua = unlockedAchievements.includes(a.id);
    const ub = unlockedAchievements.includes(b.id);
    return ua === ub ? 0 : ua ? -1 : 1;
  });

  sorted.forEach(a => {
    const done = unlockedAchievements.includes(a.id);
    const isNew = newAchievements.includes(a.id);
    const card = document.createElement('div');
    card.className = 'ach-card ' + (done ? 'unlocked' : 'locked');
    card.innerHTML = `
      ${isNew ? '<div class="ach-new-badge">НОВЕ!</div>' : ''}
      <div class="ach-icon">${done ? a.icon : '🔒'}</div>
      <div class="ach-name ${done ? '' : 'locked-name'}">${a.name}</div>
      <div class="ach-desc">${done ? a.desc : '???'}</div>
    `;
    grid.appendChild(card);
  });
}

// ========== PATCH finishSession to include new features ==========
const _origFinishSession = finishSession;
finishSession = function() {
  _origFinishSession();
  // Save session history
  saveSession(calcWPM(), calcAccuracy());
  // Check achievements
  checkAchievements();
  // Save ghost record
  if (ghostMode && charTimestamps.length) {
    saveGhostRecord(calcWPM(), charTimestamps);
  }
  // Render heatmap
  renderHeatmap();
  clearInterval(bombInterval);
  clearInterval(ghostInterval);
};

// Track char timestamps for ghost
let charTimestamps = [];

// ========== PATCH processChar for bomb reset + ghost + heatmap ==========
const _origProcessChar = processChar;
processChar = function(typed) {
  const before = pos;
  _origProcessChar(typed);
  const after = pos;
  // If we moved forward (correct key) - reset bomb, track timestamp
  if (after > before) {
    charTimestamps.push(Date.now() - (startTime || Date.now()));
    if (bombMode) resetBombTimer();
  } else {
    // Wrong key - record error for heatmap
    recordKeyError(typed);
  }
  // Check achievements live
  if (totalTyped % 10 === 1) checkAchievements();
};

// ========== PATCH newText for new features ==========
const _origNewText = newText;
newText = function() {
  _origNewText();
  charTimestamps = [];
  document.getElementById('ghost-info').style.display = ghostMode ? 'block' : 'none';
  if (ghostMode && ghostRecord) {
    document.getElementById('ghost-wpm-display').textContent = (ghostRecord.peakWPM || 0) + ' WPM';
  }
};

// ========== PATCH startCountdown to start bomb + ghost ==========
const _origStartCountdown = startCountdown;
startCountdown = function() {
  _origStartCountdown();
  if (bombMode) startBombTimer();
  if (ghostMode && ghostRecord) startGhost();
};

// ========== EXPOSE NEW FUNCTIONS ==========
window.toggleBomb = toggleBomb;
window.toggleGhost = toggleGhost;

// ========== PARTICLES SYSTEM ==========
const pCanvas = document.getElementById('particle-canvas');
const pCtx = pCanvas.getContext('2d');
let particles = [];
let particlesEnabled = true;

function resizeCanvas() {
  pCanvas.width = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function spawnParticles(x, y, color, count = 6) {
  if (!particlesEnabled) return;
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 2) * 3,
      life: 1,
      decay: 0.04 + Math.random() * 0.04,
      size: 3 + Math.random() * 4,
      color,
      char: Math.random() > 0.6 ? String.fromCharCode(65 + Math.floor(Math.random() * 26)) : null,
    });
  }
}

function animateParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // gravity
    p.life -= p.decay;
    pCtx.globalAlpha = p.life;
    if (p.char) {
      pCtx.fillStyle = p.color;
      pCtx.font = `bold ${p.size * 2}px monospace`;
      pCtx.fillText(p.char, p.x, p.y);
    } else {
      pCtx.fillStyle = p.color;
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      pCtx.fill();
    }
  });
  pCtx.globalAlpha = 1;
  requestAnimationFrame(animateParticles);
}
animateParticles();

// Spawn particles on correct keypress
const _origProcChar2 = processChar;
processChar = function(typed) {
  const before = pos;
  _origProcChar2(typed);
  if (pos > before) {
    // Get position of current char element
    const chars = document.querySelectorAll('#text-display .char');
    const idx = pos - 1;
    if (chars[idx]) {
      const rect = chars[idx].getBoundingClientRect();
      const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5d4';
      spawnParticles(rect.left + rect.width/2, rect.top, color, 4);
    }
  }
};

// ========== INIT ALL NEW FEATURES ==========
let customTextValue = '';

function openCustomModal() {
  document.getElementById('custom-text-modal').style.display = 'flex';
  document.getElementById('custom-text-input').value = customTextValue;
  setTimeout(() => document.getElementById('custom-text-input').focus(), 100);
}

function closeCustomModal(e) {
  if (!e || e.target === document.getElementById('custom-text-modal')) {
    document.getElementById('custom-text-modal').style.display = 'none';
    // Reset difficulty if cancelled without applying
    if (!customTextValue) {
      document.getElementById('difficulty').value = 'medium';
    }
  }
}

function applyCustomText() {
  const val = document.getElementById('custom-text-input').value.trim();
  const err = document.getElementById('custom-text-err');
  if (val.length < 20) { err.textContent = '⚠ Мінімум 20 символів!'; return; }
  err.textContent = '';
  customTextValue = val;
  document.getElementById('custom-text-modal').style.display = 'none';
  currentText = val;
  const detected = detectLang(currentText);
  if (detected !== currentLang) { currentLang = detected; rebuildKeyboards(); }
  resetSession(false);
  renderText();
  focusInput();
  showToast('📝 Свій текст застосовано!');
}

window.openCustomModal = openCustomModal;
window.closeCustomModal = closeCustomModal;
window.applyCustomText = applyCustomText;

// ========== SURVIVAL MODE ==========
const SV_WORDS_EN = ['the','and','for','you','can','but','all','one','had','her','was','not','are','this','have','from','they','will','would','there','their','what','about','which','when','make','like','time','just','know','take','into','year','your','good','some','could','them','than','other','look','only','come','over','think','also','back','after','work','first','well','even','want','because','these','give','most'];
const SV_WORDS_UA = ['і','та','що','це','він','вона','ми','не','як','де','коли','після','перед','між','з','до','від','над','під','за','при','у','в','на','по','про','для','але','або','хоча','тому','якщо','тоді','тут','там','вже','ще','дуже','так','ні','все'];

let svActive = false;
let svScore = 0;
let svLevel = 1;
let svLives = 3;
let svHighScore = parseInt(localStorage.getItem('tm_sv_hs') || '0');
let svWords = [];
let svSpawnInterval = null;
let svFallInterval = null;
let svSpeedMultiplier = 1;
let svCurrentTarget = null;

document.getElementById('sv-highscore').textContent = svHighScore;

const SV_SPEEDS = { slow: 0.4, normal: 0.7, fast: 1.1, insane: 1.8 };

function getSVWordList() {
  return practiceLang === 'ua' ? SV_WORDS_UA : SV_WORDS_EN;
}

function startSurvival() {
  if (svActive) return;
  svActive = true;
  svScore = 0; svLevel = 1; svLives = 3;
  svWords = [];
  document.getElementById('sv-score').textContent = 0;
  document.getElementById('sv-level').textContent = 1;
  document.getElementById('sv-lives').textContent = '❤️❤️❤️';
  document.getElementById('sv-idle-msg').style.display = 'none';
  document.getElementById('sv-words-container').innerHTML = '';
  document.getElementById('survival-input').value = '';
  document.getElementById('survival-input').focus();

  const speedKey = document.getElementById('survival-speed').value;
  svSpeedMultiplier = SV_SPEEDS[speedKey];

  spawnSVWord();
  svSpawnInterval = setInterval(spawnSVWord, 2200 / svSpeedMultiplier);
  svFallInterval = setInterval(updateSVFall, 50);
}

function stopSurvival() {
  svActive = false;
  clearInterval(svSpawnInterval);
  clearInterval(svFallInterval);
  document.getElementById('sv-words-container').innerHTML = '';
  document.getElementById('sv-idle-msg').style.display = 'flex';
  document.getElementById('sv-idle-msg').textContent = `ГЕЙМ ОВЕР · Рахунок: ${svScore}`;
  svWords = [];
  if (svScore > svHighScore) {
    svHighScore = svScore;
    localStorage.setItem('tm_sv_hs', svHighScore);
    document.getElementById('sv-highscore').textContent = svHighScore;
    showToast(`🏆 Новий рекорд Survival: ${svHighScore}!`);
  }
}

function spawnSVWord() {
  if (!svActive) return;
  const wordList = getSVWordList();
  const word = wordList[Math.floor(Math.random() * wordList.length)];
  const arena = document.getElementById('survival-arena');
  const arenaW = arena.offsetWidth;
  const el = document.createElement('div');
  el.className = 'sv-word';
  el.textContent = word;
  el.dataset.word = word;
  el.dataset.typed = '';
  const x = 20 + Math.random() * (arenaW - 160);
  el.style.left = x + 'px';
  el.style.top = '0px';
  document.getElementById('sv-words-container').appendChild(el);
  svWords.push({ el, word, y: 0, speed: (0.5 + Math.random() * 0.4) * svSpeedMultiplier });
  updateSVTarget();
}

function updateSVFall() {
  if (!svActive) return;
  const arena = document.getElementById('survival-arena');
  const danger = arena.offsetHeight - 56;
  let toRemove = [];

  svWords.forEach((w, i) => {
    w.y += w.speed;
    w.el.style.top = w.y + 'px';
    if (w.y > arena.offsetHeight - 10) {
      // Word escaped — lose a life
      w.el.remove();
      toRemove.push(i);
      loseLife();
    } else if (w.y > danger) {
      w.el.classList.add('danger');
    }
  });

  toRemove.reverse().forEach(i => svWords.splice(i, 1));
  updateSVTarget();
}

function updateSVTarget() {
  // Target the lowest word (closest to bottom)
  if (!svWords.length) { svCurrentTarget = null; return; }
  const sorted = [...svWords].sort((a,b) => b.y - a.y);
  const newTarget = sorted[0];
  if (svCurrentTarget !== newTarget) {
    svWords.forEach(w => w.el.classList.remove('active'));
    newTarget.el.classList.add('active');
    svCurrentTarget = newTarget;
    document.getElementById('survival-input').value = svCurrentTarget.el.dataset.typed || '';
  }
}

function loseLife() {
  svLives--;
  const hearts = ['', '❤️', '❤️❤️', '❤️❤️❤️'];
  document.getElementById('sv-lives').textContent = hearts[Math.max(0, svLives)] || '💀';
  if (svLives <= 0) {
    setTimeout(stopSurvival, 200);
  }
}

// Survival input handler — будь-яке слово, автоматично при повному збігу
document.getElementById('survival-input').addEventListener('input', () => {
  if (!svActive) return;
  const val = document.getElementById('survival-input').value.toLowerCase().trim();
  if (!val) {
    // Clear all word highlights back to normal
    svWords.forEach(w => { w.el.textContent = w.word; });
    return;
  }

  // Highlight any word that starts with val
  svWords.forEach(w => {
    const word = w.word.toLowerCase();
    if (word.startsWith(val)) {
      const rest = word.slice(val.length);
      w.el.innerHTML = `<span style="color:var(--correct);text-shadow:0 0 8px var(--correct)">${w.word.slice(0, val.length)}</span>${rest}`;
      w.el.classList.add('active');
    } else {
      w.el.textContent = w.word;
      w.el.classList.remove('active');
    }
  });

  // Check if any word is fully typed
  const idx = svWords.findIndex(w => w.word.toLowerCase() === val);
  if (idx !== -1) {
    const w = svWords[idx];
    w.el.classList.add('matched');
    svScore += Math.ceil(w.word.length * svSpeedMultiplier);
    document.getElementById('sv-score').textContent = svScore;
    setTimeout(() => { w.el.remove(); }, 250);
    svWords.splice(idx, 1);
    document.getElementById('survival-input').value = '';
    updateSVTarget();
    // Level up check
    const newLevel = Math.floor(svScore / 10) + 1;
    if (newLevel > svLevel) {
      svLevel = newLevel;
      document.getElementById('sv-level').textContent = svLevel;
      svSpeedMultiplier *= 1.08;
      clearInterval(svSpawnInterval);
      svSpawnInterval = setInterval(spawnSVWord, Math.max(800, 2200 / svSpeedMultiplier));
      showToast(`⚡ Рівень ${svLevel}! Швидше!`);
    }
  }
});

document.getElementById('survival-input').addEventListener('keydown', (e) => {
  if (!svActive) return;
  // Escape clears input
  if (e.key === 'Escape') { document.getElementById('survival-input').value = ''; }
  // Block Enter/Space from submitting
  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
});

window.startSurvival = startSurvival;
window.stopSurvival = stopSurvival;

// ========== INIT ALL NEW FEATURES ==========

// ---- NEW TEXTS: IT, Medicine, Book ----
Object.assign(texts, {
  it: [
    'API endpoint returns JSON with status 200 when authentication token is valid.',
    'Docker containers isolate applications using Linux namespaces and cgroups.',
    'const fetchData = async (url) => { const res = await fetch(url); return res.json(); };',
    'Git branching strategy: feature branches merge into develop via pull requests.',
    'Microservices communicate over HTTP REST or async message queues like Kafka.',
    'TypeScript interfaces enforce type contracts at compile time for safer code.',
    'SQL injection attacks exploit unsanitized input — always use prepared statements.',
    'useState and useEffect are React hooks for state and side-effect management.',
  ],
  medicine: [
    'Hypertension is a chronic condition characterized by elevated arterial blood pressure.',
    'Myocardial infarction occurs when coronary artery blood flow is blocked for an extended time.',
    'Antibiotics target bacterial cell wall synthesis, DNA replication, or protein translation.',
    'The hypothalamus regulates body temperature, hunger, thirst, and circadian rhythms.',
    'Glucose homeostasis is maintained by insulin and glucagon secreted from the pancreas.',
    'Vaccination induces adaptive immunity without causing the disease itself.',
    'MRI uses magnetic fields and radio waves to produce detailed images of soft tissue.',
  ],
  book: [
    'It was the best of times, it was the worst of times, it was the age of wisdom.',
    'Call me Ishmael. Some years ago — never mind how long precisely — I thought I would sail about.',
    'All happy families are alike; each unhappy family is unhappy in its own way.',
    'It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife.',
    'The sky above the port was the color of television, tuned to a dead channel.',
    'Ми всі — лише тіні і пил. Але кожна тінь має своє світло, і кожен пил свою зорю.',
    'Людина народжується вільною, але всюди вона в кайданах. Думаючи, що вона господар інших, вона залишається рабом більше за них.',
    'Мрія — це не те що бачиш уві сні. Мрія — це те що не дає тобі спати.',
  ],
});

// ---- ENDLESS MODE ----
let endlessMode = false;
function toggleEndless(btn) {
  endlessMode = !endlessMode;
  btn.classList.toggle('on', endlessMode);
  showToast(endlessMode ? '⚡ Endless ON — текст не закінчиться!' : '⚡ Endless OFF');
}
window.toggleEndless = toggleEndless;

// Patch finishSession for endless
const _endlessOrig = finishSession;
finishSession = function() {
  if (endlessMode) {
    // Just append new random text and continue
    const diff = document.getElementById('difficulty').value;
    const pool = texts[diff] || texts.medium;
    const extra = ' ' + pool[Math.floor(Math.random() * pool.length)];
    currentText += extra;
    // Re-render appended chars
    const display = document.getElementById('text-display');
    for (let i = display.children.length; i < currentText.length; i++) {
      const span = document.createElement('span');
      span.className = 'char pending';
      span.textContent = currentText[i] === ' ' ? '\u00A0' : currentText[i];
      display.appendChild(span);
    }
    showToast('⚡ Текст розширено!');
    return;
  }
  _endlessOrig();
};

// ---- REPEAT UNTIL PERFECT ----
let repeatMode = false;
let repeatAttempts = 0;
function toggleRepeat(btn) {
  repeatMode = !repeatMode;
  btn.classList.toggle('on', repeatMode);
  repeatAttempts = 0;
  showToast(repeatMode ? '🔁 Perfect Mode — помилка = початок слова!' : '🔁 Perfect Mode OFF');
}
window.toggleRepeat = toggleRepeat;

// ---- SPRINT MODE ----
let sprintMode = false;
let sprintWordCount = 0;
let sprintStartTime = null;
let sprintActive = false;

function startSprint() {
  sprintMode = true;
  sprintActive = true;
  sprintWordCount = 0;
  sprintStartTime = null;
  document.getElementById('sprint-words').textContent = '0';
  document.getElementById('sprint-progress').style.width = '0%';
  // Build endless word pool
  const easyPool = getPracticePool('easy');
  const medPool = getPracticePool('medium');
  const allWords = [...easyPool.join(' ').split(' '), ...medPool.join(' ').split(' ')].filter(w => w.length > 2);
  let sprintText = '';
  while (sprintText.split(' ').filter(Boolean).length < 120) {
    sprintText += allWords[Math.floor(Math.random() * allWords.length)] + ' ';
  }
  currentText = sprintText.trim();
  resetSession(false);
  renderText();
  focusInput();
  document.getElementById('sprint-bar').style.display = 'flex';
  showToast('⏱ Спринт 100 слів — СТАРТ!');
}
window.startSprint = startSprint;

// Patch processChar to count sprint words
const _sprintOrig = processChar;
processChar = function(typed) {
  _sprintOrig(typed);
  if (sprintActive && pos > 0 && currentText[pos - 1] === ' ') {
    if (!sprintStartTime) sprintStartTime = Date.now();
    sprintWordCount++;
    document.getElementById('sprint-words').textContent = sprintWordCount;
    document.getElementById('sprint-progress').style.width = Math.min(sprintWordCount, 100) + '%';
    if (sprintWordCount >= 100) {
      sprintActive = false;
      const elapsed = ((Date.now() - sprintStartTime) / 1000).toFixed(1);
      const wpm = Math.round(100 / (parseFloat(elapsed) / 60));
      document.getElementById('sprint-bar').style.display = 'none';
      showToast(`🏁 Спринт завершено! ${elapsed}с · ${wpm} WPM`);
      saveRecord('sprint', wpm);
      sprintMode = false;
    }
  }
};

// ---- FONT SELECTOR ----
const FONTS = {
  mono: "'Space Mono', monospace",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Exo 2', 'Segoe UI', sans-serif",
};
function changeFont(val) {
  document.querySelectorAll('.text-display').forEach(el => el.style.fontFamily = FONTS[val] || FONTS.mono);
}
window.changeFont = changeFont;

// ---- FULLSCREEN FOCUS ----
let fsMode = false;
function toggleFullscreen() {
  fsMode = true;
  const overlay = document.getElementById('fullscreen-overlay');
  overlay.style.display = 'block';
  // Mirror current text to fullscreen display
  syncFullscreen();
  document.addEventListener('keydown', fsEscHandler);
}

function exitFullscreen() {
  fsMode = false;
  document.getElementById('fullscreen-overlay').style.display = 'none';
  document.removeEventListener('keydown', fsEscHandler);
  focusInput();
}

function fsEscHandler(e) { if (e.key === 'Escape') exitFullscreen(); }

function syncFullscreen() {
  const src = document.getElementById('text-display');
  const dst = document.getElementById('fs-text-display');
  if (src && dst) dst.innerHTML = src.innerHTML;
  document.getElementById('fs-wpm').textContent = document.getElementById('wpm').textContent;
  document.getElementById('fs-acc').textContent = document.getElementById('accuracy').textContent;
  document.getElementById('fs-timer').textContent = document.getElementById('timer').textContent;
  document.getElementById('fs-progress').style.width = document.getElementById('progress').style.width;
}

// Patch processChar to sync fullscreen
const _fsOrig = processChar;
processChar = function(typed) {
  _fsOrig(typed);
  if (fsMode) syncFullscreen();
};

window.toggleFullscreen = toggleFullscreen;
window.exitFullscreen = exitFullscreen;

// ---- CONFETTI ----
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const pieces = Array.from({length: 120}, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    w: 8 + Math.random() * 8,
    h: 5 + Math.random() * 5,
    color: ['#00f5d4','#f5a623','#ff4d6d','#64b4ff','#a78bfa','#0af5a0'][Math.floor(Math.random()*6)],
    vx: (Math.random()-0.5)*4,
    vy: 3 + Math.random()*4,
    rot: Math.random()*360,
    rotV: (Math.random()-0.5)*8,
    life: 1,
  }));
  let frame;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.life -= 0.008;
      if (p.life > 0 && p.y < canvas.height) { alive = true; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI/180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    if (alive) { frame = requestAnimationFrame(draw); }
    else { canvas.style.display = 'none'; cancelAnimationFrame(frame); }
  }
  draw();
}

// Patch addXP to fire confetti on level-up
const _addXPOrig = addXP;
addXP = function(amount) {
  const prevLevel = playerLevel;
  _addXPOrig(amount);
  if (playerLevel > prevLevel) launchConfetti();
};

// ---- FINGER HIGHLIGHT ----
let fingerHintOn = false;
// Map key → finger (1=pinky,2=ring,3=middle,4=index,0=thumb)
const FINGER_MAP = {
  '`':1,'1':1,'q':1,'a':1,'z':1,
  '2':2,'w':2,'s':2,'x':2,
  '3':3,'e':3,'d':3,'c':3,
  '4':4,'r':4,'f':4,'v':4,'5':4,'t':4,'g':4,'b':4,
  '6':4,'y':4,'h':4,'n':4,'7':4,'u':4,'j':4,'m':4,
  '8':3,'i':3,'k':3,',':3,
  '9':2,'o':2,'l':2,'.':2,
  '0':1,'p':1,';':1,'/':1,'-':1,'[':1,"'":1,']':1,'=':1,
  ' ':0,
};
const FINGER_COLORS = {1:'finger-1',2:'finger-2',3:'finger-3',4:'finger-4',0:'finger-thumb'};

function toggleFingerHint(btn) {
  fingerHintOn = !fingerHintOn;
  btn.classList.toggle('on', fingerHintOn);
  applyFingerColors();
  showToast(fingerHintOn ? '👆 Підсвітка пальців ON' : '👆 Підсвітка пальців OFF');
}
window.toggleFingerHint = toggleFingerHint;

function applyFingerColors() {
  document.querySelectorAll('#keyboard .key, #keyboard2 .key').forEach(key => {
    key.classList.remove('finger-1','finger-2','finger-3','finger-4','finger-thumb');
    if (fingerHintOn) {
      const k = (key.dataset.key || '').toLowerCase();
      const f = FINGER_MAP[k];
      if (f !== undefined) key.classList.add(FINGER_COLORS[f]);
    }
  });
}

// Re-apply after keyboard rebuild
const _rebuildOrig = rebuildKeyboards;
rebuildKeyboards = function() {
  _rebuildOrig();
  if (fingerHintOn) applyFingerColors();
};

// ---- RECORDS BY MODE ----
let modeRecords = JSON.parse(localStorage.getItem('tm_mode_records') || '{}');

function saveRecord(mode, wpm) {
  if (!modeRecords[mode] || wpm > modeRecords[mode]) {
    modeRecords[mode] = wpm;
    localStorage.setItem('tm_mode_records', JSON.stringify(modeRecords));
    renderModeRecords();
  }
}

function renderModeRecords() {
  const el = document.getElementById('mode-records');
  if (!el) return;
  const LABELS = {easy:'🟢 Легкий',medium:'🟡 Середній',hard:'🔴 Складний',code:'💻 Код',
    numbers:'🔢 Цифри',it:'🧩 IT',medicine:'🏥 Медицина',book:'📖 Книга',sprint:'⏱ Спринт'};
  el.innerHTML = '';
  const entries = Object.entries(modeRecords);
  if (!entries.length) { el.innerHTML = '<span style="color:var(--muted);font-size:0.75rem">Немає рекордів</span>'; return; }
  entries.forEach(([mode, wpm]) => {
    el.innerHTML += `<div style="text-align:center;background:var(--surface2);padding:10px;border-radius:4px">
      <div style="font-size:0.65rem;color:var(--muted);margin-bottom:4px">${LABELS[mode]||mode}</div>
      <div style="font-family:var(--font-display);font-size:1.3rem;color:var(--accent)">${wpm}</div>
      <div style="font-size:0.55rem;color:var(--muted);letter-spacing:1px">WPM</div>
    </div>`;
  });
}

// Patch finishSession to save mode record
const _recordOrig = finishSession;
finishSession = function() {
  _recordOrig();
  const diff = document.getElementById('difficulty').value;
  saveRecord(diff, calcWPM());
};

// ---- CALENDAR ----
let activityLog = JSON.parse(localStorage.getItem('tm_activity') || '{}');

function logActivity() {
  const today = new Date().toISOString().slice(0,10);
  activityLog[today] = (activityLog[today] || 0) + 1;
  localStorage.setItem('tm_activity', JSON.stringify(activityLog));
  renderCalendar();
}

function renderCalendar() {
  const el = document.getElementById('activity-calendar');
  if (!el) return;
  const weeks = 15;
  const days = weeks * 7;
  const today = new Date();
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;gap:3px;';
  // Month labels
  const labelRow = document.createElement('div');
  labelRow.style.cssText = 'display:flex;gap:3px;margin-bottom:4px;';
  for (let w = 0; w < weeks; w++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (weeks - w - 1) * 7);
    const lbl = document.createElement('div');
    lbl.style.cssText = `width:14px;font-size:0.55rem;color:var(--muted);text-align:center;flex-shrink:0;`;
    lbl.textContent = w % 3 === 0 ? d.toLocaleDateString('uk',{month:'short'}) : '';
    labelRow.appendChild(lbl);
  }
  el.appendChild(labelRow);
  for (let w = 0; w < weeks; w++) {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex-shrink:0;';
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - ((weeks - w - 1) * 7 + d));
      const key = date.toISOString().slice(0,10);
      const count = activityLog[key] || 0;
      const cell = document.createElement('div');
      const alpha = count === 0 ? 0 : count <= 2 ? 0.3 : count <= 5 ? 0.6 : 1;
      cell.style.cssText = `width:14px;height:14px;border-radius:2px;background:${count?`rgba(0,245,212,${alpha})`:'var(--surface2)'};flex-shrink:0;cursor:default;`;
      cell.title = `${key}: ${count} сесій`;
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
  el.appendChild(grid);
}

// Patch finishSession to log activity
const _calOrig = finishSession;
finishSession = function() {
  _calOrig();
  logActivity();
};

// ---- WEAK CHARS ANALYSIS ----
function renderWeakChars() {
  const el = document.getElementById('weak-chars-list');
  if (!el) return;
  const sorted = Object.entries(keyErrors).sort((a,b) => b[1]-a[1]).slice(0,12);
  if (!sorted.length) return;
  el.innerHTML = sorted.map(([k,v]) =>
    `<div style="display:inline-flex;flex-direction:column;align-items:center;background:var(--surface2);border:1px solid rgba(255,77,109,${Math.min(v/10,0.8)});border-radius:4px;padding:6px 10px;min-width:44px">
      <span style="font-family:var(--font-mono);font-size:1.1rem;color:var(--wrong)">${k.toUpperCase()}</span>
      <span style="font-size:0.6rem;color:var(--muted);margin-top:2px">${v} помил.</span>
    </div>`
  ).join('');
}

// ---- INTER-KEY TIME ----
let keyTimes = [];
let lastKeyTime = null;

const _ikeyOrig = processChar;
processChar = function(typed) {
  const now = Date.now();
  if (lastKeyTime && running) {
    keyTimes.push(now - lastKeyTime);
    if (keyTimes.length > 200) keyTimes.shift();
  }
  lastKeyTime = now;
  _ikeyOrig(typed);
};

function renderIKeyStats() {
  if (!keyTimes.length) return;
  const avg = Math.round(keyTimes.reduce((a,b)=>a+b,0)/keyTimes.length);
  const best = Math.min(...keyTimes);
  const worst = Math.max(...keyTimes);
  const a = document.getElementById('ikey-avg');
  const b = document.getElementById('ikey-best');
  const w = document.getElementById('ikey-worst');
  if (a) a.textContent = avg;
  if (b) b.textContent = best;
  if (w) w.textContent = worst;
}

const _ikeyFinish = finishSession;
finishSession = function() {
  _ikeyFinish();
  renderIKeyStats();
  renderWeakChars();
};

// ========== MODE CHIPS CONTROLLER ==========
const CHIP_COLORS = {
  strict: 'var(--accent)',
  bomb: '#ff6b35',
  ghost: '#a78bfa',
  endless: '#0af5a0',
  perfect: '#f5a623',
  hourglass: '#c084fc',
  sprint: 'var(--accent2)',
  sniper: '#f472b6',
  rowhl: '#00cfff',
  nextkey: '#fbbf24',
};

function toggleModeChip(mode, el) {
  const isOn = el.classList.toggle('active');
  el.style.background = isOn ? CHIP_COLORS[mode] : '';
  el.style.borderColor = isOn ? CHIP_COLORS[mode] : '';
  el.style.color = isOn ? 'var(--bg)' : '';
  el.style.boxShadow = isOn ? `0 0 14px ${CHIP_COLORS[mode]}66` : '';

  const fakeBtn = { classList: { toggle: () => {}, remove: () => {}, add: () => {} }, style: { setProperty: () => {}, removeProperty: () => {} } };
  if (mode === 'strict') { strictMode = isOn; if (!isOn) strictWaiting = false; showToast(isOn ? '🔒 Суворий ON' : '🔒 Суворий OFF'); }
  else if (mode === 'bomb') { toggleBomb(fakeBtn); }
  else if (mode === 'ghost') { toggleGhost(fakeBtn); }
  else if (mode === 'endless') { endlessMode = isOn; showToast(isOn ? '⚡ Endless ON' : '⚡ Endless OFF'); }
  else if (mode === 'perfect') { repeatMode = isOn; repeatAttempts = 0; showToast(isOn ? '🔁 Perfect ON — помилка = початок слова' : '🔁 Perfect OFF'); }
  else if (mode === 'hourglass') { hourglassMode = isOn; showToast(isOn ? '⏳ Годинник ON — +5с за слово!' : '⏳ Годинник OFF'); }
  else if (mode === 'sprint') {
    document.getElementById('sprint-bar').style.display = isOn ? 'flex' : 'none';
    if (isOn) showToast('🏁 Натисни СТАРТ для спринту');
  }
  else if (mode === 'sniper') { toggleSniper(isOn); }
  else if (mode === 'rowhl') { toggleRowHighlight(isOn); }
  else if (mode === 'nextkey') { nextKeyHint = isOn; if (!isOn) clearNextKeyHint(); showToast(isOn ? '💡 Підказка клавіші ON' : '💡 Підказка OFF'); }

  updateActiveBadge();
}
window.toggleModeChip = toggleModeChip;

function updateActiveBadge() {
  const active = document.querySelectorAll('.mode-chip.active');
  const badge = document.getElementById('active-modes-badge');
  if (!badge) return;
  if (active.length === 0) { badge.style.display = 'none'; return; }
  badge.style.display = 'flex';
  badge.textContent = active.length + ' режим' + (active.length > 1 ? 'и' : '') + ' активні';
}

// Redirect old toggleBomb/toggleGhost to not double-toggle when called via chip
// (bomb and ghost have their own internal state — wrap them)
const _origToggleBomb2 = toggleBomb;
toggleBomb = function(btn) {
  _origToggleBomb2(btn);
  // Sync chip visual
  const chip = document.getElementById('chip-bomb');
  if (chip && bomb !== undefined) {
    const on = bombMode;
    chip.classList.toggle('active', on);
    chip.style.background = on ? CHIP_COLORS.bomb : '';
    chip.style.borderColor = on ? CHIP_COLORS.bomb : '';
    chip.style.color = on ? 'var(--bg)' : '';
  }
};

const _origToggleGhost2 = toggleGhost;
toggleGhost = function(btn) {
  _origToggleGhost2(btn);
  const chip = document.getElementById('chip-ghost');
  if (chip) {
    const on = ghostMode;
    chip.classList.toggle('active', on);
    chip.style.background = on ? CHIP_COLORS.ghost : '';
    chip.style.borderColor = on ? CHIP_COLORS.ghost : '';
    chip.style.color = on ? 'var(--bg)' : '';
  }
};
const _origSwitchTab = switchTab;
switchTab = function(name, btn) {
  _origSwitchTab(name, btn);
  if (name === 'speed') {
    renderCalendar();
    renderModeRecords();
    renderWeakChars();
    renderIKeyStats();
    renderMistakeWords();
  }
};
window.switchTab = switchTab;

// ========== PUNCTUATION TEXTS ==========
texts.punct = [
  'Hello, world! How are you? I\'m fine, thanks. Really? Yes!',
  'Wait... are you sure? Yes: I\'m 100% certain. No doubt at all!',
  'Dear John, I\'ve been thinking — what if we try again? Yours, Jane.',
  'Items: apples, oranges, bananas; total cost: $4.99 (discounted).',
  '"Stop!" she cried. "Don\'t go — please." He paused... then left.',
];
texts.punct_ua = [
  'Привіт, світе! Як справи? Все чудово, дякую. Справді? Так!',
  'Зачекай... ти впевнений? Так: я на 100% певен. Жодних сумнівів!',
  'Дорогий Іване, я думав — що якщо спробувати знову? З повагою, Оля.',
  'Товари: яблука, апельсини, банани; загальна вартість: 149,99 грн.',
  '"Стій!" — крикнула вона. "Не йди — прошу." Він зупинився... і пішов.',
];

// ========== MISTAKE WORDS ==========
let mistakeWords = JSON.parse(localStorage.getItem('tm_mistake_words') || '[]');

function trackMistakeWord() {
  if (!currentText || pos < 0) return;
  // Find word boundaries around current position
  const text = currentText;
  // Start of current word: scan back from pos to find last space
  let wordStart = pos;
  while (wordStart > 0 && text[wordStart - 1] !== ' ') wordStart--;
  // End of current word: scan forward from pos to find next space
  let wordEnd = pos;
  while (wordEnd < text.length && text[wordEnd] !== ' ') wordEnd++;
  const word = text.slice(wordStart, wordEnd).replace(/[^a-zA-Zа-яіїєґА-ЯІЇЄҐ']/g, '').toLowerCase();
  if (word.length > 1 && !mistakeWords.includes(word)) {
    mistakeWords.unshift(word);
    if (mistakeWords.length > 40) mistakeWords = mistakeWords.slice(0, 40);
    localStorage.setItem('tm_mistake_words', JSON.stringify(mistakeWords));
  }
}

function renderMistakeWords() {
  const el = document.getElementById('mistake-words-list');
  if (!el) return;
  if (!mistakeWords.length) {
    el.innerHTML = `<span style="color:var(--muted);font-size:0.75rem">${UI.noMistakes}</span>`;
    return;
  }
  el.innerHTML = mistakeWords.map(w =>
    `<span class="mistake-word-chip" onclick="practiceWord('${w}')" title="Натисни щоб тренувати">${w}</span>`
  ).join('');
}

function practiceMyMistakes() {
  if (!mistakeWords.length) { showToast('Немає помилкових слів!'); return; }
  customTextValue = mistakeWords.slice(0, 20).join(' ');
  currentText = customTextValue;
  const detected = detectLang(currentText);
  if (detected !== currentLang) { currentLang = detected; rebuildKeyboards(); }
  resetSession(false);
  renderText();
  // Switch to practice tab
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-practice').classList.add('active');
  document.querySelector('.tab[onclick*="practice"]').classList.add('active');
  focusInput();
  showToast('🏋️ Тренуємо помилкові слова!');
}

function practiceWord(word) {
  customTextValue = [word, word, word, word, word].join(' ');
  currentText = customTextValue;
  resetSession(false); renderText();
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-practice').classList.add('active');
  document.querySelector('.tab[onclick*="practice"]').classList.add('active');
  focusInput();
  showToast(`🏋️ Тренуємо: "${word}"`);
}

function clearMistakeWords() {
  mistakeWords = [];
  localStorage.removeItem('tm_mistake_words');
  renderMistakeWords();
  showToast('🗑️ Список очищено');
}
window.practiceMyMistakes = practiceMyMistakes;
window.practiceWord = practiceWord;
window.clearMistakeWords = clearMistakeWords;

// Patch processChar to track mistake words
const _mistakeOrig = processChar;
processChar = function(typed) {
  const before = pos;
  _mistakeOrig(typed);
  if (pos === before && before > 0) trackMistakeWord(); // error = didn't advance
};

// ========== HOURGLASS MODE ==========
let hourglassMode = false;
let hourglassRemaining = 0;
let hourglassInterval = null;
const HOURGLASS_START = 15;
const HOURGLASS_BONUS = 5;

function toggleHourglass(btn) {
  hourglassMode = !hourglassMode;
  btn.classList.toggle('on', hourglassMode);
  showToast(hourglassMode ? `⏳ Годинник: +${HOURGLASS_BONUS}с за кожне слово!` : '⏳ Годинник OFF');
}
window.toggleHourglass = toggleHourglass;

// Patch startCountdown for hourglass
const _hgCountdown = startCountdown;
startCountdown = function() {
  if (!hourglassMode) { _hgCountdown(); return; }
  hourglassRemaining = HOURGLASS_START;
  document.getElementById('timer').textContent = hourglassRemaining + 's';
  clearInterval(hourglassInterval);
  hourglassInterval = setInterval(() => {
    hourglassRemaining--;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = hourglassRemaining + 's';
    if (hourglassRemaining <= 5) timerEl.style.color = 'var(--wrong)';
    if (hourglassRemaining <= 0) {
      clearInterval(hourglassInterval);
      finishSession();
    }
  }, 1000);
};

// Add time on correct word in hourglass mode
const _hgProcessChar = processChar;
processChar = function(typed) {
  const prevPos = pos;
  _hgProcessChar(typed);
  // Only add time if we actually advanced past a space (meaning the space was correct)
  if (hourglassMode && running && pos > prevPos && pos > 0 && currentText[pos-1] === ' ') {
    hourglassRemaining += HOURGLASS_BONUS;
    document.getElementById('timer').textContent = hourglassRemaining + 's';
    document.getElementById('timer').style.color = '';
    const timerEl = document.getElementById('timer');
    timerEl.classList.remove('time-flash'); void timerEl.offsetWidth;
    timerEl.classList.add('time-flash');
  }
};

// ========== CUSTOM ACCENT COLOR ==========
function setAccentColor(hex, swatchEl) {
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--correct', hex);
  document.documentElement.style.setProperty('--glow', `0 0 20px ${hex}88`);
  const preview = document.getElementById('color-preview');
  if (preview) preview.style.background = hex;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  if (swatchEl) swatchEl.classList.add('selected');
  localStorage.setItem('tm_accent', hex);
}
window.setAccentColor = setAccentColor;

// Restore saved accent color
const savedAccent = localStorage.getItem('tm_accent');
if (savedAccent) setAccentColor(savedAccent, null);

// ========== CURSOR STYLE ==========
function setCursorStyle(style, btn) {
  document.body.classList.remove('cursor-line','cursor-under');
  if (style === 'line') document.body.classList.add('cursor-line');
  else if (style === 'under') document.body.classList.add('cursor-under');
  document.querySelectorAll('#cur-block,#cur-line,#cur-under').forEach(b => b && b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  localStorage.setItem('tm_cursor', style);
}
window.setCursorStyle = setCursorStyle;

const savedCursor = localStorage.getItem('tm_cursor');
if (savedCursor) {
  setCursorStyle(savedCursor, document.getElementById('cur-' + savedCursor));
}

// ========== SHARE RESULT ==========
let lastResult = {};

function openShareFromResult() {
  document.getElementById('share-wpm').textContent = lastResult.wpm || 0;
  document.getElementById('share-acc').textContent = (lastResult.acc || 0) + '%';
  document.getElementById('share-combo').textContent = lastResult.combo || 0;
  document.getElementById('share-rank').textContent = lastResult.rank || '';
  document.getElementById('share-modal').style.display = 'flex';
}
window.openShareFromResult = openShareFromResult;

function copyShareText() {
  const r = lastResult;
  const text = `Key Rush · ${r.wpm} WPM · ${r.acc}% · x${r.combo}\n${r.rank || ''}`;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Скопійовано!'));
}
window.copyShareText = copyShareText;

function downloadShareCard() {
  const card = document.getElementById('share-card');
  // Simple canvas render
  const canvas = document.createElement('canvas');
  canvas.width = 500; canvas.height = 220;
  const ctx = canvas.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5d4';
  ctx.fillStyle = '#12121a';
  ctx.fillRect(0,0,500,220);
  const grad = ctx.createLinearGradient(0,0,500,0);
  grad.addColorStop(0,accent); grad.addColorStop(0.5,'#f5a623'); grad.addColorStop(1,'#ff4d6d');
  ctx.fillStyle = grad; ctx.fillRect(0,0,500,4);
  ctx.fillStyle = accent; ctx.font = 'bold 22px monospace';
  ctx.fillText('KEY RUSH', 30, 50);
  ctx.fillStyle = '#f5a623'; ctx.font = '18px monospace';
  ctx.fillText('results', 200, 50);
  ctx.fillStyle = '#e8e8f0'; ctx.font = 'bold 52px monospace';
  ctx.fillText(lastResult.wpm || 0, 30, 130);
  ctx.font = '13px monospace'; ctx.fillStyle = '#5a5a7a';
  ctx.fillText('WPM', 30, 155);
  ctx.fillStyle = '#f5a623'; ctx.font = 'bold 52px monospace';
  ctx.fillText((lastResult.acc||0)+'%', 160, 130);
  ctx.font = '13px monospace'; ctx.fillStyle = '#5a5a7a';
  ctx.fillText('ТОЧНІСТЬ', 160, 155);
  ctx.fillStyle = '#ff4d6d'; ctx.font = 'bold 52px monospace';
  ctx.fillText('x'+(lastResult.combo||0), 320, 130);
  ctx.font = '13px monospace'; ctx.fillStyle = '#5a5a7a';
  ctx.fillText('КОМБО', 320, 155);
  ctx.fillStyle = '#5a5a7a'; ctx.font = '13px monospace';
  ctx.fillText(lastResult.rank || '', 30, 195);
  const link = document.createElement('a');
  link.download = 'key-rush-result.png';
  link.href = canvas.toDataURL();
  link.click();
  showToast('💾 Картку збережено!');
}
window.downloadShareCard = downloadShareCard;

// Patch finishSession to save last result
const _shareFinish = finishSession;
finishSession = function() {
  _shareFinish();
  const totalEarned = Object.keys(completedLessons).filter(k=>!k.includes('_perfect')).reduce((s,k)=>{
    const l = lessons.find(x=>x.id===k); return s + (l?l.xp:0);
  }, 0);
  const curRank = [...XP_RANKS].reverse().find(r => totalEarned >= r.min) || XP_RANKS[0];
  lastResult = {
    wpm: calcWPM(), acc: calcAccuracy(),
    combo: maxCombo, rank: curRank.label,
  };
};

// ========== UI LANGUAGE ==========
const TRANSLATIONS = {
  ua: {
    tagline: 'Навчись сліпому друку · Стань швидшим',
    practiceTab: '⌨️ Практика', survivalTab: '🔤 Survival',
    lessonsTab: '📚 Уроки', statsTab: '🚀 Статистика', achTab: '🏆 Досягнення',
    newText: '↺ Новий текст', reset: '✕ Скинути', focus: '⛶ Фокус',
    shareTitle: '🔗 ПОДІЛИТИСЬ', resultTitle: '✦ РЕЗУЛЬТАТ ✦',
    again: '↺ Знову', share: '🔗 Поділитись', close: '✕ Закрити',
    accuracyLbl: 'Точність', timeLbl: 'Час', comboLbl: 'Макс комбо', xpLbl: 'XP зароблено',
    copyBtn: '📋 Копіювати текст', saveBtn: '💾 Зберегти картку',
    accLabel: 'ТОЧНІСТЬ', comboLabel: 'КОМБО',
    mistakeWords: '📋 СЛОВА З ПОМИЛКАМИ', practiceMistakes: '▶ Тренувати',
    clearMistakes: '✕ Очистити', noMistakes: 'Ще немає помилкових слів',
    // stats bar
    lblWpm: 'WPM', lblAcc: 'Точність', lblTime: 'Час',
    lblCombo: 'Комбо', lblXp: 'XP', lblStreak: 'Стрік',
    // difficulty options
    diffEasy: '🟢 Легкий', diffMedium: '🟡 Середній', diffHard: '🔴 Складний',
    diffCode: '💻 Код', diffNumbers: '🔢 Цифри', diffPunct: '🔢 Пунктуація',
    diffIt: '🧩 IT терміни', diffMedicine: '🏥 Медицина', diffBook: '📖 Книга',
    diffMistakes: '🏋️ Мої помилки', diffCustom: '📝 Свій текст',
    // time options
    timeUnlim: '∞ Без ліміту', time30: '⏱ 30 сек', time60: '⏱ 60 сек', time120: '⏱ 2 хв',
    // mode toggles
    modeStrict: 'СУВОРИЙ', modeBomb: '💣БОМБА', modeGhost: '👻GHOST',
    modeEndless: '⚡ENDLESS', modePerfect: '🔁PERFECT', modeHourglass: '⏳ГОДИННИК',
    // survival
    svStart: '▶ СТАРТ', svStop: '■ СТОП',
  },
  en: {
    tagline: 'Learn touch typing · Become faster',
    practiceTab: '⌨️ Practice', survivalTab: '🔤 Survival',
    lessonsTab: '📚 Lessons', statsTab: '🚀 Stats', achTab: '🏆 Achievements',
    newText: '↺ New text', reset: '✕ Reset', focus: '⛶ Focus',
    shareTitle: '🔗 SHARE', resultTitle: '✦ RESULT ✦',
    again: '↺ Again', share: '🔗 Share', close: '✕ Close',
    accuracyLbl: 'Accuracy', timeLbl: 'Time', comboLbl: 'Max combo', xpLbl: 'XP earned',
    copyBtn: '📋 Copy text', saveBtn: '💾 Save card',
    accLabel: 'ACCURACY', comboLabel: 'COMBO',
    mistakeWords: '📋 MISTAKE WORDS', practiceMistakes: '▶ Practice',
    clearMistakes: '✕ Clear', noMistakes: 'No mistake words yet',
    // stats bar
    lblWpm: 'WPM', lblAcc: 'Accuracy', lblTime: 'Time',
    lblCombo: 'Combo', lblXp: 'XP', lblStreak: 'Streak',
    // difficulty options
    diffEasy: '🟢 Easy', diffMedium: '🟡 Medium', diffHard: '🔴 Hard',
    diffCode: '💻 Code', diffNumbers: '🔢 Numbers', diffPunct: '🔡 Punctuation',
    diffIt: '🧩 IT terms', diffMedicine: '🏥 Medicine', diffBook: '📖 Book',
    diffMistakes: '🏋️ My mistakes', diffCustom: '📝 Custom text',
    // time options
    timeUnlim: '∞ No limit', time30: '⏱ 30 sec', time60: '⏱ 60 sec', time120: '⏱ 2 min',
    // mode toggles
    modeStrict: 'STRICT', modeBomb: '💣BOMB', modeGhost: '👻GHOST',
    modeEndless: '⚡ENDLESS', modePerfect: '🔁PERFECT', modeHourglass: '⏳HOURGLASS',
    // survival
    svStart: '▶ START', svStop: '■ STOP',
  }
};
let currentUI = localStorage.getItem('tm_lang') || 'ua';
let UI = TRANSLATIONS[currentUI];

function setLang(lang, btn) {
  currentUI = lang;
  practiceLang = lang;
  UI = TRANSLATIONS[lang];
  localStorage.setItem('tm_lang', lang);
  localStorage.setItem('tm_practice_lang', lang);

  // Switch keyboard layout
  currentLang = lang;
  rebuildKeyboards();

  // Regenerate text in new language
  newText();

  applyLang();
}
window.setLang = setLang;

function applyLang() {
  const T = UI;
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // Header
  s('t-tagline', T.tagline);

  // Stats bar labels
  s('t-lbl-wpm', T.lblWpm);
  s('t-lbl-acc', T.lblAcc);
  s('t-lbl-time', T.lblTime);
  s('t-lbl-combo', T.lblCombo);
  s('t-lbl-xp', T.lblXp);
  s('t-lbl-streak', T.lblStreak);

  // Result modal
  s('t-result-title', T.resultTitle);
  s('t-again-btn', T.again);
  s('t-share-btn', T.share);
  s('t-close-btn', T.close);
  s('t-res-acc-lbl', T.accuracyLbl);
  s('t-res-time-lbl', T.timeLbl);
  s('t-res-combo-lbl', T.comboLbl);
  s('t-res-xp-lbl', T.xpLbl);

  // Share modal
  s('t-share-title', T.shareTitle);
  s('t-copy-btn', T.copyBtn);
  s('t-save-btn', T.saveBtn);
  s('t-accuracy-lbl', T.accLabel);
  s('t-combo-lbl', T.comboLabel);

  // Mistake words panel
  s('t-mistake-words', T.mistakeWords);
  s('t-practice-mistakes-btn', T.practiceMistakes);
  s('t-clear-mistakes-btn', T.clearMistakes);
  s('t-no-mistakes', T.noMistakes);

  // Tabs
  const tabs = document.querySelectorAll('.tabs .tab');
  const tabKeys = ['practiceTab','survivalTab','lessonsTab','statsTab','achTab'];
  tabs.forEach((t, i) => { if (T[tabKeys[i]]) t.textContent = T[tabKeys[i]]; });

  // Control buttons (find by onclick)
  document.querySelectorAll('button[onclick]').forEach(btn => {
    const oc = btn.getAttribute('onclick');
    if (oc === 'newText()') btn.textContent = T.newText;
    else if (oc === 'resetSession()') btn.textContent = T.reset;
  });
  s('fullscreen-btn', T.focus);

  // Difficulty select options
  const diff = document.getElementById('difficulty');
  if (diff) {
    const map = {easy:T.diffEasy,medium:T.diffMedium,hard:T.diffHard,code:T.diffCode,
      numbers:T.diffNumbers,punct:T.diffPunct,it:T.diffIt,medicine:T.diffMedicine,
      book:T.diffBook,mistakes:T.diffMistakes,custom:T.diffCustom};
    Array.from(diff.options).forEach(o => { if (map[o.value]) o.text = map[o.value]; });
  }

  // Time limit select options
  const tl = document.getElementById('timelimit');
  if (tl) {
    const tmap = {'0':T.timeUnlim,'30':T.time30,'60':T.time60,'120':T.time120};
    Array.from(tl.options).forEach(o => { if (tmap[o.value]) o.text = tmap[o.value]; });
  }

  // Mode chips labels
  const chipLabels = {
    't-chip-strict':    currentUI==='ua' ? 'Суворий'  : 'Strict',
    't-chip-bomb':      currentUI==='ua' ? 'Бомба'    : 'Bomb',
    't-chip-ghost':     'Ghost',
    't-chip-endless':   'Endless',
    't-chip-perfect':   'Perfect',
    't-chip-hourglass': currentUI==='ua' ? 'Годинник' : 'Hourglass',
    't-chip-sprint':    currentUI==='ua' ? 'Спринт'   : 'Sprint',
    't-chip-sniper':    currentUI==='ua' ? 'Снайпер'  : 'Sniper',
    't-chip-rowhl':     currentUI==='ua' ? 'Рядок'    : 'Row glow',
    't-chip-nextkey':   currentUI==='ua' ? 'Підказка' : 'Next key',
  };
  Object.entries(chipLabels).forEach(([id, label]) => s(id, label));

  // Survival buttons
  const svStart = document.getElementById('survival-start-btn');
  if (svStart) svStart.textContent = T.svStart;
  document.querySelectorAll('button[onclick="stopSurvival()"]').forEach(b => b.textContent = T.svStop);

  // Lang toggle active state
  document.querySelectorAll('.lang-toggle button').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(currentUI === 'ua' ? 'lang-ua-btn' : 'lang-en-btn');
  if (activeBtn) activeBtn.classList.add('active');
}

// Init lang
currentLang = practiceLang; // keyboard matches practice lang
if (currentUI === 'en') {
  const btn = document.getElementById('lang-en-btn');
  if (btn) btn.classList.add('active');
  document.getElementById('lang-ua-btn')?.classList.remove('active');
} else {
  document.getElementById('lang-ua-btn')?.classList.add('active');
  document.getElementById('lang-en-btn')?.classList.remove('active');
}
applyLang();

// ========== SNIPER MODE ==========
let sniperMode = false;
function toggleSniper(on) {
  sniperMode = on;
  document.body.classList.toggle('sniper-mode', on);
  showToast(on ? '🎯 Снайпер ON — WPM прихований, тільки точність!' : '🎯 Снайпер OFF');
}

// ========== ROW HIGHLIGHT ==========
let rowHighlightOn = false;
function toggleRowHighlight(on) {
  rowHighlightOn = on;
  const bar = document.getElementById('row-highlight-bar');
  if (bar) bar.style.display = on ? 'block' : 'none';
  showToast(on ? '🌊 Підсвітка рядка ON' : '🌊 Підсвітка рядка OFF');
  if (on) updateRowHighlight();
}

function updateRowHighlight() {
  if (!rowHighlightOn) return;
  const bar = document.getElementById('row-highlight-bar');
  const display = document.getElementById('text-display');
  if (!bar || !display) return;
  const chars = display.querySelectorAll('.char');
  if (!chars.length) return;
  const currentChar = chars[Math.min(pos, chars.length - 1)];
  const displayRect = display.getBoundingClientRect();
  const charRect = currentChar.getBoundingClientRect();
  const relTop = charRect.top - displayRect.top - 4;
  bar.style.top = Math.max(0, relTop) + 'px';
}

// Patch processChar to update row highlight
const _rowHlOrig = processChar;
processChar = function(typed) {
  _rowHlOrig(typed);
  if (rowHighlightOn) updateRowHighlight();
};

// ========== NEXT KEY HINT ==========
let nextKeyHint = false;

function clearNextKeyHint() {
  document.querySelectorAll('.key.next-hint').forEach(k => k.classList.remove('next-hint'));
  document.querySelectorAll('.key.shift-hint').forEach(k => k.classList.remove('shift-hint'));
  const banner = document.getElementById('key-hint-banner');
  if (banner) banner.style.display = 'none';
}

function showNextKeyHint() {
  if (!nextKeyHint || !currentText || pos >= currentText.length) {
    clearNextKeyHint();
    return;
  }
  const ch = currentText[pos];
  highlightKey(ch, true); // isHint=true → persistent next-hint class, not timed
  updateHintBanner();
}

// Patch processChar for next key hint
const _nkOrig = processChar;
processChar = function(typed) {
  _nkOrig(typed);
  if (nextKeyHint) showNextKeyHint();
};

// Patch renderText to init row highlight + next key after new text
const _renderTextOrig = renderText;
renderText = function() {
  _renderTextOrig();
  if (rowHighlightOn) setTimeout(updateRowHighlight, 50);
  if (nextKeyHint) showNextKeyHint();
};

// ========== LEADERBOARD ==========
let leaderboard = JSON.parse(localStorage.getItem('tm_leaderboard') || '[]');
let lbFilter = 'wpm';
let pendingLbEntry = null; // holds last session result until name entered

function saveLeaderboard() {
  localStorage.setItem('tm_leaderboard', JSON.stringify(leaderboard));
}

function openAddLeaderEntry() {
  document.getElementById('lb-add-modal').style.display = 'block';
  document.getElementById('lb-name-input').value = localStorage.getItem('tm_lb_name') || '';
  setTimeout(() => document.getElementById('lb-name-input').focus(), 50);
}

function saveLeaderEntry() {
  const name = (document.getElementById('lb-name-input').value || '').trim() || 'Гравець';
  localStorage.setItem('tm_lb_name', name);
  if (!pendingLbEntry) return;
  const entry = { ...pendingLbEntry, name, date: new Date().toLocaleDateString('uk-UA') };
  leaderboard.push(entry);
  // Keep top 50
  leaderboard.sort((a, b) => b.wpm - a.wpm);
  if (leaderboard.length > 50) leaderboard.length = 50;
  saveLeaderboard();
  pendingLbEntry = null;
  document.getElementById('lb-add-modal').style.display = 'none';
  renderLeaderboard();
  showToast('🏆 Результат збережено!');
}

function filterLeaderboard(key, btn) {
  lbFilter = key;
  document.querySelectorAll('[id^="lb-filter-"]').forEach(b => {
    b.style.color = ''; b.style.borderColor = '';
  });
  if (btn) { btn.style.color = 'var(--accent)'; btn.style.borderColor = 'var(--accent)'; }
  renderLeaderboard();
}

function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  if (!leaderboard.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:0.75rem;padding:20px">Ще немає записів — заверши сесію щоб потрапити!</div>';
    return;
  }
  const sorted = [...leaderboard].sort((a, b) => (b[lbFilter] || 0) - (a[lbFilter] || 0));
  const medals = ['🥇', '🥈', '🥉'];
  list.innerHTML = sorted.slice(0, 15).map((e, i) => {
    const medal = medals[i] || `<span style="color:var(--muted);font-family:var(--font-display);font-size:0.75rem">${i + 1}</span>`;
    const isMe = e.name === (localStorage.getItem('tm_lb_name') || '');
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${isMe ? 'rgba(0,245,212,0.06)' : 'var(--surface2)'};border-radius:4px;border:1px solid ${isMe ? 'var(--accent)44' : 'transparent'}">
      <span style="font-size:1rem;width:24px;text-align:center">${medal}</span>
      <span style="flex:1;font-size:0.85rem;color:var(--text);${isMe ? 'color:var(--accent)' : ''}">${e.name}</span>
      <span style="font-family:var(--font-display);font-size:0.9rem;color:var(--accent)">${e.wpm} WPM</span>
      <span style="font-size:0.7rem;color:var(--muted);min-width:40px;text-align:right">${e.acc}%</span>
      <span style="font-size:0.65rem;color:var(--muted);min-width:55px;text-align:right">${e.date || ''}</span>
    </div>`;
  }).join('');
}

// Auto-prompt to add to leaderboard after session
const _lbFinish = finishSession;
finishSession = function() {
  _lbFinish();
};
// Hook into result display — save pending entry after session
const _lbSaveOrig = saveSession;
saveSession = function(wpm, acc) {
  _lbSaveOrig(wpm, acc);
  pendingLbEntry = { wpm, acc, combo: maxCombo };
  // Auto-add if name already saved
  const savedName = localStorage.getItem('tm_lb_name');
  if (savedName && wpm > 0) {
    const entry = { wpm, acc, combo: maxCombo, name: savedName, date: new Date().toLocaleDateString('uk-UA') };
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.wpm - a.wpm);
    if (leaderboard.length > 50) leaderboard.length = 50;
    saveLeaderboard();
    pendingLbEntry = null;
    renderLeaderboard();
  }
};
window.openAddLeaderEntry = openAddLeaderEntry;
window.saveLeaderEntry = saveLeaderEntry;
window.filterLeaderboard = filterLeaderboard;

// ========== DAILY CHALLENGE ==========
const DAILY_TEXTS_UA = [
  'Щоденне тренування формує звичку і поступово перетворює зусилля на автоматизм.',
  'Наполегливість і терпіння — два крила що піднімають тебе вище за будь-які перешкоди.',
  'Кожен рекорд починається з першого символу. Просто почни і не зупиняйся.',
  'Швидкість без точності — як вітер без напряму. Тренуй обидва навички разом.',
  'Сьогоднішній виклик: пиши рівно, без поспіху, думай про кожне слово.',
  'Пальці памятають кожен рух. Повтори достатньо разів і рухи стануть інстинктом.',
  'Хороший друкар не дивиться на клавіші — він довіряє своїм пальцям і увазі.',
];
const DAILY_TEXTS_EN = [
  'Daily practice builds habits and gradually turns effort into pure automatism.',
  'Persistence and patience are two wings that lift you above any obstacle you face.',
  'Every record starts with the first character. Just begin and do not stop.',
  'Speed without accuracy is like wind without direction. Train both together.',
  'Today\'s challenge: type steadily, no rushing, think about each word carefully.',
  'Fingers remember every movement. Repeat enough times and motion becomes instinct.',
  'A good typist never looks at keys — they trust their fingers and their focus.',
];

function getDailyText() {
  // Deterministic per calendar day (same text for everyone on same day)
  const day = Math.floor(Date.now() / 86400000);
  const pool = practiceLang === 'ua' ? DAILY_TEXTS_UA : DAILY_TEXTS_EN;
  return pool[day % pool.length];
}

function getDailyKey() {
  const d = new Date();
  return `daily_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
}

function initDailyChallenge() {
  const text = getDailyText();
  const key  = getDailyKey();
  const done = JSON.parse(localStorage.getItem(key) || 'null');
  const d    = new Date();
  const label = d.toLocaleDateString(practiceLang === 'ua' ? 'uk-UA' : 'en-US', { weekday:'long', day:'numeric', month:'long' });

  const el = document.getElementById('daily-date-label');
  if (el) el.textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const prev = document.getElementById('daily-preview');
  if (prev) prev.textContent = text.length > 80 ? text.slice(0, 80) + '...' : text;

  const doneBadge = document.getElementById('daily-done-badge');
  const startBtn  = document.getElementById('daily-start-btn');
  const myResult  = document.getElementById('daily-my-result');

  if (done) {
    if (doneBadge) doneBadge.style.display = 'block';
    if (startBtn)  startBtn.textContent = '🔄 Знову';
    if (myResult)  myResult.textContent = `${done.wpm} WPM · ${done.acc}%`;
  } else {
    if (doneBadge) doneBadge.style.display = 'none';
    if (startBtn)  startBtn.textContent = '▶ СТАРТ';
    if (myResult)  myResult.textContent = '—';
  }
}

let isDailySession = false;

function startDailyChallenge() {
  const text = getDailyText();
  isDailySession = true;
  // Switch to practice tab and load text
  switchTab('practice', document.querySelector('.tab[onclick*="practice"]'));
  currentText = text;
  const diff = document.getElementById('difficulty');
  if (diff) diff.value = 'medium';
  resetSession(false);
  renderText();
  focusInput();
  showToast('📅 Щоденний виклик розпочато!');
}

// After session, if daily — save result
const _dailyFinish = finishSession;
finishSession = function() {
  _dailyFinish();
  if (isDailySession) {
    const key = getDailyKey();
    const wpm = calcWPM();
    const acc = calcAccuracy();
    localStorage.setItem(key, JSON.stringify({ wpm, acc }));
    isDailySession = false;
    initDailyChallenge();
    showToast('📅 Щоденний виклик виконано! 🎉');
  }
};
window.startDailyChallenge = startDailyChallenge;

// ---- INIT ----
initStreak();
renderAchievements();
renderSessionChart();
renderHeatmap();
renderCalendar();
renderModeRecords();
renderMistakeWords();
renderLeaderboard();
initDailyChallenge();
updateXPUI();