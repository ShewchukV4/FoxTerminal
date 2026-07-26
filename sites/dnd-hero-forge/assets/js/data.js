'use strict';

/* D&D 5e SRD — статичні дані для креатора */
const DND = {};

DND.ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
DND.ABILITY_NAMES = {
  str: 'Сила', dex: 'Спритність', con: 'Тіло',
  int: 'Інтелект', wis: 'Мудрість', cha: 'Харизма'
};

DND.SKILLS = [
  { id: 'acrobatics', name: 'Акробатика', ability: 'dex' },
  { id: 'animalHandling', name: 'Догляд за тваринами', ability: 'wis' },
  { id: 'arcana', name: 'Магія (Arcana)', ability: 'int' },
  { id: 'athletics', name: 'Атлетика', ability: 'str' },
  { id: 'deception', name: 'Обман', ability: 'cha' },
  { id: 'history', name: 'Історія', ability: 'int' },
  { id: 'insight', name: 'Проникливість', ability: 'wis' },
  { id: 'intimidation', name: 'Залякування', ability: 'cha' },
  { id: 'investigation', name: 'Розслідування', ability: 'int' },
  { id: 'medicine', name: 'Медицина', ability: 'wis' },
  { id: 'nature', name: 'Природа', ability: 'int' },
  { id: 'perception', name: 'Сприйняття', ability: 'wis' },
  { id: 'performance', name: 'Виступ', ability: 'cha' },
  { id: 'persuasion', name: 'Переконання', ability: 'cha' },
  { id: 'religion', name: 'Релігія', ability: 'int' },
  { id: 'sleightOfHand', name: 'Спритність рук', ability: 'dex' },
  { id: 'stealth', name: 'Стелс', ability: 'dex' },
  { id: 'survival', name: 'Виживання', ability: 'wis' }
];

DND.ALIGNMENTS = [
  'Законно-добрий', 'Нейтрально-добрий', 'Хаотично-добрий',
  'Законно-нейтральний', 'Істинно нейтральний', 'Хаотично-нейтральний',
  'Законно-злий', 'Нейтрально-злий', 'Хаотично-злий', 'Невизначений'
];

DND.POINT_BUY_COSTS = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};
DND.STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

DND.RACES = {
  dwarf: {
    id: 'dwarf', name: 'Дварф', speed: 25,
    size: 'Середній', darkvision: 60,
    traits: ['Darkvision 60', 'Dwarven Resilience (advantage vs poison, resistance)', 'Stonecunning', 'Знає Common + Dwarvish'],
    abilityBonus: { con: 2 },
    subraces: {
      hill: { name: 'Hill Dwarf', abilityBonus: { wis: 1 }, traits: ['+1 HP за рівень', 'Знає 1 додаткову мову'] },
      mountain: { name: 'Mountain Dwarf', abilityBonus: { str: 2 }, traits: ['Володіння light/medium armor'] }
    }
  },
  elf: {
    id: 'elf', name: 'Ельф', speed: 30,
    size: 'Середній', darkvision: 60,
    traits: ['Darkvision 60', 'Keen Senses (Perception)', 'Fey Ancestry', 'Trance'],
    abilityBonus: { dex: 2 },
    subraces: {
      high: { name: 'High Elf', abilityBonus: { int: 1 }, traits: ['Wizard cantrip', 'Знає 1 додаткову мову'] },
      wood: { name: 'Wood Elf', abilityBonus: { wis: 1 }, traits: ['Швидкість 35 фт', 'Mask of the Wild'] },
      drow: { name: 'Drow', abilityBonus: { cha: 1 }, traits: ['Darkvision 120', 'Dancing Lights cantrip', 'Sunlight Sensitivity'] }
    }
  },
  halfling: {
    id: 'halfling', name: 'Халфлінг', speed: 25,
    size: 'Малий', darkvision: 0,
    traits: ['Lucky', 'Brave', 'Halfling Nimbleness'],
    abilityBonus: { dex: 2 },
    subraces: {
      lightfoot: { name: 'Lightfoot', abilityBonus: { cha: 1 }, traits: ['Naturally Stealthy'] },
      stout: { name: 'Stout', abilityBonus: { con: 1 }, traits: ['Stout Resilience (poison resistance)'] }
    }
  },
  human: {
    id: 'human', name: 'Людина', speed: 30,
    size: 'Середній', darkvision: 0,
    traits: ['+1 до всіх характеристик (стандарт)'],
    abilityBonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    subraces: {
      standard: { name: 'Standard Human', abilityBonus: {}, traits: ['+1 до всіх'] },
      variant: { name: 'Variant Human', abilityBonus: {}, traits: ['+1 до двох на вибір', '1 Feat', '+1 Skill'] }
    }
  },
  dragonborn: {
    id: 'dragonborn', name: 'Дракононароджений', speed: 30,
    size: 'Середній', darkvision: 0,
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'],
    abilityBonus: { str: 2, cha: 1 },
    subraces: {
      black: { name: 'Black (Acid)', traits: ['Breath: 5×30 лінія', 'Resistance: Acid'] },
      blue: { name: 'Blue (Lightning)', traits: ['Breath: 5×30 лінія', 'Resistance: Lightning'] },
      brass: { name: 'Brass (Fire)', traits: ['Breath: 5×30 лінія', 'Resistance: Fire'] },
      bronze: { name: 'Bronze (Lightning)', traits: ['Breath: 5×30 лінія', 'Resistance: Lightning'] },
      copper: { name: 'Copper (Acid)', traits: ['Breath: 5×30 лінія', 'Resistance: Acid'] },
      gold: { name: 'Gold (Fire)', traits: ['Breath: 15 конус', 'Resistance: Fire'] },
      green: { name: 'Green (Poison)', traits: ['Breath: 15 конус', 'Resistance: Poison'] },
      red: { name: 'Red (Fire)', traits: ['Breath: 15 конус', 'Resistance: Fire'] },
      silver: { name: 'Silver (Cold)', traits: ['Breath: 15 конус', 'Resistance: Cold'] },
      white: { name: 'White (Cold)', traits: ['Breath: 15 конус', 'Resistance: Cold'] }
    }
  },
  gnome: {
    id: 'gnome', name: 'Гном', speed: 25,
    size: 'Малий', darkvision: 60,
    traits: ['Darkvision 60', 'Gnome Cunning'],
    abilityBonus: { int: 2 },
    subraces: {
      forest: { name: 'Forest Gnome', abilityBonus: { dex: 1 }, traits: ['Minor Illusion cantrip', 'Speak with Small Beasts'] },
      rock: { name: 'Rock Gnome', abilityBonus: { con: 1 }, traits: ["Artificer's Lore", 'Tinker'] }
    }
  },
  halfElf: {
    id: 'halfElf', name: 'Напівельф', speed: 30,
    size: 'Середній', darkvision: 60,
    traits: ['Darkvision 60', 'Fey Ancestry', '+2 CHA, +1 до двох інших', '2 skills на вибір'],
    abilityBonus: { cha: 2 },
    subraces: { default: { name: 'Half-Elf', abilityBonus: {}, traits: ['+1 CHA +1×2 (ручний вибір)'] } }
  },
  halfOrc: {
    id: 'halfOrc', name: 'Напіворк', speed: 30,
    size: 'Середній', darkvision: 60,
    traits: ['Darkvision 60', 'Relentless Endurance', 'Savage Attacks'],
    abilityBonus: { str: 2, con: 1 },
    subraces: { default: { name: 'Half-Orc', traits: [] } }
  },
  tiefling: {
    id: 'tiefling', name: 'Тіфлінг', speed: 30,
    size: 'Середній', darkvision: 60,
    traits: ['Darkvision 60', 'Hellish Resistance (fire)', 'Infernal Legacy spells'],
    abilityBonus: { cha: 2, int: 1 },
    subraces: { default: { name: 'Tiefling', traits: ['Thaumaturgy → Hellish Rebuke → Darkness'] } }
  }
};

DND.CLASSES = {
  barbarian: {
    id: 'barbarian', name: 'Варвар', hitDie: 12,
    primaryAbility: 'str',
    saves: ['str', 'con'],
    skills: { choose: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
    spellcasting: null,
    features: {
      1: ['Rage (2/long rest)', 'Unarmored Defense'],
      2: ['Reckless Attack', 'Danger Sense'],
      3: ['Primal Path (subclass)'],
      5: ['Extra Attack', 'Fast Movement'],
      7: ['Feral Instinct'],
      9: ['Brutal Critical (+1 die)'],
      11: ['Relentless Rage'],
      15: ['Persistent Rage'],
      18: ['Indomitable Might'],
      20: ['Primal Champion (+4 STR/CON)']
    },
    subclasses: {
      berserker: { name: 'Path of the Berserker', features: { 3: ['Frenzy'], 6: ['Mindless Rage'], 14: ['Retaliation'] } },
      totem: { name: 'Path of the Totem Warrior', features: { 3: ['Spirit Seeker', 'Totem Spirit'], 6: ['Aspect of the Beast'], 14: ['Totemic Attunement'] } }
    },
    equipment: [
      { label: '(a) greataxe або (b) будь-яка martial melee', items: ['Greataxe', 'Shield', 'Handaxe ×2'] },
      { label: '(a) two handaxes або (b) simple weapon', items: ['Explorer\'s pack', 'Javelin ×4'] }
    ]
  },
  bard: {
    id: 'bard', name: 'Бард', hitDie: 8,
    primaryAbility: 'cha',
    saves: ['dex', 'cha'],
    skills: { choose: 3, from: 'any' },
    armor: ['light'],
    weapons: ['simple', 'hand crossbow', 'longsword', 'rapier', 'shortsword'],
    spellcasting: { ability: 'cha', type: 'known', cantrips: [2,2,2,3,3,3,3,3,3,4], spellsKnown: [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22] },
    features: {
      1: ['Spellcasting', 'Bardic Inspiration (d6)'],
      2: ['Jack of All Trades', 'Song of Rest (d6)'],
      3: ['Expertise', 'Bard College'],
      5: ['Bardic Inspiration (d8)', 'Font of Inspiration'],
      6: ['Countercharm', 'College feature'],
      10: ['Bardic Inspiration (d10)', 'Expertise (×2)'],
      15: ['Bardic Inspiration (d12)'],
      20: ['Superior Inspiration']
    },
    subclasses: {
      lore: { name: 'College of Lore', features: { 3: ['Bonus Proficiencies', 'Cutting Words'], 6: ['Additional Magical Secrets'], 14: ['Peerless Skill'] } },
      valor: { name: 'College of Valor', features: { 3: ['Bonus Proficiencies', 'Combat Inspiration'], 6: ['Extra Attack'], 14: ['Battle Magic'] } }
    },
    equipment: [
      { label: '(a) rapier (b) longsword (c) simple', items: ['Diplomat\'s pack', 'Lute', 'Leather armor', 'Dagger'] }
    ]
  },
  cleric: {
    id: 'cleric', name: 'Клірик', hitDie: 8,
    primaryAbility: 'wis',
    saves: ['wis', 'cha'],
    skills: { choose: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple'],
    spellcasting: { ability: 'wis', type: 'prepared', cantrips: [3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4] },
    features: {
      1: ['Spellcasting', 'Divine Domain'],
      2: ['Channel Divinity (1/rest)', 'Domain feature'],
      5: ['Destroy Undead (CR 1/2)'],
      6: ['Channel Divinity (2/rest)', 'Domain feature'],
      8: ['Divine Domain feature', 'Destroy Undead (CR 1)'],
      10: ['Divine Intervention'],
      11: ['Destroy Undead (CR 2)'],
      14: ['Destroy Undead (CR 3)'],
      17: ['Destroy Undead (CR 4)'],
      18: ['Channel Divinity (3/rest)'],
      20: ['Divine Intervention improvement']
    },
    subclasses: {
      life: { name: 'Life Domain', features: { 1: ['Bonus healing', 'Life spells'], 2: ['Preserve Life'], 6: ['Blessed Healer'], 8: ['Divine Strike'], 17: ['Supreme Healing'] } },
      light: { name: 'Light Domain', features: { 1: ['Warding Flare', 'Light spells'], 2: ['Radiance of the Dawn'], 6: ['Improved Flare'], 8: ['Potent Spellcasting'], 17: ['Corona of Light'] } },
      war: { name: 'War Domain', features: { 1: ['War Priest', 'War spells'], 2: ['Guided Strike'], 6: ["War God's Blessing"], 8: ['Divine Strike'], 17: ['Avatar of Battle'] } }
    },
    equipment: [
      { label: '(a) mace (b) warhammer', items: ['Scale mail', 'Light crossbow', 'Bolts ×20', 'Priest\'s pack', 'Shield', 'Holy symbol'] }
    ]
  },
  druid: {
    id: 'druid', name: 'Друїд', hitDie: 8,
    primaryAbility: 'wis',
    saves: ['int', 'wis'],
    skills: { choose: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    armor: ['light', 'medium', 'shields (non-metal)'],
    weapons: ['club', 'dagger', 'dart', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'sickle', 'sling', 'spear'],
    spellcasting: { ability: 'wis', type: 'prepared', cantrips: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4] },
    features: {
      1: ['Druidic', 'Spellcasting'],
      2: ['Wild Shape', 'Druid Circle'],
      4: ['Wild Shape improvement', 'Ability Score Improvement'],
      18: ['Timeless Body', 'Beast Spells'],
      20: ['Archdruid']
    },
    subclasses: {
      land: { name: 'Circle of the Land', features: { 2: ['Bonus cantrip', 'Natural Recovery', 'Circle spells'], 6: ["Land's Stride", 'Circle spells'], 10: ['Nature\'s Ward'], 14: ['Nature\'s Sanctuary'] } },
      moon: { name: 'Circle of the Moon', features: { 2: ['Combat Wild Shape', 'Circle forms'], 6: ['Primal Strike'], 10: ['Elemental Wild Shape'], 14: ['Thousand Forms'] } }
    },
    equipment: [
      { label: '(a) wooden shield (b) simple weapon', items: ['Leather armor', 'Explorer\'s pack', 'Druidic focus'] }
    ]
  },
  fighter: {
    id: 'fighter', name: 'Воїн', hitDie: 10,
    primaryAbility: 'str',
    saves: ['str', 'con'],
    skills: { choose: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
    armor: ['light', 'medium', 'heavy', 'shields'],
    weapons: ['simple', 'martial'],
    spellcasting: null,
    features: {
      1: ['Fighting Style', 'Second Wind'],
      2: ['Action Surge (1)'],
      3: ['Martial Archetype'],
      5: ['Extra Attack'],
      9: ['Indomitable (1)'],
      11: ['Extra Attack (2)'],
      13: ['Indomitable (2)'],
      17: ['Action Surge (2)', 'Indomitable (3)'],
      20: ['Extra Attack (3)']
    },
    subclasses: {
      champion: { name: 'Champion', features: { 3: ['Improved Critical'], 7: ['Remarkable Athlete'], 10: ['Additional Fighting Style'], 15: ['Superior Critical'], 18: ['Survivor'] } },
      battleMaster: { name: 'Battle Master', features: { 3: ['Combat Superiority', 'Student of War'], 7: ['Know Your Enemy'], 15: ['Relentless'] } },
      eldritchKnight: { name: 'Eldritch Knight', features: { 3: ['Spellcasting', 'Weapon Bond'], 7: ['War Magic'], 10: ['Eldritch Strike'], 15: ['Arcane Charge'], 18: ['Improved War Magic'] } }
    },
    equipment: [
      { label: '(a) chain mail (b) leather + longbow', items: ['Martial weapon + shield', 'Light crossbow', 'Dungeoneer\'s pack'] }
    ]
  },
  monk: {
    id: 'monk', name: 'Монах', hitDie: 8,
    primaryAbility: 'dex',
    saves: ['str', 'dex'],
    skills: { choose: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    armor: [], weapons: ['simple', 'shortsword'],
    spellcasting: null,
    features: {
      1: ['Unarmored Defense', 'Martial Arts (d4)'],
      2: ['Ki', 'Unarmored Movement'],
      3: ['Monastic Tradition', 'Deflect Missiles'],
      4: ['Slow Fall'],
      5: ['Extra Attack', 'Stunning Strike'],
      6: ['Ki-Empowered Strikes'],
      7: ['Evasion', 'Stillness of Mind'],
      10: ['Purity of Body'],
      13: ['Tongue of the Sun and Moon'],
      14: ['Diamond Soul'],
      18: ['Empty Body'],
      20: ['Perfect Self']
    },
    subclasses: {
      openHand: { name: 'Way of the Open Hand', features: { 3: ['Open Hand Technique'], 6: ['Wholeness of Body'], 11: ['Tranquility'], 17: ['Quivering Palm'] } },
      shadow: { name: 'Way of Shadow', features: { 3: ['Shadow Arts'], 6: ['Shadow Step'], 11: ['Cloak of Shadows'], 17: ['Opportunist'] } },
      fourElements: { name: 'Way of the Four Elements', features: { 3: ['Disciple of the Elements'] } }
    },
    equipment: [
      { label: '(a) shortsword (b) simple weapon', items: ['Dungeoneer\'s pack', 'Dart ×10'] }
    ]
  },
  paladin: {
    id: 'paladin', name: 'Паладин', hitDie: 10,
    primaryAbility: 'str',
    saves: ['wis', 'cha'],
    skills: { choose: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    armor: ['light', 'medium', 'heavy', 'shields'],
    weapons: ['simple', 'martial'],
    spellcasting: { ability: 'cha', type: 'prepared', cantrips: null, halfCaster: true },
    features: {
      1: ['Divine Sense', 'Lay on Hands'],
      2: ['Fighting Style', 'Spellcasting', 'Divine Smite'],
      3: ['Sacred Oath'],
      5: ['Extra Attack'],
      6: ['Aura of Protection'],
      10: ['Aura of Courage'],
      11: ['Improved Divine Smite'],
      14: ['Cleansing Touch'],
      20: ['Sacred Oath capstone']
    },
    subclasses: {
      devotion: { name: 'Oath of Devotion', features: { 3: ['Channel Divinity', 'Oath Spells'], 7: ['Aura of Devotion'], 15: ['Purity of Spirit'], 20: ['Holy Nimbus'] } },
      ancients: { name: 'Oath of the Ancients', features: { 3: ['Channel Divinity', 'Oath Spells'], 7: ['Aura of Warding'], 15: ['Undying Sentinel'], 20: ['Elder Champion'] } },
      vengeance: { name: 'Oath of Vengeance', features: { 3: ['Channel Divinity', 'Oath Spells'], 7: ['Relentless Avenger'], 15: ['Soul of Vengeance'], 20: ['Avenging Angel'] } }
    },
    equipment: [
      { label: '(a) martial + shield (b) two martial', items: ['Javelin ×5', 'Priest\'s pack', 'Chain mail', 'Holy symbol'] }
    ]
  },
  ranger: {
    id: 'ranger', name: 'Рейнджер', hitDie: 10,
    primaryAbility: 'dex',
    saves: ['str', 'dex'],
    skills: { choose: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
    spellcasting: { ability: 'wis', type: 'known', halfCaster: true },
    features: {
      1: ['Favored Enemy', 'Natural Explorer'],
      2: ['Fighting Style', 'Spellcasting'],
      3: ['Ranger Archetype', 'Primeval Awareness'],
      6: ['Greater Favored Enemy'],
      8: ['Land\'s Stride'],
      10: ['Hide in Plain Sight'],
      14: ['Vanish'],
      18: ['Feral Senses'],
      20: ['Foe Slayer']
    },
    subclasses: {
      hunter: { name: 'Hunter', features: { 3: ['Hunter\'s Prey'], 7: ['Defensive Tactics'], 11: ['Multiattack'], 15: ['Superior Hunter\'s Defense'] } },
      beastMaster: { name: 'Beast Master', features: { 3: ['Ranger\'s Companion'], 7: ['Exceptional Training'], 11: ['Bestial Fury'], 15: ['Share Spells'] } }
    },
    equipment: [
      { label: '(a) scale mail (b) leather armor', items: ['Shortsword ×2', 'Dungeoneer\'s pack', 'Longbow', 'Quiver ×20'] }
    ]
  },
  rogue: {
    id: 'rogue', name: 'Розбійник', hitDie: 8,
    primaryAbility: 'dex',
    saves: ['dex', 'int'],
    skills: { choose: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
    armor: ['light'],
    weapons: ['simple', 'hand crossbow', 'longsword', 'rapier', 'shortsword'],
    spellcasting: null,
    features: {
      1: ['Expertise', 'Sneak Attack', 'Thieves\' Cant'],
      2: ['Cunning Action'],
      3: ['Roguish Archetype'],
      5: ['Uncanny Dodge'],
      6: ['Expertise (×2)'],
      7: ['Evasion'],
      11: ['Reliable Talent'],
      14: ['Blindsense'],
      18: ['Elusive'],
      20: ['Stroke of Luck']
    },
    subclasses: {
      thief: { name: 'Thief', features: { 3: ['Fast Hands', 'Second-Story Work'], 9: ['Supreme Sneak'], 13: ['Use Magic Device'], 17: ['Thief\'s Reflexes'] } },
      assassin: { name: 'Assassin', features: { 3: ['Bonus Proficiencies', 'Assassinate'], 9: ['Infiltration Expertise'], 13: ['Impostor'], 17: ['Death Strike'] } },
      arcaneTrickster: { name: 'Arcane Trickster', features: { 3: ['Spellcasting', 'Mage Hand Legerdemain'], 9: ['Magical Ambush'], 13: ['Versatile Trickster'], 17: ['Spell Thief'] } }
    },
    equipment: [
      { label: '(a) rapier (b) shortsword', items: ['Leather armor', 'Burglar\'s pack', 'Dagger ×2', 'Thieves\' tools'] }
    ]
  },
  sorcerer: {
    id: 'sorcerer', name: 'Чаклун', hitDie: 6,
    primaryAbility: 'cha',
    saves: ['con', 'cha'],
    skills: { choose: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    armor: [], weapons: ['dagger', 'dart', 'quarterstaff', 'light crossbow', 'sling'],
    spellcasting: { ability: 'cha', type: 'known', cantrips: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,7], spellsKnown: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,16,16,17,17,18,18,19,19,20,20,21,21,22,22] },
    features: {
      1: ['Spellcasting', 'Sorcerous Origin'],
      2: ['Font of Magic'],
      3: ['Metamagic'],
      20: ['Sorcerous Restoration']
    },
    subclasses: {
      draconic: { name: 'Draconic Bloodline', features: { 1: ['Dragon Ancestor', 'Draconic Resilience'], 6: ['Elemental Affinity'], 14: ['Dragon Wings'], 18: ['Draconic Presence'] } },
      wild: { name: 'Wild Magic', features: { 1: ['Wild Magic Surge', 'Tides of Chaos'], 6: ['Bend Luck'], 14: ['Controlled Chaos'], 18: ['Spell Bombardment'] } }
    },
    equipment: [
      { label: '(a) light crossbow (b) simple weapon', items: ['Component pouch', 'Dungeoneer\'s pack', 'Dagger ×2'] }
    ]
  },
  warlock: {
    id: 'warlock', name: 'Варлок', hitDie: 8,
    primaryAbility: 'cha',
    saves: ['wis', 'cha'],
    skills: { choose: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    armor: ['light'],
    weapons: ['simple'],
    spellcasting: { ability: 'cha', type: 'known', pactMagic: true, cantrips: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4] },
    features: {
      1: ['Otherworldly Patron', 'Pact Magic'],
      2: ['Eldritch Invocations'],
      3: ['Pact Boon'],
      11: ['Mystic Arcanum (6th)'],
      20: ['Eldritch Master']
    },
    subclasses: {
      fiend: { name: 'The Fiend', features: { 1: ['Dark One\'s Blessing', 'Fiend spells'], 6: ['Dark One\'s Own Luck'], 10: ['Fiendish Resilience'], 14: ['Hurl Through Hell'] } },
      greatOldOne: { name: 'The Great Old One', features: { 1: ['Awakened Mind', 'GOO spells'], 6: ['Entropic Ward'], 10: ['Thought Shield'], 14: ['Create Thrall'] } },
      archfey: { name: 'The Archfey', features: { 1: ['Fey Presence', 'Archfey spells'], 6: ['Misty Escape'], 10: ['Beguiling Defenses'], 14: ['Dark Delirium'] } }
    },
    equipment: [
      { label: '(a) light crossbow (b) simple weapon', items: ['Component pouch', 'Scholar\'s pack', 'Leather armor', 'Dagger ×2'] }
    ]
  },
  wizard: {
    id: 'wizard', name: 'Чарівник', hitDie: 6,
    primaryAbility: 'int',
    saves: ['int', 'wis'],
    skills: { choose: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
    armor: [], weapons: ['dagger', 'dart', 'quarterstaff', 'light crossbow', 'sling'],
    spellcasting: { ability: 'int', type: 'prepared', cantrips: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5] },
    features: {
      1: ['Spellcasting', 'Arcane Recovery'],
      2: ['Arcane Tradition'],
      18: ['Spell Mastery'],
      20: ['Signature Spells']
    },
    subclasses: {
      evocation: { name: 'School of Evocation', features: { 2: ['Evocation Savant', 'Sculpt Spells'], 6: ['Potent Cantrip'], 10: ['Empowered Evocation'], 14: ['Overchannel'] } },
      abjuration: { name: 'School of Abjuration', features: { 2: ['Abjuration Savant', 'Arcane Ward'], 6: ['Projected Ward'], 10: ['Improved Abjuration'], 14: ['Spell Resistance'] } },
      divination: { name: 'School of Divination', features: { 2: ['Divination Savant', 'Portent'], 6: ['Expert Divination'], 10: ['The Third Eye'], 14: ['Greater Portent'] } }
    },
    equipment: [
      { label: '(a) quarterstaff (b) dagger', items: ['Component pouch', 'Scholar\'s pack', 'Spellbook'] }
    ]
  }
};

DND.BACKGROUNDS = {
  acolyte: {
    id: 'acolyte', name: 'Послушник (Acolyte)',
    skills: ['insight', 'religion'],
    languages: { choose: 2 },
    equipment: ['Holy symbol', 'Prayer book', 'Incense ×5', 'Vestments', 'Common clothes', '15 gp'],
    feature: 'Shelter of the Faithful — безкоштовний притулок у храмах',
    personality: {
      traits: ['Молюся богам щодня', 'Терплячий до інших вірувань', 'Цитую священні тексти'],
      ideals: ['Віра', 'Традиція', 'Зміна', 'Влада'],
      bonds: ['Храм де мене виховали', 'Реліквія', 'Проповідь'],
      flaws: ['Надмірна довіра', 'Сувора мораль', 'Сумніви у вірі']
    }
  },
  criminal: {
    id: 'criminal', name: 'Злочинець (Criminal)',
    skills: ['deception', 'stealth'],
    tools: ['Gaming set', 'Thieves\' tools'],
    equipment: ['Crowbar', 'Dark common clothes', 'Hood', '15 gp'],
    feature: 'Criminal Contact — контакт у кримінальному світі',
    personality: {
      traits: ['Завжди маю план Б', 'Спокійний під тиском', 'Ніколи не довіряю повністю'],
      ideals: ['Свобода', 'Честь', 'Жадібність', 'Милосердя'],
      bonds: ['Колишній напарник', 'Борг', 'Захист сім\'ї'],
      flaws: ['Жадібність', 'Параноя', 'Поганий характер']
    }
  },
  folkHero: {
    id: 'folkHero', name: 'Народний герой (Folk Hero)',
    skills: ['animalHandling', 'survival'],
    tools: ['Artisan\'s tools', 'Vehicles (land)'],
    equipment: ['Artisan\'s tools', 'Shovel', 'Iron pot', 'Common clothes', '10 gp'],
    feature: 'Rustic Hospitality — притулок у селян',
    personality: {
      traits: ['Справедливий', 'Працьовитий', 'Скромний'],
      ideals: ['Народ', 'Сміливість', 'Свобода', 'Порядок'],
      bonds: ['Рідне село', 'Сім\'я', 'Обіцянка'],
      flaws: ['Упертість', 'Наївність', 'Гнів']
    }
  },
  noble: {
    id: 'noble', name: 'Шляхтич (Noble)',
    skills: ['history', 'persuasion'],
    tools: ['Gaming set'],
    languages: { choose: 1 },
    equipment: ['Fine clothes', 'Signet ring', 'Scroll of pedigree', '25 gp'],
    feature: 'Position of Privilege — поважання знаті',
    personality: {
      traits: ['Ввічливий', 'Гордий', 'Впевнений'],
      ideals: ['Честь', 'Влада', 'Сім\'я', 'Відповідальність'],
      bonds: ['Родина', 'Слуга', 'Титул'],
      flaws: ['Зарозумілість', 'Борги', 'Суперечки']
    }
  },
  sage: {
    id: 'sage', name: 'Мудрець (Sage)',
    skills: ['arcana', 'history'],
    languages: { choose: 2 },
    equipment: ['Ink', 'Quill', 'Small knife', 'Letter from colleague', 'Common clothes', '10 gp'],
    feature: 'Researcher — знає де шукати знання',
    personality: {
      traits: ['Цікавий', 'Педантичний', 'Забудькуватий'],
      ideals: ['Знання', 'Істина', 'Відкриття', 'Логіка'],
      bonds: ['Наставник', 'Бібліотека', 'Таємниця'],
      flaws: ['Занадто прямолінійний', 'Схильний до ризику', 'Відокремлений']
    }
  },
  soldier: {
    id: 'soldier', name: 'Солдат (Soldier)',
    skills: ['athletics', 'intimidation'],
    tools: ['Gaming set', 'Vehicles (land)'],
    equipment: ['Insignia of rank', 'Trophy', 'Bone dice', 'Common clothes', '10 gp'],
    feature: 'Military Rank — авторитет серед військових',
    personality: {
      traits: ['Дисциплінований', 'Вірний', 'Прямий'],
      ideals: ['Велич', 'Відповідальність', 'Незалежність', 'Країна'],
      bonds: ['Товариші', 'Командир', 'Гордість'],
      flaws: ['Жорстокість', 'Недовіра', 'Вина']
    }
  },
  charlatan: {
    id: 'charlatan', name: 'Шарлатан (Charlatan)',
    skills: ['deception', 'sleightOfHand'],
    tools: ['Disguise kit', 'Forgery kit'],
    equipment: ['Fine clothes', 'Disguise kit', 'Con tools', '15 gp'],
    feature: 'False Identity — підроблена особа',
    personality: {
      traits: ['Харизматичний', 'Брехливий', 'Спритний'],
      ideals: ['Свобода', 'Багатство', 'Дружба', 'Влада'],
      bonds: ['Жертва', 'Партнер', 'Секрет'],
      flaws: ['Жадібність', 'Страх викриття', 'Залежність']
    }
  },
  hermit: {
    id: 'hermit', name: 'Відлюдник (Hermit)',
    skills: ['medicine', 'religion'],
    tools: ['Herbalism kit'],
    languages: { choose: 1 },
    equipment: ['Scroll case', 'Blankets', 'Herbalism kit', 'Common clothes', '5 gp'],
    feature: 'Discovery — відкриття під час відлюдництва',
    personality: {
      traits: ['Тихий', 'Мудрий', 'Самотній'],
      ideals: ['Самопізнання', 'Гармонія', 'Допомога', 'Свобода'],
      bonds: ['Наставник', 'Місце відлюдництва', 'Пророцтво'],
      flaws: ['Відчуженість', 'Одержимість', 'Недовіра']
    }
  },
  outlander: {
    id: 'outlander', name: 'Мандрівник (Outlander)',
    skills: ['athletics', 'survival'],
    tools: ['Musical instrument'],
    languages: { choose: 1 },
    equipment: ['Staff', 'Hunting trap', 'Trophy', 'Traveler\'s clothes', '10 gp'],
    feature: 'Wanderer — орієнтація та їжа в дикій природі',
    personality: {
      traits: ['Незалежний', 'Стійкий', 'Прямий'],
      ideals: ['Зміна', 'Природа', 'Свобода', 'Сила'],
      bonds: ['Плем\'я', 'Земля', 'Тварина-компаньйон'],
      flaws: ['Ворожість до міста', 'Примітивність', 'Помста']
    }
  },
  entertainer: {
    id: 'entertainer', name: 'Артист (Entertainer)',
    skills: ['acrobatics', 'performance'],
    tools: ['Disguise kit', 'Musical instrument'],
    equipment: ['Musical instrument', 'Admirer\'s favor', 'Costume', '15 gp'],
    feature: 'By Popular Demand — виступи та притулок',
    personality: {
      traits: ['Театральний', 'Веселий', 'Романтичний'],
      ideals: ['Краса', 'Дружба', 'Свобода', 'Слава'],
      bonds: ['Трупа', 'Інструмент', 'Фанат'],
      flaws: ['Его', 'Скандали', 'Залежність']
    }
  }
};

/** На якому рівні персонажа обирається підклас (D&D 5e PHB) */
DND.SUBCLASS_UNLOCK = {
  barbarian: 3, bard: 3, cleric: 1, druid: 2, fighter: 3, monk: 3,
  paladin: 3, ranger: 3, rogue: 3, sorcerer: 3, warlock: 1, wizard: 2
};

/** Рівні покращення характеристик (більшість класів) */
DND.ASI_LEVELS = [4, 8, 12, 16, 19];

DND.SPELL_SLOTS = {
  full: {
    1: [2], 2: [3], 3: [4,2], 4: [4,3], 5: [4,3,2], 6: [4,3,3], 7: [4,3,3,1], 8: [4,3,3,2], 9: [4,3,3,3,1],
    10: [4,3,3,3,2], 11: [4,3,3,3,2,1], 12: [4,3,3,3,2,1], 13: [4,3,3,3,2,1,1], 14: [4,3,3,3,2,1,1],
    15: [4,3,3,3,2,1,1,1], 16: [4,3,3,3,2,1,1,1], 17: [4,3,3,3,2,1,1,1,1], 18: [4,3,3,3,3,1,1,1,1],
    19: [4,3,3,3,3,2,1,1,1], 20: [4,3,3,3,3,2,2,1,1]
  },
  half: {
    1: [], 2: [2], 3: [3], 4: [3], 5: [4,2], 6: [4,2], 7: [4,3], 8: [4,3], 9: [4,3,2], 10: [4,3,2],
    11: [4,3,3], 12: [4,3,3], 13: [4,3,3,1], 14: [4,3,3,1], 15: [4,3,3,2], 16: [4,3,3,2],
    17: [4,3,3,3,1], 18: [4,3,3,3,1], 19: [4,3,3,3,2], 20: [4,3,3,3,2]
  },
  warlock: {
    1: [1], 2: [2], 3: [2], 4: [2], 5: [2], 6: [2], 7: [2], 8: [2], 9: [2], 10: [2],
    11: [3], 12: [3], 13: [3], 14: [3], 15: [3], 16: [3], 17: [4], 18: [4], 19: [4], 20: [4]
  }
};

DND.SPELLS = {
  cantrips: [
    { id: 'fireBolt', name: 'Fire Bolt', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
    { id: 'light', name: 'Light', school: 'Evocation', classes: ['cleric', 'wizard', 'bard'] },
    { id: 'mageHand', name: 'Mage Hand', school: 'Conjuration', classes: ['wizard', 'sorcerer', 'bard', 'warlock'] },
    { id: 'prestidigitation', name: 'Prestidigitation', school: 'Transmutation', classes: ['wizard', 'sorcerer', 'bard', 'warlock'] },
    { id: 'rayOfFrost', name: 'Ray of Frost', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
    { id: 'sacredFlame', name: 'Sacred Flame', school: 'Evocation', classes: ['cleric'] },
    { id: 'thaumaturgy', name: 'Thaumaturgy', school: 'Transmutation', classes: ['cleric', 'tiefling'] },
    { id: 'eldritchBlast', name: 'Eldritch Blast', school: 'Evocation', classes: ['warlock'] },
    { id: 'guidance', name: 'Guidance', school: 'Divination', classes: ['cleric', 'druid'] },
    { id: 'produceFlame', name: 'Produce Flame', school: 'Conjuration', classes: ['druid'] },
    { id: 'viciousMockery', name: 'Vicious Mockery', school: 'Enchantment', classes: ['bard'] }
  ],
  level1: [
    { id: 'bless', name: 'Bless', school: 'Enchantment', classes: ['cleric', 'paladin'] },
    { id: 'burningHands', name: 'Burning Hands', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
    { id: 'cureWounds', name: 'Cure Wounds', school: 'Evocation', classes: ['cleric', 'druid', 'bard', 'paladin', 'ranger'] },
    { id: 'detectMagic', name: 'Detect Magic', school: 'Divination', classes: ['cleric', 'druid', 'wizard', 'bard', 'paladin', 'ranger', 'sorcerer', 'warlock'] },
    { id: 'healingWord', name: 'Healing Word', school: 'Evocation', classes: ['cleric', 'druid', 'bard'] },
    { id: 'hex', name: 'Hex', school: 'Enchantment', classes: ['warlock'] },
    { id: 'magicMissile', name: 'Magic Missile', school: 'Evocation', classes: ['wizard', 'sorcerer'] },
    { id: 'shield', name: 'Shield', school: 'Abjuration', classes: ['wizard', 'sorcerer'] },
    { id: 'sleep', name: 'Sleep', school: 'Enchantment', classes: ['wizard', 'sorcerer', 'bard'] },
    { id: 'thunderwave', name: 'Thunderwave', school: 'Evocation', classes: ['wizard', 'bard', 'druid', 'sorcerer'] },
    { id: 'huntersMark', name: "Hunter's Mark", school: 'Divination', classes: ['ranger'] },
    { id: 'armorOfAgathys', name: 'Armor of Agathys', school: 'Abjuration', classes: ['warlock'] },
    { id: 'charmPerson', name: 'Charm Person', school: 'Enchantment', classes: ['bard', 'druid', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'faerieFire', name: 'Faerie Fire', school: 'Evocation', classes: ['bard', 'druid'] },
    { id: 'guidingBolt', name: 'Guiding Bolt', school: 'Evocation', classes: ['cleric'] }
  ],
  level2: [
    { id: 'holdPerson', name: 'Hold Person', school: 'Enchantment', classes: ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'] },
    { id: 'mistyStep', name: 'Misty Step', school: 'Conjuration', classes: ['sorcerer', 'warlock', 'wizard'] },
    { id: 'scorchingRay', name: 'Scorching Ray', school: 'Evocation', classes: ['sorcerer', 'wizard'] },
    { id: 'spiritualWeapon', name: 'Spiritual Weapon', school: 'Evocation', classes: ['cleric'] },
    { id: 'moonbeam', name: 'Moonbeam', school: 'Evocation', classes: ['druid'] }
  ],
  level3: [
    { id: 'fireball', name: 'Fireball', school: 'Evocation', classes: ['sorcerer', 'wizard'] },
    { id: 'counterspell', name: 'Counterspell', school: 'Abjuration', classes: ['sorcerer', 'warlock', 'wizard'] },
    { id: 'revivify', name: 'Revivify', school: 'Necromancy', classes: ['cleric', 'paladin'] },
    { id: 'lightningBolt', name: 'Lightning Bolt', school: 'Evocation', classes: ['sorcerer', 'wizard'] }
  ]
};

DND.FEATS = [
  { id: 'alert', name: 'Alert', desc: '+5 Initiative, не можна застати зненацька, вороги без advantage' },
  { id: 'lucky', name: 'Lucky', desc: '3 luck points на long rest, перекид d20' },
  { id: 'sharpshooter', name: 'Sharpshooter', desc: '-5 до атаки, +10 damage, ігнор cover' },
  { id: 'warCaster', name: 'War Caster', desc: 'Advantage на CON saves для концентрації, somatic зі зброєю' },
  { id: 'tough', name: 'Tough', desc: '+2 HP за рівень (ретроактивно)' },
  { id: 'magicInitiate', name: 'Magic Initiate', desc: '2 cantrips + 1 spell 1 рівня з одного класу' }
];

DND.WIZARD_STEPS = [
  { id: 'basics', title: 'Основи', icon: '📜' },
  { id: 'race', title: 'Раса', icon: '🧝' },
  { id: 'class', title: 'Клас', icon: '⚔' },
  { id: 'background', title: 'Передісторія', icon: '🏛' },
  { id: 'abilities', title: 'Характеристики', icon: '💪' },
  { id: 'skills', title: 'Навички', icon: '🎯' },
  { id: 'equipment', title: 'Спорядження', icon: '🎒' },
  { id: 'spells', title: 'Заклинання', icon: '✨' },
  { id: 'personality', title: 'Особистість', icon: '💬' },
  { id: 'review', title: 'Огляд', icon: '📋' }
];
