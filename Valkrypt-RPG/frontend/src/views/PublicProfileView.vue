<template>
  <div class="public-profile-page">
    <div class="ambient-layer"></div>
    <nav class="top-nav">
      <button class="nav-btn" @click="goBack">← VOLVER</button>
      <h1>PERFIL PÚBLICO</h1>
      <button class="nav-btn" :disabled="loading" @click="loadProfile">
        {{ loading ? 'CARGANDO...' : 'RECARGAR' }}
      </button>
    </nav>

    <main class="content-shell">
      <p v-if="loading" class="state-line">Consultando ficha pública...</p>
      <p v-else-if="errorMsg" class="state-line error">{{ errorMsg }}</p>

      <template v-else-if="profile">
        <section class="hero-card">
          <div class="avatar-wrap">
            <img v-if="profile.profile?.avatar" :src="profile.profile.avatar" alt="Avatar" @error="clearAvatar" />
            <span v-else>{{ profileInitial }}</span>
          </div>

          <div class="identity">
            <small>EXPEDIENTE DE ALIADO</small>
            <h2>{{ profile.profile?.displayName || profile.username }}</h2>
            <p>@{{ profile.username }}</p>
            <p class="presence" :class="profile.presence?.status">
              {{ profile.presence?.statusLabel || 'Desconectado' }}
            </p>
          </div>

          <div class="rank-box">
            <span>RANGO</span>
            <strong>{{ profile.stats?.rank?.label || 'Aprendiz de Aventura' }}</strong>
            <p>Puntos: {{ profile.stats?.profileScore || 0 }}</p>
          </div>
        </section>

        <section class="info-grid">
          <article>
            <span>TÍTULO</span>
            <strong>{{ profile.profile?.title || 'Aventurero' }}</strong>
          </article>
          <article>
            <span>FACCIÓN</span>
            <strong>{{ profile.profile?.faction || 'Independiente' }}</strong>
          </article>
          <article>
            <span>PERSONAJE</span>
            <strong>{{ profile.character || 'No definido' }}</strong>
          </article>
          <article>
            <span>ALIADOS</span>
            <strong>{{ profile.stats?.friends || 0 }}</strong>
          </article>
        </section>

        <section class="stats-grid">
          <article class="stat">
            <span>PARTIDAS GUARDADAS</span>
            <strong>{{ profile.stats?.savedCampaigns || 0 }}</strong>
          </article>
          <article class="stat">
            <span>CAPÍTULOS COMPLETADOS</span>
            <strong>{{ profile.stats?.completedChapters || 0 }}</strong>
          </article>
          <article class="stat">
            <span>SALAS COMPLETADAS</span>
            <strong>{{ profile.stats?.roomsCompleted || 0 }}</strong>
          </article>
          <article class="stat">
            <span>TURNOS TOTALES</span>
            <strong>{{ profile.stats?.totalTurns || 0 }}</strong>
          </article>
          <article class="stat">
            <span>TURNOS COOP</span>
            <strong>{{ profile.stats?.coopTurnsTaken || 0 }}</strong>
          </article>
          <article class="stat">
            <span>LOGROS</span>
            <strong>{{ unlockedCount }} / {{ achievements.length }}</strong>
          </article>
        </section>

        <section class="bio-box">
          <h3>BIOGRAFÍA</h3>
          <p>{{ profile.profile?.bio || 'Este aventurero no ha registrado biografía.' }}</p>
        </section>

        <section class="achievements-box">
          <header>
            <h3>LOGROS DEL ALIADO</h3>
            <small>{{ unlockedCount }} desbloqueados</small>
          </header>
          <p v-if="achievements.length === 0" class="ach-empty">Sin logros registrados.</p>
          <div v-else class="ach-list">
            <article
              v-for="achievement in achievements"
              :key="achievement.id"
              class="ach-item"
              :class="{ unlocked: achievement.unlocked }"
            >
              <div class="dot">{{ achievement.unlocked ? '✓' : '○' }}</div>
              <div class="txt">
                <strong>{{ achievement.title }}</strong>
                <p>{{ achievement.description }}</p>
                <small>{{ achievement.progress }} / {{ achievement.goal }}</small>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const errorMsg = ref('');
const profile = ref(null);
const localUser = ref({});
const token = ref(localStorage.getItem('token') || '');

const targetUsername = computed(() => String(route.params.username || '').trim());
const viewerUserId = computed(() => String(localUser.value?.id || localUser.value?._id || '').trim());
const achievements = computed(() => Array.isArray(profile.value?.achievements) ? profile.value.achievements : []);
const unlockedCount = computed(() => achievements.value.filter((entry) => entry?.unlocked).length);
const profileInitial = computed(() => {
  const name = String(profile.value?.profile?.displayName || profile.value?.username || '?');
  return name.charAt(0).toUpperCase();
});

const authHeaders = () => {
  return token.value ? { Authorization: `Bearer ${token.value}` } : {};
};

const clearAvatar = () => {
  if (profile.value?.profile) {
    profile.value.profile.avatar = '';
  }
};

const loadProfile = async () => {
  if (!targetUsername.value || !viewerUserId.value) return;

  loading.value = true;
  errorMsg.value = '';
  try {
    const response = await fetch(
      `/api/social/profile/${encodeURIComponent(targetUsername.value)}?viewerUserId=${encodeURIComponent(viewerUserId.value)}`,
      { headers: authHeaders() }
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    profile.value = data.profile || null;
  } catch (error) {
    console.error('Error en perfil público:', error);
    errorMsg.value = error.message || 'No se pudo cargar el perfil público.';
    profile.value = null;
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/friends');
};

watch(targetUsername, () => {
  if (targetUsername.value) {
    loadProfile();
  }
});

onMounted(async () => {
  try {
    localUser.value = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (error) {
    localUser.value = {};
  }

  if (!token.value || !viewerUserId.value) {
    router.push('/login');
    return;
  }

  if (!targetUsername.value) {
    router.push('/friends');
    return;
  }

  await loadProfile();
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:wght@400;600&display=swap');

.public-profile-page {
  min-height: 100vh;
  background: #060606;
  color: #e8e1d0;
  position: relative;
  overflow-x: hidden;
  padding-bottom: 36px;
  font-family: 'Cinzel', serif;
}

.ambient-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 20% 14%, rgba(198, 150, 72, 0.09), transparent 40%),
    radial-gradient(circle at 90% 20%, rgba(94, 44, 24, 0.12), transparent 45%),
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 12px,
      rgba(255, 255, 255, 0.01) 13px
    );
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 16px 22px;
  background: rgba(5, 5, 5, 0.93);
  border-bottom: 1px solid rgba(197, 160, 89, 0.25);
}

.top-nav h1 {
  margin: 0;
  color: #c5a059;
  font-size: 0.95rem;
  letter-spacing: 2px;
  text-align: center;
}

.nav-btn {
  background: transparent;
  border: 1px solid rgba(197, 160, 89, 0.28);
  color: #cbb186;
  padding: 9px 12px;
  font-family: inherit;
  font-size: 0.72rem;
  letter-spacing: 1px;
  cursor: pointer;
}

.nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.nav-btn:last-child {
  justify-self: end;
}

.content-shell {
  position: relative;
  z-index: 1;
  width: min(1080px, calc(100% - 28px));
  margin: 18px auto 0;
  display: grid;
  gap: 12px;
}

.state-line {
  margin: 0;
  border: 1px dashed rgba(197, 160, 89, 0.25);
  background: rgba(0, 0, 0, 0.4);
  padding: 11px;
  color: #b8a684;
}

.state-line.error {
  border-color: rgba(255, 123, 123, 0.35);
  color: #ff9f9f;
}

.hero-card {
  border: 1px solid rgba(197, 160, 89, 0.25);
  background: rgba(8, 8, 8, 0.93);
  display: grid;
  grid-template-columns: 94px 1fr 260px;
  gap: 12px;
  align-items: center;
  padding: 12px;
}

.avatar-wrap {
  width: 94px;
  height: 94px;
  border-radius: 50%;
  border: 1px solid rgba(197, 160, 89, 0.35);
  background: radial-gradient(circle at 35% 25%, #d1a95f, #8a6a2d 64%, #2b1f0f);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.avatar-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-wrap span {
  color: #1c1205;
  font-size: 2rem;
  font-weight: 700;
}

.identity small {
  color: #8f7b58;
  font-size: 0.62rem;
  letter-spacing: 1.8px;
}

.identity h2 {
  margin: 6px 0 0;
  color: #f2ebdd;
  font-size: 1.2rem;
}

.identity p {
  margin: 4px 0 0;
  color: #9c8b6d;
  font-size: 0.75rem;
  letter-spacing: 1px;
}

.identity .presence {
  margin-top: 6px;
  display: inline-block;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 3px 8px;
}

.identity .presence.online {
  border-color: rgba(69, 202, 113, 0.45);
  color: #7aeba4;
}

.rank-box {
  border: 1px solid rgba(197, 160, 89, 0.2);
  background: rgba(0, 0, 0, 0.42);
  padding: 10px;
}

.rank-box span {
  display: block;
  color: #957f59;
  font-size: 0.62rem;
  letter-spacing: 1px;
}

.rank-box strong {
  display: block;
  margin-top: 6px;
  color: #edd39a;
}

.rank-box p {
  margin: 6px 0 0;
  color: #ab9873;
  font-size: 0.75rem;
}

.info-grid,
.stats-grid {
  display: grid;
  gap: 8px;
}

.info-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.info-grid article,
.stat {
  border: 1px solid rgba(197, 160, 89, 0.2);
  background: rgba(0, 0, 0, 0.36);
  padding: 10px;
}

.info-grid span,
.stat span {
  display: block;
  color: #907f62;
  font-size: 0.62rem;
  letter-spacing: 1px;
}

.info-grid strong,
.stat strong {
  display: block;
  margin-top: 6px;
  color: #ead9b6;
}

.bio-box,
.achievements-box {
  border: 1px solid rgba(197, 160, 89, 0.2);
  background: rgba(0, 0, 0, 0.35);
  padding: 10px;
}

.bio-box h3,
.achievements-box h3 {
  margin: 0 0 7px;
  color: #c5a059;
  font-size: 0.8rem;
  letter-spacing: 1px;
}

.bio-box p {
  margin: 0;
  font-family: 'Crimson Text', serif;
  font-size: 1rem;
  line-height: 1.42;
  color: #cbc0aa;
}

.achievements-box header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.achievements-box small {
  color: #a69066;
  font-size: 0.66rem;
}

.ach-empty {
  margin: 0;
  color: #ab9770;
  font-size: 0.78rem;
}

.ach-list {
  display: grid;
  gap: 7px;
  max-height: 310px;
  overflow-y: auto;
}

.ach-item {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.36);
  padding: 8px;
}

.ach-item.unlocked {
  border-color: rgba(73, 192, 114, 0.48);
  background: rgba(18, 61, 34, 0.35);
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(197, 160, 89, 0.33);
  display: grid;
  place-items: center;
  color: #d2bc94;
  font-size: 0.7rem;
}

.ach-item.unlocked .dot {
  border-color: rgba(73, 192, 114, 0.5);
  color: #8eebb1;
}

.txt strong {
  display: block;
  color: #ece7dc;
  font-size: 0.75rem;
}

.txt p {
  margin: 4px 0 0;
  color: #b5a27d;
  font-size: 0.78rem;
}

.txt small {
  display: block;
  margin-top: 5px;
  color: #d7bc88;
  font-size: 0.67rem;
}

@media (max-width: 980px) {
  .hero-card {
    grid-template-columns: 94px 1fr;
  }

  .rank-box {
    grid-column: 1 / -1;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 740px) {
  .top-nav {
    grid-template-columns: 1fr;
  }

  .top-nav h1 {
    order: -1;
  }

  .nav-btn,
  .nav-btn:last-child {
    justify-self: stretch;
  }

  .hero-card {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .info-grid,
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
