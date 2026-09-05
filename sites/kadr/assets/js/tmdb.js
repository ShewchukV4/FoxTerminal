(function (global) {
  const BASE = "https://api.themoviedb.org/3";
  const IMG = "https://image.tmdb.org/t/p";
  const LANG = "uk-UA";

  const MOVIE_GENRES = {
    28: "екшн",
    12: "пригоди",
    16: "анімація",
    35: "комедія",
    80: "кримінал",
    99: "документалка",
    18: "драма",
    10751: "сімейний",
    14: "фентезі",
    36: "історія",
    27: "жахи",
    10402: "музика",
    9648: "містика",
    10749: "романтика",
    878: "наукова фантастика",
    53: "трилер",
    10752: "війна",
    37: "вестерн",
  };

  const TV_GENRES = {
    10759: "екшн і пригоди",
    16: "анімація",
    35: "комедія",
    80: "кримінал",
    99: "документалка",
    18: "драма",
    10751: "сімейний",
    10762: "дитячий",
    9648: "містика",
    10763: "новини",
    10764: "реаліті",
    10765: "sci-fi і фентезі",
    10766: "мильна опера",
    10767: "ток-шоу",
    10768: "війна і політика",
    37: "вестерн",
  };

  function apiKey() {
    return (KadrStorage.getSettings().apiKey || "").trim();
  }

  function posterUrl(path, size) {
    if (!path) return null;
    return IMG + "/" + (size || "w500") + path;
  }

  function backdropUrl(path, size) {
    if (!path) return null;
    return IMG + "/" + (size || "w1280") + path;
  }

  async function tmdb(path, params) {
    const key = apiKey();
    if (!key) throw new Error("Немає TMDB API ключа");
    const url = new URL(BASE + path);
    url.searchParams.set("api_key", key);
    url.searchParams.set("language", LANG);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== "") url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error("TMDB " + res.status + ": " + text.slice(0, 120));
    }
    return res.json();
  }

  function normalizeMovie(m) {
    if (!m || !m.id || !m.poster_path) return null;
    const genres = (m.genre_ids || []).map((id) => MOVIE_GENRES[id] || String(id));
    return {
      id: "movie:" + m.id,
      tmdbId: m.id,
      mediaType: "movie",
      title: m.title || m.original_title || "Без назви",
      overview: m.overview || "",
      year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
      posterPath: m.poster_path,
      backdropPath: m.backdrop_path || null,
      posterUrl: posterUrl(m.poster_path),
      backdropUrl: backdropUrl(m.backdrop_path),
      popularity: m.popularity || 0,
      voteAverage: m.vote_average || 0,
      genreIds: m.genre_ids || [],
      genres,
      kindLabel: "фільм",
    };
  }

  function normalizeTv(m) {
    if (!m || !m.id || !m.poster_path) return null;
    const genres = (m.genre_ids || []).map((id) => TV_GENRES[id] || String(id));
    return {
      id: "tv:" + m.id,
      tmdbId: m.id,
      mediaType: "tv",
      title: m.name || m.original_name || "Без назви",
      overview: m.overview || "",
      year: m.first_air_date ? Number(m.first_air_date.slice(0, 4)) : null,
      posterPath: m.poster_path,
      backdropPath: m.backdrop_path || null,
      posterUrl: posterUrl(m.poster_path),
      backdropUrl: backdropUrl(m.backdrop_path),
      popularity: m.popularity || 0,
      voteAverage: m.vote_average || 0,
      genreIds: m.genre_ids || [],
      genres,
      kindLabel: "серіал",
    };
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Hydrate IndexedDB with discover pages for movies + TV.
   * ~20 pages each ≈ 800 titles; targetPages=100 each ≈ 4000; 250 ≈ 10k+ each side.
   */
  async function hydrateCatalog(opts) {
    opts = opts || {};
    const pagesPerType = opts.pagesPerType || 120; // ~2400 movies + ~2400 TV ≈ 4800; user can bump
    const onProgress = opts.onProgress || function () {};
    let saved = 0;
    const types = [
      { media: "movie", path: "/discover/movie", normalize: normalizeMovie },
      { media: "tv", path: "/discover/tv", normalize: normalizeTv },
    ];

    for (const type of types) {
      for (let page = 1; page <= pagesPerType; page++) {
        const data = await tmdb(type.path, {
          sort_by: "popularity.desc",
          include_adult: "false",
          page,
          "vote_count.gte": 40,
        });
        const batch = (data.results || [])
          .map(type.normalize)
          .filter(Boolean);
        await KadrStorage.putTitles(batch);
        saved += batch.length;
        onProgress({
          media: type.media,
          page,
          pagesPerType,
          saved,
          totalEstimate: pagesPerType * 2 * 20,
        });
        // stay under TMDB burst limits
        await sleep(page % 5 === 0 ? 280 : 90);
      }
    }
    return saved;
  }

  function randPage(max) {
    return 1 + Math.floor(Math.random() * max);
  }

  /** Пул для оцінки: лише неоцінені, з різних сторінок + локальний кеш. */
  async function fetchColdStartPool(ratedIds, count) {
    ratedIds = ratedIds || new Set();
    count = count || 28;

    const map = new Map();
    const push = (n) => {
      if (!n || ratedIds.has(n.id) || !n.posterPath || map.has(n.id)) return;
      map.set(n.id, n);
    };

    // спочатку неоцінені з локального каталогу
    try {
      const local = await KadrStorage.sampleCatalog(count * 4, ratedIds);
      local.forEach(push);
    } catch {
      /* ignore */
    }

    const remoteJobs = [
      tmdb("/movie/popular", { page: randPage(40) }),
      tmdb("/movie/popular", { page: randPage(40) }),
      tmdb("/movie/top_rated", { page: randPage(20) }),
      tmdb("/tv/popular", { page: randPage(40) }),
      tmdb("/tv/popular", { page: randPage(40) }),
      tmdb("/tv/top_rated", { page: randPage(20) }),
      tmdb("/discover/movie", {
        sort_by: "popularity.desc",
        "vote_count.gte": 80,
        page: randPage(80),
        include_adult: "false",
      }),
      tmdb("/discover/tv", {
        sort_by: "popularity.desc",
        "vote_count.gte": 60,
        page: randPage(80),
        include_adult: "false",
      }),
      tmdb("/discover/movie", {
        sort_by: "vote_average.desc",
        "vote_count.gte": 400,
        page: randPage(30),
        include_adult: "false",
      }),
      tmdb("/discover/tv", {
        sort_by: "vote_average.desc",
        "vote_count.gte": 300,
        page: randPage(30),
        include_adult: "false",
      }),
    ];

    const pools = await Promise.all(remoteJobs);
    const asMovie = [0, 1, 2, 6, 8];
    pools.forEach((data, idx) => {
      const norm = asMovie.includes(idx) ? normalizeMovie : normalizeTv;
      (data.results || []).forEach((row) => push(norm(row)));
    });

    const list = [...map.values()];
    await KadrStorage.putTitles(list);
    return diversify(list, count).filter((x) => !ratedIds.has(x.id));
  }

  function diversify(list, count) {
    const byGenre = new Map();
    for (const item of list) {
      for (const g of item.genres || []) {
        const arr = byGenre.get(g) || [];
        arr.push(item);
        byGenre.set(g, arr);
      }
    }
    const picked = [];
    const seen = new Set();
    const genres = [...byGenre.keys()];
    let guard = 0;
    while (picked.length < count && guard < count * 5) {
      for (const g of genres) {
        if (picked.length >= count) break;
        const pool = (byGenre.get(g) || []).filter((x) => !seen.has(x.id));
        if (!pool.length) continue;
        pool.sort((a, b) => b.popularity - a.popularity);
        const choice = pool[guard % pool.length];
        seen.add(choice.id);
        picked.push(choice);
      }
      guard++;
    }
    for (const item of list) {
      if (picked.length >= count) break;
      if (!seen.has(item.id)) picked.push(item);
    }
    // mix movie/tv roughly 50/50
    const movies = picked.filter((x) => x.mediaType === "movie");
    const tvs = picked.filter((x) => x.mediaType === "tv");
    const mixed = [];
    for (let i = 0; i < count; i++) {
      const useTv = i % 2 === 1 && tvs.length;
      const next = useTv ? tvs.shift() : movies.shift() || tvs.shift();
      if (next) mixed.push(next);
    }
    return mixed;
  }

  async function fetchRecommendationsFor(item) {
    const path =
      item.mediaType === "tv"
        ? "/tv/" + item.tmdbId + "/recommendations"
        : "/movie/" + item.tmdbId + "/recommendations";
    const similarPath =
      item.mediaType === "tv"
        ? "/tv/" + item.tmdbId + "/similar"
        : "/movie/" + item.tmdbId + "/similar";
    const [rec, sim] = await Promise.all([
      tmdb(path, { page: 1 }),
      tmdb(similarPath, { page: 1 }),
    ]);
    const norm = item.mediaType === "tv" ? normalizeTv : normalizeMovie;
    const out = [];
    for (const row of (rec.results || []).concat(sim.results || [])) {
      const n = norm(row);
      if (n) out.push(n);
    }
    return out;
  }

  async function discoverByGenres(mediaType, genreIds, page) {
    const path = mediaType === "tv" ? "/discover/tv" : "/discover/movie";
    const data = await tmdb(path, {
      with_genres: genreIds.slice(0, 3).join(","),
      sort_by: "popularity.desc",
      include_adult: "false",
      page: page || 1,
      "vote_count.gte": 80,
    });
    const norm = mediaType === "tv" ? normalizeTv : normalizeMovie;
    const batch = (data.results || []).map(norm).filter(Boolean);
    await KadrStorage.putTitles(batch);
    return batch;
  }

  async function verifyKey(key) {
    const url = new URL(BASE + "/configuration");
    url.searchParams.set("api_key", key);
    const res = await fetch(url.toString());
    return res.ok;
  }

  global.KadrTmdb = {
    apiKey,
    posterUrl,
    hydrateCatalog,
    fetchColdStartPool,
    fetchRecommendationsFor,
    discoverByGenres,
    verifyKey,
    normalizeMovie,
    normalizeTv,
    MOVIE_GENRES,
    TV_GENRES,
  };
})(window);
