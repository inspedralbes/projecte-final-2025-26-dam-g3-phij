<template>
  <div class="user-page">
    <div ref="vantaHost" class="vanta-layer"></div>
    <div class="noise-layer"></div>
    <div class="embers-layer" aria-hidden="true">
      <span
        v-for="(seed, idx) in emberSeeds"
        :key="idx"
        class="ember"
        :style="{ left: `${seed.left}%`, animationDuration: `${seed.duration}s`, animationDelay: `${seed.delay}s` }"
      ></span>
    </div>

    <nav class="top-nav animate__animated animate__fadeInDown">
      <div class="brand">
        <img src="/branding/valkrypt-logo.png" alt="Valkrypt" class="brand-logo" />
        <div>
          <p>VALKRYPT</p>
          <small>WAR ROOM</small>
        </div>
      </div>

      <div class="nav-links">
        <router-link to="/friends" class="nav-btn">ALIANCES</router-link>
        <router-link to="/rooms" class="nav-btn">LOBBY</router-link>
        <router-link to="/minigames" class="nav-btn">MINIJOCS</router-link>
        <router-link to="/codice" class="nav-btn">CÒDEX</router-link>
        <router-link to="/profile" class="nav-btn">PERFIL</router-link>
      </div>

      <div class="profile-meta">
        <div class="avatar">{{ userInitial }}</div>
        <div class="identity">
          <strong>{{ usernameLabel }}</strong>
          <small>Comandant actiu</small>
        </div>
        <button class="btn-exit" @click="handleLogout">SORTIR</button>
      </div>
    </nav>

    <main class="dashboard">
      <header class="hero-head animate__animated animate__fadeInUp">
        <p class="kicker">CRÒNIQUES DEL REGNE</p>
        <h1>CENTRE DE COMANDAMENT VALKRYPT</h1>
        <p class="subline">Planifica, reprèn i governa les teves expedicions amb control total.</p>
        <div class="hero-actions">
          <button class="btn-main" @click="openCampaignSelector">INICIAR NOVA LLEGENDA</button>
          <button class="btn-ghost" @click="exportChroniclesPdf">EXPORTAR CRÒNIQUES</button>
        </div>
      </header>

      <section class="stats-grid animate__animated animate__fadeInUp animate__delay-1s">
        <article class="stat-card">
          <span>PARTIDES DESADES</span>
          <strong>{{ savedGames.length }}</strong>
          <p>Cròniques llestes per continuar.</p>
        </article>
        <article class="stat-card">
          <span>CAMPANYES DISPONIBLES</span>
          <strong>{{ availableCampaigns.length || '—' }}</strong>
          <p>Missions seleccionables al regne.</p>
        </article>
        <article class="stat-card">
          <span>ALIANCES ACTIVES</span>
          <strong>{{ usernameLabel ? 'ONLINE' : 'OFF' }}</strong>
          <p>Coordina equip i estratègia en temps real.</p>
        </article>
      </section>

      <section class="training-shell animate__animated animate__fadeInUp animate__delay-1s">
        <header class="shell-head">
          <h2>CENTRE D'ENTRENAMENT</h2>
          <button class="btn-mini" @click="openMinigames">OBRIR MINIJOCS</button>
        </header>
        <div class="training-grid">
          <article class="training-card" @click="openMinigames">
            <div class="training-icon">✦</div>
            <div>
              <h3>MINIJOCS I COOP ONLINE</h3>
              <p>Entrena reflexos, memòria i puja estadístiques dels teus herois fora de campanya.</p>
            </div>
            <span class="training-cta">ENTRAR →</span>
          </article>
        </div>
      </section>

      <section class="adventures-shell">
        <header class="shell-head">
          <h2>LES MEVES AVENTURES</h2>
          <button class="btn-mini" @click="openCampaignSelector">NOVA PARTIDA</button>
        </header>

        <div class="adventures-grid">
          <div class="adv-card create" @click="openCampaignSelector">
            <div class="card-inner">
              <span class="icon">+</span>
              <h3>FORJAR CAMPANYA</h3>
              <p>Obre una nova línia temporal i inicia una expedició.</p>
            </div>
          </div>

          <div v-if="savesLoading" class="adv-card state">
            <div class="state-body">
              <h3>CARREGANT PARTIDES</h3>
              <p>Consultant la base de dades...</p>
            </div>
          </div>

          <div v-else-if="savesError" class="adv-card state error">
            <div class="state-body">
              <h3>ERROR DE LECTURA</h3>
              <p>{{ savesError }}</p>
            </div>
          </div>

          <div v-else-if="savedGames.length === 0" class="adv-card state">
            <div class="state-body">
              <h3>SENSE CRÒNIQUES</h3>
              <p>Encara no tens cap partida desada.</p>
            </div>
          </div>

          <div v-for="save in savedGames" :key="save.id" class="adv-card saved">
            <div class="card-img" :style="{ backgroundImage: `url(${save.img})` }">
              <div class="overlay">
                <span class="status-tag">{{ save.location }}</span>
              </div>
            </div>
            <div class="card-body">
              <h3>{{ save.title }}</h3>
              <p class="last-event">{{ save.lastEvent }}</p>
              <div class="card-meta">
                <span>{{ save.date }}</span>
                <div class="actions">
                  <button class="btn-play" @click="resumeGame(save.id)">CONTINUA</button>
                  <button class="btn-delete" :disabled="saveDeleteLoading === save.id" @click="deleteSave(save.id)">
                    {{ saveDeleteLoading === save.id ? 'ELIMINANT...' : 'ELIMINAR' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <transition name="fade">
        <div v-if="isSelectingCampaign" class="campaign-selector-overlay">
          <div class="selector-content animate__animated animate__zoomIn">
            <header class="selector-header">
              <h2>TRIA LA TEVA HISTÒRIA</h2>
              <button class="btn-close" @click="isSelectingCampaign = false">✕</button>
            </header>

            <div class="campaign-options">
              <p v-if="campaignsLoading" class="campaign-state">Carregant campanyes...</p>
              <p v-else-if="campaignsError" class="campaign-state campaign-error">{{ campaignsError }}</p>
              <p v-else-if="availableCampaigns.length === 0" class="campaign-state">No hi ha campanyes disponibles.</p>

              <article v-for="camp in availableCampaigns" :key="camp.id" class="camp-option-card">
                <div class="camp-image" :style="{ backgroundImage: `url(${camp.img})` }"></div>
                <div class="camp-info">
                  <h3>{{ camp.title }}</h3>
                  <p>{{ camp.desc }}</p>
                  <button class="btn-camp-new" @click="startNewGame(camp.id)">COMENÇAR</button>
                </div>
              </article>
            </div>
          </div>
        </div>
      </transition>
    </main>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';
import { DEFAULT_CAMPAIGN_IMAGE, resolveCampaignImage } from '../assets/valkryptAssets';

const router = useRouter();
const userInitial = ref('?');
const usernameLabel = ref('PERFIL');
const isSelectingCampaign = ref(false);
const campaignsLoading = ref(false);
const campaignsError = ref('');
const savesLoading = ref(false);
const savesError = ref('');
const savedGames = ref([]);
const availableCampaigns = ref([]);
const saveDeleteLoading = ref('');
const vantaHost = ref(null);
let vantaEffect = null;

const emberSeeds = [
  { left: 6, duration: 13, delay: 1 }, { left: 11, duration: 11, delay: 4 }, { left: 17, duration: 16, delay: 2 },
  { left: 24, duration: 10, delay: 6 }, { left: 31, duration: 15, delay: 3 }, { left: 39, duration: 12, delay: 5 },
  { left: 46, duration: 14, delay: 7 }, { left: 52, duration: 9, delay: 2 }, { left: 58, duration: 13, delay: 6 },
  { left: 64, duration: 11, delay: 1 }, { left: 71, duration: 15, delay: 5 }, { left: 77, duration: 12, delay: 3 },
  { left: 83, duration: 14, delay: 7 }, { left: 89, duration: 10, delay: 2 }, { left: 95, duration: 13, delay: 4 }
];

const loadCampaigns = async () => {
  campaignsLoading.value = true;
  campaignsError.value = '';
  try {
    const response = await fetch('/api/game/campaigns');
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const campaigns = await response.json();
    availableCampaigns.value = Array.isArray(campaigns)
      ? campaigns.map((campaign) => ({
          ...campaign,
          img: resolveCampaignImage(campaign, DEFAULT_CAMPAIGN_IMAGE)
        }))
      : [];
  } catch (err) {
    console.error("No s'ha pogut carregar el catàleg de campanyes:", err);
    campaignsError.value = getApiErrorMessage(err, "No s'han pogut carregar campanyes des de la base de dades.");
    availableCampaigns.value = [];
  } finally {
    campaignsLoading.value = false;
  }
};

const formatSaveDate = (rawDate) => {
  if (!rawDate) return 'SENSE DATA';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return 'SENSE DATA';
  return date.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
};

const loadSavedGames = async (userId) => {
  savesLoading.value = true;
  savesError.value = '';
  try {
    const response = await fetch(`/api/game/saves/${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const saves = await response.json();
    savedGames.value = Array.isArray(saves)
        ? saves.map((save) => ({
          id: save.id || `${save.campaignId || 'save'}-${save.updatedAt || Date.now()}`,
          title: String(save.title || 'PARTIDA').toUpperCase(),
          location: String(save.location || 'DESCONEGUT').toUpperCase(),
          lastEvent: save.lastEvent || 'Sense esdeveniments recents.',
          date: formatSaveDate(save.updatedAt),
          img: resolveCampaignImage(save, DEFAULT_CAMPAIGN_IMAGE)
        }))
      : [];
  } catch (err) {
    console.error("No s'han pogut carregar les partides desades:", err);
    savesError.value = getApiErrorMessage(err, "No s'han pogut llegir les teves partides desades.");
    savedGames.value = [];
  } finally {
    savesLoading.value = false;
  }
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};

const openCampaignSelector = async () => {
  isSelectingCampaign.value = true;
  if (availableCampaigns.value.length === 0 && !campaignsLoading.value) await loadCampaigns();
};

const openMinigames = () => {
  router.push('/minigames');
};

const exportChroniclesPdf = async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id || user._id;
  if (!userId) return;
  const link = document.createElement('a');
  link.href = `/api/engine/chronicles/export/pdf?userId=${encodeURIComponent(userId)}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.click();
};

const startNewGame = (campId) => {
  router.push({ path: '/select', query: { campaign: campId } });
};

const resumeGame = () => {
  router.push('/game');
};

const deleteSave = async (saveId) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id || user._id;
  if (!userId || !saveId || saveDeleteLoading.value) return;

  const confirmed = window.confirm('Segur que vols eliminar aquesta història? Aquesta acció no es pot desfer.');
  if (!confirmed) return;

  saveDeleteLoading.value = saveId;
  try {
    const response = await fetch(`/api/game/saves/${encodeURIComponent(userId)}/${encodeURIComponent(saveId)}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    savedGames.value = savedGames.value.filter((save) => save.id !== saveId);
  } catch (error) {
    console.error("No s'ha pogut eliminar la partida:", error);
    window.alert(getApiErrorMessage(error, "No s'ha pogut eliminar la història desada."));
  } finally {
    saveDeleteLoading.value = '';
  }
};

onMounted(async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.username) {
    const userId = user.id || user._id;
    const displayName = String(user?.profile?.displayName || user.username || '').trim();
    const label = displayName || user.username;
    userInitial.value = label.charAt(0).toUpperCase();
    usernameLabel.value = label.toUpperCase();
    if (!userId) {
      router.push('/login');
      return;
    }
    await loadSavedGames(userId);
  } else {
    router.push('/login');
  }

  try {
    const THREE = await import('three');
    const fogModule = await import('vanta/dist/vanta.fog.min');
    const VANTA = fogModule.default;
    if (!vantaHost.value) return;
    vantaEffect = VANTA({
      el: vantaHost.value,
      THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      highlightColor: 0x6f1010,
      midtoneColor: 0x0f0b0d,
      lowlightColor: 0x07080a,
      baseColor: 0x050608,
      blurFactor: 0.5,
      speed: 0.55,
      zoom: 0.62
    });
  } catch (error) {
    console.error('No s’ha pogut carregar Vanta Fog:', error);
  }
});

onBeforeUnmount(() => {
  if (vantaEffect && typeof vantaEffect.destroy === 'function') vantaEffect.destroy();
});
</script>

<style scoped lang="scss">
@import url('https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css');
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;800&family=MedievalSharp&display=swap');

$gold: #c5a059;

.user-page {
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  overflow-x: hidden;
  color: #ececef;
  font-family: 'Cinzel', serif;
}

.vanta-layer,
.noise-layer,
.embers-layer {
  position: absolute;
  inset: 0;
}

.vanta-layer { z-index: 0; }

.noise-layer {
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(circle at 24% 22%, rgba(255, 255, 255, 0.02), transparent 36%),
    radial-gradient(circle at 72% 75%, rgba(255, 255, 255, 0.018), transparent 38%),
    repeating-linear-gradient(90deg, transparent 0, transparent 2px, rgba(255, 255, 255, 0.012) 2px, rgba(255, 255, 255, 0.012) 3px);
  mix-blend-mode: screen;
}

.embers-layer {
  z-index: 2;
  pointer-events: none;
}

.ember {
  position: absolute;
  bottom: -20px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(250, 186, 94, 0.68);
  box-shadow: 0 0 12px rgba(250, 186, 94, 0.6);
  animation: ember-float linear infinite;
  opacity: 0;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 12;
  min-height: 78px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba($gold, 0.18);
  background: rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(8px);
  border-radius: 0 0 14px 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: $gold;
  p {
    margin: 0;
    letter-spacing: 3px;
    font-weight: 700;
  }
  small {
    color: #8d8d93;
    letter-spacing: 1.6px;
    font-size: 0.62rem;
  }
}

.brand-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba($gold, 0.32));
}

.nav-links {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.nav-btn {
  text-decoration: none;
  color: #bbb;
  border: 1px solid rgba($gold, 0.16);
  background: rgba(255, 255, 255, 0.025);
  padding: 9px 12px;
  font-size: 0.74rem;
  letter-spacing: 1px;
  transition: 0.22s ease;
  border-radius: 999px;
  &:hover {
    color: #ffe1a5;
    border-color: rgba($gold, 0.55);
    background: rgba($gold, 0.11);
    transform: translateY(-1px);
  }
}

.profile-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(145deg, $gold, #7f602d);
  color: #0b0b0b;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.86rem;
}

.identity {
  display: grid;
  strong {
    color: #ececef;
    font-size: 0.74rem;
    letter-spacing: 1px;
  }
  small {
    color: #85858c;
    font-size: 0.62rem;
    letter-spacing: 1px;
  }
}

.btn-exit {
  border: 1px solid rgba(255, 109, 109, 0.4);
  background: rgba(112, 16, 16, 0.24);
  color: #f4b4b4;
  padding: 9px 12px;
  font-size: 0.72rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: 0.2s ease;
  border-radius: 999px;
  &:hover {
    background: rgba(151, 20, 20, 0.3);
    color: #fff;
  }
}

.dashboard {
  position: relative;
  z-index: 10;
  max-width: 1360px;
  margin: 0 auto;
  padding: 1.2rem 1rem 2.5rem;
}

.hero-head {
  border: 1px solid rgba($gold, 0.16);
  background: rgba(9, 9, 11, 0.58);
  padding: 20px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
  border-radius: 16px;
  .kicker {
    color: #caaa66;
    letter-spacing: 3px;
    font-size: 0.68rem;
    margin: 0 0 8px;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.45rem, 2vw + 0.95rem, 2.5rem);
    color: #fff7e4;
    letter-spacing: 2px;
  }
  .subline {
    margin: 10px 0 14px;
    color: #9f9fa6;
    max-width: 780px;
    font-family: 'MedievalSharp', cursive;
  }
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-main,
.btn-ghost,
.btn-mini,
.btn-play,
.btn-delete,
.btn-camp-new {
  font-family: 'Cinzel', serif;
  letter-spacing: 1px;
  cursor: pointer;
  transition: 0.22s ease;
}

.btn-main {
  border: 1px solid $gold;
  background: linear-gradient(130deg, rgba(141, 17, 17, 0.85), rgba(101, 15, 15, 0.85));
  color: #ffe6a9;
  padding: 10px 14px;
  border-radius: 12px;
  &:hover {
    color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(122, 15, 15, 0.42);
  }
}

.btn-ghost,
.btn-mini {
  border: 1px solid rgba($gold, 0.5);
  background: rgba(255, 255, 255, 0.03);
  color: #d8be88;
  padding: 10px 14px;
  border-radius: 12px;
  &:hover {
    background: rgba($gold, 0.12);
    color: #fff;
  }
}

.stats-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  border: 1px solid rgba($gold, 0.14);
  background: rgba(11, 11, 13, 0.58);
  padding: 14px;
  border-radius: 14px;
  span {
    color: #8d8d93;
    font-size: 0.67rem;
    letter-spacing: 2px;
  }
  strong {
    display: block;
    margin-top: 4px;
    color: #f1d69b;
    font-size: 1.65rem;
  }
  p {
    margin: 6px 0 0;
    color: #9a9aa1;
    font-size: 0.78rem;
  }
}

.adventures-shell {
  margin-top: 14px;
  border: 1px solid rgba($gold, 0.16);
  background: rgba(8, 8, 10, 0.58);
  padding: 14px;
  border-radius: 16px;
}

.training-shell {
  margin-top: 14px;
  border: 1px solid rgba($gold, 0.2);
  background: rgba(10, 10, 14, 0.62);
  padding: 14px;
  border-radius: 16px;
}

.training-grid {
  display: grid;
  grid-template-columns: 1fr;
}

.training-card {
  border: 1px solid rgba($gold, 0.2);
  border-radius: 14px;
  background: linear-gradient(120deg, rgba(197, 160, 89, 0.08), rgba(16, 22, 35, 0.65));
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: center;
  cursor: pointer;
  transition: .22s ease;
  &:hover {
    border-color: rgba($gold, 0.48);
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.25);
  }
  h3 {
    margin: 0;
    color: #f1d69b;
    font-size: 1.02rem;
  }
  p {
    margin: 6px 0 0;
    color: #a8a8b1;
    font-size: 0.84rem;
  }
}

.training-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid rgba($gold, 0.35);
  display: grid;
  place-items: center;
  color: #e5c98d;
  background: rgba(0, 0, 0, 0.35);
  font-size: 1.3rem;
}

.training-cta {
  color: #e8cf9a;
  font-size: 0.8rem;
  letter-spacing: 1px;
}

.shell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  h2 {
    margin: 0;
    color: #f3d99f;
    font-size: clamp(1.18rem, 1vw + 0.8rem, 1.6rem);
    letter-spacing: 0.6px;
    font-family: 'MedievalSharp', cursive;
    font-weight: 400;
  }
}

.adventures-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.adv-card {
  border: 1px solid rgba($gold, 0.14);
  background: rgba(17, 17, 19, 0.6);
  overflow: hidden;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  transition: 0.24s ease;
  border-radius: 14px;
  &:hover {
    border-color: rgba($gold, 0.36);
    transform: translateY(-2px);
  }
  animation: shadow-materialize 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.adv-card:nth-child(1) { animation-delay: 0.03s; }
.adv-card:nth-child(2) { animation-delay: 0.07s; }
.adv-card:nth-child(3) { animation-delay: 0.11s; }
.adv-card:nth-child(4) { animation-delay: 0.15s; }
.adv-card:nth-child(5) { animation-delay: 0.19s; }
.adv-card:nth-child(6) { animation-delay: 0.23s; }

.adv-card.create {
  border-style: dashed;
  display: grid;
  place-items: center;
  min-height: 260px;
  cursor: pointer;
  .card-inner {
    text-align: center;
    padding: 20px;
  }
  .icon {
    font-size: 2.8rem;
    color: #6f5a33;
    display: block;
    margin-bottom: 8px;
  }
  h3 {
    margin: 0;
    color: #dfc68f;
    font-size: 1rem;
  }
  p {
    margin: 8px 0 0;
    color: #9e9ea5;
    font-size: 0.82rem;
  }
}

.adv-card.state {
  min-height: 260px;
  display: grid;
  place-items: center;
}

.state-body {
  text-align: center;
  padding: 20px;
  h3 {
    margin: 0;
    color: #f0d79d;
    font-size: 0.98rem;
  }
  p {
    margin: 8px 0 0;
    color: #9f9fa7;
    font-size: 0.82rem;
  }
}

.adv-card.state.error {
  border-color: rgba(255, 111, 111, 0.45);
}

.card-img {
  height: 170px;
  background-size: cover;
  background-position: center;
  position: relative;
  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.7));
    display: flex;
    align-items: end;
  }
}

.status-tag {
  margin: 0 0 8px 8px;
  border: 1px solid rgba($gold, 0.6);
  background: rgba(0, 0, 0, 0.72);
  color: #e7cd95;
  padding: 5px 8px;
  font-size: 0.64rem;
  border-radius: 999px;
}

.card-body {
  padding: 12px;
  h3 {
    margin: 0 0 7px;
    color: #f2d89e;
    font-size: 1.08rem;
    letter-spacing: 0.2px;
    font-family: 'MedievalSharp', cursive;
    font-weight: 400;
  }
  .last-event {
    margin: 0;
    color: #9e9ea6;
    font-size: 0.9rem;
    line-height: 1.45;
    min-height: 52px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.card-meta {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  span {
    color: #6f6f75;
    font-size: 0.7rem;
  }
}

.actions {
  display: flex;
  gap: 8px;
}

.btn-play {
  border: 1px solid rgba($gold, 0.55);
  background: rgba($gold, 0.18);
  color: #f0dba9;
  padding: 8px 10px;
  font-size: 0.72rem;
  border-radius: 10px;
  &:hover {
    background: rgba($gold, 0.3);
    color: #fff;
  }
}

.btn-delete {
  border: 1px solid rgba(255, 121, 121, 0.4);
  background: rgba(108, 16, 16, 0.24);
  color: #ebb4b4;
  padding: 8px 10px;
  font-size: 0.72rem;
  border-radius: 10px;
  &:hover {
    background: rgba(137, 17, 17, 0.31);
    color: #fff;
  }
  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.campaign-selector-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(0, 0, 0, 0.94);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 14px;
}

.selector-content {
  width: min(1120px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  border: 1px solid rgba($gold, 0.22);
  background: rgba(9, 9, 11, 0.92);
  padding: 18px;
  border-radius: 16px;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  h2 {
    margin: 0;
    color: #f0d79f;
    letter-spacing: 1.6px;
    font-size: 1.1rem;
  }
}

.btn-close {
  border: 1px solid rgba(255, 141, 141, 0.45);
  background: rgba(125, 18, 18, 0.2);
  color: #f3bbbb;
  width: 34px;
  height: 34px;
  cursor: pointer;
  border-radius: 10px;
}

.campaign-options {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.campaign-state {
  grid-column: 1 / -1;
  color: #9f9fa8;
  text-align: center;
}

.campaign-error {
  color: #ff8f8f;
}

.camp-option-card {
  border: 1px solid rgba($gold, 0.16);
  background: rgba(15, 15, 18, 0.74);
  overflow: hidden;
  border-radius: 14px;
}

.camp-image {
  height: 168px;
  background-size: cover;
  background-position: center;
}

.camp-info {
  padding: 12px;
  h3 {
    margin: 0 0 8px;
    color: #f0d8a2;
    font-size: 0.95rem;
  }
  p {
    margin: 0 0 12px;
    color: #9f9fa8;
    font-size: 0.81rem;
    min-height: 54px;
  }
}

.btn-camp-new {
  width: 100%;
  border: 1px solid rgba($gold, 0.55);
  background: rgba($gold, 0.13);
  color: #efd9aa;
  padding: 10px;
  font-size: 0.8rem;
  border-radius: 10px;
  &:hover {
    background: rgba($gold, 0.24);
    color: #fff;
  }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes shadow-materialize {
  0% {
    opacity: 0;
    filter: blur(9px) saturate(0.75);
    transform: scale(0.965);
    box-shadow: 0 0 0 rgba(122, 15, 15, 0);
  }
  55% {
    opacity: 0.95;
    filter: blur(0.8px) saturate(1.05);
    transform: scale(1.008);
    box-shadow: 0 0 24px rgba(122, 15, 15, 0.28);
  }
  100% {
    opacity: 1;
    filter: blur(0) saturate(1);
    transform: scale(1);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  }
}

@keyframes ember-float {
  0% {
    transform: translateY(0) translateX(0) scale(0.8);
    opacity: 0;
  }
  15% {
    opacity: 0.9;
  }
  100% {
    transform: translateY(-100vh) translateX(-34px) scale(1.05);
    opacity: 0;
  }
}

@media (max-width: 1040px) {
  .top-nav {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 10px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .campaign-options {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .dashboard {
    padding: 1rem 0.72rem 2rem;
  }

  .adventures-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    width: 100%;
    .btn-main,
    .btn-ghost {
      width: 100%;
    }
  }

  .training-card {
    grid-template-columns: 1fr;
    text-align: center;
    .training-icon {
      margin: 0 auto;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .adv-card {
    animation: none !important;
  }
}
</style>
