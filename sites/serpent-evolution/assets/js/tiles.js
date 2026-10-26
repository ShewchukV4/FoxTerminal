/* FOX SERPENT — functional tile types (simulation rules, not just colors) */
(function (FS) {
  "use strict";

  FS.GENERATOR_VERSION = 3;

  FS.TILE_TYPES = {
    meadow: {
      id: "meadow", name: "Луг", walk: true, farm: false, slowMul: 1,
      detectMul: 1, desc: "Звичайний безпечний прохід"
    },
    fertile: {
      id: "fertile", name: "Родючий ґрунт", walk: true, farm: true, farmMul: 1.35, slowMul: 1,
      detectMul: 1, desc: "Підходить для ферми, швидший ріст"
    },
    soil: {
      id: "soil", name: "Звичайний ґрунт", walk: true, farm: true, farmMul: 1, slowMul: 1,
      detectMul: 1, desc: "Ферма з базовим темпом"
    },
    path: {
      id: "path", name: "Стежка", walk: true, farm: false, slowMul: 0.88, logistics: true,
      detectMul: 1, desc: "Швидший крок і бонус логістики"
    },
    mud: {
      id: "mud", name: "Багнюка", walk: true, farm: false, slowMul: 1.35,
      detectMul: 1, desc: "Тимчасово сповільнює крок"
    },
    shallow: {
      id: "shallow", name: "Мілководдя", walk: true, farm: false, slowMul: 1.25, waterBoost: true,
      detectMul: 1, desc: "Повільний прохід; користь сусідній фермі"
    },
    deep: {
      id: "deep", name: "Глибока вода", walk: false, farm: false, water: true,
      detectMul: 1, desc: "Непрохідна без мосту"
    },
    stone: {
      id: "stone", name: "Камінь", walk: false, farm: false, block: true,
      detectMul: 1, desc: "Тверда смертельна перешкода"
    },
    thicket: {
      id: "thicket", name: "Зарості", walk: true, farm: false, slowMul: 1.08, detectMul: 0.65,
      detectMul: 0.65, desc: "Знижують дальність виявлення"
    },
    bridge: {
      id: "bridge", name: "Міст", walk: true, farm: false, slowMul: 1, bridge: true,
      detectMul: 1, desc: "Прохід через воду"
    },
    plot: {
      id: "plot", name: "Грядка", walk: true, farm: true, farmMul: 1.1, built: true,
      detectMul: 1, desc: "Посадка, ріст, урожай"
    },
    home_door: {
      id: "home_door", name: "Вхід у домівку", walk: true, farm: false, door: true,
      detectMul: 1, desc: "Безпечний прийом/випуск союзника"
    }
  };

  FS.tileDef = function (tile) {
    if (!tile) return FS.TILE_TYPES.meadow;
    var id = tile.tt || (tile.block ? "stone" : "meadow");
    return FS.TILE_TYPES[id] || FS.TILE_TYPES.meadow;
  };

  FS.tileWalkable = function (tile) {
    var d = FS.tileDef(tile);
    if (tile && tile.block) return false;
    return !!d.walk;
  };

  FS.tileStepMul = function (state, x, y) {
    var t = FS.tileAt(state.world, x, y);
    var d = FS.tileDef(t);
    return d.slowMul || 1;
  };

  FS.makeTile = function (x, y, tt, extra) {
    var d = FS.TILE_TYPES[tt] || FS.TILE_TYPES.meadow;
    var tile = {
      x: x, y: y, tt: tt,
      block: !d.walk || !!d.block,
      biome: (extra && extra.biome) || "garden",
      moss: (extra && extra.moss) != null ? extra.moss : 0.5
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (k !== "moss" && k !== "biome") tile[k] = extra[k];
      });
    }
    // bridge over deep: walkable
    if (tt === "bridge") tile.block = false;
    if (tt === "deep" || tt === "stone") tile.block = true;
    return tile;
  };

  FS.describeTile = function (tile) {
    var d = FS.tileDef(tile);
    return {
      name: d.name,
      walk: FS.tileWalkable(tile),
      effect: d.desc,
      build: d.farm ? "Можна ферму" : (d.door ? "Домівка" : (tile && tile.tt === "deep" ? "Міст?" : "—"))
    };
  };
})(window.FoxSerpent);
