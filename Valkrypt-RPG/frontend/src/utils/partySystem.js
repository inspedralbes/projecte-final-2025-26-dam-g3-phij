function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value, fallback = 0) {
  return Math.floor(toNumber(value, fallback));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const RARITY_LABELS = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario'
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const STATUS_DEFINITIONS = {
  bleed: {
    name: 'Sangrado',
    description: 'Pierde vida al inicio de cada turno.'
  },
  poison: {
    name: 'Veneno',
    description: 'Sufre daño persistente por toxinas.'
  },
  stun: {
    name: 'Aturdido',
    description: 'Pierde su siguiente acción.'
  }
};

export function normalizeRarity(rawRarity) {
  const rarity = String(rawRarity || 'common').toLowerCase();
  return RARITY_ORDER.includes(rarity) ? rarity : 'common';
}

export function rarityLabel(rawRarity) {
  const rarity = normalizeRarity(rawRarity);
  return RARITY_LABELS[rarity] || RARITY_LABELS.common;
}

function normalizeStatusType(rawType) {
  const statusType = String(rawType || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(STATUS_DEFINITIONS, statusType)
    ? statusType
    : '';
}

function normalizeStatusEffect(rawStatus, index = 0, fallbackPrefix = 'status') {
  const statusType = normalizeStatusType(rawStatus?.type);
  if (!statusType) return null;
  const definition = STATUS_DEFINITIONS[statusType];
  const duration = clamp(toInt(rawStatus?.duration, 1), 1, 6);
  const potencyDefault = statusType === 'stun' ? 0 : 2;
  const potency = statusType === 'stun'
    ? 0
    : clamp(toInt(rawStatus?.potency, potencyDefault), 1, 20);

  return {
    id: String(rawStatus?.id || uid(`${fallbackPrefix}_${index + 1}`)),
    type: statusType,
    name: String(rawStatus?.name || definition.name),
    description: String(rawStatus?.description || definition.description),
    duration,
    potency,
    source: String(rawStatus?.source || '')
  };
}

export function normalizeStatusEffects(rawStatusList, fallbackPrefix = 'status') {
  if (!Array.isArray(rawStatusList)) return [];
  return rawStatusList
    .map((status, index) => normalizeStatusEffect(status, index, fallbackPrefix))
    .filter(Boolean)
    .slice(0, 12);
}

export function roleArchetype(roleLabel = '') {
  const role = String(roleLabel || '').toLowerCase();
  if (role.includes('guerrero')) return 'warrior';
  if (role.includes('pícar') || role.includes('picar') || role.includes('estafador')) return 'rogue';
  if (role.includes('arcan')) return 'mage';
  if (role.includes('clérig') || role.includes('clerig')) return 'cleric';
  return 'adventurer';
}

function defaultStatsForArchetype(archetype) {
  if (archetype === 'warrior') return { attack: 9, defense: 6 };
  if (archetype === 'rogue') return { attack: 10, defense: 3 };
  if (archetype === 'mage') return { attack: 11, defense: 2 };
  if (archetype === 'cleric') return { attack: 8, defense: 5 };
  return { attack: 8, defense: 4 };
}

function defaultSkillsForArchetype(archetype) {
  if (archetype === 'warrior') {
    return [
      {
        id: 'hendidura_heroica',
        name: 'Hendidura Heroica',
        description: 'Golpe pesado de mandoble. Daño alto, precisión media.',
        type: 'attack',
        dice: 'd12',
        accuracy: 2,
        power: 5,
        statusType: 'bleed',
        statusChance: 24,
        statusDuration: 2,
        statusPotency: 2,
        cooldown: 0
      },
      {
        id: 'muro_de_acero',
        name: 'Muro de Acero',
        description: 'Adopta guardia reforzada. Reduce daño entrante en este turno.',
        type: 'defense',
        dice: 'd6',
        accuracy: 0,
        power: 0,
        cooldown: 0
      }
    ];
  }
  if (archetype === 'rogue') {
    return [
      {
        id: 'apuñalar_sombra',
        name: 'Apuñalar desde la Sombra',
        description: 'Ataque preciso. Mayor probabilidad de crítico.',
        type: 'attack',
        dice: 'd10',
        accuracy: 3,
        power: 4,
        critBoost: 4,
        statusType: 'bleed',
        statusChance: 38,
        statusDuration: 2,
        statusPotency: 2,
        cooldown: 0
      },
      {
        id: 'polvo_cegador',
        name: 'Polvo Cegador',
        description: 'Desorienta al enemigo y reduce su precisión temporalmente.',
        type: 'debuff',
        dice: 'd6',
        accuracy: 2,
        power: 0,
        enemyAccuracyPenalty: 2,
        cooldown: 0
      }
    ];
  }
  if (archetype === 'mage') {
    return [
      {
        id: 'descarga_runica',
        name: 'Descarga Rúnica',
        description: 'Explosión de energía inestable con daño mágico elevado.',
        type: 'attack',
        dice: 'd12',
        accuracy: 1,
        power: 6,
        statusType: 'stun',
        statusChance: 18,
        statusDuration: 1,
        statusPotency: 0,
        cooldown: 0
      },
      {
        id: 'barrera_arcana',
        name: 'Barrera Arcana',
        description: 'Escudo mágico breve que mitiga el próximo impacto.',
        type: 'defense',
        dice: 'd6',
        accuracy: 0,
        power: 0,
        guardBonus: 5,
        cooldown: 0
      }
    ];
  }
  if (archetype === 'cleric') {
    return [
      {
        id: 'rito_de_sanacion',
        name: 'Rito de Sanación',
        description: 'Curación directa a un aliado gravemente herido.',
        type: 'heal',
        dice: 'd12',
        accuracy: 0,
        power: 8,
        cooldown: 0
      },
      {
        id: 'mandato_sagrado',
        name: 'Mandato Sagrado',
        description: 'Golpe de fe que inflige daño y estabiliza al grupo.',
        type: 'attack',
        dice: 'd10',
        accuracy: 2,
        power: 3,
        statusType: 'poison',
        statusChance: 16,
        statusDuration: 2,
        statusPotency: 2,
        cooldown: 0
      }
    ];
  }
  return [
    {
      id: 'golpe_tactico',
      name: 'Golpe Táctico',
      description: 'Ataque controlado sin coste adicional.',
      type: 'attack',
      dice: 'd8',
      accuracy: 1,
      power: 2,
      cooldown: 0
    }
  ];
}

function defaultInventoryForArchetype(archetype) {
  const base = [
    {
      id: uid('item'),
      name: 'Poción Menor',
      type: 'consumable',
      subtype: 'potion',
      rarity: 'common',
      quantity: 2,
      description: 'Restaura 14-24 de vida.',
      effects: { healMin: 14, healMax: 24 }
    },
    {
      id: uid('item'),
      name: 'Venda Reforzada',
      type: 'consumable',
      subtype: 'bandage',
      rarity: 'common',
      quantity: 2,
      description: 'Restaura 8-14 de vida y reduce daño residual.',
      effects: { healMin: 8, healMax: 14, cleanse: true }
    }
  ];

  if (archetype === 'warrior') {
    base.push(
      {
        id: uid('item'),
        name: 'Espadón de Guardia',
        type: 'equipment',
        slot: 'weapon',
        rarity: 'common',
        quantity: 1,
        description: 'Arma pesada, +2 ataque.',
        effects: { attack: 2 }
      },
      {
        id: uid('item'),
        name: 'Coraza Remachada',
        type: 'equipment',
        slot: 'armor',
        rarity: 'common',
        quantity: 1,
        description: 'Placas reforzadas, +2 defensa.',
        effects: { defense: 2 }
      }
    );
  } else if (archetype === 'rogue') {
    base.push(
      {
        id: uid('item'),
        name: 'Dagas de Sombra',
        type: 'equipment',
        slot: 'weapon',
        rarity: 'common',
        quantity: 1,
        description: 'Cuchillas veloces, +2 ataque.',
        effects: { attack: 2 }
      },
      {
        id: uid('item'),
        name: 'Capa de Sigilo',
        type: 'equipment',
        slot: 'trinket',
        rarity: 'uncommon',
        quantity: 1,
        description: 'Tejido oscuro, +1 defensa y +1 precisión de habilidad.',
        effects: { defense: 1, skillAccuracy: 1 }
      }
    );
  } else if (archetype === 'mage') {
    base.push(
      {
        id: uid('item'),
        name: 'Foco Rúnico',
        type: 'equipment',
        slot: 'weapon',
        rarity: 'uncommon',
        quantity: 1,
        description: 'Canaliza energía, +3 ataque mágico.',
        effects: { attack: 3 }
      },
      {
        id: uid('item'),
        name: 'Amuleto de Velo',
        type: 'equipment',
        slot: 'trinket',
        rarity: 'uncommon',
        quantity: 1,
        description: 'Protección etérea, +2 defensa.',
        effects: { defense: 2 }
      }
    );
  } else if (archetype === 'cleric') {
    base.push(
      {
        id: uid('item'),
        name: 'Cetro Litúrgico',
        type: 'equipment',
        slot: 'weapon',
        rarity: 'uncommon',
        quantity: 1,
        description: 'Refuerza ritos, +2 ataque.',
        effects: { attack: 2 }
      },
      {
        id: uid('item'),
        name: 'Símbolo de Fe',
        type: 'equipment',
        slot: 'trinket',
        rarity: 'uncommon',
        quantity: 1,
        description: 'Cataliza curación, +2 a habilidades de sanar.',
        effects: { healPower: 2 }
      }
    );
  } else {
    base.push({
      id: uid('item'),
      name: 'Hoja de Campaña',
      type: 'equipment',
      slot: 'weapon',
      rarity: 'common',
      quantity: 1,
      description: 'Arma fiable, +1 ataque.',
      effects: { attack: 1 }
    });
  }

  return base;
}

function normalizeEffects(rawEffects) {
  if (!rawEffects || typeof rawEffects !== 'object') return {};
  const effects = {
    healMin: toInt(rawEffects.healMin, 0),
    healMax: toInt(rawEffects.healMax, 0),
    damageMin: toInt(rawEffects.damageMin, 0),
    damageMax: toInt(rawEffects.damageMax, 0),
    attack: toInt(rawEffects.attack, 0),
    defense: toInt(rawEffects.defense, 0),
    healPower: toInt(rawEffects.healPower, 0),
    skillAccuracy: toInt(rawEffects.skillAccuracy, 0),
    enemyAccuracyPenalty: toInt(rawEffects.enemyAccuracyPenalty, 0),
    statusType: normalizeStatusType(rawEffects.statusType),
    statusChance: clamp(toInt(rawEffects.statusChance, 0), 0, 100),
    statusDuration: clamp(toInt(rawEffects.statusDuration, 0), 0, 6),
    statusPotency: clamp(toInt(rawEffects.statusPotency, 0), 0, 20),
    cleanse: Boolean(rawEffects.cleanse)
  };
  return effects;
}

function normalizeItem(rawItem, fallbackPrefix = 'item') {
  const type = rawItem?.type === 'equipment' ? 'equipment' : 'consumable';
  const slot = type === 'equipment' ? String(rawItem?.slot || 'weapon') : '';
  const quantity = Math.max(0, toInt(rawItem?.quantity, 1));
  return {
    id: String(rawItem?.id || uid(fallbackPrefix)),
    name: String(rawItem?.name || (type === 'equipment' ? 'Equipo' : 'Consumible')),
    type,
    subtype: String(rawItem?.subtype || ''),
    rarity: normalizeRarity(rawItem?.rarity),
    slot,
    quantity,
    description: String(rawItem?.description || ''),
    effects: normalizeEffects(rawItem?.effects)
  };
}

function normalizeSkill(rawSkill, fallbackPrefix = 'skill') {
  return {
    id: String(rawSkill?.id || uid(fallbackPrefix)),
    name: String(rawSkill?.name || 'Habilidad'),
    description: String(rawSkill?.description || ''),
    type: String(rawSkill?.type || 'attack'),
    dice: String(rawSkill?.dice || 'd8'),
    accuracy: toInt(rawSkill?.accuracy, 0),
    power: toInt(rawSkill?.power, 0),
    guardBonus: toInt(rawSkill?.guardBonus, 0),
    critBoost: toInt(rawSkill?.critBoost, 0),
    enemyAccuracyPenalty: toInt(rawSkill?.enemyAccuracyPenalty, 0),
    statusType: normalizeStatusType(rawSkill?.statusType),
    statusChance: clamp(toInt(rawSkill?.statusChance, 0), 0, 100),
    statusDuration: clamp(toInt(rawSkill?.statusDuration, 0), 0, 6),
    statusPotency: clamp(toInt(rawSkill?.statusPotency, 0), 0, 20),
    cooldown: Math.max(0, toInt(rawSkill?.cooldown, 0))
  };
}

export function normalizeHeroState(rawHero, index = 0) {
  const id = String(rawHero?.id || rawHero?._id || `hero_${index + 1}`);
  const archetype = roleArchetype(rawHero?.role);
  const baseStats = defaultStatsForArchetype(archetype);
  const maxHp = Math.max(1, toInt(rawHero?.maxHp, toInt(rawHero?.hp, 30)));
  const hp = clamp(toInt(rawHero?.hp, maxHp), 0, maxHp);

  const inventoryRaw = Array.isArray(rawHero?.inventory) && rawHero.inventory.length > 0
    ? rawHero.inventory
    : defaultInventoryForArchetype(archetype);
  const skillsRaw = Array.isArray(rawHero?.skills) && rawHero.skills.length > 0
    ? rawHero.skills
    : defaultSkillsForArchetype(archetype);

  const inventory = inventoryRaw
    .map((item, itemIndex) => normalizeItem(item, `${id}_item_${itemIndex + 1}`))
    .filter((item) => item.quantity > 0);
  const skills = skillsRaw
    .map((skill, skillIndex) => normalizeSkill(skill, `${id}_skill_${skillIndex + 1}`))
    .slice(0, 8);

  const equipmentSource = rawHero?.equipment && typeof rawHero.equipment === 'object' ? rawHero.equipment : {};
  const equipment = {
    weapon: equipmentSource.weapon && typeof equipmentSource.weapon === 'object'
      ? normalizeItem({ ...equipmentSource.weapon, type: 'equipment', slot: 'weapon' }, `${id}_eq_weapon`)
      : null,
    armor: equipmentSource.armor && typeof equipmentSource.armor === 'object'
      ? normalizeItem({ ...equipmentSource.armor, type: 'equipment', slot: 'armor' }, `${id}_eq_armor`)
      : null,
    trinket: equipmentSource.trinket && typeof equipmentSource.trinket === 'object'
      ? normalizeItem({ ...equipmentSource.trinket, type: 'equipment', slot: 'trinket' }, `${id}_eq_trinket`)
      : null
  };

  return {
    id,
    name: String(rawHero?.name || `Héroe ${index + 1}`),
    role: String(rawHero?.role || 'Aventurero'),
    weapon: String(rawHero?.weapon || ''),
    icon: String(rawHero?.icon || '⚔️'),
    hp,
    maxHp,
    attack: toInt(rawHero?.attack, baseStats.attack),
    defense: toInt(rawHero?.defense, baseStats.defense),
    archetype,
    guarding: Boolean(rawHero?.guarding),
    statusEffects: normalizeStatusEffects(rawHero?.statusEffects, `${id}_status`),
    equipment,
    inventory,
    skills
  };
}

export function normalizePartyState(rawParty) {
  if (!Array.isArray(rawParty)) return [];
  return rawParty.map((hero, index) => normalizeHeroState(hero, index));
}

function equipmentBonus(hero, key) {
  if (!hero?.equipment) return 0;
  const sources = [hero.equipment.weapon, hero.equipment.armor, hero.equipment.trinket].filter(Boolean);
  return sources.reduce((total, item) => total + toInt(item?.effects?.[key], 0), 0);
}

export function computeHeroCombatStats(hero) {
  if (!hero) return { attack: 0, defense: 0, skillAccuracy: 0, healPower: 0 };
  return {
    attack: toInt(hero.attack, 0) + equipmentBonus(hero, 'attack'),
    defense: toInt(hero.defense, 0) + equipmentBonus(hero, 'defense'),
    skillAccuracy: equipmentBonus(hero, 'skillAccuracy'),
    healPower: equipmentBonus(hero, 'healPower')
  };
}

function mergeStackedItems(items) {
  const keyed = new Map();
  items.forEach((item) => {
    const key = `${item.name}|${item.type}|${item.slot}|${item.rarity}|${JSON.stringify(item.effects || {})}`;
    if (!keyed.has(key)) {
      keyed.set(key, { ...item });
      return;
    }
    const current = keyed.get(key);
    keyed.set(key, {
      ...current,
      quantity: toInt(current.quantity, 0) + toInt(item.quantity, 0)
    });
  });
  return [...keyed.values()].filter((item) => toInt(item.quantity, 0) > 0);
}

export function useHeroConsumable(party, sourceHeroId, itemId, targetHeroId) {
  const nextParty = normalizePartyState(party);
  const sourceIndex = nextParty.findIndex((hero) => hero.id === sourceHeroId);
  const targetIndex = nextParty.findIndex((hero) => hero.id === targetHeroId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return { party: nextParty, error: 'No se encontró el personaje objetivo para usar el objeto.' };
  }

  const sourceHero = nextParty[sourceIndex];
  const targetHero = nextParty[targetIndex];
  const itemIndex = sourceHero.inventory.findIndex((item) => item.id === itemId && item.type === 'consumable');
  if (itemIndex === -1) {
    return { party: nextParty, error: 'El objeto consumible no está disponible en este inventario.' };
  }

  const item = sourceHero.inventory[itemIndex];
  if (item.quantity <= 0) {
    return { party: nextParty, error: 'No quedan unidades de ese objeto.' };
  }

  const healMin = Math.max(0, toInt(item.effects?.healMin, 0));
  const healMax = Math.max(healMin, toInt(item.effects?.healMax, healMin));
  const healRoll = healMin > 0 ? Math.floor(Math.random() * (healMax - healMin + 1)) + healMin : 0;
  const healedTarget = { ...targetHero };
  healedTarget.hp = Math.min(healedTarget.maxHp, healedTarget.hp + healRoll);
  let cleansedCount = 0;
  if (item.effects?.cleanse) {
    const before = Array.isArray(healedTarget.statusEffects) ? healedTarget.statusEffects : [];
    const after = before.filter((effect) => normalizeStatusType(effect?.type) === '');
    cleansedCount = Math.max(0, before.length - after.length);
    healedTarget.statusEffects = after;
  }
  nextParty[targetIndex] = healedTarget;

  const updatedItem = { ...item, quantity: item.quantity - 1 };
  if (updatedItem.quantity <= 0) {
    sourceHero.inventory.splice(itemIndex, 1);
  } else {
    sourceHero.inventory[itemIndex] = updatedItem;
  }
  nextParty[sourceIndex] = { ...sourceHero, inventory: mergeStackedItems(sourceHero.inventory) };

  const cleanseText = cleansedCount > 0 ? ` Elimina ${cleansedCount} estado(s) negativo(s).` : '';
  const message = `${sourceHero.name} usa ${item.name} sobre ${healedTarget.name} y restaura ${healRoll} HP.${cleanseText}`;
  return { party: nextParty, message };
}

export function equipItemOnHero(party, heroId, itemId) {
  const nextParty = normalizePartyState(party);
  const heroIndex = nextParty.findIndex((hero) => hero.id === heroId);
  if (heroIndex === -1) return { party: nextParty, error: 'Personaje no encontrado.' };

  const hero = { ...nextParty[heroIndex] };
  const inventory = [...hero.inventory];
  const itemIndex = inventory.findIndex((item) => item.id === itemId && item.type === 'equipment');
  if (itemIndex === -1) return { party: nextParty, error: 'Equipo no encontrado en inventario.' };

  const item = inventory[itemIndex];
  const slot = item.slot || 'weapon';
  const equipSlot = slot === 'armor' || slot === 'trinket' ? slot : 'weapon';

  if (item.quantity <= 0) {
    return { party: nextParty, error: 'No hay unidades disponibles para equipar.' };
  }

  inventory[itemIndex] = { ...item, quantity: item.quantity - 1 };
  if (inventory[itemIndex].quantity <= 0) inventory.splice(itemIndex, 1);

  const previous = hero.equipment[equipSlot];
  if (previous) {
    inventory.push({ ...previous, quantity: toInt(previous.quantity, 1) + 1 });
  }

  hero.equipment = {
    ...hero.equipment,
    [equipSlot]: { ...item, quantity: 1 }
  };
  hero.inventory = mergeStackedItems(inventory);
  nextParty[heroIndex] = hero;

  const message = `${hero.name} equipa ${item.name} en ${equipSlot}.`;
  return { party: nextParty, message };
}

export function unequipHeroSlot(party, heroId, slot) {
  const allowed = ['weapon', 'armor', 'trinket'];
  if (!allowed.includes(slot)) return { party: normalizePartyState(party), error: 'Ranura inválida.' };

  const nextParty = normalizePartyState(party);
  const heroIndex = nextParty.findIndex((hero) => hero.id === heroId);
  if (heroIndex === -1) return { party: nextParty, error: 'Personaje no encontrado.' };

  const hero = { ...nextParty[heroIndex] };
  const equipped = hero.equipment?.[slot];
  if (!equipped) return { party: nextParty, error: 'No hay objeto equipado en esa ranura.' };

  hero.inventory = mergeStackedItems([...hero.inventory, { ...equipped, quantity: 1 }]);
  hero.equipment = {
    ...hero.equipment,
    [slot]: null
  };
  nextParty[heroIndex] = hero;
  return { party: nextParty, message: `${hero.name} guarda ${equipped.name} en el inventario.` };
}

export function heroConsumables(hero) {
  return Array.isArray(hero?.inventory)
    ? hero.inventory.filter((item) => item.type === 'consumable' && item.quantity > 0)
    : [];
}

export function heroEquippables(hero) {
  return Array.isArray(hero?.inventory)
    ? hero.inventory.filter((item) => item.type === 'equipment' && item.quantity > 0)
    : [];
}

const LOOT_LIBRARY = {
  potion_minor: {
    name: 'Poción Menor',
    type: 'consumable',
    subtype: 'potion',
    rarity: 'common',
    quantity: 1,
    description: 'Restaura 14-24 de vida.',
    effects: { healMin: 14, healMax: 24 }
  },
  potion_major: {
    name: 'Poción Mayor',
    type: 'consumable',
    subtype: 'potion',
    rarity: 'uncommon',
    quantity: 1,
    description: 'Restaura 22-34 de vida.',
    effects: { healMin: 22, healMax: 34 }
  },
  elixir_vital: {
    name: 'Elixir Vital',
    type: 'consumable',
    subtype: 'elixir',
    rarity: 'rare',
    quantity: 1,
    description: 'Restaura 30-46 de vida y limpia estados negativos.',
    effects: { healMin: 30, healMax: 46, cleanse: true }
  },
  venda_reforzada: {
    name: 'Venda Reforzada',
    type: 'consumable',
    subtype: 'bandage',
    rarity: 'common',
    quantity: 1,
    description: 'Restaura 8-14 de vida y limpia sangrado o veneno.',
    effects: { healMin: 8, healMax: 14, cleanse: true }
  },
  antitoxina: {
    name: 'Antitoxina de Caverna',
    type: 'consumable',
    subtype: 'antidote',
    rarity: 'uncommon',
    quantity: 1,
    description: 'Restaura 10-16 de vida y neutraliza toxinas.',
    effects: { healMin: 10, healMax: 16, cleanse: true }
  },
  hoja_ferrea: {
    name: 'Hoja Férrea',
    type: 'equipment',
    slot: 'weapon',
    rarity: 'uncommon',
    quantity: 1,
    description: 'Filo robusto forjado para túneles. +2 ataque.',
    effects: { attack: 2 }
  },
  escudo_mina: {
    name: 'Escudo de Mina',
    type: 'equipment',
    slot: 'armor',
    rarity: 'rare',
    quantity: 1,
    description: 'Plancha pesada de convoy. +3 defensa.',
    effects: { defense: 3 }
  },
  foco_eco: {
    name: 'Foco del Eco',
    type: 'equipment',
    slot: 'trinket',
    rarity: 'rare',
    quantity: 1,
    description: 'Resonador rúnico. +2 precisión de habilidad.',
    effects: { skillAccuracy: 2 }
  },
  hoja_abisal: {
    name: 'Hoja Abisal',
    type: 'equipment',
    slot: 'weapon',
    rarity: 'epic',
    quantity: 1,
    description: 'Acero oscuro de las profundidades. +4 ataque.',
    effects: { attack: 4 }
  },
  coraza_reliquia: {
    name: 'Coraza Reliquia',
    type: 'equipment',
    slot: 'armor',
    rarity: 'epic',
    quantity: 1,
    description: 'Armadura ceremonial reforzada. +4 defensa.',
    effects: { defense: 4 }
  },
  sello_corona: {
    name: 'Sello de la Corona Perdida',
    type: 'equipment',
    slot: 'trinket',
    rarity: 'legendary',
    quantity: 1,
    description: 'Reliquia real: ataque, defensa y poder de curación.',
    effects: { attack: 2, defense: 2, healPower: 2, skillAccuracy: 1 }
  }
};

const ENEMY_DROP_TABLES = {
  escaramuza: [
    { id: 'potion_minor', weight: 28, minQty: 1, maxQty: 2, chance: 0.95 },
    { id: 'venda_reforzada', weight: 22, minQty: 1, maxQty: 2, chance: 0.9 },
    { id: 'antitoxina', weight: 14, minQty: 1, maxQty: 1, chance: 0.7 },
    { id: 'hoja_ferrea', weight: 12, minQty: 1, maxQty: 1, chance: 0.45 },
    { id: 'escudo_mina', weight: 8, minQty: 1, maxQty: 1, chance: 0.3 },
    { id: 'foco_eco', weight: 6, minQty: 1, maxQty: 1, chance: 0.25 }
  ],
  elite: [
    { id: 'potion_major', weight: 26, minQty: 1, maxQty: 2, chance: 0.92 },
    { id: 'elixir_vital', weight: 17, minQty: 1, maxQty: 1, chance: 0.78 },
    { id: 'escudo_mina', weight: 16, minQty: 1, maxQty: 1, chance: 0.68 },
    { id: 'foco_eco', weight: 14, minQty: 1, maxQty: 1, chance: 0.65 },
    { id: 'hoja_abisal', weight: 9, minQty: 1, maxQty: 1, chance: 0.38 },
    { id: 'coraza_reliquia', weight: 8, minQty: 1, maxQty: 1, chance: 0.35 },
    { id: 'sello_corona', weight: 3, minQty: 1, maxQty: 1, chance: 0.12 }
  ],
  jefe: [
    { id: 'potion_major', weight: 20, minQty: 2, maxQty: 3, chance: 0.98 },
    { id: 'elixir_vital', weight: 20, minQty: 1, maxQty: 2, chance: 0.95 },
    { id: 'hoja_abisal', weight: 16, minQty: 1, maxQty: 1, chance: 0.85 },
    { id: 'coraza_reliquia', weight: 16, minQty: 1, maxQty: 1, chance: 0.85 },
    { id: 'foco_eco', weight: 10, minQty: 1, maxQty: 1, chance: 0.75 },
    { id: 'sello_corona', weight: 8, minQty: 1, maxQty: 1, chance: 0.35 }
  ]
};

function weightedPick(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, toInt(entry.weight, 0)), 0);
  if (totalWeight <= 0) return entries[0] || null;
  let cursor = Math.random() * totalWeight;
  for (const entry of entries) {
    cursor -= Math.max(0, toInt(entry.weight, 0));
    if (cursor <= 0) return entry;
  }
  return entries[entries.length - 1] || null;
}

function randomIntInRange(min, max) {
  const safeMin = Math.max(0, toInt(min, 0));
  const safeMax = Math.max(safeMin, toInt(max, safeMin));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function createLootItem(templateId, quantity = 1) {
  const base = LOOT_LIBRARY[templateId];
  if (!base) return null;
  return normalizeItem(
    {
      ...base,
      id: uid('loot'),
      quantity: Math.max(1, toInt(quantity, 1))
    },
    'loot'
  );
}

export function rollEncounterLoot(enemyType = 'escaramuza', round = 1) {
  const type = String(enemyType || 'escaramuza').toLowerCase();
  const table = ENEMY_DROP_TABLES[type] || ENEMY_DROP_TABLES.escaramuza;
  const baseRolls = type === 'jefe' ? 4 : (type === 'elite' ? 3 : 2);
  const bonusRolls = Math.min(2, Math.max(0, toInt(round / 4, 0)));
  const rolls = baseRolls + bonusRolls;
  const drops = [];

  for (let i = 0; i < rolls; i += 1) {
    const entry = weightedPick(table);
    if (!entry) continue;
    const chance = Number.isFinite(Number(entry.chance)) ? Number(entry.chance) : 1;
    if (Math.random() > chance) continue;
    const quantity = randomIntInRange(entry.minQty, entry.maxQty);
    const item = createLootItem(entry.id, quantity);
    if (item) drops.push(item);
  }

  if (drops.length === 0) {
    const fallback = createLootItem('potion_minor', 1);
    if (fallback) drops.push(fallback);
  }

  return mergeStackedItems(drops);
}

export function grantLootToParty(party, rawLootItems) {
  const nextParty = normalizePartyState(party);
  if (nextParty.length === 0) return { party: nextParty, assignments: [] };
  const lootItems = Array.isArray(rawLootItems)
    ? rawLootItems.map((item, index) => normalizeItem(item, `loot_${index + 1}`)).filter((item) => item.quantity > 0)
    : [];
  if (lootItems.length === 0) return { party: nextParty, assignments: [] };

  const aliveReceivers = nextParty.filter((hero) => hero.hp > 0);
  const receiverPool = aliveReceivers.length > 0 ? aliveReceivers : nextParty;
  const assignments = [];
  let receiverCursor = 0;

  lootItems.forEach((item) => {
    const receiver = receiverPool[receiverCursor % receiverPool.length];
    receiverCursor += 1;
    const heroIndex = nextParty.findIndex((hero) => hero.id === receiver.id);
    if (heroIndex === -1) return;
    const hero = { ...nextParty[heroIndex] };
    hero.inventory = mergeStackedItems([...hero.inventory, { ...item, id: uid('loot') }]);
    nextParty[heroIndex] = hero;
    assignments.push({
      heroId: hero.id,
      heroName: hero.name,
      item
    });
  });

  return { party: nextParty, assignments };
}
