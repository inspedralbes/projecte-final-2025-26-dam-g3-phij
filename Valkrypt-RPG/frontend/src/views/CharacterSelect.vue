<template>
  <div class="selector-wrapper">
    <div class="ambient-fx">
      <div class="fog"></div>
      <div class="vignette"></div>
    </div>
    
    <div class="selector-header">
      <button class="btn-back" @click="router.push('/userpage')">← ABANDONAR</button>
      
      <div class="step-indicator">
        <span class="active">RECLUTAMIENTO: {{ (campaignData?.title || 'SIN CAMPAÑA').toUpperCase() }}</span>
      </div>
    </div>

    <div class="fade-in">
      <header class="step-title">
        <h1>FORJA TU VANGUARDIA</h1>
        <p>Selecciona a los héroes que se adentrarán en <strong>{{ campaignData?.location || 'el reino' }}</strong>.</p>
      </header>

      <div class="builder-grid">
        <div class="roster">
          <p v-if="isLoadingCampaign" class="campaign-status">Cargando héroes desde la base de datos...</p>
          <p v-else-if="campaignError" class="campaign-status error">{{ campaignError }}</p>
          <template v-else>
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
          </template>
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
          
          <button class="btn-start-adventure" :disabled="party.length === 0 || !campaignData || isLoadingCampaign" @click="start">
            COMENZAR AVENTURA
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const party = ref([]);
const campaignData = ref(null);
const isLoadingCampaign = ref(false);
const campaignError = ref('');

const campaignId = computed(() => String(route.query.campaign || '').trim());
const availableCharacters = computed(() => campaignData.value?.heroes || []);

const normalizeHero = (hero) => {
  const maxHpValue = Number(hero?.maxHp ?? hero?.hp);
  const maxHp = Number.isFinite(maxHpValue) && maxHpValue > 0 ? maxHpValue : 1;
  const hpValue = Number(hero?.hp ?? maxHp);
  const hp = Number.isFinite(hpValue) ? Math.max(0, Math.min(hpValue, maxHp)) : maxHp;

  return {
    id: String(hero?.id || ''),
    name: hero?.name || 'Héroe',
    role: hero?.role || 'Aventurero',
    weapon: hero?.weapon || '',
    icon: hero?.icon || '⚔️',
    hp,
    maxHp
  };
};

const loadCampaign = async () => {
  if (!campaignId.value) {
    campaignError.value = 'Campaña no especificada.';
    campaignData.value = null;
    return;
  }

  isLoadingCampaign.value = true;
  campaignError.value = '';
  try {
    const response = await fetch(`/api/game/campaigns/${encodeURIComponent(campaignId.value)}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();
    campaignData.value = {
      ...data,
      heroes: Array.isArray(data?.heroes) ? data.heroes.map(normalizeHero) : []
    };
    party.value = [];
  } catch (err) {
    console.error('No se pudo cargar la campaña:', err);
    campaignError.value = 'No se pudo cargar esta campaña desde la base de datos.';
    campaignData.value = null;
    party.value = [];
  } finally {
    isLoadingCampaign.value = false;
  }
};

watch(campaignId, loadCampaign, { immediate: true });

const isInParty = (id) => party.value.some(c => c.id === id);

const toggleChar = (char) => {
  const idx = party.value.findIndex(c => c.id === char.id);
  if (idx > -1) {
    party.value.splice(idx, 1);
  } else if (party.value.length < 4) {
    party.value.push(char);
  }
};

const start = async () => {
  const userStore = JSON.parse(localStorage.getItem('user'));
  const userId = userStore?.id || userStore?._id;
  if (!campaignData.value) {
    alert("No se ha cargado una campaña válida.");
    return;
  }

  if (!userId) {
    alert("Sesión no encontrada. Por favor, inicia sesión de nuevo.");
    return;
  }

  const sessionData = {
    userId: userId,
    campaignId: campaignData.value.id || campaignId.value,
    campaignTitle: campaignData.value.title,
    location: campaignData.value.location,
    currentBackground: campaignData.value.img || '',
    party: party.value,
    turn: 1
  };

  try {
    const response = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        action: { 
          type: 'init', 
          label: 'Inicio de Aventura', 
          data: sessionData 
        }
      })
    });

    if (response.ok) {
      localStorage.setItem('valkrypt_current_game', JSON.stringify(sessionData));
      router.push('/game');
    } else {
      console.error("Error al guardar partida inicial");
    }
  } catch (err) {
    console.error("Fallo de red al conectar con el servidor:", err);
  }
};
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

$gold: #c5a059;
$dark-card: rgba(10, 10, 10, 0.9);

.selector-wrapper {
  background: #050505;
  color: #eee;
  padding: 40px;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
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
  position: relative;
  z-index: 10;
}

.btn-back {
  background: transparent;
  border: none;
  color: #666;
  font-family: 'Cinzel', serif;
  cursor: pointer;
  transition: 0.3s;
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
  position: relative;
  z-index: 10;
  h1 { font-family: 'Cinzel', serif; color: $gold; letter-spacing: 2px; margin-bottom: 10px; }
  p { color: #888; font-style: italic; }
}

.campaign-status {
  color: #777;
  text-align: center;
  padding: 20px;
}

.campaign-status.error { color: #ff7070; }

.builder-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 30px;
  max-width: 1100px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
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

  &:hover { border-color: rgba($gold, 0.5); transform: translateX(5px); }

  &.is-selected {
    border-color: $gold;
    background: rgba($gold, 0.1);
    .select-indicator { background: $gold; box-shadow: 0 0 10px $gold; }
  }

  .char-avatar-box {
    font-size: 2rem;
    margin-right: 20px;
    background: rgba(255,255,255,0.05);
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .info {
    .char-name { font-family: 'Cinzel', serif; font-size: 1.2rem; color: #fff; display: block; }
    .char-role { color: $gold; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
    .char-weapon { color: #555; font-size: 0.75rem; margin-top: 2px; }
  }

  .select-indicator {
    margin-left: auto;
    width: 12px;
    height: 12px;
    border: 1px solid #444;
    border-radius: 50%;
    transition: 0.3s;
  }
}

.summary-panel {
  background: #000;
  border: 1px solid #222;
  padding: 30px;
  text-align: center;
  border-radius: 4px;
  height: fit-content;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  h3 { font-family: 'Cinzel', serif; color: $gold; margin-bottom: 20px; font-size: 0.9rem; letter-spacing: 1px; }
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
    transition: 0.3s;
    &.filled { border: 1px solid $gold; color: $gold; background: rgba($gold, 0.05); }
  }
} 

.party-info { color: #666; font-size: 0.8rem; margin-bottom: 20px; }

.btn-start-adventure {
  width: 100%;
  background: $gold;
  color: #000;
  border: none;
  padding: 15px;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  cursor: pointer;
  transition: 0.3s;
  text-transform: uppercase;
  letter-spacing: 1px;
  &:disabled { background: #222; color: #444; cursor: not-allowed; }
  &:hover:not(:disabled) { background: lighten($gold, 15%); box-shadow: 0 0 15px rgba($gold, 0.4); }
}

.fade-in { animation: fadeIn 0.4s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fogMove { from { background-position: 0 0; } to { background-position: 1000px 0; } }
</style>
