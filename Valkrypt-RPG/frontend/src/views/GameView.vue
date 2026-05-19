<template>
  <div class="game-viewport">
    <div class="fx-layer bg-image" :style="{ backgroundImage: `url(${resolvedCurrentBackground})` }"></div>
    <div class="fx-layer vignette"></div>
    <div class="fx-layer grain"></div>
    <div class="fx-layer aurora"></div>
    <div class="fx-layer halo"></div>
    <div class="fx-layer arcane"></div>
    <div class="fx-layer particles"></div>
    <div class="fx-layer embers"></div>
    <div class="fx-layer fog"></div>
    <div class="fx-layer void-rays"></div>
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
            <span>DIA {{ day }} / {{ dayLimit }}</span>
            <small class="slot-track">{{ currentSlotLabel }} · {{ actionsRemainingToday }} ACCIONS RESTANTS AVUI</small>
            <small class="days-track">QUEDEN {{ daysRemaining }} DIES</small>
          </div>
        </div>
      </div>
      <div class="nav-right">
        <button class="btn-hud alliance-btn" @click="showFriends = !showFriends">
          <i class="fas fa-shield-alt"></i>
          <span class="online-indicator">3</span>
          <span class="btn-label">ALIANCES</span>
        </button>
      </div>
    </nav>
    <div class="main-layout">
      <aside class="party-sidebar">
        <div class="sidebar-header">COMPANYS</div>
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
            <div class="hero-level">NV {{ hero.level || 1 }} · XP {{ hero.experience || 0 }}/{{ hero.nextLevelXp || 1 }}</div>
            <div class="hero-attrs">ATQ {{ hero.attack || 0 }} · DEF {{ hero.defense || 0 }} · MAG {{ hero.magic || 0 }} · AGI {{ hero.agility || 0 }}</div>
            <div class="hero-hp-text">HP {{ hero.hp }} / {{ hero.maxHp }}</div>
          </div>
        </div>
      </aside>
      <main class="game-stage" :class="{ 'combat-mode': Boolean(combatEncounter) }">
        <div class="log-container" ref="logContainer" :class="{ 'combat-log': Boolean(combatEncounter) }">
          <div v-for="(entry, index) in visibleHistory" :key="index" class="log-entry-wrapper">
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
            <span class="typing-text">EL NARRADOR ESTÀ FORJANT LA HISTÒRIA...</span>
          </div>
        </div>
        <TacticalCombatPanel
          v-if="combatEncounter"
          class="combat-scene-panel"
          :encounter="combatEncounter"
          :party="party"
          @sync-party="handleCombatPartySync"
          @end="handleCombatEnd"
        />
        <footer v-if="!combatEncounter" class="action-bar" :class="{ 'bar-disabled': (isTyping || isSubmittingAction) && !chapterEnded }">
          <div v-if="chapterEnded" class="chapter-end">
            <h3>FIN DEL CAPÍTULO</h3>
            <p>S'han esgotat els dies disponibles per a aquesta campanya. Pots tornar al bastió i preparar l'etapa següent.</p>
            <button class="btn-action-fantasy" @click="toggleMenu">
              TORNAR AL BASTIÓ
            </button>
          </div>
          <div v-else class="action-grid-wrap">
            <div class="action-grid">
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
                No hi ha decisions disponibles ara mateix. Espera la resposta següent del narrador.
              </p>
            </div>
            <form class="manual-action" @submit.prevent="handleManualAction">
              <input
                v-model="manualActionText"
                class="manual-input"
                type="text"
                maxlength="240"
                placeholder="Escribe acción o comando (/stealth, /talk, /attack, /help)..."
                :disabled="isTyping || isSubmittingAction || Boolean(combatEncounter)"
              />
              <button
                class="manual-submit"
                type="submit"
                :disabled="!manualActionText.trim() || isTyping || isSubmittingAction || Boolean(combatEncounter)"
              >Enviar</button>
            </form>
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
          <h3>ALIANCES ACTIVES</h3>
          <button class="close-btn" @click="showFriends = false">✕</button>
        </div>
        <div v-if="alliancePreview.length === 0" class="friends-empty">
          Encara no hi ha aliats carregats.
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
        <button class="btn-go-friends" @click="goToFriendsHub">VEURE PANELL COMPLET</button>
      </div>
    </transition>
  </div>
</template>
<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import TacticalCombatPanel from '../components/TacticalCombatPanel.vue';
import PartyInventoryPanel from '../components/PartyInventoryPanel.vue';
import { extractNarrativeText, parseEventTags, buildFallbackOptions, processFinalTags } from '../utils/gameNarrative';
import { normalizePartyState } from '../utils/partySystem';
import { DEFAULT_GAME_BACKGROUND, resolveCampaignImage } from '../assets/valkryptAssets';
const ACTION_TIMEOUT_MS = 15000;
const STREAM_TIMEOUT_MS = 90000;
const ACTION_MAX_RETRIES = 2;
const NARRATION_SYNC_MAX_RETRIES = 2;
const NARRATOR_STREAM_MAX_RETRIES = 1;
const MIN_PARTIAL_NARRATION_LENGTH = 80;
const COMBAT_STREAK_LIMIT = 2;
const DAY_SLOT_LABELS = ['MATÍ', 'TARDA', 'NIT'];
const router = useRouter();
const logContainer = ref(null);
const isTyping = ref(false);
const isSubmittingAction = ref(false);
const showFriends = ref(false);
const userId = ref(null);
const campaignId = ref('');
const campaignTitle = ref("LA SOMBRA DE PIEDRAPROFUNDA");
const locationName = ref("Carregant...");
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
const manualActionText = ref('');
const actionsSinceLastCombat = ref(0);
const combatEncounter = ref(null);
const visibleHistory = computed(() => (
  combatEncounter.value ? history.value.slice(-1) : history.value
));
const resolvedCurrentBackground = computed(() => resolveCampaignImage({
  campaignId: campaignId.value,
  title: campaignTitle.value,
  location: locationName.value,
  img: currentBackground.value
}, DEFAULT_GAME_BACKGROUND));
let partySyncTimer = null;
let partySyncPromise = null;
let partySyncDirty = false;
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
const narratorDebug = (level, message, meta = {}) => {
  if (!import.meta.env.DEV && (level === 'info' || level === 'log')) return;
  const logger = typeof console[level] === 'function' ? console[level].bind(console) : console.log.bind(console);
  logger(`[Narrator ${meta.requestId || 'unknown'}] ${message}`, meta);
};
const createNarratorError = (message, details = {}) => {
  const error = new Error(message);
  error.name = details.name || 'NarratorStreamError';
  Object.assign(error, details);
  return error;
};
const parseNarratorErrorResponse = async (response, fallbackRequestId = '') => {
  const data = await parseJsonResponse(response);
  return createNarratorError(
    data.error || `Stream ${response.status}`,
    {
      status: response.status,
      code: String(data.code || ''),
      retryable: Boolean(data.retryable),
      requestId: String(data.requestId || fallbackRequestId || '').trim()
    }
  );
};
const normalizeNarratorOrigin = (origin) => (
  origin === 'combat_resolution' ? 'combat_resolution' : 'action'
);
const isMeaningfulNarrativeText = (text) => String(text || '').trim().length >= MIN_PARTIAL_NARRATION_LENGTH;
const buildNarratorFailure = (error, requestId = '') => {
  const message = String(error?.message || error || '');
  const code = String(error?.code || '').trim();
  const failureRequestId = String(error?.requestId || requestId || '').trim();

  if (code) {
    if (code === 'stream_timeout') {
      return { code, retryable: true, requestId: failureRequestId };
    }
    if (code === 'client_abort') {
      return { code, retryable: true, requestId: failureRequestId };
    }
    if (code === 'gemini_rate_limited' || code === 'gemini_http_error' || code === 'stream_read_error' || code === 'gemini_empty_stream') {
      return { code, retryable: Boolean(error?.retryable ?? true), requestId: failureRequestId };
    }
    if (code === 'gemini_auth_error' || code === 'gemini_missing_api_key') {
      return { code, retryable: false, requestId: failureRequestId };
    }
    return { code, retryable: Boolean(error?.retryable), requestId: failureRequestId };
  }

  if (error?.name === 'AbortError') {
    return { code: 'stream_timeout', retryable: true, requestId: failureRequestId };
  }
  if (/socket hang up|ECONNRESET|network|Failed to fetch|Load failed|fetch failed/i.test(message)) {
    return { code: 'stream_read_error', retryable: true, requestId: failureRequestId };
  }
  if (/stream sin body|empty stream/i.test(message)) {
    return { code: 'gemini_empty_stream', retryable: true, requestId: failureRequestId };
  }
  return { code: 'internal_stream_error', retryable: Boolean(error?.retryable), requestId: failureRequestId };
};
const shouldRetryNarratorFailure = (failure, attempt, partialText = '') => (
  failure.retryable
  && attempt < NARRATOR_STREAM_MAX_RETRIES
  && !isMeaningfulNarrativeText(partialText)
);
const buildNarratorFallbackMessage = (failure, origin = 'action') => {
  if (origin === 'combat_resolution') {
    if (failure.code === 'stream_timeout') {
      return 'La resolución del combate tarda en aclararse. El resultado sigue registrado; vuelve a intentarlo en un instante.';
    }
    if (failure.code === 'stream_read_error') {
      return 'La resolución del combate se interrumpió por una pérdida de conexión. El resultado se mantiene; intenta reanudar la historia.';
    }
    return 'La crónica del desenlace se ha quebrado, pero el resultado del combate permanece. La expedición puede continuar.';
  }

  if (failure.code === 'stream_timeout') {
    return 'La voz del narrador tarda demasiado en responder. Inténtalo de nuevo en un instante.';
  }
  if (failure.code === 'gemini_rate_limited') {
    return 'El narrador está saturado por demasiadas voces. Espera unos segundos e inténtalo otra vez.';
  }
  if (failure.code === 'stream_read_error') {
    return 'El vínculo con el narrador se interrumpió. La expedición puede reanudarlo enseguida.';
  }
  if (failure.code === 'gemini_http_error' || failure.code === 'gemini_empty_stream') {
    return 'La visión llegó incompleta y el relato no pudo cerrarse. Inténtalo otra vez en unos segundos.';
  }
  if (failure.code === 'gemini_auth_error' || failure.code === 'gemini_missing_api_key') {
    return 'El narrador no puede responder por un fallo de invocación. Hará falta revisar el vínculo arcano antes de continuar.';
  }
  return 'El narrador calla por un instante. La expedición puede volver a intentarlo.';
};
const buildNarratorPartialNotice = (origin = 'action') => (
  origin === 'combat_resolution'
    ? 'La crónica se corta tras el desenlace, pero el resultado del combate permanece.'
    : 'La visión se interrumpe antes de cerrarse, pero el grupo comprende lo esencial.'
);
const buildCombatResolutionLog = (payload) => {
  const result = String(payload?.result || '').toLowerCase();
  const summary = String(payload?.summary || '');
  const enemyMatch = summary.match(/contra (.+?) \(/i);
  const enemyName = enemyMatch?.[1]?.trim() || 'la amenaza';
  if (result === 'victoria') return `Combate resuelto: victoria contra ${enemyName}.`;
  if (result === 'derrota') return `Combate resuelto: retirada ante ${enemyName}.`;
  return `Combate resuelto: ${enemyName}.`;
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
  campaignId.value = save.campaignId || campaignId.value;
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
      throw new Error(data.error || `Error en sincronitzar narració (${response.status})`);
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
    console.error("No s'ha pogut sincronitzar la narració a DB:", lastError);
  }
};
const MANUAL_COMMANDS = {
  stealth: { type: 'narrative', label: 'Avanzar en sigilo absoluto y observar antes de actuar' },
  talk: { type: 'narrative', label: 'Intentar diálogo, negociación o engaño con el objetivo presente' },
  attack: { type: 'combat', label: 'Atacar de inmediato para tomar la iniciativa' },
  scout: { type: 'narrative', label: 'Explorar el terreno y buscar rutas, trampas o amenazas' },
  defend: { type: 'narrative', label: 'Fortificar posición y preparar defensa del grupo' },
  use: { type: 'narrative', label: 'Usar recurso u objeto del inventario en este turno' },
  magic: { type: 'narrative', label: 'Canalizar magia para alterar la situación actual' },
  flee: { type: 'narrative', label: 'Intentar retirada táctica y romper contacto' },
  help: { type: 'narrative', label: 'Ayuda de comandos: /stealth /talk /attack /scout /defend /use /magic /flee' }
};

const parseManualActionInput = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (!raw.startsWith('/')) {
    return {
      id: `manual_${Date.now()}`,
      type: 'narrative',
      label: raw
    };
  }

  const body = raw.slice(1).trim();
  if (!body) return null;

  const [commandRaw, ...restParts] = body.split(/\s+/);
  const command = String(commandRaw || '').toLowerCase();
  const argText = restParts.join(' ').trim();
  const preset = MANUAL_COMMANDS[command];

  if (!preset) {
    return {
      id: `manual_unknown_${Date.now()}`,
      type: 'narrative',
      label: `Comando desconocido (${command}). Usa /help para ver comandos disponibles.`
    };
  }

  if (command === 'help') {
    return {
      id: `manual_help_${Date.now()}`,
      type: 'narrative',
      label: preset.label
    };
  }

  const finalLabel = argText ? `${preset.label}. Contexto: ${argText}` : preset.label;
  return {
    id: `manual_${command}_${Date.now()}`,
    type: preset.type,
    label: finalLabel
  };
};

const inferOptionsFromNarrative = (narrativeText, eventMeta = {}) => {
  const safe = String(narrativeText || '').toLowerCase();
  const options = [];
  const pushUnique = (id, label, type = 'narrative') => {
    if (!label) return;
    if (options.some((opt) => opt.label.toLowerCase() === label.toLowerCase())) return;
    options.push({ id, label, type });
  };

  if (eventMeta?.combate || /(enemig|bestia|embosc|ataque|hostil|combate|sangre|asalto)/i.test(safe)) {
    pushUnique('combatir_frente', 'Atacar de frente y tomar la iniciativa', 'combat');
    pushUnique('cobertura_tactica', 'Buscar cobertura y preparar una respuesta táctica', 'narrative');
    pushUnique('repliegue_ordenado', 'Replegarse de forma ordenada para reagruparse', 'narrative');
  }

  if (/(ruina|altar|puerta|run|inscrip|pasadizo|túnel|tunel|cueva|mina|templo)/i.test(safe)) {
    pushUnique('inspeccionar_rastro', 'Inspeccionar las marcas y rastros del entorno', 'narrative');
    pushUnique('investigar_punto', 'Investigar el punto clave mencionado por el narrador', 'narrative');
  }

  if (/(frio|noche|niebla|oscur|tormenta|veneno|fatiga|herid|moral|hambre)/i.test(safe)) {
    pushUnique('asegurar_campamento', 'Asegurar posición y reforzar al grupo', 'narrative');
    pushUnique('revisar_estado', 'Revisar estado del escuadrón y recursos críticos', 'narrative');
  }

  if (options.length < 3) {
    const fallback = buildFallbackOptions(Boolean(eventMeta?.combate));
    fallback.forEach((opt) => pushUnique(opt.id, opt.label, opt.type));
  }

  return options.slice(0, 3);
};
const deriveNarrationOptions = (rawOutput, narrativeText) => {
  const eventMeta = parseEventTags(rawOutput || narrativeText, locationName.value);
  const parsedOptions = processFinalTags(rawOutput || '', eventMeta);
  const adaptiveOptions = inferOptionsFromNarrative(narrativeText, eventMeta);
  return {
    eventMeta,
    nextOptions: parsedOptions.length > 0
      ? parsedOptions
      : (adaptiveOptions.length > 0 ? adaptiveOptions : buildFallbackOptions(Boolean(eventMeta?.combate)))
  };
};

const handleManualAction = async () => {
  const text = String(manualActionText.value || '').trim();
  if (!text || isTyping.value || isSubmittingAction.value || chapterEnded.value || combatEncounter.value) return;
  manualActionText.value = '';

  const parsedAction = parseManualActionInput(text);
  if (!parsedAction) return;

  if (String(parsedAction.label || '').startsWith('Comando desconocido')) {
    history.value.push({ type: 'narrative', content: parsedAction.label });
    await scrollToBottom();
    return;
  }

  if (String(parsedAction.label || '').startsWith('Ayuda de comandos:')) {
    history.value.push({ type: 'narrative', content: parsedAction.label });
    await scrollToBottom();
    return;
  }

  await handleAction(parsedAction);
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
      throw new Error(data.error || `Error en processar l'acció (${response.status})`);
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
  throw lastError || new Error("No s'ha pogut processar l'acció.");
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
    console.error("Error crític de càrrega:", err);
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
        statusLabel: status === 'online' ? 'Connectat' : 'Desconnectat'
      };
    })
    .filter(Boolean)
    .slice(0, 8);
};

const engineSessionId = () => {
  if (!userId.value) return '';
  return `game_${String(userId.value)}`;
};

const pushEngineContext = async (role, content) => {
  const sessionId = engineSessionId();
  const text = String(content || '').trim();
  if (!sessionId || !text || !userId.value) return;
  try {
    await fetch(`/api/engine/contexts/${encodeURIComponent(sessionId)}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId.value,
        role,
        content: text
      })
    });
  } catch (error) {
    console.error('Error sincronitzant context del motor:', error);
  }
};

const restoreEngineContext = async () => {
  const sessionId = engineSessionId();
  if (!sessionId || !userId.value) return;
  try {
    const response = await fetch(`/api/engine/contexts/${encodeURIComponent(sessionId)}?userId=${encodeURIComponent(userId.value)}`);
    if (!response.ok) return;
    const data = await response.json();
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    if (messages.length === 0) return;
    const restored = messages.map((entry) => ({
      type: entry.role === 'model' ? 'narrative' : 'action',
      content: String(entry.content || '')
    })).filter((entry) => entry.content);
    if (restored.length > 0 && history.value.length === 0) {
      history.value = restored;
      await scrollToBottom();
    }
  } catch (error) {
    console.error('Error restaurant context del motor:', error);
  }
};
const currentPartySnapshot = () => normalizePartyState(
  Array.isArray(party.value) ? party.value : []
);
const syncPartySnapshot = async (snapshot = currentPartySnapshot()) => {
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
              party: snapshot
            }
          }
        })
      },
      ACTION_TIMEOUT_MS
    );
    const data = await parseJsonResponse(response);
    if (response.ok) {
      return true;
    }
    throw new Error(data.error || `Error party_sync ${response.status}`);
  } catch (err) {
    console.error("No s'ha pogut sincronitzar el grup:", err);
    partySyncDirty = true;
    return false;
  }
};
const runPartySync = async () => {
  while (partySyncDirty) {
    partySyncDirty = false;
    const snapshot = currentPartySnapshot();
    const success = await syncPartySnapshot(snapshot);
    if (!success) break;
  }
};
const ensurePartySync = async () => {
  if (partySyncPromise) return partySyncPromise;
  partySyncPromise = runPartySync().finally(() => {
    partySyncPromise = null;
  });
  return partySyncPromise;
};
const flushPartySync = async () => {
  if (partySyncTimer) {
    clearTimeout(partySyncTimer);
    partySyncTimer = null;
  }
  if (!partySyncDirty && !partySyncPromise) return;
  await ensurePartySync();
};
const schedulePartySync = () => {
  partySyncDirty = true;
  if (partySyncTimer) clearTimeout(partySyncTimer);
  partySyncTimer = setTimeout(() => {
    partySyncTimer = null;
    ensurePartySync();
  }, 350);
};
const handleInventoryLog = (message) => {
  if (!message) return;
  history.value.push({ type: 'action', content: `Inventari: ${message}` });
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
    party.value = normalizePartyState(payload.partySnapshot);
  }
  history.value.push({ type: 'combat', content: buildCombatResolutionLog(payload) });
  await scrollToBottom();
  const resolutionRequestId = generateRequestId();
  await callNarrator(
    payload.summary || 'El combate ha concluido y la escuadra evalúa sus siguientes pasos.',
    resolutionRequestId,
    { allowTacticalCombat: false, forceCombatOverride: false, origin: 'combat_resolution' }
  );
};
const handleAction = async (option) => {
  if (isTyping.value || isSubmittingAction.value || chapterEnded.value || combatEncounter.value) return;
  const requestId = generateRequestId();
  isSubmittingAction.value = true;
  try {
    await flushPartySync();
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
    await pushEngineContext('user', option.label || option.id || 'acció');
    await callNarrator(option.label, requestId);
  } catch (err) {
    console.error("Error en acció:", err);
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
  const origin = normalizeNarratorOrigin(config.origin);
  const filteredHistory = history.value.filter((entry) => (
    origin !== 'combat_resolution' || entry?.type !== 'combat'
  ));
  const narratorPayload = {
    playerAction,
    storyHistory: filteredHistory.map(h => ({
      role: h.type === 'narrative' ? 'model' : 'user',
      text: h.content
    })),
    worldSeed: `Contexto: ${locationName.value}. Día ${day.value} de ${dayLimit.value}, tramo ${currentSlotLabel.value}. Días restantes: ${daysRemaining.value}`,
    forceCombat,
    requestId,
    origin
  };

  let fullOutput = '';
  let recoveredFromPartial = false;
  try {
    for (let attempt = 0; attempt <= NARRATOR_STREAM_MAX_RETRIES; attempt += 1) {
      const attemptStartedAt = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
      let firstChunkAt = 0;

      try {
        narratorDebug('info', 'stream_start', { requestId, origin, attempt, forceCombat });
        const response = await fetch('/api/game/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(narratorPayload),
          signal: controller.signal
        });
        if (!response.ok) {
          throw await parseNarratorErrorResponse(response, requestId);
        }
        if (!response.body) {
          throw createNarratorError('Stream sin body', {
            code: 'gemini_empty_stream',
            retryable: true,
            requestId
          });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        if (!aiEntry) {
          aiEntry = { type: 'narrative', content: '' };
          history.value.push(aiEntry);
        }

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!firstChunkAt) {
            firstChunkAt = Date.now();
            narratorDebug('info', 'first_chunk', {
              requestId,
              origin,
              attempt,
              latencyMs: firstChunkAt - attemptStartedAt
            });
          }
          const chunk = decoder.decode(value, { stream: true });
          fullOutput += chunk;
          aiEntry.content = extractNarrativeText(fullOutput);
          await scrollToBottom();
        }

        clearTimeout(timeoutId);
        const narrativeText = extractNarrativeText(fullOutput);
        aiEntry.content = narrativeText || aiEntry.content;
        await pushEngineContext('model', aiEntry.content || narrativeText || '');
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
            content: "Combat tàctic iniciat. Gestiona torns, tirades i accions de l'esquadra al panell de batalla."
          });
          narratorDebug('info', 'stream_complete_combat', {
            requestId,
            origin,
            durationMs: Date.now() - attemptStartedAt,
            firstChunkLatencyMs: firstChunkAt ? firstChunkAt - attemptStartedAt : null
          });
          await scrollToBottom();
          return;
        }

        const { nextOptions } = deriveNarrationOptions(fullOutput, narrativeText || aiEntry.content);
        currentOptions.value = nextOptions;
        await syncNarration(requestId, narrativeForSync, nextOptions);
        narratorDebug('info', 'stream_complete', {
          requestId,
          origin,
          durationMs: Date.now() - attemptStartedAt,
          firstChunkLatencyMs: firstChunkAt ? firstChunkAt - attemptStartedAt : null
        });
        await scrollToBottom();
        return;
      } catch (err) {
        clearTimeout(timeoutId);
        const partialText = extractNarrativeText(fullOutput || aiEntry?.content || '');
        const failure = buildNarratorFailure(err, requestId);

        narratorDebug('warn', 'stream_error', {
          requestId: failure.requestId || requestId,
          origin,
          attempt,
          code: failure.code,
          retryable: failure.retryable,
          hasPartialText: Boolean(partialText),
          message: String(err?.message || err || '')
        });

        if (shouldRetryNarratorFailure(failure, attempt, partialText)) {
          if (aiEntry) aiEntry.content = '';
          fullOutput = '';
          narratorDebug('warn', 'stream_retry_scheduled', {
            requestId: failure.requestId || requestId,
            origin,
            nextAttempt: attempt + 1
          });
          await wait(500 * (attempt + 1));
          continue;
        }

        if (isMeaningfulNarrativeText(partialText)) {
          const partialNotice = buildNarratorPartialNotice(origin);
          const recoveredNarrative = `${partialText}\n\n${partialNotice}`.trim();
          const { nextOptions } = deriveNarrationOptions(fullOutput || partialText, partialText);
          if (aiEntry) {
            aiEntry.content = recoveredNarrative;
          } else {
            history.value.push({ type: 'narrative', content: recoveredNarrative });
          }
          currentOptions.value = nextOptions;
          await pushEngineContext('model', recoveredNarrative);
          await syncNarration(requestId, recoveredNarrative, nextOptions);
          recoveredFromPartial = true;
          narratorDebug('warn', 'stream_recovered_from_partial', {
            requestId: failure.requestId || requestId,
            origin,
            code: failure.code,
            optionsCount: nextOptions.length
          });
          await scrollToBottom();
          return;
        }

        const fallbackMessage = buildNarratorFallbackMessage(failure, origin);
        const fallbackOptions = buildFallbackOptions(false);
        if (aiEntry) {
          aiEntry.content = fallbackMessage;
        } else {
          history.value.push({
            type: 'narrative',
            content: fallbackMessage
          });
        }
        currentOptions.value = fallbackOptions;
        await syncNarration(requestId, fallbackMessage, fallbackOptions);
        console.error('Error en stream:', {
          requestId: failure.requestId || requestId,
          origin,
          code: failure.code,
          retryable: failure.retryable,
          error: err
        });
        await scrollToBottom();
        return;
      }
    }
  } finally {
    if (recoveredFromPartial) {
      narratorDebug('info', 'stream_finalized_from_partial', { requestId, origin });
    }
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
  restoreEngineContext();
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
  width: 100vw; height: 100vh; height: 100dvh; background: radial-gradient(circle at 20% 10%, #120e1d 0%, #05050a 56%, #010103 100%);
  color: #eee; overflow: hidden; position: relative;
  display: flex; flex-direction: column;
}
.fx-layer {
  position: absolute; inset: 0; pointer-events: none;
  &.bg-image { background-size: cover; background-position: center; opacity: 0.3; transition: 2s; z-index: 1; }
  &.vignette { background: radial-gradient(circle, transparent 18%, rgba(0,0,0,.95) 100%); z-index: 2; }
  &.aurora { background: radial-gradient(circle at 25% 30%, rgba(92,58,160,.26), transparent 42%), radial-gradient(circle at 70% 65%, rgba(197,160,89,.14), transparent 36%); filter: blur(18px); animation: auroraShift 16s ease-in-out infinite alternate; z-index: 3; }
  &.halo { background: radial-gradient(circle at center, rgba(197,160,89,.10), transparent 60%); animation: haloPulse 4.5s ease-in-out infinite; z-index: 3; }
  &.grain { background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.05; z-index: 3; }

  &.arcane {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'%3E%3Cg fill='none' stroke='%23c5a059' stroke-opacity='.28'%3E%3Ccircle cx='240' cy='240' r='165'/%3E%3Ccircle cx='240' cy='240' r='118'/%3E%3Cpath d='M240 46l48 83h-96zM240 434l-48-83h96zM46 240l83-48v96zM434 240l-83 48v-96z'/%3E%3C/g%3E%3C/svg%3E");
    background-size: 520px 520px;
    opacity: .12;
    animation: runeSpin 65s linear infinite;
    mix-blend-mode: plus-lighter;
    z-index: 3;
  }
  &.particles {
    background-image: radial-gradient(circle, rgba(197,160,89,.65) 1px, transparent 1px);
    background-size: 12px 12px;
    opacity: .07;
    animation: particlesRise 24s linear infinite;
    z-index: 3;
  }
  &.embers {
    background-image: radial-gradient(circle, rgba(255,133,58,.95) 1px, transparent 1px), radial-gradient(circle, rgba(255,214,138,.65) 1px, transparent 1px);
    background-size: 220px 220px, 280px 280px;
    opacity: .16;
    animation: embersFloat 18s linear infinite;
    mix-blend-mode: screen;
    z-index: 3;
  }
  &.fog {
    background: radial-gradient(ellipse at 16% 84%, rgba(107, 79, 146, 0.22), transparent 52%), radial-gradient(ellipse at 84% 18%, rgba(43, 69, 122, 0.18), transparent 58%);
    filter: blur(36px);
    animation: fogDrift 15s ease-in-out infinite alternate;
    z-index: 3;
  }
  &.void-rays {
    background: conic-gradient(from 0deg at 50% 50%, rgba(84,56,140,.18), transparent 18%, rgba(197,160,89,.12) 33%, transparent 54%, rgba(121,49,86,.15) 72%, transparent 90%);
    mix-blend-mode: screen;
    opacity: .45;
    animation: raysSpin 24s linear infinite;
    z-index: 3;
  }
  &.scanlines { background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02)); background-size: 100% 4px, 3px 100%; z-index: 4; }
}
.hud-top {
  height: 78px; display: flex; justify-content: space-between; align-items: center;
  padding: 0 32px; border: 1px solid rgba($gold, .25); z-index: 10;
  background: linear-gradient(180deg, rgba(0,0,0,0.84), rgba(0,0,0,0.35));
  border-radius: 22px;
  margin: 10px 14px 0;
  box-shadow: 0 16px 40px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
  backdrop-filter: blur(10px);
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
  border-radius: 10px;
  box-shadow: 0 8px 18px rgba(0,0,0,.25);
  background: rgba(20,20,20,0.6); border: 1px solid $border-alpha; color: $gold;
  padding: 10px 16px; font-family: 'Cinzel'; cursor: pointer; transition: 0.3s;
  display: flex; align-items: center; gap: 10px;
  &:hover { background: $gold; color: #000; border-color: $gold; }
}
.main-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  height: calc(100vh - 98px);
  perspective: 1400px;
  gap: 16px;
  padding: 14px 16px 12px;
  transform-style: preserve-3d;
  min-height: 0;
  position: relative;
  z-index: 5;
}
 .party-sidebar {
  background: linear-gradient(180deg, rgba(8,8,12,0.86), rgba(8,8,12,0.72)); backdrop-filter: blur(12px); border: 1px solid $border-alpha;
  border-radius: 22px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 25px 45px rgba(0,0,0,.35);
  transform: rotateY(2deg);
  padding: 30px 20px; display: flex; flex-direction: column; gap: 20px;
  overflow-y: auto;
  min-height: 0;
  .sidebar-header { font-family: 'Cinzel'; color: #555; font-size: 0.8rem; letter-spacing: 2px; text-align: center; }
}
 .hero-card {
  border-radius: 14px;
  background: rgba(12,12,18,0.88); border: 1px solid #222; padding: 15px; display: flex; gap: 15px;
  transition: 0.4s; position: relative;
  &:hover { border-color: $gold; transform: translateX(5px); background: rgba($gold, 0.05); }
  &.hero-dead { filter: grayscale(1); opacity: 0.4; }
  &:not(.hero-dead) { animation: pulseGold 2.6s infinite; }
  &.hero-dead { filter: grayscale(1); opacity: 0.4; }
  .hero-icon { font-size: 2rem; }
  .hp-bar-bg { width: 100%; height: 4px; background: #000; margin-top: 8px; border: 1px solid #333; }
  .hp-fill { height: 100%; background: linear-gradient(90deg, $crimson, #ff4d4d); transition: 1s ease-out; }
  .hero-name { font-family: 'Cinzel'; color: $gold; font-size: 1rem; }
  .hero-role { font-size: 0.7rem; color: #666; text-transform: uppercase; }
  .hero-level { font-size: 0.65rem; color: #8aa3d8; margin-top: 5px; }
  .hero-attrs { font-size: 0.62rem; color: #b8a57f; margin-top: 3px; line-height: 1.3; }
  .hero-hp-text { font-size: 0.7rem; color: #999; margin-top: 5px; }
}

.hero-card::before {
  content: "";
  position: absolute;
  inset: -2px;
  opacity: 0;
  background: conic-gradient(from 120deg, transparent 0deg, rgba(197,160,89,.24) 80deg, transparent 160deg);
  transition: .3s ease;
}
.hero-card:hover::before { opacity: 1; animation: sweep 1.4s linear infinite; }
.hero-card .hero-details, .hero-card .hero-avatar-wrapper { position: relative; z-index: 1; }

.game-stage {
  display: flex;
  flex-direction: column;
  margin: 0;
  width: 100%;
  height: 100%;
  border: 1px solid rgba($gold, .22);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(10, 9, 16, 0.82), rgba(8, 8, 12, 0.58));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 28px 55px rgba(0,0,0,.42);
  transform: translateZ(18px);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
  padding: 0 16px 12px;
  box-sizing: border-box;
}
.game-stage.combat-mode {
  border-radius: 20px;
  padding: 0 12px 12px;
  gap: 8px;
}
.inventory-dock {
  min-height: 0;
  border-radius: 26px;
  overflow: hidden;
  border: 1px solid rgba($gold,.26);
  background: linear-gradient(180deg, rgba(8, 8, 12, 0.84), rgba(8, 8, 12, 0.74));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 26px 44px rgba(0,0,0,.4), 0 0 0 1px rgba(197,160,89,.08);
  transform: rotateY(-4deg) translateZ(12px);
  position: relative;
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
  .log-entry-wrapper {
    perspective: 1200px;
  }
  .log-entry {
    border: 1px solid rgba($gold, 0.18);
    border-radius: 18px;
    background: linear-gradient(160deg, rgba(18,18,24,.74), rgba(10,10,14,.58));
    box-shadow: 0 16px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.03);
    padding: 18px 20px;
    transform-style: preserve-3d;
    animation: cardLift .7s ease;
  }
}
.log-container.combat-log {
  flex: 0 0 auto;
  max-height: 116px;
  overflow: hidden auto;
  padding: 14px 14px 4px;
  gap: 12px;
  mask-image: none;
}
.log-container.combat-log .log-entry {
  border-radius: 12px;
  padding: 12px 14px;
}
.log-container.combat-log .text-narrative {
  font-size: 1rem;
  line-height: 1.45;
  color: #d8cfbf;
}
.log-container.combat-log .text-combat {
  padding: 12px 14px;
}
.combat-scene-panel {
  flex: 1 1 0;
  min-height: 0;
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

.action-grid-wrap {
  display: grid;
  gap: 14px;
}
.manual-action {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid rgba($gold, 0.2);
  border-radius: 16px;
  background: rgba(6, 6, 10, 0.72);
}
.manual-input {
  width: 100%;
  border: 1px solid rgba($gold, 0.28);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.5);
  color: #e8d6af;
  padding: 11px 12px;
  font-family: 'Crimson Text', serif;
  font-size: 1rem;
  outline: none;
  transition: .2s ease;
}
.manual-input:focus {
  border-color: rgba($gold, 0.65);
  box-shadow: 0 0 0 3px rgba($gold, 0.15);
}
.manual-submit {
  border: 1px solid rgba($gold, 0.45);
  border-radius: 12px;
  background: linear-gradient(150deg, rgba(197,160,89,.20), rgba(84,56,140,.20));
  color: $gold-bright;
  padding: 10px 14px;
  font-family: 'Cinzel';
  font-size: 0.82rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: .25s ease;
}
.manual-submit:hover:enabled {
  transform: translateY(-1px);
  border-color: rgba($gold, .85);
}
.manual-submit:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.no-options {
  grid-column: 1 / -1;
  color: #777;
  text-align: center;
  font-family: 'Cinzel';
  font-size: 0.85rem;
}
 .btn-action-fantasy {
  border-radius: 18px;
  background: linear-gradient(170deg, rgba(18,18,26,.95), rgba(12,12,18,.86)); border: 1px solid rgba($gold,.22); color: #d3d3d3;
  padding: 19px; cursor: pointer; font-family: 'Cinzel'; transition: 0.36s cubic-bezier(.2,.8,.2,1);
  position: relative; overflow: hidden;
  box-shadow: 0 14px 28px rgba(0,0,0,.33), inset 0 1px 0 rgba(255,255,255,.04);
  transform-style: preserve-3d;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.12) 45%, transparent 72%);
    transform: translateX(-140%);
    transition: transform .7s ease;
  }
  &:hover {
    border-color: rgba($gold, .75);
    color: $gold;
    background: linear-gradient(170deg, rgba(30,24,12,.45), rgba(18,18,24,.88));
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 18px 34px rgba(0,0,0,.45), 0 0 22px rgba($gold,.2);
  }
  &:hover::before { transform: translateX(145%); }
  &.btn-danger:hover { border-color: rgba($crimson, .75); color: #ff7b7b; background: rgba($crimson, 0.12); box-shadow: 0 18px 34px rgba(0,0,0,.45), 0 0 20px rgba($crimson,.2); }
}

.inventory-dock::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 26px;
  background: linear-gradient(140deg, rgba(197,160,89,.14), transparent 28%, transparent 72%, rgba(100,64,165,.16));
  mix-blend-mode: screen;
}
:deep(.inventory-panel),
:deep(.inventory-sidebar),
:deep(.inventory-root) {
  border-radius: 24px !important;
  overflow: hidden;
}
:deep(.inventory-panel *),
:deep(.inventory-sidebar *) {
  border-radius: inherit;
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
@keyframes runeSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
@keyframes particlesRise { from { background-position: 0 0; } to { background-position: 0 -240px; } }
@keyframes pulseGold { 0%,100% { box-shadow: 0 0 0 0 rgba(197,160,89,0); } 50% { box-shadow: 0 0 16px 0 rgba(197,160,89,.25);} }
@keyframes auroraShift { from { transform: translate3d(-1.2%,0,0) scale(1); } to { transform: translate3d(1.4%,-1%,0) scale(1.06); } }
@keyframes haloPulse { 0%,100% { opacity: .7; } 50% { opacity: 1; } }
@keyframes sweep { from { transform: translateX(-35%) rotate(0deg); } to { transform: translateX(35%) rotate(360deg); } }
@keyframes embersFloat { from { background-position: 0 0, 0 0; } to { background-position: 0 -340px, 0 -220px; } }
@keyframes fogDrift { from { transform: translate3d(-1%, 0, 0) scale(1); opacity: .65; } to { transform: translate3d(1.8%, -1.5%, 0) scale(1.08); opacity: 1; } }
@keyframes cardLift { from { opacity: 0; transform: translateY(16px) rotateX(-5deg); } to { opacity: 1; transform: translateY(0) rotateX(0); } }
@keyframes raysSpin { from { transform: rotate(0deg) scale(1); } to { transform: rotate(360deg) scale(1.08); } }
.friends-panel {
  position: absolute; right: 12px; top: 12px; bottom: 12px; width: 350px;
  background: linear-gradient(180deg, rgba(8,8,14,0.95), rgba(8,8,14,0.88)); border: 1px solid rgba($gold,.4); z-index: 100; padding: 32px;
  border-radius: 24px;
  box-shadow: 0 24px 42px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
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
  .log-container.combat-log {
    max-height: 96px;
    padding-inline: 12px;
  }
  .log-container.combat-log .text-narrative {
    font-size: 0.92rem;
    line-height: 1.35;
  }
}
</style>
