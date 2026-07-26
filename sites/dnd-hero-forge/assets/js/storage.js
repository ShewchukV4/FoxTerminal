'use strict';

const Roster = {
  KEY: 'dnd-hero-forge-roster-v1',
  _saveTimer: null,

  defaultState() {
    return {
      id: crypto.randomUUID(),
      step: 0,
      name: '',
      playerName: '',
      level: 1,
      alignment: 'Невизначений',
      race: null,
      subrace: null,
      variantBonuses: [],
      class: null,
      subclass: null,
      background: null,
      abilityMethod: 'pointbuy',
      abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      rolledSets: [],
      selectedRollSet: null,
      skillProficiencies: [],
      skillExpertise: [],
      extraSkills: [],
      languages: [],
      tools: [],
      equipmentChoice: 0,
      selectedEquipment: [],
      inventoryItems: [],
      customItems: [],
      gold: 0,
      cantrips: [],
      spells: [],
      preparedSpells: [],
      personality: { traits: '', ideals: '', bonds: '', flaws: '' },
      appearance: { age: '', height: '', weight: '', eyes: '', skin: '', hair: '' },
      notes: '',
      feats: [],
      fightingStyle: '',
      armorChoice: 'none',
      hpMethod: 'max',
      updatedAt: Date.now()
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return { activeId: null, characters: {} };
      const data = JSON.parse(raw);
      return { activeId: data.activeId || null, characters: data.characters || {} };
    } catch {
      return { activeId: null, characters: {} };
    }
  },

  persist(roster) {
    localStorage.setItem(this.KEY, JSON.stringify({
      version: 1,
      activeId: roster.activeId,
      characters: roster.characters
    }));
  },

  migrate(st) {
    if (!st.id) st.id = crypto.randomUUID();
    if (!st.customItems) st.customItems = [];
    if (st.inventoryItems?.length && typeof DND !== 'undefined') {
      st.inventoryItems.forEach(id => {
        const it = DND.getItem(id);
        if (it && !st.customItems.some(c => c.name === it.name)) {
          st.customItems.push({ id: crypto.randomUUID(), name: it.name, desc: it.desc || '' });
        }
      });
      st.inventoryItems = [];
    }
    st.customItems = (st.customItems || []).map(c => ({
      id: c.id || crypto.randomUUID(),
      name: c.name || 'Предмет',
      desc: c.desc || ''
    }));
    if (st.customEquipment && !st.customItems.length) {
      st.customItems = [{ id: crypto.randomUUID(), name: 'Інше', price: 0, desc: st.customEquipment }];
      delete st.customEquipment;
    }
    if (st.gold === undefined) st.gold = 0;
    if (st.selectedRollSet === undefined) st.selectedRollSet = null;
    return st;
  },

  list() {
    const { characters } = this.load();
    return Object.values(characters)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  get(id) {
    const { characters } = this.load();
    return characters[id] ? this.migrate({ ...characters[id] }) : null;
  },

  save(state) {
    const roster = this.load();
    const copy = this.migrate(JSON.parse(JSON.stringify(state)));
    copy.updatedAt = Date.now();
    roster.characters[copy.id] = copy;
    roster.activeId = copy.id;
    this.persist(roster);
    return copy;
  },

  scheduleSave(state) {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(state), 400);
  },

  remove(id) {
    const roster = this.load();
    delete roster.characters[id];
    if (roster.activeId === id) {
      const ids = Object.keys(roster.characters);
      roster.activeId = ids[0] || null;
    }
    this.persist(roster);
    return roster.activeId;
  },

  createNew() {
    const st = this.defaultState();
    this.save(st);
    return st;
  },

  activeId() {
    return this.load().activeId;
  }
};
