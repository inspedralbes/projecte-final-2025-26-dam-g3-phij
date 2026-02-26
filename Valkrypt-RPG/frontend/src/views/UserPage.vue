<template>
  <div class="user-page">
    <div class="ambient-overlay">
      <div class="fog"></div>
      <div class="vignette"></div>
    </div>

    <nav class="nav-shell">
      <div class="nav-container">
        <div class="brand">
          <i class="ra ra-sword-brandish"></i>
          <span>VALKRYPT</span>
        </div>

        <div class="nav-center">
          <router-link to="/friends" class="nav-link">ALIANZAS</router-link>
          <router-link to="/codice" class="nav-link">CÓDICE</router-link>
        </div>

        <div class="nav-right">
          <router-link to="/profile" class="profile-pill">
            <div class="avatar">{{ userInitial }}</div>
            <span class="p-label">{{ usernameLabel }}</span>
          </router-link>
          <button @click="handleLogout" class="btn-exit">
            <i class="fas fa-power-off"></i>
          </button>
        </div>
      </div>
    </nav>

    <main class="dashboard">
      <header class="page-head">
        <p class="kicker">CRÓNICAS DEL REINO</p>
        <h1>MIS AVENTURAS</h1>
      </header>

      <section class="adventures-grid">
        <div class="adv-card create" @click="isSelectingCampaign = true">
          <div class="card-inner">
            <span class="icon">+</span>
            <h3>INICIAR NUEVA LEYENDA</h3>
            <p>La IA tejerá un nuevo camino hacia el Abismo.</p>
          </div>
        </div>

        <div v-if="savesLoading" class="adv-card saved-state">
          <div class="card-body">
            <h3>CARGANDO PARTIDAS</h3>
            <p class="last-event">Leyendo tus crónicas desde la base de datos...</p>
          </div>
        </div>

        <div v-else-if="savesError" class="adv-card saved-state error">
          <div class="card-body">
            <h3>NO SE PUDIERON CARGAR</h3>
            <p class="last-event">{{ savesError }}</p>
          </div>
        </div>

        <div v-else-if="savedGames.length === 0" class="adv-card saved-state">
          <div class="card-body">
            <h3>SIN PARTIDAS GUARDADAS</h3>
            <p class="last-event">Empieza una nueva campaña para crear tu primera crónica.</p>
          </div>
        </div>

        <div v-for="save in savedGames" :key="save.id" class="adv-card saved">
          <div class="card-img" :style="{ backgroundImage: `url(${save.img})` }">
            <div class="status-tag">{{ save.location }}</div>
          </div>
          <div class="card-body">
            <h3>{{ save.title }}</h3>
            <p class="last-event">{{ save.lastEvent }}</p>
            <div class="card-meta">
              <span>{{ save.date }}</span>
              <button class="btn-play" @click="resumeGame(save.id)">CONTINUAR</button>
            </div>
          </div>
        </div>
      </section>

      <transition name="fade">
        <div v-if="isSelectingCampaign" class="campaign-selector-overlay">
          <div class="selector-content">
            <header class="selector-header">
              <h2>ELIGE TU HISTORIA</h2>
              <button class="btn-close" @click="isSelectingCampaign = false">✕</button>
            </header>
            
            <div class="campaign-options">
              <p v-if="campaignsLoading" class="campaign-state">Cargando campañas...</p>
              <p v-else-if="campaignsError" class="campaign-state campaign-error">{{ campaignsError }}</p>
              <p v-else-if="availableCampaigns.length === 0" class="campaign-state">No hay campañas disponibles.</p>
              <div v-for="camp in availableCampaigns" :key="camp.id" class="camp-option-card">
                <div class="camp-image" :style="{ backgroundImage: `url(${camp.img})` }"></div>
                <div class="camp-info">
                  <h3>{{ camp.title }}</h3>
                  <p>{{ camp.desc }}</p>
                  <div class="camp-actions">
                    <button class="btn-camp-new" @click="startNewGame(camp.id)">EMPEZAR</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userInitial = ref('?');
const usernameLabel = ref('PERFIL');
const isSelectingCampaign = ref(false);
const campaignsLoading = ref(false);
const campaignsError = ref('');
const savesLoading = ref(false);
const savesError = ref('');
const savedGames = ref([]);
const SAVE_FALLBACK_IMG = 'https://images.unsplash.com/photo-1519074063912-ad25b5ce4924?q=80&w=500';

const availableCampaigns = ref([]);

const loadCampaigns = async () => {
  campaignsLoading.value = true;
  campaignsError.value = '';
  try {
    const response = await fetch('/api/game/campaigns');
    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }
    const campaigns = await response.json();
    availableCampaigns.value = Array.isArray(campaigns) ? campaigns : [];
  } catch (err) {
    console.error('No se pudo cargar el catálogo de campañas:', err);
    campaignsError.value = 'No se pudieron cargar campañas desde la base de datos.';
    availableCampaigns.value = [];
  } finally {
    campaignsLoading.value = false;
  }
};

const formatSaveDate = (rawDate) => {
  if (!rawDate) return 'SIN FECHA';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return 'SIN FECHA';
  return date
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
};

const loadSavedGames = async (userId) => {
  savesLoading.value = true;
  savesError.value = '';
  try {
    const response = await fetch(`/api/game/saves/${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const saves = await response.json();
    savedGames.value = Array.isArray(saves)
      ? saves.map((save) => ({
          id: save.id || `${save.campaignId || 'save'}-${save.updatedAt || Date.now()}`,
          title: String(save.title || 'PARTIDA').toUpperCase(),
          location: String(save.location || 'DESCONOCIDO').toUpperCase(),
          lastEvent: save.lastEvent || 'Sin eventos recientes.',
          date: formatSaveDate(save.updatedAt),
          img: save.img || SAVE_FALLBACK_IMG
        }))
      : [];
  } catch (err) {
    console.error('No se pudieron cargar las partidas guardadas:', err);
    savesError.value = 'No se pudieron leer tus partidas guardadas.';
    savedGames.value = [];
  } finally {
    savesLoading.value = false;
  }
};

onMounted(async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.username) {
    const userId = user.id || user._id;
    userInitial.value = user.username.charAt(0).toUpperCase();
    usernameLabel.value = user.username.toUpperCase();
    if (!userId) {
      router.push('/login');
      return;
    }
    await Promise.all([loadCampaigns(), loadSavedGames(userId)]);
  } else {
    router.push('/login');
  }
});

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

const startNewGame = (campId) => {
  router.push({ path: '/select', query: { campaign: campId } });
};

const resumeGame = (id) => {
  router.push('/game');
};
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

$gold: #c5a059;
$dark-bg: #050505;
$card-bg: rgba(20, 20, 20, 0.9);

.user-page {
  min-height: 100vh;
  background: $dark-bg;
  color: #eee;
  position: relative;
  overflow-x: hidden;
  font-family: 'Cinzel', serif;
}

.ambient-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
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

.nav-shell {
  position: relative;
  z-index: 10;
  background: rgba(0,0,0,0.9);
  border-bottom: 1px solid rgba($gold, 0.3);
  .nav-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    height: 70px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: $gold;
  letter-spacing: 3px;
}

.nav-link {
  color: #888;
  text-decoration: none;
  margin: 0 1.5rem;
  font-size: 0.85rem;
  transition: 0.3s;
  &:hover { color: $gold; text-shadow: 0 0 8px rgba($gold, 0.4); }
}

.profile-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  background: rgba(255,255,255,0.03);
  padding: 6px 18px;
  border-radius: 20px;
  border: 1px solid rgba($gold, 0.2);
  transition: 0.3s;
  .avatar {
    width: 26px;
    height: 26px;
    background: $gold;
    color: black;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.8rem;
  }
  .p-label { color: #fff; font-size: 0.75rem; font-weight: bold; letter-spacing: 1px; }
  &:hover { border-color: $gold; background: rgba($gold, 0.05); }
}

.btn-exit {
  background: none;
  border: none;
  color: #633;
  cursor: pointer;
  font-size: 1.1rem;
  transition: 0.3s;
  &:hover { color: #ff4444; transform: scale(1.1); }
}

.dashboard {
  position: relative;
  z-index: 5;
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.page-head {
  margin-bottom: 3.5rem;
  .kicker { color: $gold; letter-spacing: 4px; margin-bottom: 0.5rem; }
  h1 { font-size: 2.8rem; color: #fff; text-shadow: 0 0 20px rgba(0,0,0,0.5); }
}

.adventures-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 2.5rem;
}

.adv-card {
  background: $card-bg;
  border: 1px solid #222;
  border-radius: 4px;
  transition: 0.4s;
  overflow: hidden;
  &:hover { border-color: $gold; transform: translateY(-8px); }
  &.create {
    padding: 4rem 2rem;
    cursor: pointer;
    border: 2px dashed #2a2a2a;
    .icon { font-size: 3.5rem; color: #333; display: block; margin-bottom: 1.5rem; }
    &:hover { border-color: $gold; .icon, h3 { color: $gold; } }
  }
}

.card-img {
  height: 190px;
  background-size: cover;
  background-position: center;
  position: relative;
  .status-tag {
    position: absolute;
    bottom: 0; background: rgba(0,0,0,0.85);
    color: $gold; padding: 6px 15px; font-size: 0.7rem;
  }
}

.card-body {
  padding: 1.8rem;
  h3 { color: $gold; margin-bottom: 12px; font-size: 1.2rem; }
  .last-event { font-size: 0.85rem; color: #999; font-style: italic; min-height: 45px; }
}

.card-meta {
  display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;
  span { font-size: 0.75rem; color: #555; }
}

.saved-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  .card-body { width: 100%; text-align: center; }
  &.error { border-color: rgba(255, 100, 100, 0.5); }
}

.btn-play {
  background: $gold; color: black; border: none; padding: 10px 22px;
  font-weight: bold; cursor: pointer; transition: 0.3s;
  &:hover { background: #d4b47a; }
}

.campaign-selector-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.96); z-index: 100;
  display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);
}

.selector-content {
  width: 90%; max-width: 950px; background: #0a0a0a; border: 1px solid $gold; padding: 45px;
}

.selector-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 35px;
  h2 { color: $gold; }
}

.btn-close { background: none; border: none; color: #444; font-size: 1.6rem; cursor: pointer; }

.campaign-options { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }

.campaign-state {
  grid-column: 1 / -1;
  color: #999;
  text-align: center;
  margin: 0;
}

.campaign-error { color: #ff7070; }

.camp-option-card {
  background: #111; border: 1px solid #222;
  .camp-image { height: 170px; background-size: cover; }
  .camp-info { padding: 22px; p { font-size: 0.88rem; color: #888; margin-bottom: 25px; } }
}

.btn-camp-new {
  width: 100%; background: transparent; border: 1px solid $gold; color: $gold;
  padding: 12px; font-weight: bold; cursor: pointer;
  &:hover { background: rgba($gold, 0.1); }
}

@keyframes fogMove { from { background-position: 0 0; } to { background-position: 1000px 0; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
