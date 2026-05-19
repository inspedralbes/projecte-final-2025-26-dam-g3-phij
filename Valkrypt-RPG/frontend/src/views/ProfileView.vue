<template>
  <div class="profile-view">
    <div ref="vantaHost" class="vanta-layer"></div>
    <div class="ambient-layer"></div>
    <div class="embers-layer" aria-hidden="true">
      <span
        v-for="(seed, idx) in emberSeeds"
        :key="idx"
        class="ember"
        :style="{ left: `${seed.left}%`, animationDuration: `${seed.duration}s`, animationDelay: `${seed.delay}s` }"
      ></span>
    </div>

    <nav class="top-nav animate__animated animate__fadeInDown">
      <button class="link-btn" @click="goBack">← TORNAR AL BASTIÓ</button>
      <h1>PERFIL DE L'AVENTURER</h1>
      <button class="link-btn" @click="reloadProfile" :disabled="isLoading || isSaving">
        {{ isLoading ? 'CARREGANT...' : 'RECARREGA' }}
      </button>
    </nav>

    <main class="content-shell animate__animated animate__fadeInUp">
      <section class="profile-card panel-glass">
        <header class="profile-head">
          <div class="avatar-wrap">
            <img v-if="form.avatar" :src="form.avatar" alt="Avatar de l'usuari" @error="onAvatarError" />
            <span v-else>{{ avatarInitial }}</span>
          </div>
          <div class="identity">
            <p class="kicker">LLEGAT DEL COMPTE</p>
            <h2>{{ form.displayName || username }}</h2>
            <p class="meta">@{{ username }}</p>
          </div>
        </header>

        <div class="stats-grid">
          <article class="stat">
            <span>ALIADOS</span>
            <strong>{{ stats.friends }}</strong>
          </article>
          <article class="stat">
            <span>PARTIDAS</span>
            <strong>{{ stats.savedCampaigns }}</strong>
          </article>
          <article class="stat">
            <span>SOL·LICITUDS</span>
            <strong>{{ stats.incomingRequests }}</strong>
          </article>
          <article class="stat">
            <span>PENDENTS</span>
            <strong>{{ stats.outgoingRequests }}</strong>
          </article>
        </div>

        <article class="rank-card">
          <span class="rank-kicker">RANG ACTUAL</span>
          <strong>{{ stats.rankLabel }}</strong>
          <p>Puntuació de perfil: {{ stats.profileScore }}</p>
        </article>

        <div class="deep-stats">
          <article>
            <span>CAPÍTOLS COMPLETATS</span>
            <strong>{{ stats.completedChapters }}</strong>
          </article>
          <article>
            <span>DECISIONS PRESES</span>
            <strong>{{ stats.decisionEntries }}</strong>
          </article>
          <article>
            <span>TURNOS COOP</span>
            <strong>{{ stats.coopTurnsTaken }}</strong>
          </article>
          <article>
            <span>PARAULES NARRADES</span>
            <strong>{{ stats.totalStoryWords }}</strong>
          </article>
        </div>

        <section class="achievements-box">
          <header>
            <h3>ASSOLIMENTS</h3>
            <small>{{ unlockedAchievements }} / {{ achievements.length }} desbloquejats</small>
          </header>
          <p v-if="achievements.length === 0" class="achievements-empty">Encara no hi ha assoliments disponibles.</p>
          <div v-else class="achievement-list">
            <article
              v-for="achievement in achievements"
              :key="achievement.id"
              class="achievement-item"
              :class="{ unlocked: achievement.unlocked }"
            >
              <div class="icon">{{ achievement.unlocked ? '✓' : '◌' }}</div>
              <div class="txt">
                <strong>{{ achievement.title }}</strong>
                <p>{{ achievement.description }}</p>
                <small>{{ achievement.progress }} / {{ achievement.goal }}</small>
              </div>
            </article>
          </div>
        </section>
      </section>

      <section class="editor-card panel-glass">
        <p v-if="isLoading" class="state-line">Carregant perfil des de la base de dades...</p>
        <p v-else-if="errorMsg" class="state-line error">{{ errorMsg }}</p>
        <p v-else-if="successMsg" class="state-line success">{{ successMsg }}</p>

        <form @submit.prevent="saveProfile" class="form-grid">
          <label>
            Nombre visible
            <input v-model.trim="form.displayName" maxlength="32" placeholder="El teu nom en campanya" />
          </label>

          <label>
            Título
            <input v-model.trim="form.title" maxlength="60" placeholder="Ej: Guardián de la Corona" />
          </label>

          <label>
            Facción
            <input v-model.trim="form.faction" maxlength="40" placeholder="Ej: Bastión del Norte" />
          </label>

          <label>
            Personaje principal
            <input v-model.trim="form.character" maxlength="80" placeholder="Ej: Kaelen" />
          </label>

          <label class="full">
            Avatar (URL o ruta `/assets/...`)
            <input v-model.trim="form.avatar" maxlength="500" placeholder="https://..." />
          </label>

          <label class="full">
            Biografía
            <textarea
              v-model.trim="form.bio"
              maxlength="320"
              rows="5"
              placeholder="Descriu el teu aventurer, la seva història i els seus objectius."
            ></textarea>
          </label>

          <div class="actions full">
            <button type="button" class="btn-muted" @click="reloadProfile" :disabled="isLoading || isSaving">
              DESCARTAR CAMBIOS
            </button>
            <button type="submit" class="btn-gold" :disabled="isSaving || isLoading">
              {{ isSaving ? 'GUARDANDO...' : 'GUARDAR PERFIL' }}
            </button>
          </div>
        </form>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';

const router = useRouter();
const userStore = ref({});
const username = ref('');
const userId = ref('');
const isLoading = ref(false);
const isSaving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const form = reactive({
  displayName: '',
  title: '',
  faction: '',
  bio: '',
  avatar: '',
  character: ''
});

const stats = reactive({
  friends: 0,
  incomingRequests: 0,
  outgoingRequests: 0,
  savedCampaigns: 0,
  completedChapters: 0,
  decisionEntries: 0,
  coopTurnsTaken: 0,
  totalStoryWords: 0,
  profileScore: 0,
  rankId: 'aprendiz',
  rankLabel: 'Aprendiz de Aventura'
});
const achievements = ref([]);
const vantaHost = ref(null);
let vantaEffect = null;
const emberSeeds = [
  { left: 7, duration: 13, delay: 1 }, { left: 13, duration: 11, delay: 4 }, { left: 18, duration: 15, delay: 2 },
  { left: 26, duration: 10, delay: 6 }, { left: 34, duration: 14, delay: 3 }, { left: 42, duration: 12, delay: 5 },
  { left: 51, duration: 16, delay: 7 }, { left: 59, duration: 9, delay: 2 }, { left: 68, duration: 13, delay: 6 },
  { left: 76, duration: 11, delay: 1 }, { left: 85, duration: 14, delay: 5 }, { left: 93, duration: 12, delay: 3 }
];

const avatarInitial = computed(() => {
  const source = form.displayName || username.value || '?';
  return source.charAt(0).toUpperCase();
});
const unlockedAchievements = computed(() => achievements.value.filter((item) => item?.unlocked).length);

const normalizeText = (value, max) => String(value || '').trim().slice(0, max);

const readUserFromStorage = () => {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
};

const applyUserToForm = (user) => {
  const profile = user?.profile && typeof user.profile === 'object' ? user.profile : {};
  const rawStats = user?.stats && typeof user.stats === 'object' ? user.stats : {};
  form.displayName = normalizeText(profile.displayName || user?.username || '', 32);
  form.title = normalizeText(profile.title || 'Aventurero', 60);
  form.faction = normalizeText(profile.faction || 'Independiente', 40);
  form.bio = normalizeText(profile.bio || '', 320);
  form.avatar = normalizeText(profile.avatar || '', 500);
  form.character = normalizeText(user?.character || '', 80);

  stats.friends = Number(rawStats.friends || 0);
  stats.incomingRequests = Number(rawStats.incomingRequests || 0);
  stats.outgoingRequests = Number(rawStats.outgoingRequests || 0);
  stats.savedCampaigns = Number(rawStats.savedCampaigns || 0);
  stats.completedChapters = Number(rawStats.completedChapters || 0);
  stats.decisionEntries = Number(rawStats.decisionEntries || 0);
  stats.coopTurnsTaken = Number(rawStats.coopTurnsTaken || 0);
  stats.totalStoryWords = Number(rawStats.totalStoryWords || 0);
  stats.profileScore = Number(rawStats.profileScore || 0);
  stats.rankId = String(rawStats?.rank?.id || 'aprendiz');
  stats.rankLabel = String(rawStats?.rank?.label || 'Aprendiz de Aventura');

  achievements.value = Array.isArray(user?.achievements)
    ? user.achievements.map((entry) => ({
      id: String(entry?.id || ''),
      title: String(entry?.title || 'Logro'),
      description: String(entry?.description || ''),
      progress: Number(entry?.progress || 0),
      goal: Number(entry?.goal || 0),
      unlocked: Boolean(entry?.unlocked)
    }))
    : [];
};

const mergeUserInStorage = (updatedUser) => {
  const current = readUserFromStorage() || {};
  const merged = {
    ...current,
    id: updatedUser.id || current.id || current._id,
    _id: updatedUser.id || current._id || current.id,
    username: updatedUser.username || current.username,
    character: updatedUser.character || null,
    profile: updatedUser.profile || current.profile || {},
    stats: updatedUser.stats || current.stats || {}
  };
  localStorage.setItem('user', JSON.stringify(merged));
  userStore.value = merged;
};

const loadProfile = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  isLoading.value = true;
  try {
    const response = await fetch(`/api/auth/profile/${encodeURIComponent(userId.value)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}`);
    }

    applyUserToForm(data.user || {});
    mergeUserInStorage(data.user || {});
  } catch (error) {
    console.error('Error carregant perfil:', error);
    errorMsg.value = getApiErrorMessage(error, "No s'ha pogut carregar el perfil des de la base de dades.");
  } finally {
    isLoading.value = false;
  }
};

const saveProfile = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  isSaving.value = true;

  const payload = {
    userId: userId.value,
    displayName: normalizeText(form.displayName, 32),
    title: normalizeText(form.title, 60),
    faction: normalizeText(form.faction, 40),
    bio: normalizeText(form.bio, 320),
    avatar: normalizeText(form.avatar, 500),
    character: normalizeText(form.character, 80)
  };

  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}`);
    }

    applyUserToForm(data.user || {});
    mergeUserInStorage(data.user || {});
    successMsg.value = 'Perfil actualitzat correctament.';
  } catch (error) {
    console.error('Error actualitzant perfil:', error);
    errorMsg.value = getApiErrorMessage(error, "No s'ha pogut desar el perfil.");
  } finally {
    isSaving.value = false;
  }
};

const reloadProfile = async () => {
  if (isLoading.value || isSaving.value) return;
  await loadProfile();
};

const goBack = () => {
  router.push('/userpage');
};

const onAvatarError = () => {
  form.avatar = '';
};

onMounted(async () => {
  const user = readUserFromStorage();
  if (!user || (!user.id && !user._id)) {
    router.push('/login');
    return;
  }

  userStore.value = user;
  userId.value = String(user.id || user._id);
  username.value = String(user.username || 'viajero');
  await loadProfile();

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
      highlightColor: 0x641111,
      midtoneColor: 0x0f0b0d,
      lowlightColor: 0x07080a,
      baseColor: 0x050608,
      blurFactor: 0.5,
      speed: 0.5,
      zoom: 0.62
    });
  } catch (error) {
    console.error('No s’ha pogut carregar Vanta Fog al perfil:', error);
  }
});

onBeforeUnmount(() => {
  if (vantaEffect && typeof vantaEffect.destroy === 'function') vantaEffect.destroy();
});
</script>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css');
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;800&family=Crimson+Text:wght@400;600&family=MedievalSharp&display=swap');

.profile-view {
  min-height: 100vh;
  background: #050607;
  color: #e2ddcf;
  position: relative;
  overflow-x: hidden;
  font-family: 'Cinzel', serif;
  padding-bottom: 48px;
}

.vanta-layer,
.ambient-layer {
  position: absolute;
  inset: 0;
}

.vanta-layer { z-index: 0; }

.ambient-layer {
  pointer-events: none;
  z-index: 1;
  background:
    radial-gradient(circle at 20% 20%, rgba(190, 137, 60, 0.06), transparent 42%),
    radial-gradient(circle at 80% 10%, rgba(119, 46, 22, 0.05), transparent 36%),
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 12px,
      rgba(255, 255, 255, 0.008) 13px
    );
}

.embers-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.ember {
  position: absolute;
  bottom: -20px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(248, 184, 95, 0.62);
  box-shadow: 0 0 10px rgba(248, 184, 95, 0.5);
  animation: ember-float linear infinite;
  opacity: 0;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 14;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding: 18px 28px;
  background: rgba(5, 5, 5, 0.78);
  border-bottom: 1px solid rgba(197, 160, 89, 0.18);
  backdrop-filter: blur(8px);
  border-radius: 0 0 14px 14px;
}

.top-nav h1 {
  margin: 0;
  text-align: center;
  color: #c5a059;
  font-size: 1rem;
  letter-spacing: 2px;
  font-family: 'MedievalSharp', cursive;
  font-weight: 400;
}

.link-btn {
  justify-self: start;
  background: transparent;
  border: 1px solid rgba(197, 160, 89, 0.18);
  color: #cab489;
  padding: 10px 14px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.74rem;
  letter-spacing: 1px;
  border-radius: 999px;
  transition: 0.22s ease;
}

.link-btn:hover:not(:disabled) {
  color: #fff0cc;
  border-color: rgba(197, 160, 89, 0.42);
  background: rgba(197, 160, 89, 0.1);
}

.link-btn:last-child {
  justify-self: end;
}

.link-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.content-shell {
  position: relative;
  z-index: 10;
  width: min(1120px, calc(100% - 40px));
  margin: 26px auto 0;
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 18px;
}

.profile-card,
.editor-card {
  border: 1px solid rgba(197, 160, 89, 0.16);
  background: rgba(7, 7, 7, 0.66);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  border-radius: 16px;
}

.profile-card {
  padding: 20px;
}

.profile-head {
  display: flex;
  gap: 14px;
  align-items: center;
  border-bottom: 1px solid rgba(197, 160, 89, 0.16);
  padding-bottom: 16px;
}

.avatar-wrap {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  border: 1px solid rgba(197, 160, 89, 0.28);
  background: radial-gradient(circle at 30% 20%, #cea862, #8f6f32 65%, #2d220f);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-wrap span {
  color: #120c03;
  font-size: 1.8rem;
  font-weight: 700;
}

.identity .kicker {
  margin: 0 0 4px;
  font-size: 0.62rem;
  letter-spacing: 2px;
  color: #8f8268;
}

.identity h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #f4eee0;
}

.identity .meta {
  margin: 4px 0 0;
  color: #8b7d62;
  font-size: 0.72rem;
  letter-spacing: 1px;
}

.stats-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.rank-card {
  margin-top: 12px;
  border: 1px solid rgba(197, 160, 89, 0.16);
  background: rgba(0, 0, 0, 0.45);
  padding: 12px;
  border-radius: 12px;
}

.rank-card .rank-kicker {
  display: block;
  color: #968463;
  font-size: 0.65rem;
  letter-spacing: 1.3px;
}

.rank-card strong {
  display: block;
  margin-top: 6px;
  color: #f0d9a4;
  font-size: 1rem;
}

.rank-card p {
  margin: 6px 0 0;
  color: #aa9a79;
  font-size: 0.76rem;
}

.deep-stats {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.deep-stats article {
  border: 1px solid rgba(197, 160, 89, 0.13);
  background: rgba(0, 0, 0, 0.32);
  padding: 10px;
  border-radius: 10px;
}

.deep-stats span {
  display: block;
  color: #9a8868;
  font-size: 0.62rem;
  letter-spacing: 1.2px;
}

.deep-stats strong {
  display: block;
  margin-top: 6px;
  color: #dfc993;
}

.achievements-box {
  margin-top: 12px;
  border: 1px solid rgba(197, 160, 89, 0.14);
  background: rgba(0, 0, 0, 0.35);
  padding: 10px;
  border-radius: 12px;
}

.achievements-box header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.achievements-box h3 {
  margin: 0;
  font-size: 0.8rem;
  color: #c7a96b;
  letter-spacing: 1.2px;
}

.achievements-box small {
  color: #a89572;
  font-size: 0.67rem;
}

.achievements-empty {
  margin: 0;
  color: #9f8e70;
  font-size: 0.78rem;
}

.achievement-list {
  display: grid;
  gap: 7px;
  max-height: 230px;
  overflow-y: auto;
}

.achievement-item {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.4);
  padding: 8px;
  border-radius: 10px;
}

.achievement-item.unlocked {
  border-color: rgba(92, 197, 126, 0.45);
  background: rgba(31, 73, 42, 0.26);
}

.achievement-item .icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  color: #d5c39d;
  border: 1px solid rgba(197, 160, 89, 0.3);
}

.achievement-item.unlocked .icon {
  border-color: rgba(92, 197, 126, 0.5);
  color: #8df0b0;
}

.achievement-item .txt strong {
  display: block;
  font-size: 0.74rem;
  color: #f3efe6;
}

.achievement-item .txt p {
  margin: 3px 0 0;
  color: #b4a17d;
  font-size: 0.73rem;
  line-height: 1.25;
}

.achievement-item .txt small {
  display: block;
  margin-top: 5px;
  color: #d9c088;
}

.stat {
  border: 1px solid rgba(197, 160, 89, 0.14);
  background: rgba(0, 0, 0, 0.48);
  padding: 11px;
  border-radius: 10px;
}

.stat span {
  display: block;
  color: #9a8868;
  font-size: 0.64rem;
  letter-spacing: 1.3px;
}

.stat strong {
  display: block;
  margin-top: 6px;
  color: #e9d09a;
  font-size: 1.2rem;
}

.editor-card {
  padding: 18px;
}

.state-line {
  margin: 0 0 12px;
  color: #938871;
  font-size: 0.76rem;
  min-height: 18px;
}

.state-line.error {
  color: #ff7f7f;
}

.state-line.success {
  color: #78c498;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-grid label {
  display: grid;
  gap: 7px;
  color: #b89f6d;
  font-size: 0.72rem;
  letter-spacing: 1.2px;
}

.form-grid input,
.form-grid textarea {
  width: 100%;
  box-sizing: border-box;
  background: rgba(3, 3, 3, 0.86);
  border: 1px solid rgba(197, 160, 89, 0.16);
  color: #f2ebde;
  padding: 11px 12px;
  font-family: 'Crimson Text', serif;
  font-size: 1rem;
  outline: none;
  border-radius: 10px;
}

.form-grid input:focus,
.form-grid textarea:focus {
  border-color: rgba(197, 160, 89, 0.62);
  box-shadow: 0 0 0 1px rgba(197, 160, 89, 0.14);
}

.form-grid textarea {
  resize: vertical;
  min-height: 130px;
}

.full {
  grid-column: 1 / -1;
}

.actions {
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.btn-muted,
.btn-gold {
  border: 1px solid rgba(197, 160, 89, 0.24);
  padding: 10px 14px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 1px;
  font-size: 0.72rem;
  border-radius: 10px;
  transition: 0.2s ease;
}

.btn-muted {
  background: rgba(0, 0, 0, 0.45);
  color: #ab9b7b;
}

.btn-gold {
  background: #7d5f2f;
  color: #120f09;
  font-weight: 700;
}

.btn-muted:hover:not(:disabled) {
  background: rgba(197, 160, 89, 0.08);
  color: #efdfbb;
}

.btn-gold:hover:not(:disabled) {
  background: #96733a;
}

.panel-glass {
  animation: shadow-materialize 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

@keyframes shadow-materialize {
  0% {
    opacity: 0;
    filter: blur(8px) saturate(0.75);
    transform: scale(0.97);
  }
  100% {
    opacity: 1;
    filter: blur(0) saturate(1);
    transform: scale(1);
  }
}

@keyframes ember-float {
  0% { transform: translateY(0) translateX(0) scale(0.8); opacity: 0; }
  15% { opacity: 0.9; }
  100% { transform: translateY(-100vh) translateX(-34px) scale(1.05); opacity: 0; }
}

.btn-muted:disabled,
.btn-gold:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 980px) {
  .content-shell {
    grid-template-columns: 1fr;
  }

  .top-nav {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .top-nav h1 {
    order: -1;
  }

  .link-btn,
  .link-btn:last-child {
    justify-self: stretch;
  }
}

@media (max-width: 640px) {
  .content-shell {
    width: min(1120px, calc(100% - 20px));
    margin-top: 14px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .deep-stats {
    grid-template-columns: 1fr;
  }

  .actions {
    flex-direction: column;
  }
}
</style>
