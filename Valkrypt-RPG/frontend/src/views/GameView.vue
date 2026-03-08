<template>
  <div class="game-viewport">
    <div class="fx-layer bg-image" :style="{ backgroundImage: `url(${currentBackground || '/assets/default-bg.jpg'})` }"></div>
    <div class="fx-layer vignette"></div>
    <div class="fx-layer grain"></div>
    <div class="fx-layer scanlines"></div>
    <nav class="hud-top">
      <div class="nav-left">
        <button class="btn-hud main-menu-btn" @click="toggleMenu">
          <i class="fas fa-bars"></i>
          <span class="btn-label">MENÚ</span>
        </button>
      </div>
      <div class="nav-center">
        <div class="location-display">
          <div class="campaign-name">{{ campaignTitle }}</div>
          <div class="location-tag">
            <i class="fas fa-map-marker-alt"></i>
            <span>{{ locationName.toUpperCase() }}</span>
          </div>
          <div class="day-track">
            <span>DÍA {{ day }} / {{ dayLimit }}</span>
            <small class="slot-track">{{ currentSlotLabel }} · {{ actionsRemainingToday }} ACCIONES RESTANTES HOY</small>
            <small class="days-track">QUEDAN {{ daysRemaining }} DÍAS</small>
          </div>
        </div>
      </div>
      <div class="nav-right">
        <button class="btn-hud alliance-btn" @click="showFriends = !showFriends">
          <i class="fas fa-shield-alt"></i>
          <span class="online-indicator">3</span>
          <span class="btn-label">ALIANZAS</span>
        </button>
      </div>
    </nav>
    <div class="main-layout">
      <aside class="party-sidebar">
        <div class="sidebar-header">COMPAÑEROS</div>
        <div v-for="hero in party" :key="hero.id" class="hero-card" :class="{ 'hero-dead': hero.hp <= 0 }">
          <div class="hero-avatar-wrapper">
            <div class="hero-icon">{{ hero.icon }}</div>
            <div class="hp-container">
              <div class="hp-bar-bg">
                <div class="hp-fill" :style="{ width: (hero.hp / hero.maxHp) * 100 + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="hero-details">
            <div class="hero-name">{{ hero.name }}</div>
            <div class="hero-role">{{ hero.role }}</div>
            <div class="hero-hp-text">HP {{ hero.hp }} / {{ hero.maxHp }}</div>
          </div>
        </div>
      </aside>
      <main class="game-stage">
        <div class="log-container" ref="logContainer">
          <div v-for="(entry, index) in history" :key="index" class="log-entry-wrapper">
            <div :class="['log-entry', entry.type]">
              <div v-if="entry.type === 'narrative'" class="text-narrative">
                {{ entry.content }}
              </div>
              <div v-else-if="entry.type === 'combat'" class="text-combat">
                <div class="combat-icon"><i class="fas fa-skull-crossbones"></i></div>
                <div class="combat-text">{{ entry.content }}</div>
              </div>
              <div v-else-if="entry.type === 'action'" class="text-action">
                > {{ entry.content }}
              </div>
            </div>
          </div>
          <div v-if="isTyping" class="ai-typing">
            <div class="typing-loader">
              <span></span><span></span><span></span>
            </div>
            <span class="typing-text">EL NARRADOR ESTÁ FORJANDO LA HISTORIA...</span>
          </div>
        </div>
        <TacticalCombatPanel
          v-if="combatEncounter"
          :encounter="combatEncounter"
          :party="party"
          @sync-party="handleCombatPartySync"
          @end="handleCombatEnd"
        />
        <footer class="action-bar" :class="{ 'bar-disabled': (isTyping || isSubmittingAction) && !chapterEnded }">
          <div v-if="chapterEnded" class="chapter-end">
            <h3>FIN DEL CAPÍTULO</h3>
            <p>Se agotaron los días disponibles para esta campaña. Puedes volver al bastión y preparar la siguiente etapa.</p>
            <button class="btn-action-fantasy" @click="toggleMenu">
              VOLVER AL BASTIÓN
            </button>
          </div>
          <div v-else-if="combatEncounter" class="combat-waiting">
            <p>Combate táctico activo. Resuelve el turno en el panel de combate.</p>
          </div>
          <div v-else class="action-grid">
            <button 
              v-for="option in currentOptions" 
              :key="option.id" 
              @click="handleAction(option)" 
              class="btn-action-fantasy"
              :class="{ 'btn-danger': option.type === 'combat' }"
              :disabled="isTyping || isSubmittingAction || Boolean(combatEncounter)"
            >
              <span class="btn-inner">{{ option.label }}</span>
            </button>
            <p v-if="!isTyping && currentOptions.length === 0" class="no-options">
              Sin decisiones disponibles ahora mismo. Espera la siguiente respuesta del narrador.
            </p>
          </div>
        </footer>
      </main>
      <PartyInventoryPanel
        class="inventory-dock"
        :party="party"
        :combat-active="Boolean(combatEncounter)"
        @update-party="handlePartyUpdate"
        @log="handleInventoryLog"
      />
    </div>
    <transition name="panel-slide">
      <div v-if="showFriends" class="friends-panel">
        <div class="panel-header">
          <h3>ALIANZAS ACTIVAS</h3>
          <button class="close-btn" @click="showFriends = false">✕</button>
        </div>
        <div v-if="alliancePreview.length === 0" class="friends-empty">
          Sin aliados cargados todavía.
        </div>
        <div v-else class="friends-list">
          <div
            v-for="friend in alliancePreview"
            :key="friend.username"
            class="friend-card"
            :class="friend.status"
          >
            <div class="status-dot"></div>
            <div class="f-info">
              <strong>{{ friend.username }}</strong>
              <small>{{ friend.statusLabel }}</small>
            </div>
          </div>
        </div>
        <button class="btn-go-friends" @click="goToFriendsHub">VER PANEL COMPLETO</button>
      </div>
    </transition>
  </div>
</template>
<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import TacticalCombatPanel from '../components/TacticalCombatPanel.vue';
import PartyInventoryPanel from '../components/PartyInventoryPanel.vue';
import { extractNarrativeText, parseEventTags, buildFallbackOptions, processFinalTags } from '../utils/gameNarrative';
import { normalizePartyState } from '../utils/partySystem';
const ACTION_TIMEOUT_MS = 15000;
const STREAM_TIMEOUT_MS = 90000;
const ACTION_MAX_RETRIES = 2;
const NARRATION_SYNC_MAX_RETRIES = 2;
const COMBAT_STREAK_LIMIT = 2;
const DAY_SLOT_LABELS = ['MAÑANA', 'TARDE', 'NOCHE'];
const router = useRouter();
const logContainer = ref(null);
const isTyping = ref(false);
const isSubmittingAction = ref(false);
const showFriends = ref(false);
const userId = ref(null);
const campaignTitle = ref("LA SOMBRA DE PIEDRAPROFUNDA");
const locationName = ref("Cargando...");
const currentBackground = ref("");
const party = ref([]);
const history = ref([]);
const currentOptions = ref([]);
const day = ref(1);
const dayLimit = ref(30);
const daysRemaining = ref(29);
const slotIndex = ref(0);
const currentSlotLabel = ref(DAY_SLOT_LABELS[0]);
const actionsRemainingToday = ref(2);
const chapterEnded = ref(false);
const alliancePreview = ref([]);
const actionsSinceLastCombat = ref(0);
const combatEncounter = ref(null);
let partySyncTimer = null;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const generateRequestId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};
const fetchWithTimeout = async (url, options = {}, timeoutMs = ACTION_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};
const parseJsonResponse = async (response) => {
  const rawBody = await response.text();
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return { error: rawBody };
  }
};
const computeActionsSinceLastCombat = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  let streak = 0;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') continue;
    if (entry.type === 'combat') return streak;
    if (entry.type === 'action') streak += 1;
  }
  return streak;
};
const normalizeHistoryEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return entry;
  const cleanContent = typeof entry.content === 'string'
    ? entry.content
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
    : entry.content;
  return { ...entry, content: cleanContent };
};
const applySaveState = (save) => {
  if (!save || typeof save !== 'object') return;
  campaignTitle.value = save.campaignTitle || campaignTitle.value;
  locationName.value = save.locationName || locationName.value;
  currentBackground.value = save.currentBackground || currentBackground.value;
  party.value = Array.isArray(save.party) ? normalizePartyState(save.party) : party.value;
  history.value = Array.isArray(save.history) ? save.history.map(normalizeHistoryEntry) : history.value;
  currentOptions.value = Array.isArray(save.currentOptions) ? save.currentOptions : currentOptions.value;
  day.value = Number.isFinite(Number(save.day)) ? Number(save.day) : day.value;
  dayLimit.value = Number.isFinite(Number(save.dayLimit)) ? Number(save.dayLimit) : dayLimit.value;
  slotIndex.value = Number.isFinite(Number(save.slotIndex)) ? Number(save.slotIndex) : slotIndex.value;
  currentSlotLabel.value = String(save.slotLabel || DAY_SLOT_LABELS[slotIndex.value] || DAY_SLOT_LABELS[0]).toUpperCase();
  actionsRemainingToday.value = Number.isFinite(Number(save.actionsRemainingToday))
    ? Number(save.actionsRemainingToday)
    : Math.max(0, DAY_SLOT_LABELS.length - (slotIndex.value + 1));
  daysRemaining.value = Number.isFinite(Number(save.daysRemaining))
    ? Number(save.daysRemaining)
    : Math.max(0, dayLimit.value - day.value);
  chapterEnded.value = Boolean(
    save.chapterEnded ||
    save.chapterStatus === 'completed' ||
    (day.value >= dayLimit.value && currentOptions.value.length === 0)
  );
  actionsSinceLastCombat.value = computeActionsSinceLastCombat(history.value);
};
const syncNarration = async (requestId, narrativeText, options) => {
  if (!userId.value || !requestId) return;
  const payload = {
    userId: userId.value,
    action: {
      type: 'narration_sync',
      requestId,
      data: {
        requestId,
        narrative: narrativeText || '',
        options: Array.isArray(options) ? options : [],
        party: Array.isArray(party.value) ? party.value : []
      }
    }
  };
  let lastError = null;
  for (let attempt = 0; attempt <= NARRATION_SYNC_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        '/api/game/action',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        ACTION_TIMEOUT_MS
      );
      const data = await parseJsonResponse(response);
      if (response.ok) {
        applySaveState(data);
        return;
      }
      const canRetry = (response.status === 409 || data.retryable) && attempt < NARRATION_SYNC_MAX_RETRIES;
      if (canRetry) {
        await wait(300 * (attempt + 1));
        continue;
      }
      throw new Error(data.error || `Error al sincronizar narración (${response.status})`);
    } catch (err) {
      lastError = err;
      const canRetryNetwork = (err?.name === 'AbortError' || /fetch|network/i.test(String(err?.message || '')))
        && attempt < NARRATION_SYNC_MAX_RETRIES;
      if (canRetryNetwork) {
        await wait(300 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  if (lastError) {
    console.error('No se pudo sincronizar narración en DB:', lastError);
  }
};
const submitAction = async (optionPayload) => {
  let lastError = null;
  for (let attempt = 0; attempt <= ACTION_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        '/api/game/action',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId.value,
            action: optionPayload
          })
        },
        ACTION_TIMEOUT_MS
      );
      const data = await parseJsonResponse(response);
      if (response.ok) return data;
      const canRetry = (response.status === 409 || data.retryable) && attempt < ACTION_MAX_RETRIES;
      if (canRetry) {
        await wait(300 * (attempt + 1));
        continue;
      }
      throw new Error(data.error || `Error al procesar acción (${response.status})`);
    } catch (err) {
      lastError = err;
      const canRetryNetwork = (err?.name === 'AbortError' || /fetch|network/i.test(String(err?.message || '')))
        && attempt < ACTION_MAX_RETRIES;
      if (canRetryNetwork) {
        await wait(300 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  throw lastError || new Error('No se pudo procesar la acción.');
};
const fetchGameState = async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return router.push('/login');
  userId.value = user.id || user._id;
  try {
    const response = await fetch(`/api/game/load/${userId.value}`);
    const data = await response.json();
    if (response.ok) {
      applySaveState(data);
      await scrollToBottom();
    }
  } catch (err) {
    console.error("Error crítico de carga:", err);
  }
};
const loadAlliancePreview = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const rawFriends = Array.isArray(user?.friends) ? user.friends : [];
  alliancePreview.value = rawFriends
    .map((friend, index) => {
      const username = typeof friend === 'string' ? friend : friend?.username || '';
      if (!username) return null;
      const status = index % 3 === 0 ? 'online' : 'offline';
      return {
        username,
        status,
        statusLabel: status === 'online' ? 'Conectado' : 'Desconectado'
      };
    })
    .filter(Boolean)
    .slice(0, 8);
};
const syncPartySnapshot = async () => {
  if (!userId.value) return;
  const requestId = generateRequestId();
  try {
    const response = await fetchWithTimeout(
      '/api/game/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.value,
          action: {
            type: 'party_sync',
            requestId,
            data: {
              requestId,
              party: Array.isArray(party.value) ? party.value : []
            }
          }
        })
      },
      ACTION_TIMEOUT_MS
    );
    const data = await parseJsonResponse(response);
    if (response.ok) {
      if (Array.isArray(data.party)) {
        party.value = normalizePartyState(data.party);
      }
      return;
    }
    throw new Error(data.error || `Error party_sync ${response.status}`);
  } catch (err) {
    console.error('No se pudo sincronizar party:', err);
  }
};
const schedulePartySync = () => {
  if (partySyncTimer) clearTimeout(partySyncTimer);
  partySyncTimer = setTimeout(() => {
    syncPartySnapshot();
    partySyncTimer = null;
  }, 350);
};
const handleInventoryLog = (message) => {
  if (!message) return;
  history.value.push({ type: 'action', content: `Inventario: ${message}` });
  scrollToBottom();
};
const handlePartyUpdate = (nextParty) => {
  if (!Array.isArray(nextParty) || nextParty.length === 0) return;
  party.value = normalizePartyState(nextParty);
  schedulePartySync();
};
const handleCombatPartySync = (partySnapshot) => {
  if (!Array.isArray(partySnapshot) || partySnapshot.length === 0) return;
  party.value = normalizePartyState(partySnapshot);
  schedulePartySync();
};
const handleCombatEnd = async (payload) => {
  if (!payload || typeof payload !== 'object') return;
  combatEncounter.value = null;
  if (Array.isArray(payload.partySnapshot) && payload.partySnapshot.length > 0) {
    party.value = payload.partySnapshot;
  }
  if (Array.isArray(payload.transcript) && payload.transcript.length > 0) {
    payload.transcript.forEach((line) => {
      if (line) history.value.push({ type: 'combat', content: line });
    });
  }
  await scrollToBottom();
  const resolutionRequestId = generateRequestId();
  await callNarrator(
    payload.summary || 'El combate ha concluido y la escuadra evalúa sus siguientes pasos.',
    resolutionRequestId,
    { allowTacticalCombat: false, forceCombatOverride: false }
  );
};
const handleAction = async (option) => {
  if (isTyping.value || isSubmittingAction.value || chapterEnded.value || combatEncounter.value) return;
  const requestId = generateRequestId();
  isSubmittingAction.value = true;
  try {
    const payload = {
      ...option,
      requestId
    };
    const newState = await submitAction(payload);
    applySaveState(newState);
    if (newState.narratorEnabled === false || newState.chapterEnded) {
      await scrollToBottom();
      return;
    }
    await callNarrator(option.label, requestId);
  } catch (err) {
    console.error("Error en acción:", err);
    history.value.push({
      type: 'narrative',
      content: 'La acción se perdió entre las sombras del reino. Intenta de nuevo en unos segundos.'
    });
    await scrollToBottom();
  } finally {
    isSubmittingAction.value = false;
  }
};
const callNarrator = async (playerAction, requestId, config = {}) => {
  isTyping.value = true;
  let aiEntry = null;
  const allowTacticalCombat = config.allowTacticalCombat !== false;
  const forceCombat = typeof config.forceCombatOverride === 'boolean'
    ? config.forceCombatOverride
    : actionsSinceLastCombat.value >= COMBAT_STREAK_LIMIT;
  try {
    const response = await fetchWithTimeout(
      '/api/game/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAction,
          storyHistory: history.value.map(h => ({
            role: h.type === 'narrative' ? 'model' : 'user',
            text: h.content
          })),
          worldSeed: `Contexto: ${locationName.value}. Día ${day.value} de ${dayLimit.value}, tramo ${currentSlotLabel.value}. Días restantes: ${daysRemaining.value}`,
          forceCombat
        })
      },
      STREAM_TIMEOUT_MS
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stream ${response.status}: ${errorText}`);
    }
    if (!response.body) {
      throw new Error('Stream sin body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    aiEntry = { type: 'narrative', content: '' };
    history.value.push(aiEntry);
    let fullOutput = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullOutput += chunk;
      aiEntry.content = extractNarrativeText(fullOutput);
      await scrollToBottom();
    }
    const narrativeText = extractNarrativeText(fullOutput);
    aiEntry.content = narrativeText || aiEntry.content;
    const eventMeta = parseEventTags(fullOutput, locationName.value);
    let narrativeForSync = narrativeText;
    if (eventMeta.combate) {
      const combatLine = `Combate ${eventMeta.tipo}: ${eventMeta.enemigo} en ${eventMeta.entorno}.`;
      history.value.push({ type: 'combat', content: combatLine });
      narrativeForSync = narrativeText ? `${combatLine}\n${narrativeText}` : combatLine;
      actionsSinceLastCombat.value = 0;
    } else {
      actionsSinceLastCombat.value += 1;
    }
    if (!eventMeta.combate && forceCombat) {
      eventMeta.combate = true;
      eventMeta.tipo = 'escaramuza';
      eventMeta.enemigo = eventMeta.enemigo || 'patrulla hostil';
      eventMeta.entorno = eventMeta.entorno || locationName.value;
      const forcedCombatLine = `Combate ${eventMeta.tipo}: ${eventMeta.enemigo} en ${eventMeta.entorno}.`;
      history.value.push({ type: 'combat', content: forcedCombatLine });
      narrativeForSync = narrativeText ? `${forcedCombatLine}\n${narrativeText}` : forcedCombatLine;
      actionsSinceLastCombat.value = 0;
    }

    if (eventMeta.combate && allowTacticalCombat) {
      combatEncounter.value = {
        id: `cmb_${Date.now()}`,
        enemyName: eventMeta.enemigo,
        enemyType: eventMeta.tipo,
        environment: eventMeta.entorno,
        tone: eventMeta.tono || ''
      };
      currentOptions.value = [];
      await syncNarration(requestId, narrativeForSync, []);
      history.value.push({
        type: 'narrative',
        content: 'Combate táctico iniciado. Gestiona turnos, tiradas y acciones de tu escuadra en el panel de batalla.'
      });
      await scrollToBottom();
      return;
    }

    const parsedOptions = processFinalTags(fullOutput, eventMeta);
    const nextOptions = parsedOptions.length > 0 ? parsedOptions : buildFallbackOptions(eventMeta.combate);
    currentOptions.value = nextOptions;
    await syncNarration(
      requestId,
      narrativeForSync,
      nextOptions
    );
    await scrollToBottom();
  } catch (err) {
    console.error("Error en stream:", err);
    if (aiEntry) {
      aiEntry.content = aiEntry.content || 'El narrador calla por un instante. La expedición puede volver a intentarlo.';
    } else {
      history.value.push({
        type: 'narrative',
        content: 'El narrador calla por un instante. La expedición puede volver a intentarlo.'
      });
    }
    await scrollToBottom();
  } finally {
    isTyping.value = false;
  }
};
const scrollToBottom = async () => {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTo({
      top: logContainer.value.scrollHeight,
      behavior: 'smooth'
    });
  }
};
const toggleMenu = () => router.push('/userpage');
const goToFriendsHub = () => router.push('/friends');
onMounted(() => {
  loadAlliancePreview();
  fetchGameState();
});
</script>
<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital,wght@0,400;0,700;1,400&display=swap');
$gold: #c5a059;
$gold-bright: #f0d7a3;
$crimson: #8a1c1c;
$bg-dark: #050505;
$border-alpha: rgba(197, 160, 89, 0.2);
.game-viewport {
  width: 100vw; height: 100vh; height: 100dvh; background: $bg-dark;
  color: #eee; overflow: hidden; position: relative;
  display: flex; flex-direction: column;
}
.fx-layer {
  position: absolute; inset: 0; pointer-events: none;
  &.bg-image { background-size: cover; background-position: center; opacity: 0.3; transition: 2s; z-index: 1; }
  &.vignette { background: radial-gradient(circle, transparent 20%, #000 100%); z-index: 2; }
  &.grain { background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.05; z-index: 3; }
  &.scanlines { background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02)); background-size: 100% 4px, 3px 100%; z-index: 4; }
}
.hud-top {
  height: 70px; display: flex; justify-content: space-between; align-items: center;
  padding: 0 30px; border-bottom: 1px solid $border-alpha; z-index: 10;
  background: linear-gradient(to bottom, rgba(0,0,0,0.9), transparent);
  .location-display {
    text-align: center;
    .campaign-name { font-size: 0.7rem; color: #777; letter-spacing: 3px; font-family: 'Cinzel'; }
    .location-tag { color: $gold; font-family: 'Cinzel'; font-weight: bold; font-size: 1.1rem; text-shadow: 0 0 10px rgba($gold, 0.5); }
    .day-track {
      margin-top: 6px;
      color: #999;
      font-family: 'Cinzel';
      letter-spacing: 1px;
      span { font-size: 0.75rem; }
      small { display: block; }
      .slot-track {
        font-size: 0.72rem;
        color: $gold-bright;
        font-weight: 700;
        letter-spacing: 1px;
        text-shadow: 0 0 10px rgba($gold, 0.32);
      }
      .days-track {
        font-size: 0.67rem;
        color: rgba($gold, 0.82);
      }
    }
  }
}
.btn-hud {
  background: rgba(20,20,20,0.6); border: 1px solid $border-alpha; color: $gold;
  padding: 10px 20px; font-family: 'Cinzel'; cursor: pointer; transition: 0.3s;
  display: flex; align-items: center; gap: 10px;
  &:hover { background: $gold; color: #000; border-color: $gold; }
}
.main-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  height: calc(100vh - 70px);
  min-height: 0;
  position: relative;
  z-index: 5;
}
.party-sidebar {
  background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); border-right: 1px solid $border-alpha;
  padding: 30px 20px; display: flex; flex-direction: column; gap: 20px;
  overflow-y: auto;
  min-height: 0;
  .sidebar-header { font-family: 'Cinzel'; color: #555; font-size: 0.8rem; letter-spacing: 2px; text-align: center; }
}
.hero-card {
  background: rgba(15,15,15,0.8); border: 1px solid #222; padding: 15px; display: flex; gap: 15px;
  transition: 0.4s; position: relative;
  &:hover { border-color: $gold; transform: translateX(5px); background: rgba($gold, 0.05); }
  &.hero-dead { filter: grayscale(1); opacity: 0.4; }
  .hero-icon { font-size: 2rem; }
  .hp-bar-bg { width: 100%; height: 4px; background: #000; margin-top: 8px; border: 1px solid #333; }
  .hp-fill { height: 100%; background: linear-gradient(90deg, $crimson, #ff4d4d); transition: 1s ease-out; }
  .hero-name { font-family: 'Cinzel'; color: $gold; font-size: 1rem; }
  .hero-role { font-size: 0.7rem; color: #666; text-transform: uppercase; }
  .hero-hp-text { font-size: 0.7rem; color: #999; margin-top: 5px; }
}
.game-stage {
  display: flex;
  flex-direction: column;
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  padding: 0 16px 12px;
  box-sizing: border-box;
}
.inventory-dock {
  min-height: 0;
}
.log-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 32px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 30px;
  mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
  scrollbar-width: thin;
  scrollbar-color: rgba($gold, 0.45) rgba(0, 0, 0, 0.15);
  &::-webkit-scrollbar { width: 10px; }
  &::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
  &::-webkit-scrollbar-thumb { background: rgba($gold, 0.45); border-radius: 12px; }
  .text-narrative {
    font-family: 'Crimson Text', serif;
    font-size: 1.3rem;
    line-height: 1.8;
    color: #ccc;
    animation: fadeIn 1.5s ease;
    white-space: pre-line;
  }
  .text-combat { background: rgba($crimson, 0.1); border-left: 3px solid $crimson; padding: 20px; color: #ff6b6b; font-family: 'Cinzel'; }
  .text-action { font-family: 'Cinzel'; color: $gold; opacity: 0.7; font-size: 0.9rem; }
}
.ai-typing {
  display: flex; align-items: center; gap: 15px; color: $gold; font-family: 'Cinzel'; font-size: 0.8rem;
  .typing-loader { display: flex; gap: 5px; span { width: 4px; height: 4px; background: $gold; border-radius: 50%; animation: bounce 1.4s infinite; } }
}
.action-bar {
  flex: 0 0 auto;
  padding: 18px 0 10px;
  border-top: 1px solid rgba($gold, 0.18);
  background: linear-gradient(to top, rgba(3, 3, 3, 0.95), rgba(3, 3, 3, 0.15));
  max-height: 38vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba($gold, 0.45) rgba(0, 0, 0, 0.15);
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
  &::-webkit-scrollbar-thumb { background: rgba($gold, 0.45); border-radius: 10px; }
  &.bar-disabled { opacity: 0.5; pointer-events: none; }
  .action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
}
.chapter-end {
  text-align: center;
  border: 1px solid rgba($gold, 0.35);
  background: rgba($gold, 0.04);
  padding: 24px;
  h3 { font-family: 'Cinzel'; color: $gold; margin-bottom: 10px; letter-spacing: 2px; }
  p { color: #aaa; margin-bottom: 16px; font-size: 0.9rem; }
}
.no-options {
  grid-column: 1 / -1;
  color: #777;
  text-align: center;
  font-family: 'Cinzel';
  font-size: 0.85rem;
}
.combat-waiting {
  text-align: center;
  border: 1px solid rgba($crimson, 0.4);
  background: rgba($crimson, 0.08);
  color: #d9a8a8;
  padding: 14px;
  font-family: 'Cinzel';
  letter-spacing: 1px;
  font-size: 0.78rem;
}
.btn-action-fantasy {
  background: rgba(10,10,10,0.8); border: 1px solid #333; color: #aaa;
  padding: 18px; cursor: pointer; font-family: 'Cinzel'; transition: 0.4s;
  position: relative; overflow: hidden;
  &:hover { border-color: $gold; color: $gold; background: rgba($gold, 0.05); }
  &.btn-danger:hover { border-color: $crimson; color: #ff4d4d; background: rgba($crimson, 0.05); }
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
.friends-panel {
  position: absolute; right: 0; top: 0; bottom: 0; width: 350px;
  background: rgba(5,5,5,0.98); border-left: 1px solid $gold; z-index: 100; padding: 40px;
  overflow-y: auto;
  .panel-header { display: flex; justify-content: space-between; color: $gold; font-family: 'Cinzel'; margin-bottom: 30px; }
  .friends-empty { color: #777; font-family: 'Cinzel'; margin-bottom: 20px; font-size: 0.85rem; }
  .friend-card { display: flex; gap: 15px; align-items: center; margin-bottom: 20px; opacity: 0.6; &.online { opacity: 1; } }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #444; }
  .online .status-dot { background: #2ecc71; box-shadow: 0 0 5px #2ecc71; }
  .btn-go-friends {
    margin-top: 18px;
    width: 100%;
    border: 1px solid rgba($gold, 0.45);
    background: rgba($gold, 0.08);
    color: $gold;
    font-family: 'Cinzel';
    letter-spacing: 1px;
    padding: 12px;
    cursor: pointer;
    transition: 0.25s;
    &:hover { background: rgba($gold, 0.18); }
  }
  .close-btn { background: none; border: none; color: #fff; cursor: pointer; font-size: 1.5rem; }
}
.panel-slide-enter-active, .panel-slide-leave-active { transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(100%); }
@media (max-width: 1380px) {
  .main-layout {
    grid-template-columns: 250px minmax(0, 1fr) 290px;
  }
}
@media (max-width: 1180px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  .party-sidebar {
    display: none;
  }
  .inventory-dock {
    display: none;
  }
  .log-container .text-narrative {
    font-size: 1.13rem;
    line-height: 1.7;
  }
}
</style>
