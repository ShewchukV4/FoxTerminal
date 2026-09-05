const I18N = {
  uk: {
    navShop: "Каталог",
    navAbout: "Про демо",
    cart: "Кошик",
    eyebrow: "локальне демо · без оплати",
    heroTitle: "Мерч FoxTerminal, який ніхто не відправить.",
    heroLede: "Вітрина-пісочниця: стікери, принти й дрібниці з екосистеми. Кошик живе лише в браузері.",
    ctaShop: "Дивитись каталог",
    ctaLucky: "Мені пощастить",
    trust1t: "Миттєво",
    trust1d: "Усе локально. Жодних серверів і кошиків «на потім».",
    trust2t: "Безпечно",
    trust2d: "Оплати немає. Checkout лише показує тост.",
    trust3t: "Fox-стиль",
    trust3d: "Ті самі кольори, що й Hub і FoxTerminal.",
    catalogTitle: "Каталог",
    catalogSub: "Вісім позицій. Фільтр за типом.",
    all: "Усе",
    wear: "Носити",
    desk: "На стіл",
    print: "Принт",
    aboutTitle: "Це не магазин",
    aboutBody: "OnePageStore — пісочниця в Fox Hub. Товари вигадані, ціни умовні, доставки немає. Ідеально, щоб покрутити вітрину, кошик і фільтри без бекенду.",
    cartTitle: "Кошик",
    total: "Разом",
    checkout: "Оформити (демо)",
    add: "У кошик",
    empty: "Порожньо. Каталог чекає.",
    toastAdd: "Додано в кошик",
    toastOut: "Це демо. Гроші нікуди не підуть.",
    skip: "До каталогу",
    close: "Закрити",
    cats: { wear: "Носити", desk: "На стіл", print: "Принт" }
  },
  en: {
    navShop: "Shop",
    navAbout: "About",
    cart: "Cart",
    eyebrow: "local demo · no checkout",
    heroTitle: "FoxTerminal merch that will never ship.",
    heroLede: "A sandbox storefront: stickers, prints, and desk bits. The cart lives in this browser only.",
    ctaShop: "Browse catalog",
    ctaLucky: "Feeling lucky",
    trust1t: "Instant",
    trust1d: "Everything is local. No servers, no abandoned carts.",
    trust2t: "Safe",
    trust2d: "There is no payment. Checkout only shows a toast.",
    trust3t: "Fox look",
    trust3d: "The same palette as Hub and FoxTerminal.",
    catalogTitle: "Catalog",
    catalogSub: "Eight items. Filter by type.",
    all: "All",
    wear: "Wear",
    desk: "Desk",
    print: "Print",
    aboutTitle: "This is not a shop",
    aboutBody: "OnePageStore is a Fox Hub sandbox. Items are fictional, prices are fake, nothing ships. Use it to poke at a storefront, cart, and filters with no backend.",
    cartTitle: "Cart",
    total: "Total",
    checkout: "Checkout (demo)",
    add: "Add",
    empty: "Empty. The catalog is waiting.",
    toastAdd: "Added to cart",
    toastOut: "Demo only. No money moves.",
    skip: "Skip to catalog",
    close: "Close",
    cats: { wear: "Wear", desk: "Desk", print: "Print" }
  }
};

const PRODUCTS = [
  {
    id: "stickers",
    cat: "desk",
    price: 180,
    color: "#e0882a",
    uk: { name: "Набір стікерів", desc: "Лисиці, noir і Zen Companion на матовому вінілі." },
    en: { name: "Sticker Pack", desc: "Fox, noir, and Zen Companion on matte vinyl." }
  },
  {
    id: "noir",
    cat: "print",
    price: 420,
    color: "#9ca3af",
    uk: { name: "Принт Noir", desc: "Афіша теми noir, 30×40, зерно й тиша." },
    en: { name: "Noir Print", desc: "Noir theme poster, 30×40, grain and quiet." }
  },
  {
    id: "pin",
    cat: "wear",
    price: 150,
    color: "#2dd4bf",
    uk: { name: "Пін Companion", desc: "Металевий пін бічної панелі Firefox." },
    en: { name: "Companion Pin", desc: "Metal pin of the Firefox sidebar companion." }
  },
  {
    id: "mug",
    cat: "desk",
    price: 390,
    color: "#fbbf24",
    uk: { name: "Чашка Arthas", desc: "Чашка для довгих сесій і гірких команд." },
    en: { name: "Arthas Mug", desc: "A mug for long sessions and bitter commands." }
  },
  {
    id: "hoodie",
    cat: "wear",
    price: 1650,
    color: "#a78bfa",
    uk: { name: "Худі Fox", desc: "М'який худі з градієнтом Hub." },
    en: { name: "Fox Hoodie", desc: "Soft hoodie with the Hub gradient." }
  },
  {
    id: "keys",
    cat: "desk",
    price: 890,
    color: "#38bdf8",
    uk: { name: "Клавіші Fox", desc: "Набір клавіш для hotkeys і foxhelp." },
    en: { name: "Fox Keycaps", desc: "A keycap set for hotkeys and foxhelp." }
  },
  {
    id: "poster",
    cat: "print",
    price: 510,
    color: "#f472b6",
    uk: { name: "Постер екосистеми", desc: "Карта локальних сайтів на одній стіні." },
    en: { name: "Ecosystem Poster", desc: "A wall map of the local sites." }
  },
  {
    id: "badge",
    cat: "wear",
    price: 120,
    color: "#86efac",
    uk: { name: "Нашивка Ghostty", desc: "Нашивка boot-скрипта Ghostty." },
    en: { name: "Ghostty Badge", desc: "A patch for the Ghostty boot script." }
  }
];

const FOX_SVG = `<svg viewBox="0 0 54 54" fill="none"><path d="M8 25 L15 3 L23 23 Z" fill="currentColor" opacity="0.9"/><path d="M46 25 L39 3 L31 23 Z" fill="currentColor" opacity="0.9"/><ellipse cx="27" cy="32" rx="18" ry="16" fill="currentColor" opacity="0.82"/><circle cx="21" cy="29" r="2.5" fill="#0a0610"/><circle cx="33" cy="29" r="2.5" fill="#0a0610"/></svg>`;

const KEY = "foxden-cart";
let lang = localStorage.getItem("foxden-lang") || "uk";
let filter = "all";
let cart = loadCart();

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(KEY, JSON.stringify(cart));
}

function t() {
  return I18N[lang] || I18N.uk;
}

function formatPrice(n) {
  return `${n} ₴`;
}

function productCopy(p) {
  return p[lang] || p.uk;
}

function applyI18n() {
  const dict = t();
  document.documentElement.lang = lang === "uk" ? "uk" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (dict[key]) el.setAttribute("aria-label", dict[key]);
  });
  document.getElementById("lang-toggle").textContent = lang === "uk" ? "EN" : "UA";
  renderProducts();
  renderCart();
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  const dict = t();
  grid.innerHTML = PRODUCTS.map((p) => {
    const copy = productCopy(p);
    const hidden = filter !== "all" && p.cat !== filter;
    return `
      <article class="card" data-id="${p.id}" ${hidden ? "hidden" : ""}>
        <div class="swatch" style="background:radial-gradient(circle at 30% 20%, ${p.color}55, ${p.color}12 62%, #140c18);color:${p.color}">${FOX_SVG}</div>
        <div class="card-body">
          <span class="card-cat">${dict.cats[p.cat]}</span>
          <h3>${copy.name}</h3>
          <p>${copy.desc}</p>
          <div class="card-row">
            <span class="price">${formatPrice(p.price)}</span>
            <button class="btn primary" type="button" data-add="${p.id}">${dict.add}</button>
          </div>
        </div>
      </article>`;
  }).join("");
}

function cartCount() {
  return cart.reduce((sum, line) => sum + line.qty, 0);
}

function cartTotal() {
  return cart.reduce((sum, line) => {
    const p = PRODUCTS.find((x) => x.id === line.id);
    return sum + (p ? p.price * line.qty : 0);
  }, 0);
}

function updateBadge() {
  const badge = document.getElementById("cart-count");
  const n = cartCount();
  badge.hidden = n === 0;
  badge.textContent = String(n);
}

function renderCart() {
  const body = document.getElementById("cart-body");
  const dict = t();
  document.getElementById("cart-total").textContent = formatPrice(cartTotal());
  document.getElementById("checkout-btn").disabled = cart.length === 0;
  updateBadge();
  if (!cart.length) {
    body.innerHTML = `<p class="empty">${dict.empty}</p>`;
    return;
  }
  body.innerHTML = cart.map((line) => {
    const p = PRODUCTS.find((x) => x.id === line.id);
    if (!p) return "";
    const copy = productCopy(p);
    return `
      <div class="line">
        <div class="mini" style="background:${p.color}33"></div>
        <div>
          <h3>${copy.name}</h3>
          <p>${formatPrice(p.price)}</p>
          <div class="qty">
            <button type="button" data-qty="${p.id}" data-delta="-1" aria-label="-">−</button>
            <span>${line.qty}</span>
            <button type="button" data-qty="${p.id}" data-delta="1" aria-label="+">+</button>
          </div>
        </div>
        <strong>${formatPrice(p.price * line.qty)}</strong>
      </div>`;
  }).join("");
}

function addToCart(id, silent) {
  const existing = cart.find((x) => x.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ id, qty: 1 });
  saveCart();
  renderCart();
  if (!silent) toast(t().toastAdd);
}

function changeQty(id, delta) {
  const line = cart.find((x) => x.id === id);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) cart = cart.filter((x) => x.id !== id);
  saveCart();
  renderCart();
}

let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function openCart() {
  document.getElementById("cart-drawer").hidden = false;
}

function closeCart() {
  document.getElementById("cart-drawer").hidden = true;
}

document.getElementById("lang-toggle").addEventListener("click", () => {
  lang = lang === "uk" ? "en" : "uk";
  localStorage.setItem("foxden-lang", lang);
  applyI18n();
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    filter = chip.dataset.filter;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    renderProducts();
  });
});

document.getElementById("product-grid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  addToCart(btn.dataset.add);
});

document.getElementById("cart-body").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-qty]");
  if (!btn) return;
  changeQty(btn.dataset.qty, Number(btn.dataset.delta));
});

document.getElementById("cart-open").addEventListener("click", openCart);
document.getElementById("cart-close").addEventListener("click", closeCart);
document.getElementById("cart-drawer").addEventListener("click", (e) => {
  if (e.target.id === "cart-drawer") closeCart();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
});

document.getElementById("checkout-btn").addEventListener("click", () => {
  if (!cart.length) return;
  cart = [];
  saveCart();
  renderCart();
  closeCart();
  toast(t().toastOut);
});

document.getElementById("lucky-btn").addEventListener("click", () => {
  const pick = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  addToCart(pick.id);
  openCart();
  document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
});

applyI18n();
