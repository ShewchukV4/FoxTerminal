(function () {
  const SESSION_GOAL = 15; // нових оцінок у сесії (пропуск НЕ рахується)
  const HERO_BG =
    "https://image.tmdb.org/t/p/w1280/xJHokMblJvgxJs38KmMcMhbwOFG.jpg";
  const HYDRATE_PAGES = 400; // ~400*20*2 ≈ 16 000+ titles

  let coldPool = [];
  let coldIndex = 0;
  let sessionRated = 0; // лише реальні оцінки в цій сесії
  let hydrating = false;

  function ratedIdSet() {
    return new Set(KadrStorage.getRatings().map((r) => r.id));
  }

  function isRatedItem(item) {
    if (!item) return true;
    return KadrStorage.getScore(item.mediaType, item.tmdbId) != null;
  }

  /** Пропускає вже оцінені картки в пулі (пропуск сесії їх не чіпає). */
  function advanceToRateable() {
    while (coldIndex < coldPool.length && isRatedItem(coldPool[coldIndex])) {
      coldIndex++;
    }
  }

  const nav = document.getElementById("top-nav");

  function hasKey() {
    return Boolean(KadrTmdb.apiKey());
  }

  function route() {
    const hash = (location.hash || "#/").replace(/^#/, "") || "/";
    const path = hash.startsWith("/") ? hash : "/" + hash;
    document.querySelectorAll(".view").forEach((el) => el.classList.remove("is-active"));
    document.querySelectorAll(".nav-link").forEach((el) => el.classList.remove("is-active"));

    let view = "home";
    if (path.startsWith("/rate")) view = "rate";
    else if (path.startsWith("/discover")) view = "discover";
    else if (path.startsWith("/ratings")) view = "ratings";
    else if (path.startsWith("/settings")) view = "settings";

    if (!hasKey() && view !== "settings" && view !== "home") {
      location.hash = "#/settings";
      return;
    }

    const el = document.getElementById("view-" + view);
    if (el) el.classList.add("is-active");
    const link = document.querySelector('.nav-link[data-route="' + view + '"]');
    if (link) link.classList.add("is-active");
    nav.classList.toggle("is-home", view === "home");

    if (view === "home") renderHome();
    if (view === "rate") void startRate();
    if (view === "discover") void renderDiscover();
    if (view === "ratings") void renderRatings();
    if (view === "settings") void renderSettings();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function posterHtml(item, extraClass) {
    const cls = "poster " + (extraClass || "");
    const url = item.posterUrl || (item.posterPath ? KadrTmdb.posterUrl(item.posterPath) : null);
    if (url) {
      return (
        '<div class="' +
        cls +
        '"><img src="' +
        url +
        '" alt="' +
        escapeHtml(item.title) +
        '" loading="lazy" onerror="this.parentNode.innerHTML=\'<div class=poster-fallback>' +
        escapeHtml(item.title).replace(/'/g, "") +
        "</div>\'\"></div>"
      );
    }
    return (
      '<div class="' +
      cls +
      '"><div class="poster-fallback">' +
      escapeHtml(item.title) +
      "</div></div>"
    );
  }

  function scaleHtml(mediaType, tmdbId, active) {
    let html = '<div class="score-row" role="group" aria-label="Оцінка 1–10">';
    for (let n = 1; n <= 10; n++) {
      html +=
        '<button type="button" class="score-btn' +
        (active === n ? " is-active" : "") +
        '" data-media="' +
        mediaType +
        '" data-tmdb="' +
        tmdbId +
        '" data-score="' +
        n +
        '">' +
        n +
        "</button>";
    }
    return html + "</div>";
  }

  function bindScores(root, onDone) {
    root.querySelectorAll("[data-tmdb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        KadrStorage.setRating(
          btn.getAttribute("data-media"),
          Number(btn.getAttribute("data-tmdb")),
          Number(btn.getAttribute("data-score")),
        );
        if (onDone) onDone();
      });
    });
  }

  async function renderHome() {
    const root = document.getElementById("view-home");
    const count = hasKey() ? await KadrStorage.catalogCount() : 0;
    const rated = KadrStorage.ratingCount();
    root.innerHTML =
      '<section class="hero-stage">' +
      '<div class="hero-bg" style="background-image:url(' +
      HERO_BG +
      ')" aria-hidden="true"></div>' +
      '<div style="position:relative;z-index:10;width:100%;max-width:48rem;padding:8rem 1.25rem 5rem">' +
      '<p class="display fade-up" style="font-size:clamp(3.5rem,10vw,6rem);line-height:1;margin:0 0 1.5rem">Кадр</p>' +
      '<h1 class="fade-up-delay" style="font-size:clamp(1.15rem,2.5vw,1.5rem);font-weight:500;max-width:28rem;margin:0 0 1rem;line-height:1.35">Оціни фільми й серіали — підберемо наступне.</h1>' +
      '<p class="muted fade-up-delay" style="max-width:30rem;margin:0 0 2rem;line-height:1.6">Каталог TMDB: фільми та серіали з обкладинками. ' +
      (hasKey()
        ? "У кеші <strong style=\"color:var(--ink)\">" +
          count.toLocaleString("uk-UA") +
          "</strong> назв · твоїх оцінок: " +
          rated +
          "."
        : "Спочатку додай безкоштовний TMDB API ключ.") +
      "</p>" +
      '<div class="fade-up-delay" style="display:flex;flex-wrap:wrap;gap:0.75rem">' +
      (hasKey()
        ? '<a class="btn-primary" href="#/rate">Почати оцінку</a><a class="btn-ghost" href="#/discover">Моя підбірка</a><a class="btn-ghost" href="#/settings">Каталог / ключ</a>'
        : '<a class="btn-primary" href="#/settings">Підключити TMDB</a>') +
      "</div></div></section>";
  }

  async function ensureHydratedHint() {
    const count = await KadrStorage.catalogCount();
    if (count >= 5000 || hydrating || !hasKey()) return;
    // soft background fill if catalog is still small
    void startHydrate(false);
  }

  async function startHydrate(force) {
    if (!hasKey() || hydrating) return;
    const count = await KadrStorage.catalogCount();
    if (!force && count >= 8000) return;
    hydrating = true;
    const bar = document.getElementById("hydrate-status");
    try {
      await KadrTmdb.hydrateCatalog({
        pagesPerType: HYDRATE_PAGES,
        onProgress: (p) => {
          if (!bar) return;
          bar.textContent =
            "Завантаження каталогу: " +
            p.media +
            " · стор. " +
            p.page +
            "/" +
            p.pagesPerType +
            " · уже " +
            p.saved.toLocaleString("uk-UA") +
            " назв";
        },
      });
      if (bar) {
        const total = await KadrStorage.catalogCount();
        bar.textContent = "Каталог готовий: " + total.toLocaleString("uk-UA") + " фільмів і серіалів";
      }
    } catch (e) {
      if (bar) bar.textContent = "Помилка завантаження: " + (e.message || e);
    } finally {
      hydrating = false;
    }
  }

  async function renderSettings() {
    const root = document.getElementById("view-settings");
    const settings = KadrStorage.getSettings();
    const count = await KadrStorage.catalogCount();
    root.innerHTML =
      '<div class="page-wrap fade-up">' +
      '<p class="accent" style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 0.75rem">Налаштування</p>' +
      '<h1 class="display" style="font-size:clamp(2rem,4vw,3rem);margin:0 0 1rem">TMDB каталог</h1>' +
      '<p class="muted" style="line-height:1.6;margin:0 0 1.5rem">Безкоштовний ключ відкриває сотні тисяч фільмів і серіалів з офіційними постерами. Отримай на ' +
      '<a class="accent" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org/settings/api</a>.</p>' +
      '<label class="muted" style="display:block;margin-bottom:0.5rem">API Key</label>' +
      '<input id="api-key-input" type="password" autocomplete="off" placeholder="встав ключ" value="' +
      escapeHtml(settings.apiKey || "") +
      '" style="width:100%;max-width:28rem;padding:0.85rem 1rem;border-radius:12px;border:1px solid var(--line);background:var(--bg-elevated);color:var(--ink);margin-bottom:1rem">' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.5rem">' +
      '<button type="button" class="btn-primary" id="btn-save-key">Зберегти ключ</button>' +
      '<button type="button" class="btn-ghost" id="btn-hydrate">Завантажити ~10 000+ назв</button>' +
      "</div>" +
      '<p class="muted" id="hydrate-status">У локальному кеші зараз: <strong style="color:var(--ink)">' +
      count.toLocaleString("uk-UA") +
      "</strong> назв. Підбірка також тягне рекомендації TMDB наживо.</p>" +
      '<p class="muted" style="margin-top:1.5rem;font-size:0.85rem">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>' +
      "</div>";

    document.getElementById("btn-save-key").addEventListener("click", async () => {
      const key = document.getElementById("api-key-input").value.trim();
      const status = document.getElementById("hydrate-status");
      if (!key) {
        status.textContent = "Встав API ключ.";
        return;
      }
      status.textContent = "Перевіряю ключ…";
      const ok = await KadrTmdb.verifyKey(key);
      if (!ok) {
        status.textContent = "Ключ невірний або TMDB недоступний.";
        return;
      }
      KadrStorage.setSettings({ apiKey: key });
      status.textContent = "Ключ збережено. Можна завантажити каталог або одразу оцінювати.";
      void startHydrate(false);
    });

    document.getElementById("btn-hydrate").addEventListener("click", () => {
      void startHydrate(true);
    });
  }

  async function startRate() {
    const root = document.getElementById("view-rate");
    root.innerHTML =
      '<div class="center-empty"><p class="muted">Готуємо нові неоцінені фільми й серіали…</p></div>';
    try {
      void ensureHydratedHint();
      sessionRated = 0;
      coldPool = await KadrTmdb.fetchColdStartPool(ratedIdSet(), 28);
      coldIndex = 0;
      advanceToRateable();
      renderRateCard();
    } catch (e) {
      root.innerHTML =
        '<div class="center-empty"><p style="color:var(--accent-hot)">' +
        escapeHtml(e.message || String(e)) +
        '</p><a class="btn-primary" href="#/settings">Налаштування</a></div>';
    }
  }

  async function refillPoolIfNeeded() {
    advanceToRateable();
    if (coldIndex < coldPool.length) return true;
    const more = await KadrTmdb.fetchColdStartPool(ratedIdSet(), 24);
    if (!more.length) return false;
    coldPool = more;
    coldIndex = 0;
    advanceToRateable();
    return coldIndex < coldPool.length;
  }

  function finishRateSession() {
    const root = document.getElementById("view-rate");
    const ratedCount = KadrStorage.ratingCount();
    root.innerHTML =
      '<div class="center-empty fade-up">' +
      '<h1 class="display" style="font-size:2.75rem;margin:0">Дякуємо</h1>' +
      '<p class="muted" style="max-width:28rem;line-height:1.6">У цій сесії нових оцінок: ' +
      sessionRated +
      ". Усього збережено: " +
      ratedCount +
      ". Підбірка враховує всі твої оцінки.</p>" +
      '<a class="btn-primary" href="#/discover">Відкрити підбірку</a>' +
      '<button type="button" class="btn-ghost" id="btn-more-rate">Ще неоцінені</button></div>';
    const more = document.getElementById("btn-more-rate");
    if (more) more.addEventListener("click", () => void startRate());
  }

  function onSkip() {
    // пропуск — не оцінка, не прогрес сесії
    coldIndex++;
    advanceToRateable();
    void (async () => {
      if (coldIndex >= coldPool.length) {
        const ok = await refillPoolIfNeeded();
        if (!ok) {
          finishRateSession();
          return;
        }
      }
      renderRateCard();
    })();
  }

  function onRatedScore() {
    sessionRated++;
    coldIndex++;
    advanceToRateable();
    if (sessionRated >= SESSION_GOAL) {
      location.hash = "#/discover";
      return;
    }
    void (async () => {
      if (coldIndex >= coldPool.length) {
        const ok = await refillPoolIfNeeded();
        if (!ok) {
          finishRateSession();
          return;
        }
      }
      renderRateCard();
    })();
  }

  function renderRateCard() {
    const root = document.getElementById("view-rate");
    const ratedCount = KadrStorage.ratingCount();
    advanceToRateable();

    if (!coldPool.length || coldIndex >= coldPool.length) {
      void (async () => {
        const ok = await refillPoolIfNeeded();
        if (!ok) finishRateSession();
        else renderRateCard();
      })();
      return;
    }

    const current = coldPool[coldIndex];
    if (isRatedItem(current)) {
      coldIndex++;
      advanceToRateable();
      void (async () => {
        if (coldIndex >= coldPool.length) {
          const ok = await refillPoolIfNeeded();
          if (!ok) finishRateSession();
          else renderRateCard();
          return;
        }
        renderRateCard();
      })();
      return;
    }

    const progress = Math.min(100, (sessionRated / SESSION_GOAL) * 100);
    const meta = [
      current.kindLabel,
      current.year,
      (current.genres || []).slice(0, 2).join(" · "),
    ]
      .filter(Boolean)
      .join(" · ");

    root.innerHTML =
      '<div class="rate-layout">' +
      '<div class="poster-swap">' +
      posterHtml(current) +
      "</div>" +
      '<div class="fade-up" style="display:flex;flex-direction:column;justify-content:center;gap:1.5rem">' +
      '<div><p class="accent" style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 0.75rem">Оціни ' +
      (current.mediaType === "tv" ? "серіал" : "фільм") +
      '</p><h1 class="display" style="font-size:clamp(2rem,4vw,3rem);line-height:1;margin:0 0 0.5rem">' +
      escapeHtml(current.title) +
      '</h1><p class="muted" style="margin:0">' +
      escapeHtml(meta) +
      "</p></div>" +
      (current.overview
        ? '<p class="muted line-clamp-4" style="max-width:36rem;line-height:1.6;margin:0">' +
          escapeHtml(current.overview) +
          "</p>"
        : "") +
      '<div><p class="muted" style="font-size:0.9rem;margin:0 0 0.75rem">1–10 · клавіші 1–9, 0=10 · S / Пропустити — без оцінки</p>' +
      scaleHtml(current.mediaType, current.tmdbId, null) +
      "</div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:0.75rem">' +
      '<button type="button" class="btn-ghost" id="btn-skip">Пропустити</button>' +
      (ratedCount >= 5 ? '<a class="btn-primary" href="#/discover">До підбірки</a>' : "") +
      "</div>" +
      '<div><div class="muted" style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:0.5rem">' +
      "<span>Нових оцінок у сесії " +
      sessionRated +
      "/" +
      SESSION_GOAL +
      "</span><span>Усього збережено: " +
      ratedCount +
      "</span></div>" +
      '<div style="height:6px;overflow:hidden;border-radius:999px;background:var(--bg-elevated)"><div class="progress-fill" style="width:' +
      progress +
      '%"></div></div></div></div></div>';

    bindScores(root, onRatedScore);
    document.getElementById("btn-skip").addEventListener("click", onSkip);
  }

  async function renderDiscover() {
    const root = document.getElementById("view-discover");
    const ratings = KadrStorage.getRatings();
    if (ratings.length < 5) {
      root.innerHTML =
        '<div class="center-empty fade-up">' +
        '<h1 class="display" style="font-size:2.5rem;margin:0">Ще трохи оцінок</h1>' +
        '<p class="muted">Потрібно щонайменше 5. Зараз: ' +
        ratings.length +
        '.</p><a class="btn-primary" href="#/rate">Оцінити</a></div>';
      return;
    }

    root.innerHTML =
      '<div class="center-empty"><p class="muted">Збираємо підбірку фільмів і серіалів…</p></div>';

    try {
      const ratedIds = new Set(ratings.map((r) => r.id));
      const catalogPool = await KadrStorage.sampleCatalog(400, ratedIds);
      const result = await KadrRecommend.buildRecommendations({
        ratings,
        getTitle: (id) => KadrStorage.getTitle(id),
        fetchRecs: (item) => KadrTmdb.fetchRecommendationsFor(item),
        discoverByGenres: (mt, ids, page) => KadrTmdb.discoverByGenres(mt, ids, page),
        catalogPool,
        limit: 24,
      });

      // persist any new candidates
      await KadrStorage.putTitles(result.recommendations.map((r) => r.item));

      const tasteLine = result.taste.length
        ? result.taste.map((t) => t.label).join(" · ")
        : "унікальний мікс";

      let html =
        '<div class="page-wrap fade-up">' +
        '<p class="accent" style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 0.75rem">Твій смак</p>' +
        '<h1 class="display" style="font-size:clamp(2rem,4vw,3rem);line-height:1.15;margin:0 0 1rem">' +
        escapeHtml(tasteLine) +
        '</h1><p class="muted" style="max-width:36rem;line-height:1.6;margin:0 0 2.5rem">' +
        "Ураховано всі " +
        result.ratingCount +
        " оцінок · TMDB фільми + серіали" +
        (result.hybridActive ? " · similar/recommendations" : "") +
        ".</p>";

      if (!result.recommendations.length) {
        html +=
          '<p class="muted">Не вдалося зібрати підбірку. Додай ще оцінок або онови каталог у налаштуваннях.</p>';
      }

      for (const rec of result.recommendations) {
        const m = rec.item;
        const local = KadrStorage.getScore(m.mediaType, m.tmdbId);
        html +=
          '<article class="rec-row">' +
          posterHtml(m) +
          "<div><div style=\"display:flex;gap:0.5rem;align-items:baseline;flex-wrap:wrap\">" +
          '<h2 class="display" style="font-size:1.55rem;margin:0;line-height:1.15">' +
          escapeHtml(m.title) +
          '</h2><span class="muted" style="font-size:0.8rem">' +
          escapeHtml(m.kindLabel) +
          "</span></div>" +
          '<p class="muted" style="font-size:0.9rem;margin:0.35rem 0 0.75rem">' +
          escapeHtml([m.year, (m.genres || []).slice(0, 2).join(" · ")].filter(Boolean).join(" · ")) +
          '</p><p class="accent" style="font-size:0.9rem;margin:0 0 1rem">' +
          escapeHtml(rec.reason) +
          "</p>" +
          (m.overview
            ? '<p class="muted line-clamp-3" style="font-size:0.9rem;line-height:1.55;margin:0 0 1rem">' +
              escapeHtml(m.overview) +
              "</p>"
            : "") +
          scaleHtml(m.mediaType, m.tmdbId, local) +
          "</div></article>";
      }
      html += "</div>";
      root.innerHTML = html;
      bindScores(root, () => void renderDiscover());
    } catch (e) {
      root.innerHTML =
        '<div class="center-empty"><p style="color:var(--accent-hot)">' +
        escapeHtml(e.message || String(e)) +
        '</p><a class="btn-primary" href="#/settings">Налаштування</a></div>';
    }
  }

  async function renderRatings() {
    const root = document.getElementById("view-ratings");
    const ratings = KadrStorage.getRatings();
    if (!ratings.length) {
      root.innerHTML =
        '<div class="center-empty fade-up"><h1 class="display" style="font-size:2.5rem;margin:0">Поки порожньо</h1>' +
        '<a class="btn-primary" href="#/rate">Почати оцінку</a></div>';
      return;
    }

    const items = await KadrStorage.getTitlesByIds(ratings.map((r) => r.id));
    const byId = new Map(items.map((i) => [i.id, i]));

    let html =
      '<div class="page-wrap wide fade-up">' +
      '<h1 class="display" style="font-size:clamp(2rem,4vw,3rem);margin:0 0 0.5rem">Мої оцінки</h1>' +
      '<p class="muted" style="margin:0 0 2rem">' +
      ratings.length +
      " · фільми та серіали</p><div class=\"ratings-grid\">";

    for (const r of ratings) {
      const m = byId.get(r.id);
      if (!m) continue;
      html +=
        "<article>" +
        posterHtml(m) +
        '<h2 class="display" style="font-size:1.2rem;margin:1rem 0 0.25rem">' +
        escapeHtml(m.title) +
        '</h2><p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">' +
        escapeHtml(m.kindLabel) +
        " · " +
        (m.year || "") +
        " · " +
        r.score +
        "/10</p>" +
        scaleHtml(m.mediaType, m.tmdbId, r.score) +
        "</article>";
    }
    html += "</div></div>";
    root.innerHTML = html;
    bindScores(root, () => void renderRatings());
  }

  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("view-rate").classList.contains("is-active")) return;
    if (!coldPool.length || coldIndex >= coldPool.length) return;
    const current = coldPool[coldIndex];
    if (!current || isRatedItem(current)) return;
    if (e.key >= "1" && e.key <= "9") {
      KadrStorage.setRating(current.mediaType, current.tmdbId, Number(e.key));
      onRatedScore();
    }
    if (e.key === "0") {
      KadrStorage.setRating(current.mediaType, current.tmdbId, 10);
      onRatedScore();
    }
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "s") {
      onSkip();
    }
  });

  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/";
  route();
  if (hasKey()) void ensureHydratedHint();
})();
