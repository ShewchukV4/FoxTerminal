(function (global) {
  const NEUTRAL = 5.5;
  const MMR_LAMBDA = 0.62;

  function genreVector(item) {
    const v = {};
    for (const g of item.genres || []) {
      v["g:" + g] = (v["g:" + g] || 0) + 1;
    }
    if (item.mediaType) v["m:" + item.mediaType] = 1.2;
    if (item.year) v["y:" + String(Math.floor(item.year / 10) * 10)] = 0.4;
    return normalize(v);
  }

  function normalize(v) {
    const n = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
    if (!n) return v;
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = val / n;
    return out;
  }

  function cosine(a, b) {
    let dot = 0;
    for (const k of Object.keys(a)) {
      if (b[k]) dot += a[k] * b[k];
    }
    return dot;
  }

  function buildProfile(ratedItems) {
    let acc = {};
    for (const { item, score } of ratedItems) {
      const w = score - NEUTRAL;
      if (Math.abs(w) < 0.01) continue;
      const vec = genreVector(item);
      for (const [k, val] of Object.entries(vec)) {
        acc[k] = (acc[k] || 0) + val * w;
      }
    }
    return normalize(acc);
  }

  function tasteLabels(profile, limit) {
    limit = limit || 6;
    return Object.entries(profile)
      .filter(([k, w]) => w > 0 && k.startsWith("g:"))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k]) => ({ label: k.slice(2), kind: "жанр" }));
  }

  function mmr(candidates, limit) {
    const selected = [];
    const remaining = candidates.slice();
    while (selected.length < limit && remaining.length) {
      let bestIdx = 0;
      let bestVal = -Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        let maxSim = 0;
        for (const s of selected) {
          maxSim = Math.max(maxSim, cosine(cand.vec, s.vec));
        }
        const val = MMR_LAMBDA * cand.score - (1 - MMR_LAMBDA) * maxSim;
        if (val > bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }
      selected.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }
    return selected;
  }

  function reason(item, profile, boost) {
    let best = 0;
    let genre = "";
    for (const g of item.genres || []) {
      const w = profile["g:" + g] || 0;
      if (w > best) {
        best = w;
        genre = g;
      }
    }
    if (boost >= 2) return "Часто зʼявляється поруч із твоїми улюбленцями";
    if (genre) return "Близько до смаку в жанрі «" + genre + "»";
    if (item.mediaType === "tv") return "Серіал під твій профіль";
    return "Фільм під твій профіль";
  }

  /**
   * Build recommendations from TMDB-sourced candidates + local catalog.
   */
  async function buildRecommendations(opts) {
    const ratings = opts.ratings || [];
    const getTitle = opts.getTitle;
    const fetchRecs = opts.fetchRecs;
    const discoverByGenres = opts.discoverByGenres;
    const catalogPool = opts.catalogPool || [];
    const limit = opts.limit || 24;

    const ratedIds = new Set(ratings.map((r) => r.id));
    const ratedItems = [];
    for (const r of ratings) {
      const item = await getTitle(r.id);
      if (item) ratedItems.push({ item, score: r.score });
    }

    if (ratedItems.length < 3) {
      return { recommendations: [], taste: [], hybridActive: false, ratingCount: ratings.length };
    }

    // Профіль зі ВСІХ оцінок (не лише останніх)
    const profile = buildProfile(ratedItems);
    const byScore = ratedItems.slice().sort((a, b) => b.score - a.score);
    const liked = byScore.filter((x) => x.score >= 7);
    // для TMDB-графа — усі високі оцінки; якщо їх мало, беремо топ з усіх
    const seedForGraph = (liked.length ? liked : byScore).slice(0, 40);

    const candidateMap = new Map();
    const bump = (item, amount) => {
      if (!item || !item.posterPath || ratedIds.has(item.id)) return;
      const prev = candidateMap.get(item.id);
      if (prev) {
        prev.boost += amount;
        prev.item = item;
      } else {
        candidateMap.set(item.id, { item, boost: amount, vec: genreVector(item) });
      }
    };

    // TMDB similar/recommendations по всіх seed-оцінках (паралельно пачками)
    async function mapPool(items, concurrency, fn) {
      const q = items.slice();
      const workers = Array.from({ length: concurrency }, async () => {
        while (q.length) {
          const next = q.shift();
          if (next) await fn(next);
        }
      });
      await Promise.all(workers);
    }

    await mapPool(seedForGraph, 3, async ({ item, score }) => {
      try {
        const recs = await fetchRecs(item);
        const weight = Math.max(0.25, (score - NEUTRAL) / 4.5);
        for (const rec of recs) bump(rec, 1 + weight);
      } catch {
        /* ignore */
      }
    });

    // Discover за жанрами з усіх позитивних оцінок
    const topGenres = tasteLabels(profile, 4).map((t) => t.label);
    const movieGenreIds = {};
    const tvGenreIds = {};
    for (const { item, score } of ratedItems) {
      if (score < 6) continue;
      const bag = item.mediaType === "tv" ? tvGenreIds : movieGenreIds;
      const w = score - NEUTRAL;
      for (const gid of item.genreIds || []) {
        bag[gid] = (bag[gid] || 0) + w;
      }
    }
    const topMovieIds = Object.entries(movieGenreIds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => Number(id));
    const topTvIds = Object.entries(tvGenreIds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => Number(id));

    try {
      const jobs = [];
      if (topMovieIds.length) jobs.push(discoverByGenres("movie", topMovieIds, 1));
      if (topTvIds.length) jobs.push(discoverByGenres("tv", topTvIds, 1));
      // якщо оцінені лише фільми — все одно підкинемо популярні серіали суміжних жанрів
      if (topMovieIds.length && !topTvIds.length) {
        jobs.push(discoverByGenres("tv", [18, 35, 10765], 1));
      }
      if (topTvIds.length && !topMovieIds.length) {
        jobs.push(discoverByGenres("movie", [18, 35, 878], 1));
      }
      const batches = await Promise.all(jobs);
      for (const batch of batches) batch.forEach((x) => bump(x, 0.85));
    } catch {
      /* ignore */
    }

    for (const item of catalogPool) bump(item, 0.35);

    const scored = [...candidateMap.values()].map((c) => {
      const content = cosine(profile, c.vec);
      const score = content * 0.55 + Math.min(c.boost, 4) * 0.2 + (c.item.voteAverage / 10) * 0.15;
      return {
        movie: c.item,
        item: c.item,
        score,
        contentScore: content,
        boost: c.boost,
        vec: c.vec,
        reason: reason(c.item, profile, c.boost),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const picked = mmr(scored.slice(0, 120), limit);

    return {
      recommendations: picked,
      taste: tasteLabels(profile),
      hybridActive: seedForGraph.length > 0,
      ratingCount: ratings.length,
      topGenres,
    };
  }

  global.KadrRecommend = { buildRecommendations, genreVector, buildProfile, tasteLabels };
})(window);
