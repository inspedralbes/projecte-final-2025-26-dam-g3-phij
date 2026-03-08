<template>
  <section class="tactical-combat-panel">
    <header class="combat-head">
      <div>
        <h3>COMBATE TACTICO</h3>
        <small>{{ enemy.name }} · {{ enemy.typeLabel }} · RONDA {{ round }}</small>
      </div>
      <small class="turn-badge" v-if="!isPlanningOrder && activeHero">TURNO: {{ activeHero.name }}</small>
      <small class="turn-badge" v-else>PLANIFICAR TURNO</small>
    </header>

    <section class="order-planner" v-if="isPlanningOrder">
      <h4>Orden de Turno de la Escuadra</h4>
      <p>Elige quien actua primero, segundo y tercero. Puedes cambiar el orden cada ronda.</p>
      <div class="planner-grid">
        <button
          v-for="hero in aliveHeroes"
          :key="`planner_${hero.id}`"
          class="planner-hero"
          :class="{ selected: planningOrder.includes(hero.id) }"
          @click="toggleHeroInOrder(hero.id)"
        >
          <span>{{ hero.icon }}</span>
          <strong>{{ hero.name }}</strong>
        </button>
      </div>
      <div class="planner-sequence">
        <span v-for="(heroId, idx) in planningOrder" :key="`seq_${heroId}_${idx}`">
          {{ idx + 1 }}. {{ heroName(heroId) }}
        </span>
      </div>
      <div class="planner-actions">
        <button class="planner-btn" @click="setAutoOrder">AUTO ORDEN</button>
        <button class="planner-btn" :disabled="planningOrder.length !== aliveHeroes.length" @click="confirmOrder">
          CONFIRMAR ORDEN
        </button>
      </div>
    </section>

    <div class="battle-lane">
      <div class="ally-col">
        <article
          v-for="hero in localHeroes"
          :key="hero.id"
          class="unit-card"
          :class="{
            active: activeHero && hero.id === activeHero.id,
            dead: hero.hp <= 0,
            ordered: roundOrder.includes(hero.id)
          }"
        >
          <div class="unit-main">
            <span class="unit-icon">{{ hero.icon }}</span>
            <div class="unit-meta">
              <strong>{{ hero.name }}</strong>
              <small>{{ hero.role }}</small>
            </div>
            <small class="order-pos" v-if="roundOrder.includes(hero.id)">
              #{{ roundOrder.indexOf(hero.id) + 1 }}
            </small>
          </div>
          <div class="hp-strip">
            <div class="hp-fill" :style="{ width: `${Math.max(0, (hero.hp / hero.maxHp) * 100)}%` }"></div>
          </div>
          <small class="hp-text">HP {{ hero.hp }} / {{ hero.maxHp }}</small>
          <small class="guarding" v-if="hero.guarding">EN GUARDIA</small>
          <div v-if="hero.statusEffects && hero.statusEffects.length > 0" class="status-row">
            <span
              v-for="effect in hero.statusEffects"
              :key="`${hero.id}_${effect.id}`"
              class="status-pill"
              :class="`is-${effect.type}`"
            >
              {{ shortStatus(effect) }} {{ effect.duration > 0 ? `(${effect.duration})` : '' }}
            </span>
          </div>
        </article>
      </div>

      <div class="enemy-col">
        <article class="enemy-card" :class="enemy.type">
          <span class="enemy-icon">{{ enemy.icon }}</span>
          <strong>{{ enemy.name }}</strong>
          <small>{{ enemy.typeLabel }}</small>
          <div class="hp-strip enemy-strip">
            <div class="hp-fill enemy-fill" :style="{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }"></div>
          </div>
          <small class="hp-text">HP {{ enemy.hp }} / {{ enemy.maxHp }}</small>
          <small v-if="enemy.accuracyPenalty > 0" class="enemy-state">PRECISION REDUCIDA ({{ enemy.accuracyPenalty }})</small>
          <div v-if="enemy.statusEffects && enemy.statusEffects.length > 0" class="status-row">
            <span
              v-for="effect in enemy.statusEffects"
              :key="`enemy_${effect.id}`"
              class="status-pill"
              :class="`is-${effect.type}`"
            >
              {{ shortStatus(effect) }} {{ effect.duration > 0 ? `(${effect.duration})` : '' }}
            </span>
          </div>
        </article>
      </div>
    </div>

    <section class="combat-controls" v-if="!isPlanningOrder && activeHero">
      <div class="actor-row">
        <strong>{{ activeHero.name }}</strong>
        <small>ATQ {{ activeStats.attack }} · DEF {{ activeStats.defense }}</small>
      </div>

      <div class="main-actions">
        <button class="combat-btn" :disabled="controlsLocked" @click="performBasicAttack">ATACAR (d20)</button>
        <button class="combat-btn" :disabled="controlsLocked" @click="performDefend">DEFENDER</button>
      </div>

      <div class="skill-block">
        <h4>Habilidades</h4>
        <article v-for="skill in activeHero.skills || []" :key="skill.id" class="skill-card">
          <div>
            <strong>{{ skill.name }}</strong>
            <small>{{ skill.description }}</small>
            <small class="skill-meta">{{ skill.type.toUpperCase() }} · {{ skill.dice }} · PODER {{ skill.power }}</small>
          </div>
          <button class="combat-btn minor" :disabled="controlsLocked" @click="performSkill(skill.id)">USAR</button>
        </article>
        <p v-if="!activeHero.skills || activeHero.skills.length === 0" class="empty-note">Sin habilidades definidas.</p>
      </div>

      <div class="item-block">
        <div class="item-head">
          <h4>Objetos de {{ activeHero.name }}</h4>
          <select v-model="itemTargetHeroId">
            <option v-for="hero in aliveHeroes" :key="`target_${hero.id}`" :value="hero.id">{{ hero.name }}</option>
          </select>
        </div>
        <article v-for="item in activeConsumables" :key="item.id" class="item-card">
          <div>
            <strong>{{ item.name }}</strong>
            <small>x{{ item.quantity }} · {{ item.description }}</small>
          </div>
          <button class="combat-btn minor" :disabled="controlsLocked" @click="performConsumable(item.id)">USAR</button>
        </article>
        <p v-if="activeConsumables.length === 0" class="empty-note">No hay consumibles en su inventario.</p>
      </div>
    </section>

    <div class="dice-readout" v-if="lastRollText">{{ lastRollText }}</div>

    <ul class="combat-feed">
      <li v-for="(line, idx) in recentLines" :key="`${idx}_${line}`">{{ line }}</li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  normalizePartyState,
  computeHeroCombatStats,
  useHeroConsumable,
  heroConsumables,
  normalizeStatusEffects,
  rollEncounterLoot,
  grantLootToParty,
  rarityLabel
} from '../utils/partySystem';

const props = defineProps({
  encounter: {
    type: Object,
    default: null
  },
  party: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['sync-party', 'end']);

const localHeroes = ref([]);
const enemy = ref({
  name: 'Hostil desconocido',
  type: 'escaramuza',
  typeLabel: 'ESCARAMUZA',
  icon: '👹',
  hp: 60,
  maxHp: 60,
  attack: 8,
  defense: 2,
  accuracyPenalty: 0,
  statusEffects: [],
  statusOnHit: null
});

const round = ref(1);
const battleLog = ref([]);
const lastRollText = ref('');
const locked = ref(false);
const finished = ref(false);

const isPlanningOrder = ref(true);
const planningOrder = ref([]);
const roundOrder = ref([]);
const turnPointer = ref(0);
const itemTargetHeroId = ref('');

const ENEMY_PRESETS = {
  escaramuza: {
    hp: 80,
    attack: 9,
    defense: 3,
    icon: '👹',
    label: 'ESCARAMUZA',
    statusOnHit: { type: 'bleed', chance: 24, duration: 2, potency: 2 }
  },
  elite: {
    hp: 135,
    attack: 12,
    defense: 5,
    icon: '🧟',
    label: 'ELITE',
    statusOnHit: { type: 'poison', chance: 28, duration: 2, potency: 3 }
  },
  jefe: {
    hp: 220,
    attack: 16,
    defense: 7,
    icon: '💀',
    label: 'JEFE',
    statusOnHit: { type: 'stun', chance: 20, duration: 1, potency: 0 }
  }
};

const aliveHeroes = computed(() => localHeroes.value.filter((hero) => hero.hp > 0));
const activeHeroId = computed(() => roundOrder.value[turnPointer.value] || '');
const activeHero = computed(() => localHeroes.value.find((hero) => hero.id === activeHeroId.value) || null);
const activeStats = computed(() => computeHeroCombatStats(activeHero.value));
const activeConsumables = computed(() => heroConsumables(activeHero.value));
const controlsLocked = computed(() => locked.value || finished.value || !activeHero.value || activeHero.value.hp <= 0);
const recentLines = computed(() => battleLog.value.slice(-9));

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseDiceFaces(diceLabel = 'd8') {
  const parsed = String(diceLabel).toLowerCase().match(/d(\d+)/);
  return parsed ? Math.max(2, toInt(parsed[1], 8)) : 8;
}

function rollDice(faces) {
  return Math.floor(Math.random() * faces) + 1;
}

function shortStatus(effect) {
  const type = String(effect?.type || '').toLowerCase();
  if (type === 'bleed') return 'SANGRADO';
  if (type === 'poison') return 'VENENO';
  if (type === 'stun') return 'ATURDIDO';
  return String(effect?.name || 'ESTADO').toUpperCase();
}

function mergeStatusEffects(currentStatus, rawStatus, fallbackPrefix = 'status') {
  const current = normalizeStatusEffects(currentStatus || [], `${fallbackPrefix}_current`);
  const incoming = normalizeStatusEffects([rawStatus], `${fallbackPrefix}_incoming`);
  if (incoming.length === 0) return { list: current, changed: false, applied: null };
  const effect = incoming[0];
  const index = current.findIndex((entry) => entry.type === effect.type);
  if (index === -1) {
    return { list: [...current, effect], changed: true, applied: effect };
  }
  const existing = current[index];
  const merged = {
    ...existing,
    duration: Math.max(toInt(existing.duration, 1), toInt(effect.duration, 1)),
    potency: Math.max(toInt(existing.potency, 0), toInt(effect.potency, 0)),
    source: effect.source || existing.source
  };
  const changed = merged.duration !== existing.duration || merged.potency !== existing.potency;
  const next = [...current];
  next[index] = merged;
  return { list: next, changed, applied: changed ? merged : null };
}

function consumeStunStatus(statusList, fallbackPrefix = 'status') {
  const normalized = normalizeStatusEffects(statusList || [], `${fallbackPrefix}_consume`);
  let stunned = false;
  const next = normalized.flatMap((effect) => {
    if (effect.type !== 'stun') return [effect];
    stunned = true;
    const nextDuration = toInt(effect.duration, 1) - 1;
    if (nextDuration > 0) {
      return [{ ...effect, duration: nextDuration }];
    }
    return [];
  });
  return {
    stunned,
    nextStatus: normalizeStatusEffects(next, `${fallbackPrefix}_next`)
  };
}

function tickDamageStatuses(statusList, unitLabel, fallbackPrefix = 'status') {
  const normalized = normalizeStatusEffects(statusList || [], `${fallbackPrefix}_tick`);
  let totalDamage = 0;
  const lines = [];

  const nextStatus = normalized.flatMap((effect) => {
    if (effect.type === 'stun') return [effect];
    const currentDuration = toInt(effect.duration, 1);
    if (effect.type === 'bleed' || effect.type === 'poison') {
      const variance = effect.type === 'bleed' ? rollDice(3) - 1 : rollDice(4) - 1;
      const damage = Math.max(1, toInt(effect.potency, 2) + variance);
      totalDamage += damage;
      lines.push(
        effect.type === 'bleed'
          ? `${unitLabel} sufre ${damage} de daño por sangrado.`
          : `${unitLabel} sufre ${damage} de daño por veneno.`
      );
    }
    const nextDuration = currentDuration - 1;
    if (nextDuration > 0) return [{ ...effect, duration: nextDuration }];
    return [];
  });

  return {
    damage: totalDamage,
    lines,
    nextStatus: normalizeStatusEffects(nextStatus, `${fallbackPrefix}_next`)
  };
}

function tryApplyStatusToHero(heroId, statusConfig, sourceLabel = '') {
  if (!statusConfig || typeof statusConfig !== 'object') return;
  const chance = clamp(toInt(statusConfig.chance, 0), 0, 100);
  if (chance <= 0) return;
  const roll = rollDice(100);
  if (roll > chance) return;
  const statusType = String(statusConfig.type || '').toLowerCase();
  if (!statusType) return;

  let applied = null;
  updateHeroById(heroId, (hero) => {
    const merged = mergeStatusEffects(
      hero.statusEffects,
      {
        type: statusType,
        duration: Math.max(1, toInt(statusConfig.duration, 1)),
        potency: Math.max(0, toInt(statusConfig.potency, 0)),
        source: sourceLabel
      },
      `${hero.id}_status`
    );
    applied = merged.applied;
    return {
      ...hero,
      statusEffects: merged.list
    };
  });

  if (applied) {
    pushBattleLine(`${heroName(heroId)} queda bajo efecto: ${shortStatus(applied)}.`);
  }
}

function tryApplyStatusToEnemy(statusConfig, sourceLabel = '') {
  if (!statusConfig || typeof statusConfig !== 'object') return;
  const chance = clamp(toInt(statusConfig.chance, 0), 0, 100);
  if (chance <= 0) return;
  const roll = rollDice(100);
  if (roll > chance) return;
  const statusType = String(statusConfig.type || '').toLowerCase();
  if (!statusType) return;

  const merged = mergeStatusEffects(
    enemy.value.statusEffects,
    {
      type: statusType,
      duration: Math.max(1, toInt(statusConfig.duration, 1)),
      potency: Math.max(0, toInt(statusConfig.potency, 0)),
      source: sourceLabel
    },
    'enemy_status'
  );
  enemy.value = {
    ...enemy.value,
    statusEffects: merged.list
  };
  if (merged.applied) {
    pushBattleLine(`${enemy.value.name} queda afectado: ${shortStatus(merged.applied)}.`);
  }
}

function pushBattleLine(line) {
  if (!line) return;
  battleLog.value.push(line);
  if (battleLog.value.length > 60) battleLog.value.shift();
}

function heroName(heroId) {
  return localHeroes.value.find((hero) => hero.id === heroId)?.name || 'Aventurero';
}

function mergeTacticalState(nextList) {
  const previousById = new Map(localHeroes.value.map((hero) => [hero.id, hero]));
  return nextList.map((hero) => {
    const prev = previousById.get(hero.id);
    if (!prev) {
      return {
        ...hero,
        guarding: false,
        guardBonus: 0
      };
    }
    return {
      ...hero,
      guarding: Boolean(prev.guarding),
      guardBonus: toInt(prev.guardBonus, 0)
    };
  });
}

function normalizePartyForCombat(rawParty) {
  const normalized = normalizePartyState(rawParty);
  return mergeTacticalState(normalized);
}

function heroSnapshot() {
  return localHeroes.value.map((hero) => ({
    id: hero.id,
    name: hero.name,
    role: hero.role,
    weapon: hero.weapon,
    icon: hero.icon,
    hp: hero.hp,
    maxHp: hero.maxHp,
    attack: hero.attack,
    defense: hero.defense,
    inventory: hero.inventory || [],
    equipment: hero.equipment || { weapon: null, armor: null, trinket: null },
    skills: hero.skills || [],
    statusEffects: hero.statusEffects || []
  }));
}

function emitPartySync() {
  emit('sync-party', heroSnapshot());
}

function prepareEncounter() {
  if (!props.encounter) return;

  const normalizedParty = normalizePartyForCombat(props.party);
  localHeroes.value = normalizedParty.length > 0
    ? normalizedParty
    : normalizePartyForCombat([
      { id: 'fallback_hero', name: 'Kaelen', role: 'Guerrero', icon: '⚔️', hp: 52, maxHp: 52 }
    ]);

  const enemyType = String(props.encounter?.enemyType || 'escaramuza').toLowerCase();
  const preset = ENEMY_PRESETS[enemyType] || ENEMY_PRESETS.escaramuza;
  enemy.value = {
    name: props.encounter?.enemyName || 'Amenaza hostil',
    type: Object.prototype.hasOwnProperty.call(ENEMY_PRESETS, enemyType) ? enemyType : 'escaramuza',
    typeLabel: preset.label,
    icon: preset.icon,
    hp: preset.hp,
    maxHp: preset.hp,
    attack: preset.attack,
    defense: preset.defense,
    accuracyPenalty: 0,
    statusEffects: [],
    statusOnHit: preset.statusOnHit || null
  };

  round.value = 1;
  battleLog.value = [`${enemy.value.name} emerge en ${props.encounter?.environment || 'la zona de combate'}.`];
  lastRollText.value = '';
  locked.value = false;
  finished.value = false;
  planningOrder.value = [];
  roundOrder.value = [];
  turnPointer.value = 0;
  isPlanningOrder.value = true;
  itemTargetHeroId.value = aliveHeroes.value[0]?.id || localHeroes.value[0]?.id || '';

  emitPartySync();
}

function ensureValidTargetHero() {
  const alive = aliveHeroes.value;
  if (alive.length === 0) {
    itemTargetHeroId.value = '';
    return;
  }
  const exists = alive.some((hero) => hero.id === itemTargetHeroId.value);
  if (!exists) itemTargetHeroId.value = alive[0].id;
}

function setAutoOrder() {
  const ordered = [...aliveHeroes.value]
    .map((hero) => {
      const stats = computeHeroCombatStats(hero);
      return {
        id: hero.id,
        score: stats.attack + stats.defense + toInt(hero.hp / 10, 0)
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
  planningOrder.value = ordered;
}

function toggleHeroInOrder(heroId) {
  if (planningOrder.value.includes(heroId)) {
    planningOrder.value = planningOrder.value.filter((id) => id !== heroId);
    return;
  }
  if (!aliveHeroes.value.some((hero) => hero.id === heroId)) return;
  planningOrder.value = [...planningOrder.value, heroId];
}

function confirmOrder() {
  if (planningOrder.value.length !== aliveHeroes.value.length) return;
  roundOrder.value = [...planningOrder.value];
  turnPointer.value = 0;
  isPlanningOrder.value = false;
  ensureValidTargetHero();
  pushBattleLine(`Orden confirmado: ${roundOrder.value.map((id) => heroName(id)).join(' > ')}.`);
}

function allHeroesDown() {
  return localHeroes.value.every((hero) => hero.hp <= 0);
}

function clearDefensiveStates() {
  localHeroes.value = localHeroes.value.map((hero) => ({
    ...hero,
    guarding: false,
    guardBonus: 0
  }));
}

function finishCombat(result) {
  if (finished.value) return;
  finished.value = true;

  if (result === 'derrota') {
    localHeroes.value = localHeroes.value.map((hero) => ({
      ...hero,
      hp: hero.hp > 0 ? hero.hp : Math.max(1, Math.floor(hero.maxHp * 0.25)),
      guarding: false,
      guardBonus: 0
    }));
    pushBattleLine('La escuadra retrocede malherida, pero evita la aniquilacion total.');
  } else {
    pushBattleLine(`La amenaza ${enemy.value.name} cae. El terreno queda en silencio.`);
  }

  emitPartySync();
  const summaryState = heroSnapshot().map((hero) => `${hero.name} ${hero.hp}/${hero.maxHp}`).join(', ');
  const summary = result === 'victoria'
    ? `Resultado del combate tactico: victoria contra ${enemy.value.name} (${enemy.value.typeLabel}). Rondas: ${round.value}. Estado del grupo: ${summaryState}.`
    : `Resultado del combate tactico: retirada tras derrota contra ${enemy.value.name} (${enemy.value.typeLabel}). Rondas: ${round.value}. Estado del grupo tras retirada: ${summaryState}.`;

  emit('end', {
    result,
    summary,
    partySnapshot: heroSnapshot(),
    transcript: battleLog.value.slice(-12)
  });
}

function resolveHit(attackValue, targetDefense, bonus = 0) {
  const die = rollDice(20);
  const total = die + attackValue + bonus;
  const hit = die === 20 || total >= targetDefense;
  return { die, total, hit };
}

function damageRoll(diceLabel, power, attackValue) {
  const faces = parseDiceFaces(diceLabel);
  return rollDice(faces) + Math.max(0, toInt(power, 0)) + Math.floor(Math.max(0, attackValue) / 2);
}

function updateHeroById(heroId, updater) {
  const idx = localHeroes.value.findIndex((hero) => hero.id === heroId);
  if (idx === -1) return;
  const updated = updater({ ...localHeroes.value[idx] });
  localHeroes.value[idx] = updated;
}

function applyDamageToEnemy(amount) {
  enemy.value = {
    ...enemy.value,
    hp: clamp(enemy.value.hp - Math.max(0, amount), 0, enemy.value.maxHp)
  };
}

function applyHealToHero(heroId, amount) {
  updateHeroById(heroId, (hero) => ({
    ...hero,
    hp: clamp(hero.hp + Math.max(0, amount), 0, hero.maxHp)
  }));
}

function applyEnemyTurn() {
  const targets = aliveHeroes.value;
  if (targets.length === 0) {
    finishCombat('derrota');
    return;
  }

  const target = targets[Math.floor(Math.random() * targets.length)];
  const targetStats = computeHeroCombatStats(target);
  const effectiveDefense = 11 + targetStats.defense + toInt(target.guardBonus, 0);
  const enemyAccuracyPenalty = Math.max(0, toInt(enemy.value.accuracyPenalty, 0));

  const hitCheck = resolveHit(enemy.value.attack, effectiveDefense, -enemyAccuracyPenalty);
  lastRollText.value = `${enemy.value.name} tira d20: ${hitCheck.die} (total ${hitCheck.total})`;

  if (hitCheck.hit) {
    const base = damageRoll('d10', 0, enemy.value.attack);
    const mitigated = target.guarding ? Math.floor(base * 0.58) : base;
    const damage = Math.max(1, mitigated);
    updateHeroById(target.id, (hero) => ({ ...hero, hp: Math.max(0, hero.hp - damage) }));
    pushBattleLine(`${enemy.value.name} golpea a ${target.name} y causa ${damage} de dano.`);
  } else {
    pushBattleLine(`${enemy.value.name} falla su ataque contra ${target.name}.`);
  }

  enemy.value = {
    ...enemy.value,
    accuracyPenalty: Math.max(0, enemyAccuracyPenalty - 1)
  };

  clearDefensiveStates();
  emitPartySync();

  if (allHeroesDown()) {
    finishCombat('derrota');
    return;
  }

  round.value += 1;
  planningOrder.value = [];
  roundOrder.value = [];
  turnPointer.value = 0;
  isPlanningOrder.value = true;
  ensureValidTargetHero();
  pushBattleLine('La ronda termina. Define un nuevo orden de turno.');
}

function finalizeHeroAction() {
  emitPartySync();

  if (enemy.value.hp <= 0) {
    finishCombat('victoria');
    locked.value = false;
    return;
  }

  const nextPointer = turnPointer.value + 1;
  if (nextPointer >= roundOrder.value.length) {
    applyEnemyTurn();
    locked.value = false;
    return;
  }

  turnPointer.value = nextPointer;
  ensureValidTargetHero();
  locked.value = false;
}

function performBasicAttack() {
  if (controlsLocked.value) return;
  const actor = activeHero.value;
  if (!actor) return;

  locked.value = true;
  const actorStats = computeHeroCombatStats(actor);
  const targetDefense = 11 + enemy.value.defense;
  const hitCheck = resolveHit(actorStats.attack, targetDefense, 0);
  lastRollText.value = `${actor.name} tira d20: ${hitCheck.die} (total ${hitCheck.total})`;

  if (hitCheck.hit) {
    const damage = damageRoll('d8', 0, actorStats.attack);
    applyDamageToEnemy(damage);
    pushBattleLine(`${actor.name} impacta a ${enemy.value.name} por ${damage} de dano.`);
  } else {
    pushBattleLine(`${actor.name} falla su ataque contra ${enemy.value.name}.`);
  }

  finalizeHeroAction();
}

function performDefend() {
  if (controlsLocked.value) return;
  const actor = activeHero.value;
  if (!actor) return;

  locked.value = true;
  updateHeroById(actor.id, (hero) => ({
    ...hero,
    guarding: true,
    guardBonus: Math.max(toInt(hero.guardBonus, 0), 3)
  }));
  pushBattleLine(`${actor.name} entra en guardia y fortalece su defensa.`);
  finalizeHeroAction();
}

function performSkill(skillId) {
  if (controlsLocked.value) return;
  const actor = activeHero.value;
  if (!actor) return;

  const skill = (actor.skills || []).find((entry) => entry.id === skillId);
  if (!skill) {
    pushBattleLine('No se encontro esa habilidad para el personaje activo.');
    return;
  }

  locked.value = true;
  const actorStats = computeHeroCombatStats(actor);

  if (skill.type === 'heal') {
    const targetId = itemTargetHeroId.value || actor.id;
    const healValue = damageRoll(skill.dice, skill.power + actorStats.healPower, 0);
    applyHealToHero(targetId, healValue);
    lastRollText.value = `${actor.name} canaliza ${skill.name}: +${healValue} HP`;
    pushBattleLine(`${actor.name} usa ${skill.name} y restaura ${healValue} HP a ${heroName(targetId)}.`);
    finalizeHeroAction();
    return;
  }

  if (skill.type === 'defense') {
    const bonus = Math.max(3, toInt(skill.guardBonus, 0));
    updateHeroById(actor.id, (hero) => ({
      ...hero,
      guarding: true,
      guardBonus: Math.max(toInt(hero.guardBonus, 0), bonus)
    }));
    pushBattleLine(`${actor.name} activa ${skill.name} y gana una defensa reforzada (+${bonus}).`);
    finalizeHeroAction();
    return;
  }

  if (skill.type === 'debuff') {
    const penalty = Math.max(1, toInt(skill.enemyAccuracyPenalty, 1));
    enemy.value = {
      ...enemy.value,
      accuracyPenalty: Math.max(enemy.value.accuracyPenalty, penalty)
    };
    lastRollText.value = `${actor.name} aplica ${skill.name}: penalizacion de precision ${penalty}`;
    pushBattleLine(`${actor.name} ejecuta ${skill.name}. ${enemy.value.name} pierde precision.`);
    finalizeHeroAction();
    return;
  }

  const targetDefense = 11 + enemy.value.defense;
  const hitBonus = toInt(skill.accuracy, 0) + actorStats.skillAccuracy;
  const hitCheck = resolveHit(actorStats.attack, targetDefense, hitBonus);
  lastRollText.value = `${actor.name} usa ${skill.name}: d20 ${hitCheck.die} (total ${hitCheck.total})`;

  if (hitCheck.hit) {
    let damage = damageRoll(skill.dice, skill.power, actorStats.attack);
    if (hitCheck.die === 20 || (toInt(skill.critBoost, 0) > 0 && hitCheck.die >= 20 - toInt(skill.critBoost, 0))) {
      damage += rollDice(8);
    }
    applyDamageToEnemy(damage);
    pushBattleLine(`${actor.name} conecta ${skill.name} e inflige ${damage} de dano a ${enemy.value.name}.`);
  } else {
    pushBattleLine(`${actor.name} intenta ${skill.name}, pero ${enemy.value.name} lo esquiva.`);
  }

  finalizeHeroAction();
}

function performConsumable(itemId) {
  if (controlsLocked.value) return;
  const actor = activeHero.value;
  if (!actor) return;

  const targetId = itemTargetHeroId.value || actor.id;
  const result = useHeroConsumable(localHeroes.value, actor.id, itemId, targetId);
  if (result?.error) {
    pushBattleLine(result.error);
    return;
  }

  locked.value = true;
  localHeroes.value = mergeTacticalState(result.party || localHeroes.value);
  if (result?.message) {
    pushBattleLine(result.message);
    lastRollText.value = `${actor.name} utiliza un consumible sobre ${heroName(targetId)}.`;
  }
  finalizeHeroAction();
}

watch(
  () => props.encounter,
  (encounter) => {
    if (encounter) {
      prepareEncounter();
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => props.party,
  (partyValue) => {
    if (!props.encounter || finished.value) return;
    const incoming = normalizePartyForCombat(partyValue);
    if (incoming.length === 0) return;
    localHeroes.value = incoming;
    ensureValidTargetHero();
  },
  { deep: true }
);

watch(
  aliveHeroes,
  (alive) => {
    if (!alive || alive.length === 0) return;
    if (planningOrder.value.length > alive.length) {
      planningOrder.value = planningOrder.value.filter((id) => alive.some((hero) => hero.id === id));
    }
    ensureValidTargetHero();
  },
  { deep: true }
);
</script>

<style scoped lang="scss">
$gold: #c5a059;
$crimson: #8a1c1c;

.tactical-combat-panel {
  border: 1px solid rgba($gold, 0.35);
  background: linear-gradient(to bottom, rgba(7, 7, 7, 0.96), rgba(7, 7, 7, 0.86));
  padding: 14px;
  margin: 0 0 12px;
}
.combat-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
  h3 {
    margin: 0;
    color: $gold;
    letter-spacing: 1px;
    font-size: 0.94rem;
  }
  small {
    color: #bfa06a;
    font-size: 0.67rem;
    letter-spacing: 1px;
  }
  .turn-badge {
    border: 1px solid rgba($gold, 0.3);
    background: rgba($gold, 0.08);
    padding: 5px 8px;
  }
}
.order-planner {
  border: 1px solid rgba($gold, 0.2);
  background: rgba(0, 0, 0, 0.28);
  padding: 10px;
  margin-bottom: 12px;
  h4 {
    margin: 0 0 4px;
    color: #e8c88a;
    font-size: 0.73rem;
    letter-spacing: 1px;
  }
  p {
    margin: 0 0 8px;
    color: #949494;
    font-size: 0.62rem;
    line-height: 1.45;
  }
}
.planner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 6px;
}
.planner-hero {
  border: 1px solid rgba($gold, 0.2);
  background: rgba(15, 15, 15, 0.76);
  color: #dcbf84;
  padding: 7px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  &.selected {
    border-color: rgba($gold, 0.85);
    box-shadow: 0 0 10px rgba($gold, 0.2);
  }
  strong { font-size: 0.64rem; }
}
.planner-sequence {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  span {
    border: 1px solid rgba($gold, 0.25);
    background: rgba($gold, 0.07);
    color: #d5b477;
    font-size: 0.62rem;
    padding: 4px 6px;
  }
}
.planner-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.planner-btn {
  border: 1px solid rgba($gold, 0.38);
  background: rgba($gold, 0.08);
  color: #ddb873;
  font-size: 0.62rem;
  padding: 6px 8px;
  cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}
.battle-lane {
  display: grid;
  grid-template-columns: 1.3fr 0.85fr;
  gap: 12px;
  align-items: start;
}
.ally-col {
  display: grid;
  gap: 8px;
}
.unit-card {
  border: 1px solid rgba($gold, 0.2);
  background: rgba(10, 10, 10, 0.82);
  padding: 8px;
  &.active { border-color: rgba($gold, 0.85); box-shadow: 0 0 12px rgba($gold, 0.25); }
  &.dead { opacity: 0.4; filter: grayscale(1); }
  &.ordered { border-left: 3px solid rgba($gold, 0.4); }
}
.unit-main {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
}
.unit-icon { font-size: 1.1rem; }
.unit-meta {
  display: flex;
  flex-direction: column;
  strong { color: #e6ca91; font-size: 0.74rem; }
  small { color: #808080; font-size: 0.6rem; text-transform: uppercase; }
}
.order-pos {
  color: #cfb47a;
  font-size: 0.6rem;
}
.hp-strip {
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba($gold, 0.25);
  margin-top: 4px;
}
.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #b33f3f, #ff6f6f);
}
.hp-text { color: #9f9f9f; font-size: 0.62rem; }
.guarding {
  color: #8ab9ff;
  font-size: 0.58rem;
  letter-spacing: 0.8px;
}
.enemy-card {
  border: 1px solid rgba($crimson, 0.45);
  background: rgba(23, 5, 5, 0.78);
  padding: 11px;
  display: grid;
  gap: 5px;
  strong { color: #ef9f9f; }
  small { color: #d89a9a; }
}
.enemy-icon { font-size: 1.5rem; }
.enemy-strip { border-color: rgba($crimson, 0.35); }
.enemy-fill { background: linear-gradient(90deg, #761616, #df4747); }
.enemy-state {
  color: #f3bf7c;
  font-size: 0.58rem;
}
.combat-controls {
  margin-top: 12px;
  border: 1px solid rgba($gold, 0.2);
  background: rgba(0, 0, 0, 0.3);
  padding: 10px;
  display: grid;
  gap: 10px;
}
.actor-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  strong { color: #e8c98e; font-size: 0.78rem; }
  small { color: #b79b66; font-size: 0.62rem; }
}
.main-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(130px, 1fr));
  gap: 8px;
}
.combat-btn {
  border: 1px solid rgba($gold, 0.45);
  background: rgba($gold, 0.08);
  color: #e0c082;
  font-size: 0.64rem;
  letter-spacing: 0.8px;
  padding: 8px;
  cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
  &:not(:disabled):hover { background: rgba($gold, 0.18); }
  &.minor { font-size: 0.6rem; padding: 6px; }
}
.skill-block, .item-block {
  border: 1px solid rgba($gold, 0.16);
  background: rgba(0, 0, 0, 0.26);
  padding: 8px;
  h4 {
    margin: 0 0 6px;
    color: #e0be7a;
    font-size: 0.67rem;
    letter-spacing: 1px;
  }
}
.skill-card, .item-card {
  border: 1px solid rgba($gold, 0.12);
  background: rgba(12, 12, 12, 0.72);
  padding: 7px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  margin-bottom: 6px;
  strong { color: #e5c98f; font-size: 0.65rem; }
  small { color: #9a9a9a; font-size: 0.58rem; line-height: 1.35; }
}
.skill-meta { color: #b99b65 !important; }
.item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  select {
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba($gold, 0.25);
    color: #ddb978;
    font-size: 0.6rem;
    padding: 3px 5px;
  }
}
.empty-note {
  color: #757575;
  font-size: 0.6rem;
  margin: 0;
}
.dice-readout {
  margin-top: 8px;
  color: #f2d29a;
  font-size: 0.68rem;
  letter-spacing: 0.5px;
}
.combat-feed {
  margin: 10px 0 0;
  padding: 8px 10px;
  border: 1px solid rgba($gold, 0.18);
  background: rgba(0, 0, 0, 0.32);
  max-height: 135px;
  overflow-y: auto;
  list-style: none;
  li {
    font-size: 0.66rem;
    color: #bdbdbd;
    margin-bottom: 5px;
    line-height: 1.4;
  }
}
@media (max-width: 900px) {
  .battle-lane { grid-template-columns: 1fr; }
  .main-actions { grid-template-columns: 1fr; }
  .skill-card, .item-card { grid-template-columns: 1fr; }
}
</style>
