const HOST_NAME = "com.foxterminal.bridge";

function isValidCommandName(value) {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}$/i.test(value);
}

function normalizeArgs(rawArgs) {
  if (!Array.isArray(rawArgs)) {
    return [];
  }
  return rawArgs.map((value) => String(value));
}

async function runNativeCommand(command, args) {
  if (!isValidCommandName(command)) {
    throw new Error("Invalid command name.");
  }

  const payload = {
    type: "runCommand",
    command,
    args: normalizeArgs(args)
  };

  const response = await browser.runtime.sendNativeMessage(HOST_NAME, payload);
  if (!response || response.ok !== true) {
    const reason = response && response.error ? response.error : "Unknown native host error.";
    throw new Error(reason);
  }
  return response;
}

function notifyFailure(message) {
  if (!browser.notifications || !browser.notifications.create) {
    return;
  }
  browser.notifications.create({
    type: "basic",
    title: "FoxTerminal Companion",
    message: String(message || "").slice(0, 250)
  }).catch(() => {});
}

function notifyTranslateResult(payload, reason) {
  if (!browser.notifications || !browser.notifications.create) {
    return;
  }
  const translation = String((payload && payload.translatedText) || "").trim();
  if (!translation) {
    return;
  }
  const notes = String((payload && payload.notes) || "").trim();
  const parts = [translation];
  if (notes) {
    parts.push(`Нотатки: ${notes}`);
  }
  if (reason) {
    parts.push(`(${reason})`);
  }
  browser.notifications.create({
    type: "basic",
    title: "Переклад · FoxTerminal",
    message: parts.join("\n\n").slice(0, 350)
  }).catch(() => {});
}

async function openSideTerminal(options = {}) {
  if (!browser.sidebarAction || !browser.sidebarAction.open) {
    throw new Error("Firefox sidebar API is unavailable.");
  }
  // Must run during a user gesture when possible. windowId helps multi-window Zen/Firefox.
  if (typeof options.windowId === "number" && browser.sidebarAction.open.length !== 0) {
    try {
      await browser.sidebarAction.open({ windowId: options.windowId });
      return;
    } catch (_) {
      // Older builds ignore windowId — fall through.
    }
  }
  await browser.sidebarAction.open();
}

async function clearFirefoxHistory(options = {}) {
  if (!browser.browsingData || !browser.browsingData.removeHistory) {
    throw new Error("Firefox history API is unavailable.");
  }

  const removalOptions = {};
  if (typeof options.since === "number" && Number.isFinite(options.since)) {
    removalOptions.since = options.since;
  }

  await browser.browsingData.removeHistory(removalOptions);

  if (options.period === "today") {
    return { ok: true, output: "Очищено історію Firefox за сьогодні." };
  }
  if (options.period === "hour") {
    return { ok: true, output: "Очищено історію Firefox за останню годину." };
  }
  if (options.period === "week") {
    return { ok: true, output: "Очищено історію Firefox за тиждень." };
  }
  return { ok: true, output: "Firefox history cleared." };
}

function startOfLocalDayMs(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function parseClearHistoryIntent(input) {
  const text = String(input || "").trim();
  if (!text) {
    return null;
  }

  const lower = text.toLowerCase();
  const wantsClear = hasAnyLoosePhrase(lower, [
    "clear", "очисти", "очистить", "очистити", "почисти", "прибери", "прибрати",
    "видали", "видалити", "delete", "remove", "стерти"
  ]) || /очист/i.test(lower);

  const mentionsHistory = hasAnyLoosePhrase(lower, [
    "history", "історію", "історія", "историю", "история", "журнал", "історії", "історію браузера"
  ]) || /істор|истор/i.test(lower);

  if (!wantsClear || !mentionsHistory) {
    return null;
  }

  let period = "all";
  let since = null;

  if (
    hasAnyLoosePhrase(lower, ["сьогодні", "сегодня", "today", "за сьогодні", "за сегодня"]) ||
    /за\s*сьогодн/i.test(lower)
  ) {
    period = "today";
    since = startOfLocalDayMs();
  } else if (
    hasAnyLoosePhrase(lower, ["годину", "hour", "останню годину", "за годину"]) ||
    /за\s*годин/i.test(lower)
  ) {
    period = "hour";
    since = Date.now() - (60 * 60 * 1000);
  } else if (
    hasAnyLoosePhrase(lower, ["тиждень", "week", "за тиждень", "останній тиждень"]) ||
    /за\s*тижд/i.test(lower)
  ) {
    period = "week";
    since = Date.now() - (7 * 24 * 60 * 60 * 1000);
  }

  const label =
    period === "today" ? "clear history for today" :
    period === "hour" ? "clear history for last hour" :
    period === "week" ? "clear history for last week" :
    "clear browser history";

  return {
    interpretation: label,
    request: {
      type: "clearHistory",
      period,
      since
    }
  };
}

function toHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^(https?:\/\/|ftp:\/\/)/i.test(raw)) {
    return raw;
  }
  if (/^www\./i.test(raw)) {
    return `https://${raw}`;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(raw)) {
    return `https://${raw}`;
  }
  return "";
}

async function openBrowserTab(url) {
  if (!browser.tabs || !browser.tabs.create) {
    throw new Error("Firefox tabs API is unavailable.");
  }
  await browser.tabs.create({ url });
  return { ok: true, output: `Opened: ${url}` };
}

function buildGoogleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(String(query || "").trim())}`;
}

function buildWikipediaSearchUrl(query) {
  return `https://uk.wikipedia.org/w/index.php?search=${encodeURIComponent(String(query || "").trim())}`;
}

function buildYouTubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(String(query || "").trim())}`;
}

function buildGitHubSearchUrl(query) {
  return `https://github.com/search?q=${encodeURIComponent(String(query || "").trim())}&type=repositories`;
}

function buildChatGptUrl(query) {
  const q = String(query || "").trim();
  if (!q) {
    return "https://chatgpt.com/";
  }
  return `https://chatgpt.com/?q=${encodeURIComponent(q)}`;
}

function buildDuckyOpenUrl(query) {
  const q = String(query || "").trim();
  return `https://duckduckgo.com/?q=${encodeURIComponent(`!ducky ${q}`)}`;
}

function cleanPageInActiveTab() {
  try {
    const softSelectors = [
      "[id*='cookie']",
      "[class*='cookie']",
      "[id*='consent']",
      "[class*='consent']",
      "[id*='gdpr']",
      "[class*='gdpr']",
      "[id*='newsletter']",
      "[class*='newsletter']",
      "[id*='subscribe']",
      "[class*='subscribe']",
      "[class*='paywall']",
      "[id*='paywall']",
      "[role='dialog']",
      "[aria-modal='true']",
      ".modal",
      ".popup",
      ".overlay",
      ".backdrop",
      ".modal-backdrop"
    ];

    const removed = new Set();

    function removeNode(node) {
      if (!node || !node.parentNode || removed.has(node)) {
        return;
      }
      removed.add(node);
      node.remove();
    }

    for (const selector of softSelectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        removeNode(node);
      }
    }

    const viewportWidth = Math.max(window.innerWidth || 0, 1);
    const viewportHeight = Math.max(window.innerHeight || 0, 1);
    const fixedElements = document.querySelectorAll("body *");
    for (const el of fixedElements) {
      if (!el || el === document.body || el === document.documentElement) {
        continue;
      }
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      const zIndex = Number.parseInt(style.zIndex || "0", 10);
      const isWide = rect.width >= viewportWidth * 0.7;
      const isTall = rect.height >= viewportHeight * 0.1;
      const topBand = rect.top <= viewportHeight * 0.2;
      const bottomBand = rect.bottom >= viewportHeight * 0.8;
      const likelyOverlay = isWide && isTall && (topBand || bottomBand || zIndex >= 100);
      const fullscreenLayer = rect.width >= viewportWidth * 0.9 && rect.height >= viewportHeight * 0.45;
      if (likelyOverlay || fullscreenLayer) {
        removeNode(el);
      }
    }

    if (document.body) {
      document.body.classList.remove("modal-open", "no-scroll", "overflow-hidden", "has-overlay");
      document.body.style.overflow = "auto";
      document.body.style.position = "";
    }
    if (document.documentElement) {
      document.documentElement.classList.remove("modal-open", "no-scroll", "overflow-hidden", "has-overlay");
      document.documentElement.style.overflow = "auto";
    }

    return {
      ok: true,
      removedCount: removed.size
    };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

async function cleanActivePage() {
  if (!browser.tabs || !browser.tabs.query || !browser.tabs.executeScript) {
    throw new Error("Firefox tabs API is unavailable.");
  }

  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || typeof activeTab.id !== "number") {
    throw new Error("Active tab was not found.");
  }

  const tabUrl = String(activeTab.url || "");
  if (/^(about:|moz-extension:|view-source:|chrome:)/i.test(tabUrl)) {
    throw new Error("This page does not allow cleanup script injection.");
  }

  const results = await browser.tabs.executeScript(activeTab.id, {
    code: `(${cleanPageInActiveTab.toString()})();`
  });
  const result = Array.isArray(results) ? results[0] : null;
  if (!result || result.ok !== true) {
    const reason = result && result.error ? result.error : "Cleanup script failed.";
    throw new Error(reason);
  }

  const count = Number(result.removedCount || 0);
  return {
    ok: true,
    output: count > 0
      ? `Сторінку очищено. Прибрано ${count} блок(ів).`
      : "Сторінку очищено. Видимих оверлеїв не знайдено."
  };
}

function extractAfterKeyword(input, pattern) {
  const match = String(input || "").match(pattern);
  if (!match || !match[1]) {
    return "";
  }
  return match[1].trim();
}

function buildRunCommand(command, args) {
  return {
    type: "runCommand",
    command,
    args: Array.isArray(args) ? args : []
  };
}

const KNOWN_DESTINATIONS = [
  {
    label: "YouTube",
    url: "https://www.youtube.com/",
    domains: ["youtube.com", "youtu.be"],
    aliases: ["youtube", "yt", "ютуб", "ютубі", "ютубом", "ютюб", "ютцб", "you tube", "ю туб"]
  },
  {
    label: "Telegram",
    url: "https://web.telegram.org/",
    domains: ["telegram.org", "t.me"],
    aliases: ["telegram", "телеграм", "телеграмі", "телеграмом", "телеграмм", "телега", "tg"]
  },
  {
    label: "GitHub",
    url: "https://github.com/",
    domains: ["github.com"],
    aliases: ["github", "гітхаб", "гитхаб"]
  },
  {
    label: "Gmail",
    url: "https://mail.google.com/",
    domains: ["mail.google.com"],
    aliases: ["gmail", "джімейл", "джимейл", "пошта гугл", "почта гугл"]
  },
  {
    label: "Google Drive",
    url: "https://drive.google.com/",
    domains: ["drive.google.com"],
    aliases: ["drive", "google drive", "гугл диск", "диск гугл"]
  },
  {
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    domains: ["chatgpt.com"],
    aliases: ["chatgpt", "gpt", "chat gpt", "чатгпт", "чат gpt", "джпт", "дджпт", "джіпіті", "джипити"]
  },
  {
    label: "DeepSeek",
    url: "https://chat.deepseek.com/",
    domains: ["deepseek.com"],
    aliases: ["deepseek", "deep seek", "діпсік", "дипсик", "діп сік", "deepsek"]
  },
  {
    label: "Pornhub",
    url: "https://www.pornhub.com/",
    domains: ["pornhub.com"],
    aliases: ["pornhub", "порнхаб", "порн хаб", "porn hub"]
  }
];

function normalizeNaturalText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}<>/\\|`~^%$#@*+=_"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWholePhrase(normalizedText, phrase) {
  if (!normalizedText || !phrase) {
    return false;
  }
  return ` ${normalizedText} `.includes(` ${normalizeNaturalText(phrase)} `);
}

function tokenizeNaturalWords(normalizedText) {
  return String(normalizedText || "")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);
}

function levenshteinDistance(a, b, maxDistance = Infinity) {
  const left = String(a || "");
  const right = String(b || "");
  if (left === right) {
    return 0;
  }
  if (!left.length) {
    return right.length;
  }
  if (!right.length) {
    return left.length;
  }

  const row = new Array(right.length + 1);
  for (let j = 0; j <= right.length; j += 1) {
    row[j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    let prevDiagonal = row[0];
    row[0] = i;
    let bestInRow = row[0];

    for (let j = 1; j <= right.length; j += 1) {
      const temp = row[j];
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prevDiagonal + substitutionCost
      );
      prevDiagonal = temp;
      if (row[j] < bestInRow) {
        bestInRow = row[j];
      }
    }

    if (bestInRow > maxDistance) {
      return maxDistance + 1;
    }
  }

  return row[right.length];
}

function stemUkrWord(word) {
  const w = normalizeNaturalText(word);
  if (!w) {
    return "";
  }
  // Strip common UA/RU endings so "ютубом/ютубі/телеграмі" still match.
  return w.replace(/(ами|ями|ах|ях|ом|ем|ою|ею|ою|ів|ей|ий|ій|ую|юю|ою|а|я|у|ю|и|і|і|е|о|й)$/u, "");
}

function fuzzyWordMatches(word, candidate) {
  const w = normalizeNaturalText(word);
  const c = normalizeNaturalText(candidate);
  if (!w || !c) {
    return false;
  }
  if (w === c) {
    return true;
  }
  const ws = stemUkrWord(w);
  const cs = stemUkrWord(c);
  if (ws && cs && (ws === cs || ws.startsWith(cs) || cs.startsWith(ws))) {
    return Math.min(ws.length, cs.length) >= 3;
  }
  if (Math.abs(w.length - c.length) > 2) {
    return false;
  }
  const maxDistance = c.length <= 4 ? 1 : 2;
  return levenshteinDistance(w, c, maxDistance) <= maxDistance;
}

function detectKnownDestination(normalizedText) {
  const words = tokenizeNaturalWords(normalizedText);
  let bestMatch = null;

  for (const item of KNOWN_DESTINATIONS) {
    for (const alias of item.aliases) {
      const normalizedAlias = normalizeNaturalText(alias);
      if (!normalizedAlias) {
        continue;
      }

      if (hasWholePhrase(normalizedText, normalizedAlias)) {
        return item;
      }

      const aliasWords = tokenizeNaturalWords(normalizedAlias);
      if (aliasWords.length === 1) {
        for (const word of words) {
          if (fuzzyWordMatches(word, aliasWords[0])) {
            if (!bestMatch || bestMatch.score < 0.85) {
              bestMatch = { item, score: 0.85 };
            }
          }
        }
        continue;
      }

      let matchedWords = 0;
      for (const aliasWord of aliasWords) {
        const hasNearWord = words.some((word) => fuzzyWordMatches(word, aliasWord));
        if (hasNearWord) {
          matchedWords += 1;
        }
      }
      const phraseScore = matchedWords / aliasWords.length;
      if (phraseScore >= 0.8 && (!bestMatch || bestMatch.score < phraseScore)) {
        bestMatch = { item, score: phraseScore };
      }
    }
  }
  return bestMatch ? bestMatch.item : null;
}

function detectAllKnownDestinations(normalizedText) {
  const words = tokenizeNaturalWords(normalizedText);
  const hits = [];

  function destinationAlreadyAdded(label) {
    return hits.some((item) => item.label === label);
  }

  for (const item of KNOWN_DESTINATIONS) {
    if (destinationAlreadyAdded(item.label)) {
      continue;
    }

    let matched = false;
    for (const alias of item.aliases) {
      const normalizedAlias = normalizeNaturalText(alias);
      if (!normalizedAlias) {
        continue;
      }

      if (hasWholePhrase(normalizedText, normalizedAlias)) {
        matched = true;
        break;
      }

      const aliasWords = tokenizeNaturalWords(normalizedAlias);
      if (aliasWords.length === 1) {
        matched = words.some((word) => fuzzyWordMatches(word, aliasWords[0]));
      } else {
        let matchedWords = 0;
        for (const aliasWord of aliasWords) {
          if (words.some((word) => fuzzyWordMatches(word, aliasWord))) {
            matchedWords += 1;
          }
        }
        matched = matchedWords / aliasWords.length >= 0.8;
      }

      if (matched) {
        break;
      }
    }

    if (matched) {
      hits.push(item);
    }
  }

  return hits;
}

function stripOpenIntentPrefix(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(
    /^(?:будь\s*ласка\s+|пліз\s+|please\s+)?(?:хочу|хотів(?:\s*би)?|мені\s+треба|потрібно|нужно|want|need|open|відкрий|зайди|увійди|перейди|go\s*to|launch|show)\s+/i,
    ""
  ).trim();
}

function isNoiseOpenTarget(target) {
  const normalized = normalizeNaturalText(target);
  if (!normalized) {
    return true;
  }
  if (/^\d+$/.test(normalized)) {
    return true;
  }
  return hasAnyLoosePhrase(normalized, [
    "потім", "then", "закрий", "закрити", "close", "вкладку", "вкладки", "вкладок",
    "tab", "tabs", "і", "та", "й", "and", "з", "із", "на", "в", "у"
  ]);
}

function extractTabCount(input) {
  const text = String(input || "");
  const match =
    text.match(/(?:відкрий|open|запусти)\s+(\d{1,2})\s*(?:вкладк(?:и|у|ок)?|tabs?|вікон(?:а|о)?)/iu) ||
    text.match(/(\d{1,2})\s*(?:вкладк(?:и|у|ок)?|tabs?)/iu);
  if (!match) {
    return 1;
  }
  const count = Number.parseInt(match[1], 10);
  if (!Number.isFinite(count) || count < 1) {
    return 1;
  }
  return Math.min(count, 10);
}

function splitOpenTargets(input) {
  const base = stripOpenIntentPrefix(input);
  if (!base) {
    return [];
  }

  // Keep sequenced close/search clauses out of open-target splitting.
  const openOnly = base.split(/\s+(?:а\s+потім|і\s+потім|потім|then)\s+/iu)[0] || base;

  const normalizedJoiners = openOnly
    .replace(/\s+(?:and|і|й|та|plus)\s+/giu, ", ");

  return normalizedJoiners
    .split(/\s*,\s*|\s*;\s*|\s*\+\s*/)
    .map((part) => part.trim())
    .filter((part) => part && !isNoiseOpenTarget(part));
}

function resolveOpenEntryFromTarget(target) {
  const cleaned = String(target || "").trim();
  if (!cleaned || isNoiseOpenTarget(cleaned)) {
    return null;
  }

  const asUrl = toHttpUrl(cleaned);
  if (asUrl) {
    return { url: asUrl, source: "url" };
  }

  const known = detectKnownDestination(normalizeNaturalText(cleaned));
  if (known) {
    return { url: known.url, source: known.label };
  }

  // Never ducky-open command leftovers like "2 вкладки з ..."
  if (/(вкладк|tab|потім|закри|close|відкрий|open)/iu.test(cleaned)) {
    return null;
  }

  return { url: buildDuckyOpenUrl(cleaned), source: `ducky:${cleaned}` };
}

function buildOpenEntriesFromInput(input) {
  const normalized = normalizeNaturalText(input);
  const knownDestinations = detectAllKnownDestinations(normalized);
  const tabCount = extractTabCount(input);

  if (knownDestinations.length >= 2) {
    return knownDestinations.map((item) => ({ url: item.url, source: item.label }));
  }

  if (knownDestinations.length === 1) {
    const item = knownDestinations[0];
    const entries = [];
    for (let i = 0; i < tabCount; i += 1) {
      entries.push({ url: item.url, source: item.label });
    }
    return entries;
  }

  const splitTargets = splitOpenTargets(input);
  if (splitTargets.length > 0) {
    const entries = [];
    for (const target of splitTargets) {
      const entry = resolveOpenEntryFromTarget(target);
      if (entry && !String(entry.source || "").startsWith("ducky:")) {
        entries.push(entry);
      }
    }
    if (entries.length > 0) {
      return entries;
    }
  }

  return [];
}

function parseCountedOpenAndMaybeClose(input) {
  const text = String(input || "").trim();
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  const hasOpen = hasAnyLoosePhrase(lower, ["відкрий", "open", "запусти", "хочу", "потрібно"]);
  if (!hasOpen) {
    return null;
  }

  // Do not steal content-search intents like "відкрий в ютубі відео про X".
  const hasTabCountPhrase = /(\d{1,2})\s*(?:вкладк(?:и|у|ок)?|tabs?)/iu.test(text);
  const hasContentCue =
    hasAnyLoosePhrase(lower, ["відео", "статтю", "стаття", "шо таке", "що таке", "про"]) ||
    SEARCH_KEYWORD_RE.test(text);
  if (hasContentCue && !hasTabCountPhrase) {
    return null;
  }

  const destinations = detectAllKnownDestinations(normalizeNaturalText(text));
  if (destinations.length === 0) {
    return null;
  }

  // Require either explicit tab count, sequenced close, or multiple destinations.
  const wantsClose = hasAnyLoosePhrase(lower, ["закрий", "закрити", "close"]) || /закри/i.test(lower);
  if (!hasTabCountPhrase && !wantsClose && destinations.length < 2) {
    return null;
  }

  const tabCount = extractTabCount(text);
  const openEntries = [];
  if (destinations.length === 1) {
    for (let i = 0; i < tabCount; i += 1) {
      openEntries.push({ url: destinations[0].url, source: destinations[0].label });
    }
  } else {
    for (const item of destinations) {
      openEntries.push({ url: item.url, source: item.label });
    }
  }

  const steps = [];
  if (openEntries.length === 1) {
    steps.push({
      interpretation: `open ${openEntries[0].source}`,
      request: { type: "openTab", url: openEntries[0].url, source: openEntries[0].source }
    });
  } else {
    steps.push({
      interpretation: `open ${openEntries.length} tabs`,
      request: { type: "openManyTabs", entries: openEntries }
    });
  }

  if (wantsClose) {
    const closeSegmentMatch = text.match(/(?:потім|then|і\s+потім|а\s+потім)\s+(.*)$/iu);
    const closeSegment = closeSegmentMatch ? closeSegmentMatch[1] : text;
    const closeTargets = detectAllKnownDestinations(normalizeNaturalText(closeSegment));
    if (closeTargets.length > 0) {
      steps.push({
        interpretation: `close ${closeTargets.map((item) => item.label).join(", ")}`,
        request: { type: "closeTabsByDestination", labels: closeTargets.map((item) => item.label) }
      });
    } else if (destinations.length === 1) {
      // "відкрий 2 ютуб і потім закрий" => close those youtube tabs
      steps.push({
        interpretation: `close ${destinations[0].label}`,
        request: { type: "closeTabsByDestination", labels: [destinations[0].label] }
      });
    } else {
      steps.push({
        interpretation: "close active tab",
        request: { type: "closeActiveTab" }
      });
    }
  }

  if (steps.length === 1) {
    return { ...steps[0], confidence: 0.97 };
  }
  return {
    interpretation: steps.map((step) => step.interpretation).join(" + "),
    confidence: 0.97,
    request: { type: "actionPlan", steps: steps.map((step) => step.request) }
  };
}

function findDestinationByLabel(label) {
  const normalizedLabel = normalizeNaturalText(label);
  return KNOWN_DESTINATIONS.find((item) => normalizeNaturalText(item.label) === normalizedLabel) || null;
}

function getSourceLabelFromEntry(entry) {
  if (!entry || !entry.source) {
    return "";
  }
  if (typeof entry.source === "string" && entry.source.startsWith("ducky:")) {
    return "";
  }
  return String(entry.source);
}

const SEARCH_KEYWORD_RE = /(search|google|гугл(?:и)?|загугли|погугли|гугли|знайди|найди|find|пошук|пошукай)/i;

function findSearchKeywordIndex(input) {
  const text = String(input || "");
  const match = SEARCH_KEYWORD_RE.exec(text);
  return match ? match.index : -1;
}

function getTextBeforeSearchIntent(input) {
  const text = String(input || "");
  const idx = findSearchKeywordIndex(text);
  if (idx < 0) {
    return text;
  }
  return text.slice(0, idx).trim();
}

function hasLoosePhrase(text, phrase) {
  const hay = ` ${normalizeNaturalText(text)} `;
  const needle = ` ${normalizeNaturalText(phrase)} `;
  return Boolean(String(phrase || "").trim()) && hay.includes(needle);
}

function hasAnyLoosePhrase(text, phrases) {
  return phrases.some((phrase) => hasLoosePhrase(text, phrase));
}

function detectSearchScope(input) {
  const lower = String(input || "").toLowerCase();
  if (hasAnyLoosePhrase(lower, ["вікіпедії", "вікіпедія", "вікі", "википедии", "wikipedia", "wiki"]) || /вікіпед|википед/i.test(lower)) {
    return "wikipedia";
  }
  if (hasAnyLoosePhrase(lower, ["ютубі", "ютюбі", "ютуб", "ютюб", "youtube", "yt"])) {
    return "youtube";
  }
  if (hasAnyLoosePhrase(lower, ["гітхабі", "гітхаб", "github"])) {
    return "github";
  }
  return "google";
}

function sanitizeSearchQuery(rawQuery) {
  let query = String(rawQuery || "").trim();
  if (!query) {
    return "";
  }

  query = query
    .replace(/^(?:мені|будь\s*ласка|пліз|please)\s+/iu, "")
    .replace(/^(?:знайди|найди|find|search|пошук|пошукай|google|гугл(?:и)?|загугли|погугли|гугли)\s+/iu, "")
    .replace(/(?:^|\s)(?:відкрий|open|зайди|перейди|покажи|show|launch)(?=\s|$)/giu, " ")
    .replace(/(?:^|\s)(?:в|у|на)\s*(?:вікіпедії|вікі|википедии|wikipedia|wiki|ютубі|ютюбі|youtube|yt|гітхабі|github|гуглі|google)(?=\s|$)/giu, " ")
    .replace(/(?:^|\s)(?:вікіпедія|wikipedia|wiki|ютуб|ютюб|youtube|гітхаб|github)(?=\s|$)/giu, " ")
    .replace(/(?:^|\s)(?:відео|video|статт(?:ю|я|і)|article)(?=\s|$)/giu, " ")
    .replace(/^(?:про|about)\s+/iu, "")
    .replace(/^(?:шо|що)\s+таке\s+/iu, "")
    .replace(/^(?:шо|що)\s+/iu, "")
    .replace(/\s+/g, " ")
    .trim();

  return query;
}

function buildSearchRequest(scope, query) {
  if (scope === "wikipedia") {
    return {
      interpretation: "search on Wikipedia",
      request: { type: "openTab", url: buildWikipediaSearchUrl(query), source: "wikipedia-search" }
    };
  }
  if (scope === "youtube") {
    return {
      interpretation: "search on YouTube",
      request: { type: "openTab", url: buildYouTubeSearchUrl(query), source: "youtube-search" }
    };
  }
  if (scope === "github") {
    return {
      interpretation: "search on GitHub",
      request: { type: "openTab", url: buildGitHubSearchUrl(query), source: "github-search" }
    };
  }
  return {
    interpretation: "google search",
    request: { type: "googleSearch", query }
  };
}

function parseSearchIntent(input) {
  const text = String(input || "").trim();
  if (!text) {
    return null;
  }

  const hasExplicitSearchWord = SEARCH_KEYWORD_RE.test(text);
  const hasQuestionIntent = hasAnyLoosePhrase(text, ["шо таке", "що таке", "what is", "how to"]) ||
    hasAnyLoosePhrase(text, ["як", "чому", "коли", "де", "хто", "why"]);
  const hasTopicCue =
    (hasAnyLoosePhrase(text, ["відео", "video", "стаття", "статтю", "article"]) && hasAnyLoosePhrase(text, ["про", "about"])) ||
    /(?:^|\s)(?:про|about)\s+\S+/iu.test(text);
  if (!hasExplicitSearchWord && !hasQuestionIntent && !hasTopicCue) {
    return null;
  }

  const raw = extractAfterKeyword(text, /(?:search|google|гугл(?:и)?|загугли|погугли|гугли|знайди|найди|find|пошук|пошукай)\s+(?:for\s+)?(.+)/iu) || text;
  const scope = detectSearchScope(text);
  const query = sanitizeSearchQuery(raw) || extractTopicQuery(text);
  if (!query) {
    return buildSearchRequest(scope, sanitizeSearchQuery(text) || text);
  }
  return buildSearchRequest(scope, query);
}

function extractTopicQuery(input) {
  const text = String(input || "").trim();
  const patterns = [
    /(?:відео|video|статт(?:ю|я|і)|article)?\s*(?:про|about)\s+(.+)$/iu,
    /(?:шо|що)\s+таке\s+(.+)$/iu,
    /(?:what\s+is)\s+(.+)$/iu
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return sanitizeSearchQuery(match[1]);
    }
  }
  return "";
}

function parseScopedContentSearch(input) {
  const text = String(input || "").trim();
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();

  const hasContentCue =
    SEARCH_KEYWORD_RE.test(text) ||
    hasAnyLoosePhrase(lower, ["відео", "video", "стаття", "статтю", "article", "шо таке", "що таке", "what is"]) ||
    /(?:^|\s)(?:про|about)\s+\S+/iu.test(lower);

  if (!hasContentCue) {
    return null;
  }

  const idx = findSearchKeywordIndex(text);
  const scopeSource = idx >= 0 ? text.slice(idx) : text;
  let engine = null;

  if (hasAnyLoosePhrase(scopeSource, ["вікіпедії", "вікіпедія", "вікі", "wikipedia", "wiki"]) || /вікіпед|википед/i.test(scopeSource)) {
    engine = "wikipedia";
  } else if (hasAnyLoosePhrase(scopeSource, ["ютубі", "ютюбі", "ютуб", "ютюб", "youtube", "yt"])) {
    engine = "youtube";
  } else if (hasAnyLoosePhrase(scopeSource, ["гітхабі", "гітхаб", "github"])) {
    engine = "github";
  } else if (hasAnyLoosePhrase(scopeSource, ["загугли", "погугли", "гугли", "гугл", "google"])) {
    engine = "google";
  } else if (hasAnyLoosePhrase(lower, ["вікіпедії", "вікіпедія", "вікі", "wikipedia", "wiki"]) || /вікіпед|википед/i.test(lower)) {
    engine = "wikipedia";
  } else if (hasAnyLoosePhrase(lower, ["ютубі", "ютюбі", "ютуб", "ютюб", "youtube", "yt"])) {
    engine = "youtube";
  } else if (hasAnyLoosePhrase(lower, ["гітхабі", "гітхаб", "github"])) {
    engine = "github";
  } else if (hasAnyLoosePhrase(lower, ["загугли", "погугли", "гугли", "гугл", "google"])) {
    engine = "google";
  }

  if (!engine && !SEARCH_KEYWORD_RE.test(text) && !hasAnyLoosePhrase(lower, ["шо таке", "що таке", "what is"])) {
    return null;
  }
  if (!engine) {
    engine = "google";
  }

  let query = extractTopicQuery(text);
  if (!query) {
    query = sanitizeSearchQuery(text);
  }
  if (!query || query.length < 2) {
    return null;
  }

  if (
    detectKnownDestination(normalizeNaturalText(query)) &&
    !hasAnyLoosePhrase(lower, ["про", "about", "шо таке", "що таке", "what is"])
  ) {
    return null;
  }

  return buildSearchRequest(engine, query);
}

function parseTabOrdinal(input) {
  const lower = normalizeNaturalText(input);
  if (!lower) {
    return null;
  }
  if (hasAnyLoosePhrase(lower, ["останн", "last"])) {
    return -1;
  }
  const map = [
    { n: 1, words: ["перш", "1", "one", "first"] },
    { n: 2, words: ["друг", "втор", "2", "two", "second"] },
    { n: 3, words: ["трет", "3", "three", "third"] },
    { n: 4, words: ["четверт", "4", "four", "fourth"] },
    { n: 5, words: ["п\'ят", "пят", "5", "five", "fifth"] }
  ];
  for (const item of map) {
    if (item.words.some((word) => lower.includes(word))) {
      return item.n;
    }
  }
  const digit = lower.match(/(?:вкладк\w*\s*)?(\d{1,2})(?:\s*[-.]?\s*(?:у|ю|а|у|ту|гу))?/);
  if (digit) {
    const n = Number.parseInt(digit[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 20) {
      return n;
    }
  }
  return null;
}

function parseKeepTabExceptIntent(input) {
  const text = String(input || "").trim();
  const lower = text.toLowerCase();
  if (!text) {
    return null;
  }

  const hasCloseAll =
    (/закри/i.test(lower) || /\bclose\b/i.test(lower)) &&
    (hasAnyLoosePhrase(lower, ["все", "усі", "всі", "всіх", "усіх", "all", "everything", "остальн", "інші", "other"]) ||
      /крім|окрім|кроме|except|aside from|but keep/i.test(lower));

  const hasExcept = /крім|окрім|кроме|except|aside from|but keep|leave|лиш|залиш/i.test(lower);
  if (!hasCloseAll && !hasExcept) {
    return null;
  }
  if (!/закри|close|лиш|залиш|keep|except|крім|окрім/i.test(lower)) {
    return null;
  }

  // "закрий все крім першої вкладки" / "close all except first tab"
  let keepIndex = 1;
  const exceptPart =
    (text.match(/(?:крім|окрім|кроме|except|aside from|but keep|leave|лиш|залиш)\s+(.+)$/iu) || [])[1] ||
    text;
  const ordinal = parseTabOrdinal(exceptPart);
  if (ordinal === -1) {
    keepIndex = -1;
  } else if (ordinal) {
    keepIndex = ordinal;
  } else if (/активн|current|цю|this/i.test(exceptPart)) {
    keepIndex = 0; // keep active
  }

  return {
    interpretation:
      keepIndex === 0
        ? "close all tabs except active"
        : keepIndex === -1
          ? "close all tabs except last"
          : `close all tabs except #${keepIndex}`,
    confidence: 0.99,
    request: {
      type: "closeTabsKeepIndex",
      keepIndex,
      currentWindow: true
    }
  };
}

function parseCloseIntent(input) {
  const text = String(input || "");
  const lower = text.toLowerCase();
  if (!hasAnyLoosePhrase(lower, ["close", "закрий", "закрити", "close it", "close tab"]) && !/закри/i.test(lower)) {
    return null;
  }

  // If phrase also asks to open something, let sequenced planner handle it.
  if (hasAnyLoosePhrase(lower, ["відкрий", "open", "запусти", "хочу"]) && /потім|then/i.test(lower)) {
    return null;
  }

  const keepExcept = parseKeepTabExceptIntent(text);
  if (keepExcept) {
    return keepExcept;
  }

  const closeStart = text.search(/(?:close|закрий|закрити)/i);
  const afterClose = closeStart >= 0 ? text.slice(closeStart) : text;
  const closeSegment = afterClose.split(/\s+(?:і|and|then|потім)\s+(?:open|відкрий|зайди|перейди|search|знайди|пошук|google|загугли)/i)[0] || afterClose;
  const normalized = normalizeNaturalText(closeSegment);
  const targets = detectAllKnownDestinations(normalized);
  const ordinal = parseTabOrdinal(closeSegment);

  if (targets.length > 0) {
    return {
      interpretation: ordinal
        ? `close ${ordinal === -1 ? "last" : ordinal} ${targets[0].label} tab`
        : `close ${targets.map((item) => item.label).join(", ")}`,
      request: {
        type: "closeTabsByDestination",
        labels: targets.map((item) => item.label),
        index: ordinal
      }
    };
  }

  if (ordinal) {
    return {
      interpretation: `close tab #${ordinal === -1 ? "last" : ordinal}`,
      request: { type: "closeTabByIndex", index: ordinal }
    };
  }

  // "закрий всі вкладки"
  if (hasAnyLoosePhrase(lower, ["все", "усі", "всі", "all", "everything"]) && hasAnyLoosePhrase(lower, ["вкладк", "tabs", "tab"])) {
    return {
      interpretation: "close all tabs except first",
      confidence: 0.9,
      request: { type: "closeTabsKeepIndex", keepIndex: 1, currentWindow: true }
    };
  }

  return {
    interpretation: "close active tab",
    request: { type: "closeActiveTab" }
  };
}

function formatRequestPreview(request) {
  if (!request || typeof request !== "object") {
    return "unknown";
  }
  if (request.type === "noop") {
    return "do nothing";
  }
  if (request.type === "openSidebar") {
    return "open side terminal";
  }
  if (request.type === "clearHistory") {
    const period = request.period || "all";
    if (period === "today") {
      return "history clear today";
    }
    if (period === "hour") {
      return "history clear hour";
    }
    if (period === "week") {
      return "history clear week";
    }
    return "history -clear";
  }
  if (request.type === "cleanPage") {
    return "clean page";
  }
  if (request.type === "openTab") {
    return `open ${request.url || "-"}`;
  }
  if (request.type === "openManyTabs") {
    const entries = Array.isArray(request.entries) ? request.entries : [];
    return `open ${entries.length} tabs`;
  }
  if (request.type === "closeActiveTab") {
    return "close active tab";
  }
  if (request.type === "closeTabsByDestination") {
    const labels = Array.isArray(request.labels) ? request.labels : [];
    return `close ${labels.join(", ") || "matched tabs"}`;
  }
  if (request.type === "closeTabsKeepIndex") {
    const keep = Number(request.keepIndex);
    if (keep === 0) {
      return "close all except active";
    }
    if (keep === -1) {
      return "close all except last";
    }
    return `close all except #${keep || 1}`;
  }
  if (request.type === "actionPlan") {
    const steps = Array.isArray(request.steps) ? request.steps : [];
    return `run plan (${steps.length} steps)`;
  }
  if (request.type === "googleSearch") {
    return `google ${request.query || ""}`.trim();
  }
  if (request.type === "askChatGpt") {
    return `ask ${request.query || ""}`.trim();
  }
  if (request.type === "runCommand") {
    const args = Array.isArray(request.args) ? request.args : [];
    return `${request.command || "cmd"} ${args.join(" ")}`.trim();
  }
  return "unknown";
}

function parseAiCommandInput(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) {
    throw new Error("AI parser: empty input.");
  }

  const tokens = tokenizeCommandLine(input);
  const first = tokens[0] ? tokens[0].toLowerCase() : "";
  if (first === "ff" || first === "ser" || first === "gask" || first === "youtube" || first === "sites") {
    return {
      interpretation: "raw command detected",
      request: parseOmniboxInput(input)
    };
  }

  const lower = input.toLowerCase();
  const hasOpenVerb = /(open|відкрий|перейди|запусти|launch|go to|show)\b/i.test(lower);
  const hasWantVerb = /(хочу|мені треба|потрібно|нужно|want|need)/i.test(lower);
  const hasEnterVerb = /(зайди|увійди|відкрий|open|go|enter)/i.test(lower);
  const wantsClearPage = hasAnyLoosePhrase(lower, [
    "clear", "очисти", "почисти", "прибери", "прибрати", "видали", "hide", "remove"
  ]) || /очист|прибер/i.test(lower);
  const normalized = normalizeNaturalText(input);
  const words = tokenizeNaturalWords(normalized);
  const implicitDirectIntent = words.length > 0 && words.length <= 3;
  const closeIntent = parseCloseIntent(input);
  const clearHistoryIntent = parseClearHistoryIntent(input);
  const scopedContent = parseScopedContentSearch(input);
  const searchIntent = scopedContent || parseSearchIntent(input);

  if (/(side\s*terminal|sidebar|terminal panel|боков(ий|а)\s+термінал|бокова\s+панель)/i.test(lower)) {
    return {
      interpretation: "open side terminal",
      request: { type: "openSidebar" }
    };
  }

  if (clearHistoryIntent) {
    return clearHistoryIntent;
  }

  if (wantsClearPage && hasAnyLoosePhrase(lower, ["page", "сторінку", "сторінка", "сайт", "popup", "cookie", "банер", "overlay", "modal", "модал", "consent", "gdpr"])) {
    return {
      interpretation: "clean active page overlays",
      request: { type: "cleanPage" }
    };
  }

  // Pure content search on a platform: "відкрий в ютубі відео про X", "найди у вікіпедії про X"
  if (scopedContent && !closeIntent) {
    const prefix = getTextBeforeSearchIntent(input);
    const extraOpens = detectAllKnownDestinations(normalizeNaturalText(prefix))
      .filter((item) => {
        if (scopedContent.interpretation.includes("YouTube") && item.label === "YouTube") {
          return false;
        }
        if (scopedContent.interpretation.includes("Wikipedia") && item.label === "Wikipedia") {
          return false;
        }
        if (scopedContent.interpretation.includes("GitHub") && item.label === "GitHub") {
          return false;
        }
        return true;
      })
      .map((item) => ({ url: item.url, source: item.label }));

    if (extraOpens.length === 0) {
      return scopedContent;
    }

    const steps = [];
    if (extraOpens.length === 1) {
      steps.push({
        interpretation: `open ${extraOpens[0].source}`,
        request: { type: "openTab", url: extraOpens[0].url, source: extraOpens[0].source }
      });
    } else if (extraOpens.length > 1) {
      steps.push({
        interpretation: `open ${extraOpens.length} targets`,
        request: { type: "openManyTabs", entries: extraOpens }
      });
    }
    steps.push(scopedContent);
    return {
      interpretation: steps.map((step) => step.interpretation).join(" + "),
      request: { type: "actionPlan", steps: steps.map((step) => step.request) }
    };
  }

  const askQuery = extractAfterKeyword(input, /(?:ask|спитай|запитай|питай)\s+(?:chatgpt|gpt|ai)?\s*(.+)/i);
  if (askQuery) {
    return {
      interpretation: "ask ChatGPT",
      request: { type: "askChatGpt", query: askQuery }
    };
  }

  if ((hasOpenVerb || hasEnterVerb || hasWantVerb) && /(?:fox\s*hub|site\s*hub|sites\s*hub|фокс\s*хаб)/i.test(lower)) {
    return {
      interpretation: "open Fox Hub",
      request: buildRunCommand("sites", ["-Main"])
    };
  }

  if (hasOpenVerb && /(site|сайт)/i.test(lower) && /(folder|папк|editor|vscode|код)/i.test(lower)) {
    const folderMatch = lower.match(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/);
    if (!folderMatch) {
      throw new Error("AI parser: specify site folder, e.g. 'open site folder fox-utils'.");
    }
    return {
      interpretation: "open site folder in editor",
      request: buildRunCommand("sites", ["-open", folderMatch[0]])
    };
  }

  const steps = [];
  if (closeIntent) {
    steps.push(closeIntent);
  }

  let openEntries = [];
  const shouldOpenDirectly = hasOpenVerb || hasWantVerb || hasEnterVerb || implicitDirectIntent;
  if (searchIntent) {
    const prefix = getTextBeforeSearchIntent(input);
    const prefixDestinations = detectAllKnownDestinations(normalizeNaturalText(prefix));
    if (prefixDestinations.length > 0) {
      openEntries = prefixDestinations.map((item) => ({ url: item.url, source: item.label }));
      if (searchIntent.interpretation.includes("YouTube")) {
        openEntries = openEntries.filter((entry) => getSourceLabelFromEntry(entry) !== "YouTube");
      }
      if (searchIntent.interpretation.includes("Wikipedia")) {
        openEntries = openEntries.filter((entry) => getSourceLabelFromEntry(entry) !== "Wikipedia");
      }
      if (searchIntent.interpretation.includes("GitHub")) {
        openEntries = openEntries.filter((entry) => getSourceLabelFromEntry(entry) !== "GitHub");
      }
    }
  }

  if (openEntries.length === 0 && shouldOpenDirectly) {
    openEntries = buildOpenEntriesFromInput(input);
    if (searchIntent) {
      openEntries = openEntries.filter((entry) => Boolean(getSourceLabelFromEntry(entry)));
    }
  }

  if (openEntries.length > 1) {
    steps.push({
      interpretation: `open ${openEntries.length} targets`,
      request: { type: "openManyTabs", entries: openEntries }
    });
  } else if (openEntries.length === 1) {
    const entry = openEntries[0];
    steps.push({
      interpretation: `open ${getSourceLabelFromEntry(entry) || "target"}`,
      request: { type: "openTab", url: entry.url, source: entry.source }
    });
  }

  if (searchIntent) {
    steps.push(searchIntent);
  }

  if (steps.length > 1) {
    return {
      interpretation: steps.map((step) => step.interpretation).join(" + "),
      request: { type: "actionPlan", steps: steps.map((step) => step.request) }
    };
  }

  if (steps.length === 1) {
    return {
      interpretation: steps[0].interpretation,
      request: steps[0].request
    };
  }

  const fallbackScope = detectSearchScope(input);
  const fallbackQuery = sanitizeSearchQuery(input) || input;
  return buildSearchRequest(fallbackScope, fallbackQuery);
}

async function executeRequest(request) {
  if (!request || typeof request !== "object") {
    throw new Error("Invalid request.");
  }

  if (request.type === "actionPlan") {
    const steps = Array.isArray(request.steps) ? request.steps : [];
    if (steps.length === 0) {
      throw new Error("Action plan is empty.");
    }

    const outputs = [];
    for (const step of steps) {
      const stepResult = await executeRequest(step);
      if (stepResult && stepResult.output) {
        outputs.push(stepResult.output);
      } else {
        outputs.push(`Done: ${formatRequestPreview(step)}`);
      }
    }

    return {
      ok: true,
      output: outputs.join("\n")
    };
  }

  if (request.type === "noop") {
    return { ok: true, output: "Нічого не зроблено." };
  }

  if (request.type === "openSidebar") {
    await openSideTerminal();
    return { ok: true, output: "Side terminal відкрито." };
  }

  if (request.type === "clearHistory") {
    return clearFirefoxHistory({
      since: request.since,
      period: request.period || "all"
    });
  }

  if (request.type === "cleanPage") {
    return cleanActivePage();
  }

  if (request.type === "closeActiveTab") {
    if (!browser.tabs || !browser.tabs.query || !browser.tabs.remove) {
      throw new Error("Firefox tabs API is unavailable.");
    }
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || typeof activeTab.id !== "number") {
      throw new Error("Active tab was not found.");
    }
    await browser.tabs.remove(activeTab.id);
    return { ok: true, output: "Active tab closed." };
  }

  if (request.type === "closeTabsKeepIndex") {
    if (!browser.tabs || !browser.tabs.query || !browser.tabs.remove) {
      throw new Error("Firefox tabs API is unavailable.");
    }
    const query = request.currentWindow === false ? {} : { currentWindow: true };
    const tabs = (await browser.tabs.query(query))
      .slice()
      .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
    if (tabs.length <= 1) {
      return { ok: true, output: "Nothing to close (only one tab)." };
    }

    let keepIndex = Number(request.keepIndex);
    if (!Number.isFinite(keepIndex)) {
      keepIndex = 1;
    }

    let keepTab = null;
    if (keepIndex === 0) {
      keepTab = tabs.find((tab) => tab.active) || tabs[0];
    } else if (keepIndex === -1) {
      keepTab = tabs[tabs.length - 1];
    } else if (keepIndex >= 1 && keepIndex <= tabs.length) {
      keepTab = tabs[keepIndex - 1];
    } else {
      throw new Error(`Cannot keep tab #${keepIndex}: only ${tabs.length} tab(s).`);
    }

    const idsToClose = tabs
      .filter((tab) => tab.id !== keepTab.id)
      .map((tab) => tab.id)
      .filter((id) => typeof id === "number");

    if (idsToClose.length === 0) {
      return { ok: true, output: "Nothing to close." };
    }

    await browser.tabs.remove(idsToClose);
    if (typeof keepTab.id === "number") {
      try {
        await browser.tabs.update(keepTab.id, { active: true });
      } catch (_) {
        // ignore focus errors
      }
    }
    return {
      ok: true,
      output: `Closed ${idsToClose.length} tab(s), kept: ${keepTab.title || keepTab.url || "selected tab"}.`
    };
  }

  if (request.type === "closeTabsByDestination") {
    if (!browser.tabs || !browser.tabs.query || !browser.tabs.remove) {
      throw new Error("Firefox tabs API is unavailable.");
    }
    const labels = Array.isArray(request.labels) ? request.labels : [];
    const domains = [];
    for (const label of labels) {
      const item = findDestinationByLabel(label);
      if (item && Array.isArray(item.domains)) {
        domains.push(...item.domains);
      }
    }

    if (domains.length === 0) {
      throw new Error("No destination domains found to close.");
    }

    const tabs = await browser.tabs.query({});
    const matched = tabs
      .filter((tab) => {
        const url = String(tab.url || "").toLowerCase();
        return domains.some((domain) => url.includes(domain.toLowerCase()));
      })
      .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));

    if (matched.length === 0) {
      return { ok: true, output: "No matching tabs to close." };
    }

    let idsToClose = matched.map((tab) => tab.id).filter((id) => typeof id === "number");
    const index = Number(request.index);
    if (Number.isFinite(index) && index !== 0) {
      if (index === -1) {
        idsToClose = [matched[matched.length - 1].id].filter((id) => typeof id === "number");
      } else if (index >= 1 && index <= matched.length) {
        idsToClose = [matched[index - 1].id].filter((id) => typeof id === "number");
      } else {
        return { ok: false, error: `Немає ${index}-ї вкладки серед ${labels.join(", ")} (знайдено ${matched.length}).` };
      }
    }

    if (idsToClose.length === 0) {
      return { ok: true, output: "No matching tabs to close." };
    }

    await browser.tabs.remove(idsToClose);
    return { ok: true, output: `Closed ${idsToClose.length} tab(s).` };
  }

  if (request.type === "closeTabByIndex") {
    if (!browser.tabs || !browser.tabs.query || !browser.tabs.remove) {
      throw new Error("Firefox tabs API is unavailable.");
    }
    const tabs = (await browser.tabs.query({ currentWindow: true }))
      .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
    if (tabs.length === 0) {
      return { ok: true, output: "No tabs to close." };
    }
    const index = Number(request.index);
    let target = null;
    if (index === -1) {
      target = tabs[tabs.length - 1];
    } else if (Number.isFinite(index) && index >= 1 && index <= tabs.length) {
      target = tabs[index - 1];
    }
    if (!target || typeof target.id !== "number") {
      throw new Error("Tab index not found.");
    }
    await browser.tabs.remove(target.id);
    return { ok: true, output: `Closed tab #${index === -1 ? "last" : index}.` };
  }

  if (request.type === "openTab") {
    const url = toHttpUrl(request.url);
    if (!url) {
      throw new Error("Cannot open tab: invalid URL.");
    }
    return openBrowserTab(url);
  }

  if (request.type === "openManyTabs") {
    const entries = Array.isArray(request.entries) ? request.entries : [];
    if (entries.length === 0) {
      throw new Error("No tabs to open.");
    }

    const openedUrls = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index] || {};
      const url = toHttpUrl(entry.url);
      if (!url) {
        continue;
      }
      await browser.tabs.create({ url, active: index === 0 });
      openedUrls.push(url);
    }

    if (openedUrls.length === 0) {
      throw new Error("Cannot open tabs: all targets invalid.");
    }

    return {
      ok: true,
      output: `Opened ${openedUrls.length} tabs:\n${openedUrls.join("\n")}`
    };
  }

  if (request.type === "googleSearch") {
    const query = String(request.query || "").trim();
    if (!query) {
      throw new Error("Google search query is empty.");
    }
    return openBrowserTab(buildGoogleSearchUrl(query));
  }

  if (request.type === "askChatGpt") {
    const query = String(request.query || "").trim();
    return openBrowserTab(buildChatGptUrl(query));
  }

  if (request.type === "runCommand") {
    const response = await runNativeCommand(request.command, request.args);
    return {
      ok: true,
      output: response.output || `Виконано: ${formatRequestPreview(request)}`
    };
  }

  throw new Error("Unknown request type.");
}

function parseHighConfidenceAiIntent(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) {
    return null;
  }

  const clearHistoryIntent = parseClearHistoryIntent(input);
  if (clearHistoryIntent) {
    return { ...clearHistoryIntent, confidence: 0.99 };
  }

  const keepExcept = parseKeepTabExceptIntent(input);
  if (keepExcept) {
    return keepExcept;
  }

  const countedPlan = parseCountedOpenAndMaybeClose(input);
  if (countedPlan) {
    return countedPlan;
  }

  const closeIntent = parseCloseIntent(input);
  if (closeIntent && !SEARCH_KEYWORD_RE.test(input)) {
    return { ...closeIntent, confidence: closeIntent.confidence || 0.95 };
  }

  const scoped = parseScopedContentSearch(input);
  if (scoped) {
    const lower = input.toLowerCase();
    const alsoOpenOther =
      hasAnyLoosePhrase(lower, [" і ", " and ", " та ", " й "]) &&
      detectAllKnownDestinations(normalizeNaturalText(getTextBeforeSearchIntent(input))).length > 0;
    if (!alsoOpenOther) {
      return { ...scoped, confidence: 0.96 };
    }
  }

  const lower = input.toLowerCase();
  if (
    (hasAnyLoosePhrase(lower, ["почисти", "очисти", "прибери", "clean"]) &&
      hasAnyLoosePhrase(lower, ["сторінку", "сторінка", "popup", "cookie", "банер", "overlay", "modal"])) ||
    hasAnyLoosePhrase(lower, ["почисти сторінку", "очисти сторінку", "clean page"])
  ) {
    return {
      interpretation: "clean active page overlays",
      request: { type: "cleanPage" },
      confidence: 0.95
    };
  }

  return null;
}

function isWeakGooglePlan(parsed, input) {
  if (!parsed || !parsed.request) {
    return true;
  }
  if (parsed.request.type !== "googleSearch") {
    return false;
  }
  return normalizeNaturalText(parsed.request.query || "") === normalizeNaturalText(input);
}

function scorePlan(parsed) {
  if (!parsed || !parsed.request) {
    return 0;
  }
  if (typeof parsed.confidence === "number") {
    return parsed.confidence;
  }
  const type = parsed.request.type;
  if (type === "clearHistory" || type === "cleanPage" || type === "closeActiveTab" || type === "closeTabsByDestination") {
    return 0.93;
  }
  if (type === "actionPlan") {
    return 0.9;
  }
  if (type === "openTab" && /\/(results|w\/index\.php\?search=)/i.test(String(parsed.request.url || ""))) {
    return 0.92;
  }
  if (type === "openTab") {
    return 0.8;
  }
  if (type === "googleSearch") {
    return 0.45;
  }
  return 0.7;
}

function isDuckySpamPlan(parsed) {
  if (!parsed || !parsed.request) {
    return true;
  }
  if (parsed.request.type === "openTab" && /duckduckgo\.com/i.test(String(parsed.request.url || ""))) {
    return true;
  }
  if (parsed.request.type === "openManyTabs") {
    const entries = Array.isArray(parsed.request.entries) ? parsed.request.entries : [];
    if (entries.length === 0) {
      return true;
    }
    const duckyCount = entries.filter((entry) => /duckduckgo\.com/i.test(String(entry.url || "")) || String(entry.source || "").startsWith("ducky:")).length;
    return duckyCount >= Math.ceil(entries.length / 2);
  }
  return false;
}

function parseNoopIntent(input) {
  const lower = normalizeNaturalText(input);
  if (!lower) {
    return null;
  }
  const noopPhrases = [
    "не роби нічого",
    "нічого не роби",
    "нічого не робий",
    "нічого не треба",
    "не треба нічого",
    "скасуй",
    "стоп",
    "cancel",
    "do nothing",
    "dont do anything",
    "don't do anything",
    "no op",
    "noop"
  ];
  if (noopPhrases.some((phrase) => lower === phrase || lower.includes(phrase))) {
    return {
      interpretation: "do nothing",
      confidence: 0.99,
      request: { type: "noop" }
    };
  }
  return null;
}

function pickBestAiPlan(input, heuristicPlan, ollamaPlan) {
  // LLM-first: trust Ollama whenever it produced a non-junk plan.
  if (ollamaPlan && !isWeakGooglePlan(ollamaPlan, input) && !isDuckySpamPlan(ollamaPlan)) {
    return { parsed: ollamaPlan, engine: "ollama" };
  }
  if (heuristicPlan && !isWeakGooglePlan(heuristicPlan, input) && !isDuckySpamPlan(heuristicPlan)) {
    return { parsed: heuristicPlan, engine: "heuristic-fallback" };
  }
  if (ollamaPlan) {
    return { parsed: ollamaPlan, engine: "ollama" };
  }
  if (heuristicPlan) {
    return { parsed: heuristicPlan, engine: "heuristic-fallback" };
  }
  // Never auto-google unknown phrases — that looks "stupid".
  return {
    parsed: {
      interpretation: "не зрозумів запит",
      request: { type: "noop" }
    },
    engine: "fallback"
  };
}

async function runAiCommand(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) {
    throw new Error("AI parser: empty input.");
  }

  // Explicit "do nothing" should never become a Google search.
  const noop = parseNoopIntent(input);
  if (noop) {
    return {
      ok: true,
      interpretation: `${noop.interpretation} [noop]`,
      request: noop.request,
      output: "Ох, ок. Нічого не роблю."
    };
  }

  // Structural tab ops like "close all except first" must not be mangled by the LLM.
  const keepExcept = parseKeepTabExceptIntent(input);
  if (keepExcept) {
    const preview = formatRequestPreview(keepExcept.request);
    const response = await executeRequest(keepExcept.request);
    return {
      ok: true,
      interpretation: `${keepExcept.interpretation} [deterministic]`,
      request: keepExcept.request,
      output: `Виконано: ${preview}${response.output ? `\n${response.output}` : ""}`
    };
  }

  // ALWAYS ask local LLM first — this is the "smart" path.
  let ollamaPlan = null;
  let ollamaError = "";
  try {
    ollamaPlan = await askOllamaForPlan(input);
  } catch (error) {
    ollamaError = error && error.message ? error.message : String(error);
    console.warn("FoxTerminal Ollama:", ollamaError);
  }

  // Heuristics only as safety net when LLM is down/junk.
  // (e.g. "хочу телеграм" can succeed here even if model returns empty JSON)
  let heuristicPlan = null;
  try {
    heuristicPlan = parseHighConfidenceAiIntent(input) || parseAiCommandInput(input);
  } catch (_) {
    heuristicPlan = null;
  }

  const chosen = pickBestAiPlan(input, heuristicPlan, ollamaPlan);
  const parsed = chosen.parsed;
  const engine = chosen.engine;

  const preview = formatRequestPreview(parsed.request);
  const response = await executeRequest(parsed.request);

  let hint = "";
  if (ollamaError && engine !== "ollama") {
    const looksOffline = /Native Ollama bridge failed|not installed|did not become ready|Failed to|NetworkError|disconnected/i.test(ollamaError);
    hint = looksOffline
      ? `\n(Ollama недоступна, взяв запасний шлях: ${ollamaError})`
      : `\n(Ollama відповіла криво/порожньо, взяв запасний шлях: ${ollamaError})`;
  }

  return {
    ok: true,
    interpretation: `${parsed.interpretation || "команда"} [${engine}]`,
    request: parsed.request,
    output: `Виконано: ${preview}${response.output ? `\n${response.output}` : ""}${hint}`
  };
}

const OLLAMA_MODEL = "gemma3:4b";
const OLLAMA_SYSTEM_PROMPT = `You are FoxTerminal, a smart browser agent. Understand ANY Ukrainian/Russian/English request and convert it into browser actions. Output ONLY valid JSON.

Schema:
{"interpretation":"short","confidence":0.0,"steps":[STEP,...]}

STEP one of:
{"action":"search","engine":"youtube","query":"..."}
{"action":"search","engine":"wikipedia","query":"..."}
{"action":"search","engine":"github","query":"..."}
{"action":"search","engine":"google","query":"..."}
{"action":"open","url":"https://...","count":1}
{"action":"close","target":"youtube|telegram|github|chatgpt|deepseek|pornhub|gmail|active","index":2}
{"action":"close_keep","keepIndex":1}
{"action":"clear_history","period":"all|today|hour|week"}
{"action":"clean_page"}
{"action":"open_sidebar"}
{"action":"ask","query":"..."}
{"action":"noop"}

Mindset:
- Understand intent, not keywords.
- Do the action. Never search "how to clear history" and never google a close/open command.
- If user says do nothing / не роби нічого => noop (empty steps also mean noop).
- Multi-step phrases ("і потім", "then") => multiple steps in order.
- "N вкладок з X" => open url with count N.
- "закрий другу вкладку з телеграмом" => close target telegram index 2.
- "закрий все крім першої вкладки" => close_keep keepIndex 1 (NOT close youtube/active).
- Inflected words: ютубом/ютубі = youtube, телеграмі = telegram.
- Typos OK: найди, ютцб, діпсік, чат джпт.
- Keep user topic language (айзека, лампа), do not invent unrelated names.
- Prefer https URLs.
Known homes:
youtube=https://www.youtube.com/
telegram=https://web.telegram.org/
github=https://github.com/
chatgpt=https://chatgpt.com/
deepseek=https://chat.deepseek.com/
gmail=https://mail.google.com/
pornhub=https://www.pornhub.com/

Examples:
User: очисти історію за сьогодні
{"interpretation":"clear history today","confidence":0.99,"steps":[{"action":"clear_history","period":"today"}]}
User: відкрий в ютубі відео про айзека
{"interpretation":"youtube search","confidence":0.95,"steps":[{"action":"search","engine":"youtube","query":"айзека"}]}
User: найди статтю в вікіпедії про айзека
{"interpretation":"wikipedia search","confidence":0.95,"steps":[{"action":"search","engine":"wikipedia","query":"айзека"}]}
User: відкрий 2 вкладки з ютубом і потім закрий
{"interpretation":"open 2 youtube then close","confidence":0.97,"steps":[{"action":"open","url":"https://www.youtube.com/","count":2},{"action":"close","target":"youtube"}]}
User: хочу телеграм
{"interpretation":"open telegram","confidence":0.95,"steps":[{"action":"open","url":"https://web.telegram.org/","count":1}]}
User: відкрий ютуб і телеграм
{"interpretation":"open two sites","confidence":0.95,"steps":[{"action":"open","url":"https://www.youtube.com/","count":1},{"action":"open","url":"https://web.telegram.org/","count":1}]}
User: ютуб і знайди в вікіпедії що таке лампа
{"interpretation":"open youtube + wiki","confidence":0.95,"steps":[{"action":"open","url":"https://www.youtube.com/","count":1},{"action":"search","engine":"wikipedia","query":"лампа"}]}
User: почисти сторінку від popup
{"interpretation":"clean page","confidence":0.95,"steps":[{"action":"clean_page"}]}
User: загугли шо таке корова на ютубі
{"interpretation":"youtube search cow","confidence":0.95,"steps":[{"action":"search","engine":"youtube","query":"корова"}]}
User: закрий другу вкладку з телеграмом
{"interpretation":"close 2nd telegram tab","confidence":0.97,"steps":[{"action":"close","target":"telegram","index":2}]}
User: закрий все крім першої вкладки
{"interpretation":"close all except first","confidence":0.99,"steps":[{"action":"close_keep","keepIndex":1}]}
User: не роби нічого
{"interpretation":"do nothing","confidence":0.99,"steps":[{"action":"noop"}]}`;

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (__) {
        return null;
      }
    }
    return null;
  }
}

function buildSearchUrlByEngine(engine, query) {
  switch (String(engine || "").toLowerCase()) {
    case "wikipedia":
    case "wiki":
      return buildWikipediaSearchUrl(query);
    case "youtube":
    case "yt":
      return buildYouTubeSearchUrl(query);
    case "github":
    case "gh":
      return buildGitHubSearchUrl(query);
    default:
      return buildGoogleSearchUrl(query);
  }
}

function mapOllamaStepToRequest(step) {
  if (!step || typeof step !== "object") {
    return null;
  }
  const action = String(step.action || "").toLowerCase();

  if (action === "search") {
    const query = String(step.query || "").trim();
    if (!query || /[?]{2,}|youtube\|wikipedia/i.test(query)) {
      return null;
    }
    let engine = String(step.engine || "google").toLowerCase().trim();
    if (engine.includes("|")) {
      engine = "google";
    }
    if (engine === "chatgpt" || engine === "gpt") {
      return { type: "askChatGpt", query };
    }
    if (!["youtube", "yt", "wikipedia", "wiki", "github", "gh", "google"].includes(engine)) {
      const knownEngine = detectKnownDestination(normalizeNaturalText(engine));
      if (knownEngine) {
        return { type: "openTab", url: knownEngine.url, source: knownEngine.label };
      }
      engine = "google";
    }
    if (engine === "google") {
      return { type: "googleSearch", query };
    }
    return {
      type: "openTab",
      url: buildSearchUrlByEngine(engine, query),
      source: `${engine}-search`
    };
  }

  if (action === "open") {
    let url = String(step.url || "").trim();
    if (!url) {
      return null;
    }
    if (!/^https?:\/\//i.test(url)) {
      const known = detectKnownDestination(normalizeNaturalText(url.replace(/^www\./i, "")));
      url = known ? known.url : (toHttpUrl(url) || buildDuckyOpenUrl(url));
    } else {
      // Normalize known destinations to canonical URLs.
      try {
        const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
        if (host.includes("deepseek")) {
          url = "https://chat.deepseek.com/";
        } else if (host.includes("youtube") && !/\/results/i.test(url)) {
          url = "https://www.youtube.com/";
        } else if (host.includes("telegram") || host === "t.me") {
          url = "https://web.telegram.org/";
        }
      } catch (_) {
        // keep original url
      }
    }

    let count = Number.parseInt(step.count, 10);
    if (!Number.isFinite(count) || count < 1) {
      count = 1;
    }
    count = Math.min(count, 10);
    if (count === 1) {
      return { type: "openTab", url, source: "ollama-open" };
    }
    const entries = [];
    for (let i = 0; i < count; i += 1) {
      entries.push({ url, source: "ollama-open" });
    }
    return { type: "openManyTabs", entries };
  }

  if (action === "close_keep" || action === "close-keep" || action === "close_all_except") {
    let keepIndex = Number.parseInt(step.keepIndex, 10);
    if (!Number.isFinite(keepIndex)) {
      keepIndex = 1;
    }
    return {
      type: "closeTabsKeepIndex",
      keepIndex,
      currentWindow: true
    };
  }

  if (action === "close") {
    const target = String(step.target || "active").toLowerCase();
    let index = Number.parseInt(step.index, 10);
    if (!Number.isFinite(index)) {
      index = null;
    }
    // Model sometimes mislabels "close all except first" as close youtube/active.
    if ((target === "all" || target === "others" || target === "rest") && (index || step.keepIndex)) {
      return {
        type: "closeTabsKeepIndex",
        keepIndex: Number.isFinite(Number(step.keepIndex)) ? Number(step.keepIndex) : (index || 1),
        currentWindow: true
      };
    }
    if (target === "active" || target === "tab" || target === "current") {
      if (index) {
        return { type: "closeTabByIndex", index };
      }
      return { type: "closeActiveTab" };
    }
    const known = detectKnownDestination(normalizeNaturalText(target));
    if (known) {
      return {
        type: "closeTabsByDestination",
        labels: [known.label],
        index: index || null
      };
    }
    if (index) {
      return { type: "closeTabByIndex", index };
    }
    return { type: "closeActiveTab" };
  }

  if (action === "clear_history" || action === "clear-history") {
    const periodRaw = String(step.period || "all").toLowerCase();
    const period = ["today", "hour", "week"].includes(periodRaw) ? periodRaw : "all";
    const since =
      period === "today" ? startOfLocalDayMs() :
      period === "hour" ? Date.now() - (60 * 60 * 1000) :
      period === "week" ? Date.now() - (7 * 24 * 60 * 60 * 1000) :
      null;
    return { type: "clearHistory", period, since };
  }
  if (action === "clean_page" || action === "clean") {
    return { type: "cleanPage" };
  }
  if (action === "open_sidebar" || action === "sidebar") {
    return { type: "openSidebar" };
  }
  if (action === "noop" || action === "none" || action === "do_nothing") {
    return { type: "noop" };
  }
  if (action === "ask") {
    return { type: "askChatGpt", query: String(step.query || "").trim() };
  }
  return null;
}

function repairOllamaSteps(userInput, stepsRaw) {
  const input = String(userInput || "").trim();
  const lower = input.toLowerCase();
  let steps = Array.isArray(stepsRaw) ? stepsRaw.map((step) => ({ ...step })) : [];

  // Force-correct "close all except ..." if model closed a site instead.
  const keepExcept = parseKeepTabExceptIntent(input);
  if (keepExcept) {
    return [{
      action: "close_keep",
      keepIndex: keepExcept.request.keepIndex
    }];
  }

  // Short known destination phrases (incl. typos) => open site.
  const knownShort = detectKnownDestination(normalizeNaturalText(input));
  if (knownShort && tokenizeNaturalWords(normalizeNaturalText(input)).length <= 3 && !SEARCH_KEYWORD_RE.test(input)) {
    const hasContentCue = hasAnyLoosePhrase(lower, ["відео", "статтю", "про", "шо таке", "що таке"]);
    if (!hasContentCue) {
      return [{ action: "open", url: knownShort.url, count: 1 }];
    }
  }

  // "відкрий N вкладок з ютубом і потім закрий"
  const tabCount = extractTabCount(input);
  const countedDestinations = detectAllKnownDestinations(normalizeNaturalText(input));
  if (
    tabCount > 1 &&
    countedDestinations.length === 1 &&
    hasAnyLoosePhrase(lower, ["відкрий", "open", "запусти"])
  ) {
    const repaired = [{ action: "open", url: countedDestinations[0].url, count: tabCount }];
    if (hasAnyLoosePhrase(lower, ["закрий", "закрити", "close"]) || /закри/i.test(lower)) {
      repaired.push({ action: "close", target: countedDestinations[0].label.toLowerCase() });
    }
    return repaired;
  }

  // Fix: content search reduced to homepage open.
  let topic = extractTopicQuery(input);
  if (!topic) {
    topic = sanitizeSearchQuery(input);
  }
  const wantsYoutubeContent =
    hasAnyLoosePhrase(lower, ["ютуб", "ютюб", "youtube", "ютубі", "ютюбі", "ютцб"]) &&
    (hasAnyLoosePhrase(lower, ["відео", "video", "про", "шо таке", "що таке", "загугли", "знайди", "найди"]) || SEARCH_KEYWORD_RE.test(input));
  const onlyOpensYoutubeHome =
    steps.length === 1 &&
    String(steps[0].action || "").toLowerCase() === "open" &&
    /youtube\.com\/?$/i.test(String(steps[0].url || ""));
  const googledInsteadOfYoutube =
    steps.some((step) => String(step.action || "").toLowerCase() === "search" && String(step.engine || "").toLowerCase() === "google") &&
    wantsYoutubeContent;

  if (wantsYoutubeContent && topic && (onlyOpensYoutubeHome || steps.length === 0 || googledInsteadOfYoutube)) {
    steps = [{ action: "search", engine: "youtube", query: topic }];
  }

  const wantsWikiContent =
    (/вікіпед|википед|wikipedia|wiki/i.test(lower)) &&
    (SEARCH_KEYWORD_RE.test(input) || hasAnyLoosePhrase(lower, ["статтю", "стаття", "про", "шо таке", "що таке"]));
  if (wantsWikiContent && topic) {
    const hasWikiSearch = steps.some(
      (step) => String(step.action || "").toLowerCase() === "search" && /wiki/i.test(String(step.engine || ""))
    );
    if (!hasWikiSearch) {
      steps = steps.filter((step) => !(String(step.action || "").toLowerCase() === "open" && /wikipedia\.org\/?$/i.test(String(step.url || ""))));
      steps.push({ action: "search", engine: "wikipedia", query: topic });
    } else {
      steps = steps.map((step) => {
        if (String(step.action || "").toLowerCase() === "search" && /wiki/i.test(String(step.engine || ""))) {
          // Prefer original UA topic over model hallucination.
          if (topic && /[а-яіїєґ]/i.test(topic)) {
            return { ...step, query: topic };
          }
        }
        return step;
      });
    }
  }

  // "ютуб і знайди у вікіпедії X" => ensure youtube open exists when youtube mentioned before search.
  if (
    hasAnyLoosePhrase(lower, ["ютуб", "youtube"]) &&
    /вікіпед|wikipedia|wiki/i.test(lower) &&
    SEARCH_KEYWORD_RE.test(input)
  ) {
    const hasYtSearch = steps.some(
      (step) => String(step.action || "").toLowerCase() === "search" && /youtube|yt/i.test(String(step.engine || ""))
    );
    const hasYtOpen = steps.some(
      (step) => String(step.action || "").toLowerCase() === "open" && /youtube\.com/i.test(String(step.url || ""))
    );
    if (!hasYtOpen && !hasYtSearch) {
      steps.unshift({ action: "open", url: "https://www.youtube.com/" });
    }
    // Prefer wiki search for the topic, drop accidental youtube search of same topic.
    if (hasYtSearch && /вікіпед|wikipedia|wiki/i.test(lower)) {
      steps = steps.filter(
        (step) => !(String(step.action || "").toLowerCase() === "search" && /youtube|yt/i.test(String(step.engine || "")))
      );
      if (!hasYtOpen) {
        steps.unshift({ action: "open", url: "https://www.youtube.com/" });
      }
    }
  }

  // clean_page should not also close active tab.
  if (steps.some((step) => String(step.action || "").toLowerCase() === "clean_page")) {
    steps = steps.filter(
      (step) => !(String(step.action || "").toLowerCase() === "close" && /active|tab|current/i.test(String(step.target || "active")))
    );
  }

  // clear history phrasing should never become google.
  const clearIntent = parseClearHistoryIntent(input);
  if (clearIntent) {
    return [{
      action: "clear_history",
      period: clearIntent.request.period || "all"
    }];
  }

  return steps;
}

function convertOllamaPlan(plan, userInput = "") {
  if (!plan || typeof plan !== "object") {
    return null;
  }
  const stepsRaw = repairOllamaSteps(userInput, Array.isArray(plan.steps) ? plan.steps : []);
  const requests = [];
  for (const step of stepsRaw) {
    const mapped = mapOllamaStepToRequest(step);
    if (mapped) {
      requests.push(mapped);
    }
  }
  if (requests.length === 0) {
    // Empty plan from model: treat as noop for cancel-like phrasing, else invalid.
    if (parseNoopIntent(userInput) || /noop|do nothing|не роби/i.test(String(plan.interpretation || ""))) {
      return {
        interpretation: plan.interpretation || "do nothing",
        confidence: 0.9,
        request: { type: "noop" }
      };
    }
    return null;
  }

  const filtered = [];
  for (let i = 0; i < requests.length; i += 1) {
    const cur = requests[i];
    const next = requests[i + 1];
    if (
      cur.type === "openTab" &&
      next &&
      next.type === "openTab" &&
      /youtube\.com\/?$/i.test(String(cur.url || "")) &&
      /youtube\.com\/results/i.test(String(next.url || ""))
    ) {
      continue;
    }
    filtered.push(cur);
  }

  const finalSteps = filtered.length > 0 ? filtered : requests;
  const confidence = typeof plan.confidence === "number" ? plan.confidence : 0.85;
  if (finalSteps.length === 1) {
    return {
      interpretation: plan.interpretation || "ollama plan",
      confidence,
      request: finalSteps[0]
    };
  }
  return {
    interpretation: plan.interpretation || `ollama plan (${finalSteps.length})`,
    confidence,
    request: { type: "actionPlan", steps: finalSteps }
  };
}

async function askOllamaForPlan(userInput) {
  // Proxy through Native Host so Firefox does not need direct localhost access,
  // and Ollama can be auto-started without opening anything manually.
  const response = await browser.runtime.sendNativeMessage(HOST_NAME, {
    type: "ollamaChat",
    model: OLLAMA_MODEL,
    system: OLLAMA_SYSTEM_PROMPT,
    user: String(userInput || "").trim()
  });

  if (!response || response.ok !== true) {
    const reason = response && response.error ? response.error : "Native Ollama bridge failed.";
    throw new Error(reason);
  }

  const content = response.content || "";
  const plan = convertOllamaPlan(extractJsonObject(content), userInput);
  if (!plan) {
    throw new Error("Ollama returned empty/invalid plan.");
  }
  return plan;
}

function warmupOllama() {
  browser.runtime.sendNativeMessage(HOST_NAME, { type: "ensureOllama" }).catch(() => {});
}

function makeSavedSetId() {
  return `tabs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSavableTabUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  if (/^(about:|moz-extension:|chrome:|resource:|view-source:)/i.test(url)) {
    return false;
  }
  return /^(https?:|file:|ftp:)/i.test(url);
}

function normalizeSavedTab(tab, index) {
  return {
    url: String(tab.url),
    title: String(tab.title || tab.url || "Без назви").slice(0, 200),
    pinned: tab.pinned === true,
    index: typeof index === "number" ? index : (typeof tab.index === "number" ? tab.index : 0)
  };
}

function sortSavedTabSets(sets) {
  return sets.slice().sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

async function getSavedTabSetsRaw() {
  const stored = await browser.storage.local.get("savedTabSets");
  return Array.isArray(stored.savedTabSets) ? stored.savedTabSets : [];
}

async function writeSavedTabSets(sets) {
  const next = sortSavedTabSets(sets);
  await browser.storage.local.set({ savedTabSets: next });
  return next;
}

async function listSavedTabSets() {
  return sortSavedTabSets(await getSavedTabSetsRaw());
}

async function saveCurrentWindowTabs(name) {
  if (!browser.tabs || !browser.tabs.query) {
    throw new Error("Tabs API unavailable.");
  }
  const tabs = (await browser.tabs.query({ currentWindow: true }))
    .filter((tab) => isSavableTabUrl(tab.url))
    .sort((a, b) => (a.index || 0) - (b.index || 0));

  if (tabs.length === 0) {
    throw new Error("Немає вкладок для збереження (пропущено about:/розширення).");
  }

  const now = Date.now();
  const set = {
    id: makeSavedSetId(),
    name: String(name || "").trim() || `Сесія · ${new Date(now).toLocaleString()}`,
    pinned: false,
    kind: "session",
    createdAt: now,
    updatedAt: now,
    tabs: tabs.map((tab, index) => normalizeSavedTab(tab, index))
  };

  const sets = await getSavedTabSetsRaw();
  sets.unshift(set);
  await writeSavedTabSets(sets);
  return set;
}

async function saveActiveTabPin(name) {
  if (!browser.tabs || !browser.tabs.query) {
    throw new Error("Tabs API unavailable.");
  }
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !isSavableTabUrl(activeTab.url)) {
    throw new Error("Активну вкладку не можна зберегти.");
  }

  const now = Date.now();
  const title = String(activeTab.title || activeTab.url).slice(0, 80);
  const set = {
    id: makeSavedSetId(),
    name: String(name || "").trim() || title,
    pinned: true,
    kind: "pin",
    createdAt: now,
    updatedAt: now,
    tabs: [normalizeSavedTab(activeTab, 0)]
  };

  const sets = await getSavedTabSetsRaw();
  sets.unshift(set);
  await writeSavedTabSets(sets);
  return set;
}

async function toggleSavedTabSetPinned(id) {
  const sets = await getSavedTabSetsRaw();
  const target = sets.find((item) => item.id === id);
  if (!target) {
    throw new Error("Набір не знайдено.");
  }
  target.pinned = !target.pinned;
  target.updatedAt = Date.now();
  await writeSavedTabSets(sets);
  return target;
}

async function renameSavedTabSet(id, name) {
  const nextName = String(name || "").trim();
  if (!nextName) {
    throw new Error("Назва не може бути порожньою.");
  }
  const sets = await getSavedTabSetsRaw();
  const target = sets.find((item) => item.id === id);
  if (!target) {
    throw new Error("Набір не знайдено.");
  }
  target.name = nextName.slice(0, 120);
  target.updatedAt = Date.now();
  await writeSavedTabSets(sets);
  return target;
}

async function deleteSavedTabSet(id) {
  const sets = await getSavedTabSetsRaw();
  const next = sets.filter((item) => item.id !== id);
  if (next.length === sets.length) {
    throw new Error("Набір не знайдено.");
  }
  await writeSavedTabSets(next);
  return { ok: true };
}

async function openSavedTabSet(id, mode = "current") {
  const sets = await getSavedTabSetsRaw();
  const target = sets.find((item) => item.id === id);
  if (!target || !Array.isArray(target.tabs) || target.tabs.length === 0) {
    throw new Error("Набір порожній або не знайдений.");
  }

  const urls = target.tabs.map((tab) => tab.url).filter(isSavableTabUrl);
  if (urls.length === 0) {
    throw new Error("У наборі немає валідних URL.");
  }

  if (mode === "new") {
    if (!browser.windows || !browser.windows.create) {
      throw new Error("Windows API unavailable.");
    }
    const created = await browser.windows.create({ url: urls });
    if (created && Array.isArray(created.tabs)) {
      for (let i = 0; i < created.tabs.length; i += 1) {
        const saved = target.tabs[i];
        const live = created.tabs[i];
        if (saved && saved.pinned && live && live.id != null) {
          try {
            await browser.tabs.update(live.id, { pinned: true });
          } catch (_) {
            // ignore pin failures
          }
        }
      }
    }
    return { ok: true, opened: urls.length, mode: "new" };
  }

  let firstId = null;
  for (let i = 0; i < target.tabs.length; i += 1) {
    const saved = target.tabs[i];
    if (!isSavableTabUrl(saved.url)) {
      continue;
    }
    const created = await browser.tabs.create({
      url: saved.url,
      active: firstId == null,
      pinned: saved.pinned === true
    });
    if (firstId == null && created && created.id != null) {
      firstId = created.id;
    }
  }

  return { ok: true, opened: urls.length, mode: "current" };
}

async function openSavedTabUrl(id, index) {
  const sets = await getSavedTabSetsRaw();
  const target = sets.find((item) => item.id === id);
  if (!target || !Array.isArray(target.tabs)) {
    throw new Error("Набір не знайдено.");
  }
  const saved = target.tabs[index];
  if (!saved || !isSavableTabUrl(saved.url)) {
    throw new Error("Сайт у наборі невалідний.");
  }
  await browser.tabs.create({
    url: saved.url,
    active: true,
    pinned: saved.pinned === true
  });
  return { ok: true };
}

const TRANSLATE_MENU_ID = "foxterminal-translate-selection";

const DEFAULT_TRANSLATE_SETTINGS = {
  targetLang: "uk",
  sourceLang: "auto",
  openSidebarOnTranslate: true,
  copyTranslation: false,
  notifyOnTranslate: true,
  preferAiTranslate: true
};

const TRANSLATE_AI_SYSTEM_PROMPT = `You are a professional translator for IT / product / browser UI text.
Translate by MEANING and natural usage in the target language — NEVER word-for-word calques.
Rules:
- Keep established tech terms in common IT form: Framework → «фреймворк» (NOT «каркас»), API, CSS, React, Node, JSON, URL, IDE, CLI stay recognizable; do not invent literal dictionary calques.
- Keep brand names, product names, code identifiers, file paths, URLs, and code snippets unchanged when that is natural.
- Preserve tone, punctuation, and line breaks where useful.
- If source language is already the target, return the text unchanged.
- Also write short "notes": 1–3 sentences in the TARGET language explaining the meaning in simpler words (paraphrase / what it means), not a second translation. Mention tricky terms if useful.
- Output ONLY valid JSON:
{"translation":"...","notes":"...","detectedSource":"en"}
detectedSource must be an ISO 639-1 code when possible (en, uk, de, ...).`;

const TRANSLATE_LANG_LABELS = {
  auto: "Авто",
  uk: "Українська",
  en: "English",
  pl: "Polski",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  cs: "Čeština",
  sk: "Slovenčina",
  ru: "Русский",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  tr: "Türkçe",
  ar: "العربية"
};

function normalizeLangCode(value, fallback) {
  const code = String(value || "").trim().toLowerCase();
  if (!code) {
    return fallback;
  }
  if (code === "auto" || TRANSLATE_LANG_LABELS[code]) {
    return code;
  }
  return fallback;
}

async function getUiThemeId() {
  const stored = await browser.storage.local.get("uiThemeId");
  const id = stored && stored.uiThemeId ? String(stored.uiThemeId) : "slate";
  return FoxThemes.getFoxTheme(id).id;
}

async function getUiTheme() {
  return FoxThemes.getFoxTheme(await getUiThemeId());
}

async function applyBrowserChromeTheme(theme) {
  if (!theme) {
    return { themeApi: false, zenChrome: false };
  }

  let themeApi = false;
  if (browser.theme && browser.theme.update && FoxThemes.toBrowserTheme) {
    try {
      await browser.theme.update(FoxThemes.toBrowserTheme(theme));
      themeApi = true;
    } catch (error) {
      console.error("FoxTerminal theme.update failed:", error);
    }
  }

  let zenChrome = false;
  let zenRestart = false;
  try {
    const response = await browser.runtime.sendNativeMessage(HOST_NAME, {
      type: "applyZenTheme",
      theme,
      restart: true
    });
    zenChrome = !!(response && response.ok === true);
    zenRestart = !!(response && response.restartScheduled === true);
  } catch (error) {
    console.error("FoxTerminal applyZenTheme native failed:", error);
  }

  return { themeApi, zenChrome, zenRestart };
}

async function setUiTheme(themeId) {
  const theme = FoxThemes.getFoxTheme(themeId);
  await browser.storage.local.set({ uiThemeId: theme.id });
  const applied = await applyBrowserChromeTheme(theme);
  return { ...theme, applied };
}

async function restoreBrowserChromeTheme() {
  try {
    const theme = await getUiTheme();
    await applyBrowserChromeTheme(theme);
  } catch (error) {
    console.error("FoxTerminal restore theme failed:", error);
  }
}

async function getTranslateSettings() {
  const stored = await browser.storage.local.get("translateSettings");
  const raw = stored && stored.translateSettings ? stored.translateSettings : {};
  return {
    targetLang: normalizeLangCode(raw.targetLang, DEFAULT_TRANSLATE_SETTINGS.targetLang),
    sourceLang: normalizeLangCode(raw.sourceLang, DEFAULT_TRANSLATE_SETTINGS.sourceLang),
    openSidebarOnTranslate: raw.openSidebarOnTranslate !== false,
    copyTranslation: raw.copyTranslation === true,
    notifyOnTranslate: raw.notifyOnTranslate !== false,
    preferAiTranslate: raw.preferAiTranslate !== false
  };
}

async function saveTranslateSettings(partial) {
  const current = await getTranslateSettings();
  const next = {
    ...current,
    ...(partial && typeof partial === "object" ? partial : {})
  };
  next.targetLang = normalizeLangCode(next.targetLang, DEFAULT_TRANSLATE_SETTINGS.targetLang);
  next.sourceLang = normalizeLangCode(next.sourceLang, DEFAULT_TRANSLATE_SETTINGS.sourceLang);
  next.openSidebarOnTranslate = next.openSidebarOnTranslate !== false;
  next.copyTranslation = next.copyTranslation === true;
  next.notifyOnTranslate = next.notifyOnTranslate !== false;
  next.preferAiTranslate = next.preferAiTranslate !== false;
  await browser.storage.local.set({ translateSettings: next });
  await updateTranslateContextMenu(next);
  return next;
}

function copyTextToClipboard(text) {
  try {
    const area = document.createElement("textarea");
    area.value = String(text || "");
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch (_) {
    return false;
  }
}

function parseGoogleTranslatePayload(raw) {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) {
    return null;
  }
  const chunks = [];
  for (const part of raw[0]) {
    if (Array.isArray(part) && typeof part[0] === "string") {
      chunks.push(part[0]);
    }
  }
  const translated = chunks.join("").trim();
  if (!translated) {
    return null;
  }
  const detected = typeof raw[2] === "string" ? raw[2] : "";
  return { text: translated, detectedSource: detected };
}

async function translateViaGoogle(text, sourceLang, targetLang) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: sourceLang || "auto",
    tl: targetLang,
    dt: "t",
    q: text
  });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Google Translate HTTP ${response.status}`);
  }
  const payload = await response.json();
  const parsed = parseGoogleTranslatePayload(payload);
  if (!parsed) {
    throw new Error("Empty Google Translate response.");
  }
  return {
    engine: "google",
    text: parsed.text,
    detectedSource: parsed.detectedSource || sourceLang || "auto"
  };
}

async function translateViaMyMemory(text, sourceLang, targetLang) {
  const sl = !sourceLang || sourceLang === "auto" ? "autodetect" : sourceLang;
  const params = new URLSearchParams({
    q: text,
    langpair: `${sl}|${targetLang}`
  });
  const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`MyMemory HTTP ${response.status}`);
  }
  const payload = await response.json();
  const translated = payload && payload.responseData && payload.responseData.translatedText
    ? String(payload.responseData.translatedText).trim()
    : "";
  if (!translated) {
    throw new Error("Empty MyMemory response.");
  }
  const detected = payload && payload.responseData && payload.responseData.detectedLanguage
    ? String(payload.responseData.detectedLanguage)
    : (sourceLang || "auto");
  return {
    engine: "mymemory",
    text: translated,
    detectedSource: detected
  };
}

function parseAiTranslationPayload(content) {
  const obj = extractJsonObject(content);
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const translated = String(obj.translation || obj.text || obj.translatedText || "").trim();
  if (!translated) {
    return null;
  }
  const detected = String(obj.detectedSource || obj.sourceLang || obj.lang || "").trim().toLowerCase();
  const notes = String(obj.notes || obj.note || obj.explain || obj.explanation || obj.paraphrase || "").trim();
  return {
    text: translated,
    notes,
    detectedSource: detected || ""
  };
}

async function translateViaOllama(text, sourceLang, targetLang) {
  const targetLabel = TRANSLATE_LANG_LABELS[targetLang] || targetLang;
  const sourceHint = !sourceLang || sourceLang === "auto"
    ? "auto-detect source language"
    : `source language hint: ${TRANSLATE_LANG_LABELS[sourceLang] || sourceLang} (${sourceLang})`;
  const numPredict = Math.min(4096, Math.max(320, Math.ceil(text.length * 2.8) + 220));

  // Warm model first — cold Ollama often times out on the first chat call.
  try {
    await browser.runtime.sendNativeMessage(HOST_NAME, { type: "ensureOllama" });
  } catch (_) {
    // continue; ollamaChat will ensure again
  }

  const response = await browser.runtime.sendNativeMessage(HOST_NAME, {
    type: "ollamaChat",
    model: OLLAMA_MODEL,
    format: "json",
    temperature: 0.25,
    numPredict,
    timeoutSec: 180,
    system: TRANSLATE_AI_SYSTEM_PROMPT,
    user: [
      `Target language: ${targetLabel} (${targetLang}).`,
      `Source: ${sourceHint}.`,
      "1) Translate <text> by meaning.",
      "2) Add short notes: explain in other words in the target language (simple paraphrase).",
      "Example: Framework → translation «фреймворк»; notes «Це готова основа/набір інструментів для швидшої розробки програм, не фізичний каркас.»",
      "<text>",
      text,
      "</text>"
    ].join("\n")
  });

  if (!response || response.ok !== true) {
    const reason = response && response.error ? response.error : "Native Ollama bridge failed.";
    throw new Error(reason);
  }

  const parsed = parseAiTranslationPayload(response.content || "");
  if (!parsed) {
    throw new Error("Ollama returned empty/invalid translation.");
  }

  return {
    engine: "ollama",
    text: parsed.text,
    notes: parsed.notes || "",
    detectedSource: parsed.detectedSource || sourceLang || "auto"
  };
}

async function translateViaMachineFallback(text, sourceLang, targetLang) {
  try {
    return await translateViaGoogle(text, sourceLang, targetLang);
  } catch (googleError) {
    try {
      return await translateViaMyMemory(text, sourceLang, targetLang);
    } catch (memoryError) {
      throw new Error(
        `Машинний переклад не вдався: ${googleError.message || googleError}; ${memoryError.message || memoryError}`
      );
    }
  }
}

async function translateSelectionText(text, options = {}) {
  const source = String(text || "").trim();
  if (!source) {
    throw new Error("Немає тексту для перекладу.");
  }
  if (source.length > 4500) {
    throw new Error("Текст занадто довгий (макс. ~4500 символів).");
  }

  const settings = await getTranslateSettings();
  const targetLang = normalizeLangCode(options.targetLang || settings.targetLang, "uk");
  const sourceLang = normalizeLangCode(options.sourceLang || settings.sourceLang, "auto");
  if (targetLang === "auto") {
    throw new Error("Цільова мова не може бути Auto.");
  }

  // Open sidebar immediately while user-gesture is still valid (multi-window Zen).
  if (settings.openSidebarOnTranslate && options.openSidebarNow !== false) {
    try {
      await openSideTerminal({ windowId: options.windowId });
    } catch (_) {
      // May already be open; storage update still syncs the panel.
    }
  }

  let result;
  const preferAi = settings.preferAiTranslate !== false && options.forceMachine !== true;
  const errors = [];

  if (preferAi) {
    try {
      result = await translateViaOllama(source, sourceLang, targetLang);
    } catch (aiError) {
      errors.push(`AI: ${aiError.message || aiError}`);
      console.warn("FoxTerminal AI translate:", aiError);
    }
  }

  if (!result) {
    try {
      result = await translateViaMachineFallback(source, sourceLang, targetLang);
      if (errors.length) {
        result.note = errors.join(" | ");
      }
    } catch (machineError) {
      errors.push(machineError.message || String(machineError));
      throw new Error(`Переклад не вдався. ${errors.join(" | ")}`);
    }
  }

  const uiTheme = await getUiTheme();
  const payload = {
    sourceText: source,
    translatedText: result.text,
    notes: result.notes || "",
    sourceLang: result.detectedSource || sourceLang,
    targetLang,
    engine: result.engine,
    at: Date.now(),
    theme: uiTheme,
    tabId: typeof options.tabId === "number" ? options.tabId : null,
    windowId: typeof options.windowId === "number" ? options.windowId : null
  };

  await browser.storage.local.set({ lastTranslation: payload });

  if (settings.copyTranslation) {
    copyTextToClipboard(payload.translatedText);
  }

  if (settings.notifyOnTranslate !== false) {
    const tabId = await resolveTranslateTabId(options.tabId, options.windowId);
    let tabUrl = "";
    if (tabId != null) {
      try {
        const tab = await browser.tabs.get(tabId);
        tabUrl = (tab && tab.url) || "";
      } catch (_) {
        // ignore
      }
    }

    // about:/devtools pages cannot host content scripts — use sidebar + toast, not a fake error.
    if (tabId != null && canInjectTranslateOverlay(tabUrl)) {
      try {
        await showTranslateOverlayOnTab(tabId, payload);
      } catch (overlayError) {
        console.error("FoxTerminal translate overlay error:", overlayError);
        notifyTranslateResult(payload, "показано в сайдбарі");
      }
    } else {
      notifyTranslateResult(
        payload,
        tabUrl && /^about:/i.test(tabUrl)
          ? "на about:-сторінках бокс недоступний — дивись сайдбар"
          : "дивись сайдбар"
      );
    }
  }

  return payload;
}

async function resolveTranslateTabId(preferredTabId, preferredWindowId) {
  if (typeof preferredTabId === "number" && preferredTabId >= 0) {
    return preferredTabId;
  }
  const queries = [];
  if (typeof preferredWindowId === "number") {
    queries.push({ active: true, windowId: preferredWindowId });
  }
  queries.push({ active: true, lastFocusedWindow: true });
  queries.push({ active: true, currentWindow: true });
  for (const query of queries) {
    try {
      const tabs = await browser.tabs.query(query);
      if (tabs && tabs[0] && typeof tabs[0].id === "number") {
        return tabs[0].id;
      }
    } catch (_) {
      // try next
    }
  }
  return null;
}

function canInjectTranslateOverlay(url) {
  const value = String(url || "");
  if (!value) {
    return false;
  }
  if (/^(about:|moz-extension:|chrome:|resource:|view-source:|devtools:)/i.test(value)) {
    return false;
  }
  return /^(https?:|file:|ftp:)/i.test(value);
}

async function showTranslateOverlayOnTab(tabId, payload) {
  let tab = null;
  try {
    tab = await browser.tabs.get(tabId);
  } catch (_) {
    throw new Error("Вкладка недоступна для overlay.");
  }
  if (!canInjectTranslateOverlay(tab && tab.url)) {
    throw new Error(`Overlay недоступний на цій сторінці (${(tab && tab.url) || "unknown"}).`);
  }

  await browser.tabs.executeScript(tabId, { file: "translate-overlay.js" });
  try {
    await browser.tabs.sendMessage(tabId, {
      type: "showTranslateOverlay",
      payload
    });
  } catch (_) {
    // Frame race: reinject once and retry show.
    await browser.tabs.executeScript(tabId, { file: "translate-overlay.js" });
    await browser.tabs.sendMessage(tabId, {
      type: "showTranslateOverlay",
      payload
    });
  }
}

async function updateTranslateContextMenu(settings) {
  if (!browser.contextMenus) {
    return;
  }
  const target = settings && settings.targetLang ? settings.targetLang : "uk";
  const label = TRANSLATE_LANG_LABELS[target] || target;
  const title = `Перекласти (${label})`;
  try {
    await browser.contextMenus.update(TRANSLATE_MENU_ID, { title });
  } catch (_) {
    try {
      await browser.contextMenus.create({
        id: TRANSLATE_MENU_ID,
        title,
        contexts: ["selection"]
      });
    } catch (__) {
      // Ignore duplicate create races during reload.
    }
  }
}

async function ensureTranslateContextMenu() {
  if (!browser.contextMenus) {
    return;
  }
  const settings = await getTranslateSettings();
  try {
    await browser.contextMenus.remove(TRANSLATE_MENU_ID);
  } catch (_) {
    // Menu may not exist yet.
  }
  await browser.contextMenus.create({
    id: TRANSLATE_MENU_ID,
    title: `Перекласти (${TRANSLATE_LANG_LABELS[settings.targetLang] || settings.targetLang})`,
    contexts: ["selection"]
  });
}

if (browser.contextMenus && browser.contextMenus.onClicked) {
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info || info.menuItemId !== TRANSLATE_MENU_ID) {
      return;
    }
    const selection = info.selectionText ? String(info.selectionText).trim() : "";
    if (!selection) {
      notifyFailure("Немає виділеного тексту для перекладу.");
      return;
    }

    // Capture tab/window before any await — Zen multi-window can lose focus context.
    let tabId = tab && typeof tab.id === "number" ? tab.id : undefined;
    let windowId = tab && typeof tab.windowId === "number" ? tab.windowId : undefined;
    if (tabId == null) {
      try {
        const focused = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (focused && focused[0]) {
          tabId = focused[0].id;
          windowId = focused[0].windowId;
        }
      } catch (_) {
        // ignore
      }
    }

    // Open sidebar in THIS window immediately (user gesture still valid).
    try {
      const settings = await getTranslateSettings();
      if (settings.openSidebarOnTranslate) {
        await openSideTerminal({ windowId });
      }
    } catch (_) {
      // ignore — translate still proceeds
    }

    try {
      await translateSelectionText(selection, {
        tabId,
        windowId,
        openSidebarNow: false
      });
    } catch (error) {
      console.error("FoxTerminal translate error:", error);
      notifyFailure(`Переклад не вдався: ${error.message || error}`);
    }
  });
}

browser.runtime.onInstalled.addListener(() => {
  ensureTranslateContextMenu().catch(() => {});
});

browser.runtime.onStartup.addListener(() => {
  ensureTranslateContextMenu().catch(() => {});
});

ensureTranslateContextMenu().catch(() => {});

function tokenizeCommandLine(input) {
  const parts = (input.match(/"[^"]*"|'[^']*'|\S+/g) || [])
    .map((part) => part.replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  return parts;
}

function parseOmniboxInput(text) {
  const tokens = tokenizeCommandLine(text.trim());
  if (tokens.length === 0) {
    return { type: "openSidebar" };
  }

  const first = tokens[0].toLowerCase();
  if (first === "ai" || first === "smart") {
    const aiInput = tokens.slice(1).join(" ");
    if (!aiInput) {
      throw new Error("Type AI request after 'ai'.");
    }
    return { type: "runAiFromOmnibox", input: aiInput };
  }

  if (first === "clean" || first === "clean-page") {
    return { type: "cleanPage" };
  }

  if (first === "history" && tokens[1] && tokens[1].toLowerCase() === "-clear") {
    return { type: "clearHistory" };
  }

  if (first === "terminal" || first === "panel" || first === "side") {
    return { type: "openSidebar" };
  }

  if (first === "ff" || first === "ser" || first === "gask" || first === "youtube" || first === "sites") {
    if (first === "ff" && tokens[1] && tokens[1].toLowerCase() === "clean") {
      return { type: "cleanPage" };
    }
    if (first === "ff" && tokens[1] && tokens[1].toLowerCase() === "history" && tokens[2] && tokens[2].toLowerCase() === "-clear") {
      return { type: "clearHistory" };
    }
    return { type: "runCommand", command: first, args: tokens.slice(1) };
  }

  if (first === "open") {
    return { type: "runCommand", command: "ff", args: tokens };
  }

  return { type: "runCommand", command: "ff", args: ["open", tokens.join(" ")] };
}

browser.runtime.onMessage.addListener((message) => {
  if (!message) {
    return undefined;
  }

  if (message.type === "runFoxTerminalCommand") {
    return runNativeCommand(message.command, message.args);
  }

  if (message.type === "openFoxTerminalSidebar") {
    return openSideTerminal().then(() => ({ ok: true }));
  }

  if (message.type === "clearFirefoxHistory") {
    return clearFirefoxHistory();
  }

  if (message.type === "cleanActivePage") {
    return cleanActivePage();
  }

  if (message.type === "runAiCommand") {
    return runAiCommand(message.input);
  }

  if (message.type === "getTranslateSettings") {
    return getTranslateSettings();
  }

  if (message.type === "saveTranslateSettings") {
    return saveTranslateSettings(message.settings || {});
  }

  if (message.type === "translateText") {
    return translateSelectionText(message.text, {
      targetLang: message.targetLang,
      sourceLang: message.sourceLang
    });
  }

  if (message.type === "getLastTranslation") {
    return browser.storage.local.get("lastTranslation").then((stored) => stored.lastTranslation || null);
  }

  if (message.type === "getTranslateLangLabels") {
    return Promise.resolve(TRANSLATE_LANG_LABELS);
  }

  if (message.type === "listUiThemes") {
    return Promise.resolve(FoxThemes.listFoxThemes());
  }

  if (message.type === "getUiTheme") {
    return getUiTheme();
  }

  if (message.type === "setUiTheme") {
    return setUiTheme(message.themeId);
  }

  if (message.type === "listSavedTabSets") {
    return listSavedTabSets();
  }

  if (message.type === "saveCurrentWindowTabs") {
    return saveCurrentWindowTabs(message.name);
  }

  if (message.type === "saveActiveTabPin") {
    return saveActiveTabPin(message.name);
  }

  if (message.type === "toggleSavedTabSetPinned") {
    return toggleSavedTabSetPinned(message.id);
  }

  if (message.type === "renameSavedTabSet") {
    return renameSavedTabSet(message.id, message.name);
  }

  if (message.type === "deleteSavedTabSet") {
    return deleteSavedTabSet(message.id);
  }

  if (message.type === "openSavedTabSet") {
    return openSavedTabSet(message.id, message.mode || "current");
  }

  if (message.type === "openSavedTabUrl") {
    return openSavedTabUrl(message.id, message.index);
  }

  return undefined;
});

if (browser.omnibox && browser.omnibox.onInputEntered) {
  browser.omnibox.setDefaultSuggestion({
    description: "FoxTerminal AI: natural language open/close/search (local Ollama)"
  });

  browser.omnibox.onInputEntered.addListener(async (text) => {
    try {
      const request = parseOmniboxInput(text || "");
      if (request.type === "runAiFromOmnibox") {
        await runAiCommand(request.input);
        return;
      }
      await executeRequest(request);
    } catch (error) {
      console.error("FoxTerminal omnibox error:", error);
      notifyFailure(`Command failed: ${error.message}`);
    }
  });
}

warmupOllama();
restoreBrowserChromeTheme();
