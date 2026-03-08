<template>
  <div class="profile-view">
    <div class="ambient-layer"></div>

    <nav class="top-nav">
      <button class="link-btn" @click="goBack">← VOLVER AL BASTIÓN</button>
      <h1>PERFIL DEL AVENTURERO</h1>
      <button class="link-btn" @click="reloadProfile" :disabled="isLoading || isSaving">
        {{ isLoading ? 'CARGANDO...' : 'RECARGAR' }}
      </button>
    </nav>

    <main class="content-shell">
      <section class="profile-card">
        <header class="profile-head">
          <div class="avatar-wrap">
            <img v-if="form.avatar" :src="form.avatar" alt="Avatar del usuario" @error="onAvatarError" />
            <span v-else>{{ avatarInitial }}</span>
          </div>
          <div class="identity">
            <p class="kicker">LEGADO DE CUENTA</p>
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
            <span>SOLICITUDES</span>
            <strong>{{ stats.incomingRequests }}</strong>
          </article>
          <article class="stat">
            <span>PENDIENTES</span>
            <strong>{{ stats.outgoingRequests }}</strong>
          </article>
        </div>

        <article class="rank-card">
          <span class="rank-kicker">RANGO ACTUAL</span>
          <strong>{{ stats.rankLabel }}</strong>
          <p>Puntuación de perfil: {{ stats.profileScore }}</p>
        </article>

        <div class="deep-stats">
          <article>
            <span>CAPÍTULOS COMPLETADOS</span>
            <strong>{{ stats.completedChapters }}</strong>
          </article>
          <article>
            <span>DECISIONES TOMADAS</span>
            <strong>{{ stats.decisionEntries }}</strong>
          </article>
          <article>
            <span>TURNOS COOP</span>
            <strong>{{ stats.coopTurnsTaken }}</strong>
          </article>
          <article>
            <span>PALABRAS NARRADAS</span>
            <strong>{{ stats.totalStoryWords }}</strong>
          </article>
        </div>

        <section class="achievements-box">
          <header>
            <h3>LOGROS</h3>
            <small>{{ unlockedAchievements }} / {{ achievements.length }} desbloqueados</small>
          </header>
          <p v-if="achievements.length === 0" class="achievements-empty">Aún no hay logros disponibles.</p>
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

      <section class="editor-card">
        <p v-if="isLoading" class="state-line">Cargando perfil desde base de datos...</p>
        <p v-else-if="errorMsg" class="state-line error">{{ errorMsg }}</p>
        <p v-else-if="successMsg" class="state-line success">{{ successMsg }}</p>

        <form @submit.prevent="saveProfile" class="form-grid">
          <label>
            Nombre visible
            <input v-model.trim="form.displayName" maxlength="32" placeholder="Tu nombre en campaña" />
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
              placeholder="Describe a tu aventurero, su historia y objetivos."
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

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
    console.error('Error cargando perfil:', error);
    errorMsg.value = 'No se pudo cargar el perfil desde la base de datos.';
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
    successMsg.value = 'Perfil actualizado correctamente.';
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    errorMsg.value = error.message || 'No se pudo guardar el perfil.';
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
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:wght@400;600&display=swap');

.profile-view {
  min-height: 100vh;
  background: #060606;
  color: #e2ddcf;
  position: relative;
  overflow-x: hidden;
  font-family: 'Cinzel', serif;
  padding-bottom: 48px;
}

.ambient-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 20% 20%, rgba(190, 137, 60, 0.1), transparent 42%),
    radial-gradient(circle at 80% 10%, rgba(119, 46, 22, 0.08), transparent 36%),
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 12px,
      rgba(255, 255, 255, 0.008) 13px
    );
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding: 18px 28px;
  background: rgba(5, 5, 5, 0.92);
  border-bottom: 1px solid rgba(197, 160, 89, 0.25);
}

.top-nav h1 {
  margin: 0;
  text-align: center;
  color: #c5a059;
  font-size: 0.95rem;
  letter-spacing: 3px;
}

.link-btn {
  justify-self: start;
  background: transparent;
  border: 1px solid rgba(197, 160, 89, 0.25);
  color: #cab489;
  padding: 10px 14px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.74rem;
  letter-spacing: 1px;
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
  z-index: 1;
  width: min(1120px, calc(100% - 40px));
  margin: 26px auto 0;
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 18px;
}

.profile-card,
.editor-card {
  border: 1px solid rgba(197, 160, 89, 0.22);
  background: rgba(7, 7, 7, 0.92);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
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
  border: 1px solid rgba(197, 160, 89, 0.36);
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
  border: 1px solid rgba(197, 160, 89, 0.22);
  background: rgba(0, 0, 0, 0.45);
  padding: 12px;
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
  border: 1px solid rgba(197, 160, 89, 0.16);
  background: rgba(0, 0, 0, 0.32);
  padding: 10px;
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
  border: 1px solid rgba(197, 160, 89, 0.18);
  background: rgba(0, 0, 0, 0.35);
  padding: 10px;
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
  border: 1px solid rgba(197, 160, 89, 0.18);
  background: rgba(0, 0, 0, 0.48);
  padding: 11px;
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
  font-size: 0.7rem;
  letter-spacing: 1.2px;
}

.form-grid input,
.form-grid textarea {
  width: 100%;
  box-sizing: border-box;
  background: rgba(3, 3, 3, 0.86);
  border: 1px solid rgba(197, 160, 89, 0.22);
  color: #f2ebde;
  padding: 11px 12px;
  font-family: 'Crimson Text', serif;
  font-size: 1rem;
  outline: none;
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
  border: 1px solid rgba(197, 160, 89, 0.32);
  padding: 10px 14px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 1px;
  font-size: 0.72rem;
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
