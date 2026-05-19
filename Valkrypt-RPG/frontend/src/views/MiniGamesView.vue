<template>
  <div class="mini-page">
    <header class="top">
      <button class="btn ghost" @click="router.push('/userpage')">← Tornar</button>
      <h1>Entrenament Arcà</h1>
      <button class="btn" @click="loadProgress" :disabled="loading">{{ loading ? 'Carregant...' : 'Recarregar' }}</button>
    </header>

    <section class="progress-card">
      <div>
        <small>NIVELL DE COMPTE</small>
        <h2>NV {{ progression.level }}</h2>
      </div>
      <div class="xp">
        <div class="xp-bar"><div class="xp-fill" :style="{ width: `${xpPercent}%` }"></div></div>
        <small>XP {{ progression.xp }} / {{ progression.nextLevelXp }} · Partides: {{ progression.gamesPlayed }}</small>
      </div>
      <div class="hero-picker">
        <label>Heroi a entrenar</label>
        <select v-model="selectedHeroId">
          <option v-for="hero in party" :key="hero.id || hero.name" :value="hero.id">{{ hero.name }} · NV {{ hero.level || 1 }}</option>
        </select>
      </div>
    </section>

    <section class="tabs">
      <button class="tab" :class="{ active: tab === 'reflex' }" @click="tab = 'reflex'">Reflexos</button>
      <button class="tab" :class="{ active: tab === 'memory' }" @click="tab = 'memory'">Memòria</button>
      <button class="tab" :class="{ active: tab === 'coop' }" @click="tab = 'coop'">Coop Online</button>
    </section>

    <section class="panel">
      <h3>Rànquing setmanal</h3>
      <p class="muted">Top XP minijocs (últims 7 dies)</p>
      <div v-if="leaderboardLoading" class="muted">Carregant rànquing...</div>
      <div v-else-if="leaderboard.length === 0" class="muted">Encara no hi ha puntuacions.</div>
      <table v-else class="rank-table">
        <thead>
          <tr><th>#</th><th>Jugador</th><th>XP</th><th>Partides</th><th>Millor</th></tr>
        </thead>
        <tbody>
          <tr v-for="entry in leaderboard" :key="entry.userId">
            <td>{{ entry.rank }}</td>
            <td>{{ entry.displayName || entry.username }}</td>
            <td>{{ entry.weeklyXp }}</td>
            <td>{{ entry.gamesPlayed }}</td>
            <td>{{ entry.bestScore }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="tab === 'reflex'" class="panel">
      <h3>Runa de Reflexos</h3>
      <p>Fes clic quan la runa aparegui. 20 segons.</p>
      <div class="arena">
        <button
          class="rune"
          :class="{ active: reflex.active }"
          :style="{ left: `${reflex.x}%`, top: `${reflex.y}%` }"
          @click="hitReflex"
        >✦</button>
      </div>
      <div class="row">
        <span>Punts: {{ reflex.score }}</span>
        <span>Temps: {{ reflex.timeLeft }}s</span>
      </div>
      <button class="btn" @click="startReflex" :disabled="reflex.running">{{ reflex.running ? 'En curs...' : 'Començar' }}</button>
    </section>

    <section v-if="tab === 'memory'" class="panel">
      <h3>Cercle de Memòria</h3>
      <p>Recorda la seqüència i repeteix-la.</p>
      <div class="memory-grid">
        <button
          v-for="(color, idx) in memory.colors"
          :key="color"
          class="memory-cell"
          :class="[color, { glow: memory.flashIndex === idx }]"
          @click="pressMemory(idx)"
          :disabled="!memory.acceptInput"
        ></button>
      </div>
      <div class="row">
        <span>Nivell: {{ memory.level }}</span>
        <span>Errors: {{ memory.errors }}/3</span>
      </div>
      <button class="btn" @click="startMemory" :disabled="memory.running">{{ memory.running ? 'En curs...' : 'Començar' }}</button>
    </section>

    <section v-if="tab === 'coop'" class="panel">
      <h3>Duel Cooperatiu de Reflexos</h3>
      <div class="row wrap">
        <button class="btn" @click="createCoopRoom">Crear sala</button>
        <input v-model="coop.joinCode" placeholder="Codi sala" />
        <button class="btn" @click="joinCoopRoom">Entrar</button>
        <button class="btn" :disabled="matchmaking.searching" @click="joinMatchmaking">
          {{ matchmaking.searching ? `Buscant... (${matchmaking.queueSize})` : 'Matchmaking auto' }}
        </button>
        <button class="btn ghost" :disabled="!matchmaking.searching" @click="leaveMatchmaking">Cancel·lar cua</button>
      </div>
      <div v-if="coop.room" class="coop-box">
        <p><strong>Sala:</strong> {{ coop.room.roomCode }} · <strong>Estat:</strong> {{ coop.room.status }}</p>
        <p>Membres: {{ coop.room.members?.length || 0 }}</p>
        <ul>
          <li v-for="m in coop.room.members || []" :key="m.userId">
            {{ memberName(m.userId) }} · ready: {{ m.ready ? 'sí' : 'no' }} · score: {{ m.score ?? '-' }}
          </li>
        </ul>
        <div class="row wrap">
          <button class="btn" @click="setReady(true)">Ready</button>
          <button class="btn ghost" @click="setReady(false)">Not ready</button>
          <button class="btn" @click="startCoopRun" :disabled="coop.running || coop.room.status !== 'running'">Jugar run</button>
        </div>
        <div class="row">
          <span>Punts run: {{ coop.localScore }}</span>
          <span>Temps: {{ coop.timeLeft }}s</span>
        </div>
        <button class="btn big-hit" :disabled="!coop.running" @click="coop.localScore += 1">CLIC!</button>
      </div>
    </section>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';
import { wsService } from '../services/WebSocketService';

const router = useRouter();
const loading = ref(false);
const feedback = ref('');
const tab = ref('reflex');
const party = ref([]);
const selectedHeroId = ref('');
const progression = reactive({ level: 1, xp: 0, nextLevelXp: 120, gamesPlayed: 0, byType: { memory: 0, reflex: 0, coop_reflex: 0 } });
const leaderboard = ref([]);
const leaderboardLoading = ref(false);
const user = JSON.parse(localStorage.getItem('user') || '{}');
const userId = String(user?.id || user?._id || '');

const reflex = reactive({ running: false, score: 0, timeLeft: 20, active: false, x: 50, y: 50 });
let reflexTick = null;
let reflexSpawn = null;

const memory = reactive({ running: false, level: 1, errors: 0, colors: ['c1', 'c2', 'c3', 'c4'], sequence: [], input: [], flashIndex: -1, acceptInput: false });

const coop = reactive({ joinCode: '', room: null, poll: null, running: false, localScore: 0, timeLeft: 15, timer: null });
const matchmaking = reactive({ searching: false, queueSize: 0, poll: null });

const xpPercent = computed(() => {
  const next = Math.max(1, Number(progression.nextLevelXp || 1));
  const current = Math.max(0, Number(progression.xp || 0));
  return Math.max(0, Math.min(100, (current / next) * 100));
});

function memberName(memberId) {
  if (String(memberId) === userId) return `${user.username || 'Tu'} (tu)`;
  return String(memberId).slice(0, 8);
}

async function loadProgress() {
  if (!userId) return;
  loading.value = true;
  feedback.value = '';
  try {
    const response = await fetch(`/api/game/minigames/${encodeURIComponent(userId)}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No s’ha pogut carregar el progrés.');
    party.value = Array.isArray(data.party) ? data.party : [];
    if (!selectedHeroId.value && party.value.length > 0) {
      selectedHeroId.value = party.value[0].id || '';
    }
    Object.assign(progression, data.progression || {});
  } catch (error) {
    feedback.value = getApiErrorMessage(error, 'Error carregant minijocs.');
  } finally {
    loading.value = false;
  }
}

async function loadWeeklyLeaderboard() {
  leaderboardLoading.value = true;
  try {
    const response = await fetch('/api/game/minigames/leaderboard/weekly');
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No s’ha pogut carregar el rànquing.');
    leaderboard.value = Array.isArray(data.leaderboard) ? data.leaderboard : [];
  } catch (error) {
    feedback.value = getApiErrorMessage(error, 'Error carregant el rànquing.');
    leaderboard.value = [];
  } finally {
    leaderboardLoading.value = false;
  }
}

async function claimReward(gameType, score, durationMs) {
  try {
    const response = await fetch('/api/game/minigames/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, gameType, score, durationMs, heroId: selectedHeroId.value })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No s’ha pogut aplicar recompensa.');
    party.value = Array.isArray(data.party) ? data.party : party.value;
    Object.assign(progression, data.progression || progression);
    feedback.value = `+${data.reward?.xp || 0} XP · ${gameType}`;
  } catch (error) {
    feedback.value = getApiErrorMessage(error, 'Error aplicant recompensa.');
  }
}

function spawnReflexRune() {
  reflex.active = true;
  reflex.x = 10 + Math.random() * 80;
  reflex.y = 12 + Math.random() * 74;
}

function hitReflex() {
  if (!reflex.running || !reflex.active) return;
  reflex.score += 1;
  reflex.active = false;
}

function stopReflex() {
  reflex.running = false;
  reflex.active = false;
  if (reflexTick) clearInterval(reflexTick);
  if (reflexSpawn) clearInterval(reflexSpawn);
  reflexTick = null;
  reflexSpawn = null;
}

function startReflex() {
  stopReflex();
  reflex.running = true;
  reflex.score = 0;
  reflex.timeLeft = 20;
  spawnReflexRune();
  reflexSpawn = setInterval(spawnReflexRune, 850);
  reflexTick = setInterval(async () => {
    reflex.timeLeft -= 1;
    if (reflex.timeLeft <= 0) {
      stopReflex();
      await claimReward('reflex', reflex.score * 10, 20000);
    }
  }, 1000);
}

async function flashSequence() {
  memory.acceptInput = false;
  for (const idx of memory.sequence) {
    memory.flashIndex = idx;
    await new Promise((r) => setTimeout(r, 420));
    memory.flashIndex = -1;
    await new Promise((r) => setTimeout(r, 180));
  }
  memory.input = [];
  memory.acceptInput = true;
}

async function startMemory() {
  memory.running = true;
  memory.level = 1;
  memory.errors = 0;
  memory.sequence = [Math.floor(Math.random() * 4)];
  await flashSequence();
}

async function pressMemory(idx) {
  if (!memory.running || !memory.acceptInput) return;
  memory.input.push(idx);
  const pos = memory.input.length - 1;
  if (memory.sequence[pos] !== idx) {
    memory.errors += 1;
    memory.input = [];
    if (memory.errors >= 3) {
      memory.running = false;
      memory.acceptInput = false;
      await claimReward('memory', memory.level * 12, memory.level * 3000);
      return;
    }
    await flashSequence();
    return;
  }

  if (memory.input.length === memory.sequence.length) {
    memory.level += 1;
    memory.sequence.push(Math.floor(Math.random() * 4));
    await flashSequence();
  }
}

async function createCoopRoom() {
  try {
    const response = await fetch('/api/game/minigames/coop/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, gameType: 'coop_reflex' })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No s’ha pogut crear la sala.');
    await ensureWsConnected();
    coop.room = data.room;
    coop.joinCode = data.room.roomCode;
    wsService.joinMiniCoop(coop.room.roomCode, userId, user.username || 'Jugador');
    startCoopPolling();
  } catch (error) {
    feedback.value = getApiErrorMessage(error, 'Error creant sala coop.');
  }
}

async function joinCoopRoom() {
  if (!coop.joinCode.trim()) return;
  try {
    const response = await fetch('/api/game/minigames/coop/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, roomCode: coop.joinCode.trim().toUpperCase() })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No s’ha pogut entrar a la sala.');
    await ensureWsConnected();
    coop.room = data.room;
    wsService.joinMiniCoop(coop.room.roomCode, userId, user.username || 'Jugador');
    startCoopPolling();
  } catch (error) {
    feedback.value = getApiErrorMessage(error, 'Error entrant a sala coop.');
  }
}

async function joinMatchmaking() {
  try {
    await ensureWsConnected();
    const response = await fetch('/api/game/minigames/coop/matchmaking/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, gameType: 'coop_reflex' })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'No s’ha pogut entrar a matchmaking.');
    if (data.matched && data.roomCode) {
      matchmaking.searching = false;
      coop.joinCode = data.roomCode;
      await joinCoopRoom();
      return;
    }
    matchmaking.searching = true;
    matchmaking.queueSize = Number(data.queueSize || 1);
    startMatchmakingPolling();
  } catch (error) {
    feedback.value = getApiErrorMessage(error, 'Error iniciant matchmaking.');
  }
}

async function leaveMatchmaking() {
  try {
    await fetch('/api/game/minigames/coop/matchmaking/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, gameType: 'coop_reflex' })
    });
  } catch {}
  matchmaking.searching = false;
  matchmaking.queueSize = 0;
  if (matchmaking.poll) clearInterval(matchmaking.poll);
  matchmaking.poll = null;
}

async function pollMatchmakingStatus() {
  if (!matchmaking.searching) return;
  const response = await fetch(`/api/game/minigames/coop/matchmaking/status/${encodeURIComponent(userId)}`);
  const data = await response.json();
  if (!response.ok || !data.success) return;
  if (data.matched && data.roomCode) {
    matchmaking.searching = false;
    coop.joinCode = data.roomCode;
    await joinCoopRoom();
    return;
  }
  matchmaking.queueSize = Number(data.queueSize || matchmaking.queueSize || 1);
}

function startMatchmakingPolling() {
  if (matchmaking.poll) clearInterval(matchmaking.poll);
  matchmaking.poll = setInterval(() => pollMatchmakingStatus().catch(() => {}), 3000);
}

async function pollCoopRoom() {
  if (!coop.room?.roomCode) return;
  const response = await fetch(`/api/game/minigames/coop/${encodeURIComponent(coop.room.roomCode)}`);
  const data = await response.json();
  if (response.ok && data.success) coop.room = data.room;
}

function startCoopPolling() {
  if (coop.poll) clearInterval(coop.poll);
  coop.poll = setInterval(() => pollCoopRoom().catch(() => {}), 10000);
}

async function setReady(ready) {
  if (!coop.room?.roomCode) return;
  const response = await fetch('/api/game/minigames/coop/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roomCode: coop.room.roomCode, ready })
  });
  const data = await response.json();
  if (response.ok && data.success) {
    coop.room = data.room;
    wsService.miniCoopReady(coop.room.roomCode, userId, user.username || 'Jugador', ready);
  }
}

function stopCoopRun() {
  coop.running = false;
  if (coop.timer) clearInterval(coop.timer);
  coop.timer = null;
}

function startCoopRun() {
  stopCoopRun();
  coop.running = true;
  coop.localScore = 0;
  coop.timeLeft = 15;
  coop.timer = setInterval(async () => {
    coop.timeLeft -= 1;
    if (coop.timeLeft <= 0) {
      stopCoopRun();
      await fetch('/api/game/minigames/coop/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roomCode: coop.room.roomCode, score: coop.localScore, ready: true })
      });
      wsService.miniCoopScore(coop.room.roomCode, userId, user.username || 'Jugador', coop.localScore);
      await claimReward('coop_reflex', coop.localScore * 8, 15000);
      await pollCoopRoom();
      await loadWeeklyLeaderboard();
    }
  }, 1000);
}

async function ensureWsConnected() {
  try {
    await wsService.connect();
  } catch {}
}

function setupMiniCoopRealtime() {
  wsService.on('miniCoopPresence', async (msg) => {
    if (!coop.room?.roomCode || msg.roomCode !== coop.room.roomCode) return;
    await pollCoopRoom();
  });
  wsService.on('miniCoopSignal', async (msg) => {
    if (!coop.room?.roomCode || msg.roomCode !== coop.room.roomCode) return;
    await pollCoopRoom();
  });
  wsService.on('miniMatchFound', async (msg) => {
    if (!matchmaking.searching) return;
    if (!msg?.roomCode) return;
    matchmaking.searching = false;
    coop.joinCode = String(msg.roomCode);
    await joinCoopRoom();
  });
}

onMounted(() => {
  if (!userId) {
    router.push('/login');
    return;
  }
  setupMiniCoopRealtime();
  loadProgress();
  loadWeeklyLeaderboard();
});

onBeforeUnmount(() => {
  stopReflex();
  stopCoopRun();
  if (coop.poll) clearInterval(coop.poll);
  if (matchmaking.poll) clearInterval(matchmaking.poll);
  leaveMatchmaking();
  if (coop.room?.roomCode) wsService.leaveMiniCoop(coop.room.roomCode);
});
</script>

<style scoped>
.mini-page { min-height: 100vh; padding: 20px; color: #efe8d8; background: radial-gradient(circle at 20% 10%, #1a1321 0%, #060709 60%, #020304 100%); }
.top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; }
.top h1 { margin: 0; color: #d4b06f; }
.btn { border: 1px solid #85693b; color: #f5e7c6; background: #141015; padding: 8px 12px; border-radius: 10px; cursor: pointer; }
.btn.ghost { opacity: .9; }
.progress-card,.panel { border: 1px solid rgba(212,176,111,.35); background: rgba(8,10,14,.86); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.progress-card { display: grid; grid-template-columns: 180px 1fr 280px; gap: 14px; align-items: center; }
.xp-bar { height: 10px; background: #1a1d24; border-radius: 99px; overflow: hidden; border: 1px solid #3a2f1d; }
.xp-fill { height: 100%; background: linear-gradient(90deg, #8d6b2e, #e1c27d); }
.hero-picker select,.panel input { width: 100%; background: #0f131a; color: #f1ead8; border: 1px solid #42311a; border-radius: 8px; padding: 8px; }
.tabs { display: flex; gap: 10px; margin-bottom: 10px; }
.tab { border: 1px solid #5b4623; background: #0f1116; color: #d7c49b; border-radius: 999px; padding: 8px 12px; cursor: pointer; }
.tab.active { background: #2b1f11; color: #ffe0a8; }
.arena { position: relative; height: 300px; border: 1px dashed #5a4320; border-radius: 12px; background: rgba(18,13,15,.7); overflow: hidden; }
.rune { position: absolute; transform: translate(-50%, -50%); width: 54px; height: 54px; border-radius: 50%; border: 1px solid #5c4a2d; background: #1b1d23; color: #f6e0ad; font-size: 24px; opacity: .25; }
.rune.active { opacity: 1; box-shadow: 0 0 30px rgba(244,199,120,.55); }
.row { display: flex; justify-content: space-between; gap: 10px; margin: 10px 0; }
.row.wrap { flex-wrap: wrap; justify-content: flex-start; }
.memory-grid { display: grid; grid-template-columns: repeat(2, 120px); gap: 10px; }
.memory-cell { width: 120px; height: 120px; border-radius: 16px; border: 1px solid #53452d; opacity: .65; }
.memory-cell.glow { opacity: 1; box-shadow: 0 0 22px rgba(255,255,255,.35); }
.memory-cell.c1 { background: #8a2d2d; } .memory-cell.c2 { background: #2c6a8e; } .memory-cell.c3 { background: #3a7b4d; } .memory-cell.c4 { background: #8b6b2f; }
.coop-box { border: 1px solid #473318; border-radius: 12px; padding: 12px; }
.big-hit { font-size: 1.2rem; padding: 14px 20px; }
.feedback { margin-top: 8px; color: #f3d39c; }
.muted { color: #b8ab8f; font-size: .92rem; margin: 4px 0 10px; }
.rank-table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.rank-table th,.rank-table td { border-bottom: 1px solid rgba(212,176,111,.16); padding: 8px; text-align: left; }
@media (max-width: 980px) { .progress-card { grid-template-columns: 1fr; } }
</style>
