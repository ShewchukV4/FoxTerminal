const ITEMS_URL = "https://raw.githubusercontent.com/odota/dotaconstants/master/build/items.json";
const CDN = "https://cdn.cloudflare.steamstatic.com";

const sectionOrder = [
  "actions",
  "consumables",
  "boots",
  "under2000",
  "under3000",
  "under4000",
  "under6000",
  "over6000"
];

const sectionInfo = {
  actions: { title: "Дії", subtitle: "челенджі на гру" },
  consumables: { title: "Розхідники", subtitle: "варди, смоки, хіл" },
  boots: { title: "Ботинки", subtitle: "усі чоботи окремо" },
  under2000: { title: "До 2000", subtitle: "1-2000 золота" },
  under3000: { title: "До 3000", subtitle: "2001-3000" },
  under4000: { title: "До 4000", subtitle: "3001-4000" },
  under6000: { title: "До 6000", subtitle: "4001-6000" },
  over6000: { title: "Більше 6000", subtitle: "дорогі слоти" }
};

const actionItems = [
  {
    key: "break_cheapest_item",
    type: "action",
    icon: "💥",
    name: "Зламати найдешевшу шмотку",
    cost: 0,
    section: "actions",
    sectionTitle: "Дії",
    lore: "Знайди найдешевший предмет у своєму інвентарі й продай або викинь його за правилами вашого челенджу.",
    note: "Якщо є кілька предметів з однаковою ціною, обери будь-який з них."
  },
  {
    key: "buy_teleport",
    type: "action",
    icon: "🌀",
    name: "Купити телепорт",
    cost: 100,
    section: "actions",
    sectionTitle: "Дії",
    lore: "Негайно купи Town Portal Scroll і тримай його до наступного великого файту.",
    note: "Якщо TP вже є, купи ще один після використання поточного."
  },
  {
    key: "become_zhc_ghoul",
    type: "action",
    icon: "🧟",
    name: "Стати ЗХЦ гулем",
    cost: 0,
    section: "actions",
    sectionTitle: "Дії",
    lore: "На наступні 3 хвилини грай як справжній зхц гуль: фарм, жадібність і мінімум страху.",
    note: "Не фіди спеціально. Просто максимально жадібний стиль."
  },
  {
    key: "drop_neutral",
    type: "action",
    icon: "🎲",
    name: "Перекинути рішення",
    cost: 0,
    section: "actions",
    sectionTitle: "Дії",
    lore: "Якщо дія не підходить до ситуації, кинь ще раз, але наступний результат обов'язковий.",
    note: "Це safety valve, щоб челендж не ламав гру."
  },
  {
    key: "buy_ward",
    type: "action",
    icon: "👁",
    name: "Купити вард",
    cost: 50,
    section: "actions",
    sectionTitle: "Дії",
    lore: "Купи Sentry або Observer і постав його до наступної хвилини.",
    note: "Якщо ти кор, все одно купи. Це наказ магазину."
  }
];

const consumableKeys = new Set([
  "clarity",
  "faerie_fire",
  "enchanted_mango",
  "flask",
  "tango",
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "smoke_of_deceit",
  "dust",
  "blood_grenade",
  "tpscroll",
  "aghanims_shard"
]);

const excludedKeys = new Set([
  "cheese",
  "refresher_shard",
  "cornucopia",
  "quarterstaff",
  "pocket_roshan",
  "courier",
  "flying_courier",
  "eternal_shroud",
  "moon_shard",
  "tango_single",
  "ultimate_scepter_2",
  "ultimate_scepter_roshan",
  "stout_shield",
  "poor_mans_shield",
  "iron_talon",
  "ring_of_aquila",
  "necronomicon",
  "necronomicon_2",
  "necronomicon_3",
  "wraith_pact",
  "tome_of_knowledge",
  "diffusal_blade_2",
  "trident",
  "force_boots",
  "desolator_2",
  "seer_stone",
  "greater_mango",
  "mirror_shield",
  "flicker",
  "ninja_gear",
  "illusionsts_cape",
  "havoc_hammer",
  "apex",
  "ballista",
  "woodland_striders",
  "demonicon",
  "fallen_sky",
  "pirate_hat",
  "ex_machina",
  "minotaur_horn",
  "book_of_shadows"
]);

const bootKeys = new Set([
  "boots",
  "phase_boots",
  "power_treads",
  "travel_boots",
  "travel_boots_2",
  "tranquil_boots",
  "arcane_boots",
  "guardian_greaves",
  "boots_of_bearing"
]);

const state = {
  sections: Object.fromEntries(sectionOrder.map((key) => [key, []])),
  currentSection: "actions",
  selectedItem: null,
  search: ""
};

const sectionButtons = document.querySelector("#sectionButtons");
const itemCard = document.querySelector("#itemCard");
const itemList = document.querySelector("#itemList");
const currentSectionLabel = document.querySelector("#currentSectionLabel");
const sectionMeta = document.querySelector("#sectionMeta");
const searchInput = document.querySelector("#searchInput");
const randomSection = document.querySelector("#randomSection");
const randomAll = document.querySelector("#randomAll");

function cleanName(key, item) {
  return item.dname || key
    .replace(/^recipe_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isValidItem(key, item) {
  if (excludedKeys.has(key)) {
    return false;
  }

  if (!item || !item.img || !item.dname) {
    return false;
  }

  if (key.startsWith("recipe_") || item.dname.startsWith("Recipe:")) {
    return false;
  }

  if (item.neutral_item_tier || item.tier) {
    return false;
  }

  return Number.isFinite(Number(item.cost)) && Number(item.cost) > 0;
}

function sectionFor(key, item) {
  if (consumableKeys.has(key)) {
    return "consumables";
  }

  if (bootKeys.has(key)) {
    return "boots";
  }

  const cost = Number(item.cost);

  if (cost <= 2000) {
    return "under2000";
  }

  if (cost <= 3000) {
    return "under3000";
  }

  if (cost <= 4000) {
    return "under4000";
  }

  if (cost <= 6000) {
    return "under6000";
  }

  return "over6000";
}

function normalizeItem(key, item) {
  const section = sectionFor(key, item);

  return {
    key,
    id: item.id,
    name: cleanName(key, item),
    cost: Number(item.cost),
    img: `${CDN}${item.img}`,
    lore: item.lore || "",
    note: item.notes || "",
    section,
    sectionTitle: sectionInfo[section].title
  };
}

async function loadItems() {
  state.sections.actions = [...actionItems];

  const response = await fetch(ITEMS_URL);

  if (!response.ok) {
    throw new Error("Не вдалося завантажити items.json");
  }

  const data = await response.json();
  const used = new Set();

  Object.entries(data).forEach(([key, item]) => {
    if (!isValidItem(key, item)) {
      return;
    }

    const normalized = normalizeItem(key, item);

    if (used.has(normalized.id)) {
      return;
    }

    used.add(normalized.id);
    state.sections[normalized.section].push(normalized);
  });

  sectionOrder.forEach((section) => {
    state.sections[section].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  });
}

function renderSections() {
  sectionButtons.innerHTML = sectionOrder.map((section) => `
    <button class="section-btn ${section === state.currentSection ? "active" : ""}" data-section="${section}">
      <strong>${sectionInfo[section].title}</strong>
      <small>${state.sections[section].length} предметів</small>
    </button>
  `).join("");

  sectionButtons.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentSection = button.dataset.section;
      state.search = "";
      searchInput.value = "";
      render();
      rollFromSection();
    });
  });
}

function currentItems() {
  const query = state.search.trim().toLowerCase();
  const items = state.sections[state.currentSection];

  if (!query) {
    return items;
  }

  return items.filter((item) => item.name.toLowerCase().includes(query));
}

function renderList() {
  const items = currentItems();
  const info = sectionInfo[state.currentSection];

  currentSectionLabel.textContent = info.title;
  sectionMeta.textContent = `${items.length} із ${state.sections[state.currentSection].length} предметів`;

  if (items.length === 0) {
    itemList.innerHTML = '<div class="loader">Нічого не знайдено.</div>';
    return;
  }

  itemList.innerHTML = items.map((item) => `
    <button class="item-row" data-key="${item.key}">
      ${item.type === "action"
        ? `<span class="action-symbol">${item.icon}</span>`
        : `<img src="${item.img}" alt="${item.name}">`}
      <span>
        <strong>${item.name}</strong>
        <small>${item.type === "action" ? "челендж" : `${item.cost} золота`}</small>
      </span>
    </button>
  `).join("");

  itemList.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.sections[state.currentSection].find((entry) => entry.key === button.dataset.key);
      selectItem(item);
    });
  });
}

function selectItem(item) {
  state.selectedItem = item;

  if (item.type === "action") {
    itemCard.innerHTML = `
      <div class="item-hero">
        <div class="action-hero">${item.icon}</div>
        <div>
          <div class="item-name">${item.name}</div>
          <div class="item-section">${item.sectionTitle}</div>
        </div>
      </div>
      <div class="price">${item.cost > 0 ? `${item.cost} золота` : "без ціни"}</div>
      <p class="item-lore">${item.lore}</p>
      <div class="item-note">${item.note}</div>
    `;
    return;
  }

  itemCard.innerHTML = `
    <div class="item-hero">
      <img class="item-icon" src="${item.img}" alt="${item.name}">
      <div>
        <div class="item-name">${item.name}</div>
        <div class="item-section">${item.sectionTitle}</div>
      </div>
    </div>
    <div class="price">${item.cost} золота</div>
    <p class="item-lore">${item.lore || "Без опису лору в даних."}</p>
    <div class="item-note">${item.note || "Предмет належить тільки до цієї секції."}</div>
  `;
}

function rollFromSection() {
  const items = currentItems();

  if (items.length === 0) {
    return;
  }

  selectItem(items[Math.floor(Math.random() * items.length)]);
}

function rollFromAll() {
  const all = sectionOrder.flatMap((section) => state.sections[section]);
  selectItem(all[Math.floor(Math.random() * all.length)]);
}

function render() {
  renderSections();
  renderList();
}

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  renderList();
});

randomSection.addEventListener("click", rollFromSection);
randomAll.addEventListener("click", rollFromAll);

loadItems()
  .then(() => {
    render();
    rollFromSection();
  })
  .catch((error) => {
    itemCard.innerHTML = `<div class="loader">${error.message}</div>`;
  });
