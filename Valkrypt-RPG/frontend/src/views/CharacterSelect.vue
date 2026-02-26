<template>
  <div class="selector-wrapper">
    <div class="ambient-fx">
      <div class="fog"></div>
      <div class="vignette"></div>
    </div>
    
    <div class="selector-header">
      <button class="btn-back" @click="router.push('/UserPage')">← ABANDONAR</button>
      
      <div class="step-indicator">
        <span class="active">RECLUTAMIENTO: {{ campaignData?.title.toUpperCase() }}</span>
      </div>
    </div>

    <div class="fade-in">
      <header class="step-title">
        <h1>FORJA TU VANGUARDIA</h1>
        <p>Selecciona a los héroes que se adentrarán en <strong>{{ campaignData?.location }}</strong>.</p>
      </header>

      <div class="builder-grid">
        <div class="roster">
          <div 
            v-for="char in availableCharacters" :key="char.id"
            class="char-card" :class="{ 'is-selected': isInParty(char.id) }"
            @click="toggleChar(char)"
          >
            <div class="char-avatar-box">
               <span class="char-icon">{{ char.icon }}</span>
            </div>
            <div class="info">
              <strong class="char-name">{{ char.name }}</strong>
              <small class="char-role">{{ char.role }}</small>
              <p class="char-weapon">{{ char.weapon }}</p>
            </div>
            <div class="select-indicator"></div>
          </div>
        </div>

        <div class="summary-panel">
          <h3>HÉROES ELEGIDOS</h3>
          <div class="party-slots">
            <div v-for="n in 4" :key="n" class="slot" :class="{ filled: party[n-1] }">
              <span v-if="party[n-1]">{{ party[n-1].icon }}</span>
              <small v-else>?</small>
            </div>
          </div>
          <p class="party-info" v-if="party.length > 0">{{ party.length }} / 4 Héroes</p>
          
          <button class="btn-start-adventure" :disabled="party.length === 0" @click="start">
            COMENZAR AVENTURA
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const party = ref([]);

const allCampaigns = {
  'piedraprofunda': {
    title: 'La Sombra de Piedraprofunda',
    location: 'Bastión Real',
    heroes: [
      { id: 'kaelen', name: 'Kaelen', role: 'Guerrero', weapon: 'Rompehuesos', icon: '⚔️' },
      { id: 'vax', name: 'Vax', role: 'Pícaro', weapon: 'Dagas Gemelas', icon: '🗡️' },
      { id: 'elara', name: 'Elara', role: 'Maga de Sangre', weapon: 'Vínculo Real', icon: '🩸' },
      { id: 'sorin', name: 'Sorin', role: 'Clérigo Caído', weapon: 'Maza Quebrada', icon: '⚖️' }
    ]
  },
  'minas': {
    title: 'El Invierno de las Minas',
    location: 'Minas del Norte',
    heroes: [
      { id: 'kaelen', name: 'Kaelen', role: 'Guerrero', weapon: 'Rompehuesos', icon: '⚔️' },
      { id: 'vax', name: 'Vax', role: 'Pícaro', weapon: 'Dagas Gemelas', icon: '🗡️' },
      { id: 'elara', name: 'Elara', role: 'Maga de Sangre', weapon: 'Vínculo Real', icon: '🩸' },
      { id: 'sorin', name: 'Sorin', role: 'Clérigo Caído', weapon: 'Maza Quebrada', icon: '⚖️' }
    ]
  }
};

const campaignId = computed(() => route.query.campaign || 'piedraprofunda');
const campaignData = computed(() => allCampaigns[campaignId.value]);
const availableCharacters = computed(() => campaignData.value?.heroes || []);

const isInParty = (id) => party.value.some(c => c.id === id);

const toggleChar = (char) => {
  const idx = party.value.findIndex(c => c.id === char.id);
  if (idx > -1) {
    party.value.splice(idx, 1);
  } else if (party.value.length < 4) {
    party.value.push(char);
  }
};

const start = () => {
  const sessionData = {
    campaignId: campaignId.value,
    campaignTitle: campaignData.value.title,
    location: campaignData.value.location,
    party: party.value,
    turn: 1,
    timestamp: new Date().toISOString()
  };
  

  localStorage.setItem('valkrypt_current_game', JSON.stringify(sessionData));

  router.push('/game');
};
</script>

<style scoped lang="scss">
@use "sass:color";
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

$gold: #c5a059;
$dark-card: rgba(10, 10, 10, 0.9);

.selector-wrapper {
  background: #050505;
  color: #eee;
  padding: 40px;
  min-height: 100vh;
  position: relative;
}

.ambient-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  .fog {
    position: absolute;
    inset: 0;
    background: url('https://raw.githubusercontent.com/danielstuart14/CSS_FOG_ANIMATION/master/img/fog1.png') repeat-x;
    opacity: 0.1;
    animation: fogMove 60s linear infinite;
  }
  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.9) 100%);
  }
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  border-bottom: 1px solid rgba($gold, 0.2);
  padding-bottom: 20px;
}

.btn-back {
  background: transparent;
  border: none;
  color: #666;
  font-family: 'Cinzel', serif;
  cursor: pointer;
  &:hover { color: $gold; }
}

.step-indicator {
  font-family: 'Cinzel', serif;
  color: $gold;
  letter-spacing: 1px;
}

.step-title {
  text-align: center;
  margin-bottom: 40px;
  h1 { font-family: 'Cinzel', serif; color: $gold; letter-spacing: 2px; }
  p { color: #888; font-style: italic; }
}

.builder-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 30px;
  max-width: 1100px;
  margin: 0 auto;
}

.char-card {
  display: flex;
  align-items: center;
  padding: 15px 25px;
  background: $dark-card;
  border: 1px solid #222;
  margin-bottom: 15px;
  cursor: pointer;
  transition: 0.3s;
  border-radius: 4px;

  &.is-selected {
    border-color: $gold;
    background: rgba($gold, 0.1);
    .select-indicator { background: $gold; box-shadow: 0 0 10px $gold; }
  }

  .char-avatar-box {
    font-size: 2rem;
    margin-right: 20px;
  }

  .info {
    .char-name { font-family: 'Cinzel', serif; font-size: 1.2rem; color: #fff; display: block; }
    .char-role { color: $gold; font-size: 0.8rem; text-transform: uppercase; }
  }

  .select-indicator {
    margin-left: auto;
    width: 12px;
    height: 12px;
    border: 1px solid #444;
    border-radius: 50%;
  }
}

.summary-panel {
  background: #000;
  border: 1px solid #222;
  padding: 30px;
  text-align: center;
  border-radius: 4px;
  height: fit-content;
  h3 { font-family: 'Cinzel', serif; color: $gold; margin-bottom: 20px; font-size: 0.9rem; }
}

.party-slots {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  .slot {
    width: 50px;
    height: 50px;
    border: 1px dashed #333;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    &.filled { border: 1px solid $gold; color: $gold; }
  }
} 

.btn-start-adventure {
  width: 100%;
  background: $gold;
  color: #000;
  border: none;
  padding: 15px;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  cursor: pointer;
  &:disabled { background: #222; color: #444; cursor: not-allowed; }
  &:hover:not(:disabled) { background: color.adjust($gold, $lightness: 15%); }
}

.fade-in { animation: fadeIn 0.4s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fogMove { from { background-position: 0 0; } to { background-position: 1000px 0; } }
</style>