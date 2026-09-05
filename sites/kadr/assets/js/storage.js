(function (global) {
  const RATINGS_KEY = "kadr.ratings.v2";
  const SETTINGS_KEY = "kadr.settings.v1";
  const DB_NAME = "kadr-catalog";
  const DB_VERSION = 1;
  const STORE = "titles";

  function loadRatings() {
    try {
      return JSON.parse(localStorage.getItem(RATINGS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveRatings(map) {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(map));
  }

  function ratingKey(mediaType, tmdbId) {
    return mediaType + ":" + tmdbId;
  }

  function getRatings() {
    return Object.entries(loadRatings()).map(([key, score]) => {
      const [mediaType, id] = key.split(":");
      return {
        userId: "me",
        mediaType,
        tmdbId: Number(id),
        id: key,
        score: Number(score),
      };
    });
  }

  function getScore(mediaType, tmdbId) {
    const map = loadRatings();
    const v = map[ratingKey(mediaType, tmdbId)];
    return v != null ? Number(v) : null;
  }

  function setRating(mediaType, tmdbId, score) {
    const map = loadRatings();
    map[ratingKey(mediaType, tmdbId)] = score;
    saveRatings(map);
  }

  function ratingCount() {
    return Object.keys(loadRatings()).length;
  }

  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function setSettings(patch) {
    const next = Object.assign({}, getSettings(), patch);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("mediaType", "mediaType", { unique: false });
          store.createIndex("popularity", "popularity", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function putTitles(items) {
    if (!items.length) return;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function getTitle(id) {
    const db = await openDb();
    const item = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return item;
  }

  async function getTitlesByIds(ids) {
    const out = [];
    for (const id of ids) {
      const item = await getTitle(id);
      if (item) out.push(item);
    }
    return out;
  }

  async function catalogCount() {
    const db = await openDb();
    const count = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return count;
  }

  async function sampleCatalog(limit, ratedIds) {
    ratedIds = ratedIds || new Set();
    const db = await openDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("popularity").openCursor(null, "prev");
      const acc = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || acc.length >= limit * 3) {
          resolve(acc);
          return;
        }
        const v = cursor.value;
        if (v && v.posterPath && !ratedIds.has(v.id)) acc.push(v);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items;
  }

  async function allCatalogForRecs(max) {
    max = max || 8000;
    const db = await openDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).slice(0, max));
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items;
  }

  global.KadrStorage = {
    getRatings,
    getScore,
    setRating,
    ratingCount,
    getSettings,
    setSettings,
    putTitles,
    getTitle,
    getTitlesByIds,
    catalogCount,
    sampleCatalog,
    allCatalogForRecs,
    ratingKey,
  };
})(window);
