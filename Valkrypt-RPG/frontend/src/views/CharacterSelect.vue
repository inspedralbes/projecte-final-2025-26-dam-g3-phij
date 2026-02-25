<template>
  <div class="selector-wrapper">
    <div class="selector-header">
      <button class="btn-back" @click="$emit('cancel')">← CANCELAR</button>
      <h2>{{ step === 1 ? 'SELECCIONA CRÓNICA' : 'FORJA TU VANGUARDIA' }}</h2>
    </div>

    <div v-if="step === 1" class="fade-in">
      <div class="campaign-list">
        <div 
          v-for="camp in campaigns" :key="camp.id"
          class="camp-item" :class="{ active: selectedCamp?.id === camp.id }"
          @click="selectedCamp = camp"
        >
          <div class="camp-thumb" :style="{ backgroundImage: `url(${camp.img})` }"></div>
          <div class="camp-text">
            <h3>{{ camp.title }}</h3>
            <p>{{ camp.desc }}</p>
          </div>
        </div>
      </div>
      <button class="btn-next" :disabled="!selectedCamp" @click="step = 2">
        CONTINUAR AL RECLUTAMIENTO
      </button>
    </div>

    <div v-else class="fade-in">
      <div class="builder-grid">
        <div class="roster">
          <div 
            v-for="char in availableCharacters" :key="char.id"
            class="char-card" :class="{ 'is-selected': isInParty(char.id) }"
            @click="toggleChar(char)"
          >
            <span class="icon">{{ char.icon }}</span>
            <div class="info">
              <strong>{{ char.name }}</strong>
              <small>{{ char.role }}</small>
            </div>
          </div>
        </div>

        <div class="summary-panel">
          <div class="party-dots">
            <div v-for="n in 4" :key="n" class="dot" :class="{ filled: party[n-1] }">
              {{ party[n-1]?.icon || '' }}
            </div>
          </div>
          <button class="btn-start" :disabled="party.length === 0" @click="start">
            COMENZAR AVENTURA
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

defineEmits(['cancel']);
const router = useRouter();
const step = ref(1);
const selectedCamp = ref(null);
const party = ref([]);

const campaigns = [
  { id: 'minas', title: 'Minas de Grimhold', desc: 'Oscuridad en las profundidades.', img: 'https://images.unsplash.com/photo-1520637836862-4d197d17c90a?q=80&w=400' },
  { id: 'castillo', title: 'Castillo Sombrío', desc: 'La sede del Rey Exánime.', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400' }
];

const availableCharacters = [
  { id: 'borin', name: 'Borin', role: 'Tank', icon: '🛡️' },
  { id: 'elara', name: 'Elara', role: 'DPS', icon: '🗡️' },
  { id: 'sorin', name: 'Sorin', role: 'Healer', icon: '🩸' },
  { id: 'marius', name: 'Marius', role: 'DPS', icon: '🔥' }
];

const isInParty = (id) => party.value.some(c => c.id === id);
const toggleChar = (char) => {
  const idx = party.value.findIndex(c => c.id === char.id);
  if (idx > -1) party.value.splice(idx, 1);
  else if (party.value.length < 4) party.value.push(char);
};

const start = () => {
  localStorage.setItem('valkrypt_session', JSON.stringify({ camp: selectedCamp.value, party: party.value }));
  router.push('/game');
};
</script>

<style scoped>
.selector-wrapper { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 30px; border-radius: 8px; }
.selector-header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; border-bottom: 1px solid #222; padding-bottom: 15px; }
.btn-back { background: transparent; border: 1px solid #444; color: #888; padding: 6px 12px; cursor: pointer; font-size: 0.8rem; }
.btn-back:hover { border-color: #d4af37; color: #d4af37; }
.campaign-list { display: grid; gap: 15px; margin-bottom: 25px; }
.camp-item { display: flex; gap: 15px; background: #111; border: 1px solid #222; cursor: pointer; transition: 0.3s; }
.camp-item.active { border-color: #d4af37; background: #1a1608; }
.camp-thumb { width: 100px; background-size: cover; background-position: center; }
.camp-text { padding: 15px; }
.camp-text h3 { margin: 0; color: #d4af37; font-size: 1rem; }
.camp-text p { margin: 5px 0 0; font-size: 0.85rem; color: #888; }
.builder-grid { display: grid; grid-template-columns: 1fr 250px; gap: 20px; }
.char-card { display: flex; align-items: center; gap: 15px; padding: 12px; background: #111; border: 1px solid #222; margin-bottom: 8px; cursor: pointer; }
.char-card.is-selected { border-color: #d4af37; background: #1a1608; }
.icon { font-size: 1.5rem; }
.info strong { display: block; font-size: 0.9rem; }
.info small { color: #666; font-size: 0.75rem; }
.summary-panel { background: #000; border: 1px solid #222; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.party-dots { display: flex; gap: 10px; margin-bottom: 20px; }
.dot { width: 45px; height: 45px; border: 1px dashed #333; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.dot.filled { border: 1px solid #d4af37; background: #1a1608; }

.btn-next, .btn-start { width: 100%; background: #d4af37; color: #000; border: none; padding: 12px; font-weight: bold; cursor: pointer; }
.btn-next:disabled, .btn-start:disabled { background: #222; color: #555; cursor: not-allowed; }

.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>