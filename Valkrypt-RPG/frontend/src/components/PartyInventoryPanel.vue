<template>
  <aside class="party-inventory-panel">
    <header class="panel-header">
      <h3>INVENTARIO DE ESCUADRA</h3>
      <small>{{ combatActive ? 'COMBATE ACTIVO' : 'EXPLORACIÓN' }}</small>
    </header>

    <div class="hero-tabs" v-if="heroes.length > 0">
      <button
        v-for="hero in heroes"
        :key="hero.id"
        class="hero-tab"
        :class="{ active: hero.id === selectedHeroId }"
        @click="selectHero(hero.id)"
      >
        <span>{{ hero.icon }}</span>
        <strong>{{ hero.name }}</strong>
      </button>
    </div>

    <div v-if="activeHero" class="panel-body">
      <section class="hero-overview">
        <div class="hero-id">
          <strong>{{ activeHero.name }}</strong>
          <small>{{ activeHero.role }}</small>
        </div>
        <div class="hero-hp">
          <div class="hp-strip">
            <div class="hp-fill" :style="{ width: `${Math.max(0, (activeHero.hp / activeHero.maxHp) * 100)}%` }"></div>
          </div>
          <small>HP {{ activeHero.hp }} / {{ activeHero.maxHp }}</small>
        </div>
      </section>

      <section class="slot-section">
        <h4>Equipado</h4>
        <div class="slot-row">
          <span>Arma</span>
          <button class="slot-btn" @click="unequip('weapon')">
            {{ activeHero.equipment?.weapon?.name || 'Vacío' }}
          </button>
        </div>
        <div class="slot-row">
          <span>Armadura</span>
          <button class="slot-btn" @click="unequip('armor')">
            {{ activeHero.equipment?.armor?.name || 'Vacío' }}
          </button>
        </div>
        <div class="slot-row">
          <span>Reliquia</span>
          <button class="slot-btn" @click="unequip('trinket')">
            {{ activeHero.equipment?.trinket?.name || 'Vacío' }}
          </button>
        </div>
      </section>

      <section class="consumables-section">
        <div class="section-head">
          <h4>Consumibles</h4>
          <select v-model="targetHeroId">
            <option v-for="hero in heroes" :key="`target_${hero.id}`" :value="hero.id">{{ hero.name }}</option>
          </select>
        </div>
        <div class="item-list">
          <article v-for="item in consumables" :key="item.id" class="item-card">
            <div>
              <strong>{{ item.name }}</strong>
              <small>x{{ item.quantity }} · {{ item.description }}</small>
            </div>
            <button class="item-btn" @click="useConsumable(item.id)">USAR</button>
          </article>
          <p v-if="consumables.length === 0" class="empty-note">No hay consumibles disponibles.</p>
        </div>
      </section>

      <section class="equipment-section">
        <h4>Mochila de Equipo</h4>
        <div class="item-list">
          <article v-for="item in equippables" :key="item.id" class="item-card">
            <div>
              <strong>{{ item.name }}</strong>
              <small>x{{ item.quantity }} · {{ item.description }}</small>
            </div>
            <button class="item-btn" @click="equipItem(item.id)">EQUIPAR</button>
          </article>
          <p v-if="equippables.length === 0" class="empty-note">No hay equipo en la mochila.</p>
        </div>
      </section>

      <section class="skills-section">
        <h4>Habilidades</h4>
        <div class="skill-list">
          <article v-for="skill in activeHero.skills || []" :key="skill.id" class="skill-card">
            <strong>{{ skill.name }}</strong>
            <small>{{ skill.description }}</small>
            <small class="skill-meta">{{ skill.type.toUpperCase() }} · {{ skill.dice }} · Poder {{ skill.power }}</small>
          </article>
          <p v-if="!activeHero.skills || activeHero.skills.length === 0" class="empty-note">Sin habilidades cargadas.</p>
        </div>
      </section>
    </div>

    <p v-else class="empty-note">No hay personajes para gestionar inventario.</p>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  heroConsumables,
  heroEquippables,
  useHeroConsumable,
  equipItemOnHero,
  unequipHeroSlot
} from '../utils/partySystem';

const props = defineProps({
  party: {
    type: Array,
    default: () => []
  },
  combatActive: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update-party', 'log']);

const selectedHeroId = ref('');
const targetHeroId = ref('');

const heroes = computed(() => (Array.isArray(props.party) ? props.party : []));
const activeHero = computed(() => heroes.value.find((hero) => hero.id === selectedHeroId.value) || null);
const consumables = computed(() => heroConsumables(activeHero.value));
const equippables = computed(() => heroEquippables(activeHero.value));

function selectHero(heroId) {
  selectedHeroId.value = heroId;
  targetHeroId.value = heroId;
}

function emitResult(result) {
  if (result?.error) {
    emit('log', result.error);
    return;
  }
  if (Array.isArray(result?.party)) emit('update-party', result.party);
  if (result?.message) emit('log', result.message);
}

function useConsumable(itemId) {
  if (!activeHero.value || !targetHeroId.value) return;
  const result = useHeroConsumable(props.party, activeHero.value.id, itemId, targetHeroId.value);
  emitResult(result);
}

function equipItem(itemId) {
  if (!activeHero.value) return;
  const result = equipItemOnHero(props.party, activeHero.value.id, itemId);
  emitResult(result);
}

function unequip(slot) {
  if (!activeHero.value) return;
  const result = unequipHeroSlot(props.party, activeHero.value.id, slot);
  emitResult(result);
}

watch(
  heroes,
  (value) => {
    if (!Array.isArray(value) || value.length === 0) {
      selectedHeroId.value = '';
      targetHeroId.value = '';
      return;
    }
    const stillExists = value.some((hero) => hero.id === selectedHeroId.value);
    if (!stillExists) {
      selectedHeroId.value = value[0].id;
    }
    const targetExists = value.some((hero) => hero.id === targetHeroId.value);
    if (!targetExists) {
      targetHeroId.value = selectedHeroId.value || value[0].id;
    }
  },
  { immediate: true, deep: true }
);
</script>

<style scoped lang="scss">
$gold: #c5a059;

.party-inventory-panel {
  border-left: 1px solid rgba($gold, 0.3);
  background: rgba(4, 4, 4, 0.84);
  backdrop-filter: blur(8px);
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
}
.panel-header {
  margin-bottom: 10px;
  h3 {
    margin: 0;
    color: $gold;
    font-size: 0.78rem;
    letter-spacing: 1.5px;
  }
  small {
    color: #8d8d8d;
    font-size: 0.62rem;
    letter-spacing: 1px;
  }
}
.hero-tabs {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
.hero-tab {
  border: 1px solid rgba($gold, 0.22);
  background: rgba(15, 15, 15, 0.75);
  color: #d7bd87;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  &.active {
    border-color: rgba($gold, 0.8);
    box-shadow: 0 0 12px rgba($gold, 0.18);
  }
  strong { font-size: 0.68rem; }
}
.panel-body {
  display: grid;
  gap: 12px;
}
.hero-overview {
  border: 1px solid rgba($gold, 0.25);
  background: rgba(10, 10, 10, 0.65);
  padding: 8px;
}
.hero-id {
  display: flex;
  flex-direction: column;
  strong { color: #e8cb91; font-size: 0.74rem; }
  small { color: #808080; font-size: 0.62rem; text-transform: uppercase; }
}
.hp-strip {
  margin-top: 6px;
  height: 6px;
  border: 1px solid rgba($gold, 0.25);
  background: rgba(0, 0, 0, 0.7);
}
.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #a72f2f, #ec5b5b);
}
.hero-hp small {
  color: #a8a8a8;
  font-size: 0.62rem;
}
.slot-section, .consumables-section, .equipment-section, .skills-section {
  border: 1px solid rgba($gold, 0.2);
  background: rgba(8, 8, 8, 0.6);
  padding: 8px;
}
h4 {
  margin: 0 0 6px;
  color: #e4be79;
  font-size: 0.7rem;
  letter-spacing: 1px;
}
.slot-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  span { color: #8c8c8c; font-size: 0.62rem; text-transform: uppercase; }
}
.slot-btn {
  border: 1px solid rgba($gold, 0.3);
  background: rgba($gold, 0.07);
  color: #d9b772;
  font-size: 0.62rem;
  padding: 6px;
  text-align: left;
  cursor: pointer;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  select {
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba($gold, 0.28);
    color: #d6b677;
    font-size: 0.62rem;
    padding: 4px 6px;
  }
}
.item-list {
  display: grid;
  gap: 6px;
}
.item-card {
  border: 1px solid rgba($gold, 0.14);
  background: rgba(0, 0, 0, 0.35);
  padding: 6px;
  display: grid;
  gap: 6px;
  strong { color: #e6ca93; font-size: 0.67rem; }
  small { color: #929292; font-size: 0.6rem; line-height: 1.35; }
}
.item-btn {
  border: 1px solid rgba($gold, 0.45);
  background: rgba($gold, 0.08);
  color: #ddb770;
  font-size: 0.6rem;
  padding: 5px 6px;
  cursor: pointer;
  justify-self: end;
}
.skill-list {
  display: grid;
  gap: 6px;
}
.skill-card {
  border: 1px solid rgba($gold, 0.14);
  background: rgba(0, 0, 0, 0.35);
  padding: 6px;
  display: grid;
  gap: 2px;
  strong { color: #e5c78c; font-size: 0.66rem; }
  small { color: #949494; font-size: 0.6rem; line-height: 1.35; }
  .skill-meta { color: #ac8f5a; }
}
.empty-note {
  color: #707070;
  font-size: 0.62rem;
  line-height: 1.4;
}
</style>
