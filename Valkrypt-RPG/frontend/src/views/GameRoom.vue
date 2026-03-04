<template>
  <div class="game-room">
    <div class="fx-layer bg-image" :style="{ backgroundImage: `url(${currentBackground})` }"></div>
    <div class="fx-layer vignette"></div>
    <div class="fx-layer grain"></div>

    <nav class="room-topbar">
      <button class="btn-top ghost" @click="goToLobby">MENU</button>

      <div class="room-meta">
        <small>SALA COOPERATIVA</small>
        <strong>{{ roomNameLabel }}</strong>
        <span>Codigo {{ roomCode }} · {{ roomPlayers.length }}/{{ maxPlayers }} jugadores</span>
      </div>

      <div class="top-actions">
        <button class="btn-top" @click="copyRoomCode">Copiar codigo</button>
        <button class="btn-top danger" @click="confirmLeaveRoom">Salir</button>
      </div>
    </nav>

    <div class="room-shell">
      <aside class="panel squad-panel">
        <header>
          <h2>Escuadra</h2>
          <span>{{ roomPlayers.length }} conectados</span>
        </header>

        <div class="squad-list">
          <article
            v-for="player in roomPlayers"
            :key="player.userId"
            class="player-card"
            :class="{
              me: isCurrentPlayer(player),
              host: isHostPlayer(player),
              active: currentTurnUserId === normalizedId(player.userId)
            }"
          >
            <div class="avatar">{{ playerInitials(player.username) }}</div>
            <div class="player-main">
              <strong>{{ player.username }}</strong>
              <small>
                {{ isHostPlayer(player) ? 'Host' : 'Miembro' }}
                <template v-if="isCurrentPlayer(player)"> · Tu</template>
              </small>
              <p class="meta-line">PJ: {{ player.character || 'sin personaje' }}</p>
              <p class="meta-line" :class="{ role: Boolean(playerRoleLabel(player)) }">
                Rol: {{ playerRoleLabel(player) || 'sin rol' }}
              </p>
            </div>
            <span class="presence">{{ currentTurnUserId === normalizedId(player.userId) ? 'Turno' : 'En sala' }}</span>
          </article>
        </div>
      </aside>

      <main class="panel command-panel">
        <header class="command-header">
          <div>
            <h2>Partida de grupo</h2>
            <p>{{ phaseDescription }}</p>
          </div>
          <span class="room-state" :class="roomStatusClass">{{ roomStatusLabel }}</span>
        </header>

        <section class="phase-panel">
          <div v-if="phase === 'role-selection'" class="role-phase">
            <div class="phase-banner">
              <strong>Fase de roles</strong>
              <span>Cada jugador debe elegir uno. Es obligatorio que exista un Lider.</span>
            </div>

            <div v-if="isMyCharacterMissing" class="character-setup">
              <label>Primero elige tu personaje:</label>
              <div class="character-row">
                <input
                  v-model="characterDraft"
                  type="text"
                  maxlength="40"
                  placeholder="Nombre del personaje"
                />
                <button class="btn-side" @click="saveCharacter" :disabled="savingCharacter || !characterDraft.trim()">
                  {{ savingCharacter ? 'Guardando...' : 'Guardar personaje' }}
                </button>
              </div>
            </div>

            <div class="roles-grid">
              <button
                v-for="role in roleCatalog"
                :key="role.id"
                class="role-card"
                :class="{
                  selected: myRoleId === role.id,
                  taken: roleTakenBy(role.id) && roleTakenBy(role.id) !== currentUserId
                }"
                :disabled="assigningRole || isMyCharacterMissing || (roleTakenBy(role.id) && roleTakenBy(role.id) !== currentUserId)"
                @click="assignRole(role.id)"
              >
                <strong>{{ role.label }}</strong>
                <small>{{ role.description }}</small>
                <span v-if="roleTakenBy(role.id)">
                  {{ roleTakenBy(role.id) === currentUserId ? 'Tu rol' : `Asignado a ${usernameById(roleTakenBy(role.id))}` }}
                </span>
              </button>
            </div>
          </div>

          <div v-else-if="phase === 'active'" class="turn-phase">
            <div class="turn-banner" :class="{ mine: isMyTurn }">
              <strong>{{ isMyTurn ? 'Es tu turno' : `Turno de ${currentTurnUsername}` }}</strong>
              <span>Dia {{ day }} / {{ dayLimit }} · Ronda {{ turnRound }}</span>
            </div>

            <div class="metrics-grid">
              <article>
                <small>PROGRESO</small>
                <strong>{{ metrics.progress }}</strong>
              </article>
              <article>
                <small>AMENAZA</small>
                <strong>{{ metrics.threat }}</strong>
              </article>
              <article>
                <small>MORAL</small>
                <strong>{{ metrics.morale }}</strong>
              </article>
            </div>

            <div class="scene-box">
              <h3>{{ sceneTitle }}</h3>
              <p>{{ sceneText }}</p>
            </div>

            <div class="choices-grid">
              <button
                v-for="choice in currentChoices"
                :key="choice.id"
                class="btn-action"
                :disabled="submittingChoice || !isMyTurn"
                @click="playChoice(choice.id)"
              >
                <strong>{{ choice.label }}</strong>
                <small>{{ choice.outcome }}</small>
              </button>
            </div>
          </div>

          <div v-else-if="phase === 'completed'" class="completed-phase">
            <div class="phase-banner done">
              <strong>Capitulo finalizado</strong>
              <span>{{ sceneText }}</span>
            </div>
            <button v-if="isHost" class="btn-side success" @click="startMultiplayerGame">Reiniciar partida</button>
          </div>

          <div v-else class="waiting-phase">
            <div class="phase-banner">
              <strong>Sala en espera</strong>
              <span>El anfitrion debe iniciar la partida para comenzar la fase de roles.</span>
            </div>
            <button v-if="isHost" class="btn-side success" @click="startMultiplayerGame">Iniciar partida de grupo</button>
          </div>
        </section>

        <section class="log-panel" ref="logContainer">
          <article
            v-for="entry in missionLog"
            :key="entryKey(entry)"
            class="log-line"
            :class="entryCssType(entry)"
          >
            <span class="tag">{{ entryTag(entry) }}</span>
            <p>{{ entryText(entry) }}</p>
          </article>
          <p v-if="missionLog.length === 0" class="log-empty">Sin actividad aun.</p>
        </section>

        <footer class="command-footer">
          <div class="chat-row">
            <input
              v-model="chatMessage"
              @keydown.enter="sendChat"
              type="text"
              maxlength="400"
              class="chat-input"
              placeholder="Chat de sala para coordinar..."
            />
            <button @click="sendChat" class="btn-send" :disabled="!chatMessage.trim()">Enviar</button>
          </div>
        </footer>
      </main>

      <aside class="panel help-panel">
        <header>
          <h2>Flujo cooperativo</h2>
        </header>

        <ol class="steps">
          <li>Host inicia la partida de grupo.</li>
          <li>Todos eligen personaje y rol.</li>
          <li>Con roles completos, empieza el orden por prioridad.</li>
          <li>Cada turno el jugador activo escoge 1 eleccion.</li>
          <li>La partida termina por progreso, amenaza o limite de dias.</li>
        </ol>

        <div class="host-controls">
          <h3>Controles</h3>
          <button class="btn-side" @click="refreshRoom">Refrescar estado</button>
          <button v-if="isHost" class="btn-side success" @click="startMultiplayerGame">Iniciar / Reiniciar</button>
          <button v-if="isHost" class="btn-side warn" @click="deleteRoom">Eliminar sala</button>
          <button class="btn-side danger" @click="confirmLeaveRoom">Salir de sala</button>
        </div>
      </aside>
    </div>

    <div v-if="systemMessage" class="system-toast">{{ systemMessage }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { wsService } from '@/services/WebSocketService';

const route = useRoute();
const router = useRouter();
const API_URL = '/api';

const roomCode = ref(route.params.roomCode);
const currentUser = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const currentUserId = String(currentUser.value?.id || currentUser.value?._id || '').trim();
const token = localStorage.getItem('token');

const roomPlayers = ref([]);
const hostId = ref('');
const roomName = ref('Sala sin nombre');
const maxPlayers = ref(4);
const roomStatus = ref('waiting');
const roomData = ref(null);

const roleCatalog = ref([]);
const chatLog = ref([]);
const chatMessage = ref('');
const systemMessage = ref('');
const currentBackground = ref('');
const characterDraft = ref(String(currentUser.value?.character || '').trim());

const assigningRole = ref(false);
const submittingChoice = ref(false);
const savingCharacter = ref(false);

const logContainer = ref(null);
let refreshTimer = null;
const listenerDisposers = [];

const normalizedId = (value) => String(value || '').trim();

const phase = computed(() => roomData.value?.gameState?.phase || 'waiting');
const roleAssignments = computed(() => roomData.value?.gameState?.roleAssignments || {});
const currentTurnUserId = computed(() => normalizedId(roomData.value?.gameState?.currentTurnUserId));
const currentTurnIndex = computed(() => Number(roomData.value?.gameState?.currentTurnIndex || 0));
const turnRound = computed(() => Number(roomData.value?.gameState?.turnRound || 1));
const day = computed(() => Number(roomData.value?.gameState?.day || 1));
const dayLimit = computed(() => Number(roomData.value?.gameState?.dayLimit || 6));
const sceneTitle = computed(() => roomData.value?.gameState?.sceneTitle || 'Sala cooperativa');
const sceneText = computed(() => roomData.value?.gameState?.sceneText || 'Esperando instrucciones de la escuadra.');
const currentChoices = computed(() => Array.isArray(roomData.value?.gameState?.choices) ? roomData.value.gameState.choices : []);
const metrics = computed(() => roomData.value?.gameState?.metrics || { progress: 0, threat: 0, morale: 5 });

const isHost = computed(() => normalizedId(hostId.value) === currentUserId);
const isMyTurn = computed(() => phase.value === 'active' && currentTurnUserId.value === currentUserId);
const isMyCharacterMissing = computed(() => {
  const me = roomPlayers.value.find((player) => normalizedId(player.userId) === currentUserId);
  return !String(me?.character || '').trim();
});
const myRoleId = computed(() => roleAssignments.value?.[currentUserId] || null);

const roomNameLabel = computed(() => `${roomName.value || 'Sala'} · ${roomCode.value}`);
const roomStatusClass = computed(() => {
  if (phase.value === 'active') return 'in-progress';
  if (phase.value === 'role-selection') return 'roles';
  if (phase.value === 'completed') return 'done';
  return 'waiting';
});
const roomStatusLabel = computed(() => {
  if (phase.value === 'active') return 'Turnos activos';
  if (phase.value === 'role-selection') return 'Asignando roles';
  if (phase.value === 'completed') return 'Capitulo cerrado';
  return 'En espera';
});
const phaseDescription = computed(() => {
  if (phase.value === 'role-selection') return 'Asignad roles para construir el orden de turnos. Debe haber un Lider.';
  if (phase.value === 'active') return 'El jugador en turno elige una accion y avanza la historia del grupo.';
  if (phase.value === 'completed') return 'La partida de grupo ha terminado. El host puede reiniciarla.';
  return 'La sala esta en espera. El host debe iniciar la partida cooperativa.';
});

const currentTurnUsername = computed(() => usernameById(currentTurnUserId.value) || 'Escuadra');
const missionLog = computed(() => {
  const missionEntries = Array.isArray(roomData.value?.gameState?.log) ? roomData.value.gameState.log : [];
  return [...missionEntries, ...chatLog.value].slice(-140);
});

const playerInitials = (username) => {
  const value = String(username || '').trim();
  return value ? value.slice(0, 2).toUpperCase() : '??';
};

const usernameById = (userId) => {
  const player = roomPlayers.value.find((entry) => normalizedId(entry.userId) === normalizedId(userId));
  return player?.username || '';
};

const isCurrentPlayer = (player) => normalizedId(player?.userId) === currentUserId;
const isHostPlayer = (player) => normalizedId(player?.userId) === normalizedId(hostId.value);

const roleLabelById = (roleId) => {
  const catalog = Array.isArray(roleCatalog.value) ? roleCatalog.value : [];
  const role = catalog.find((entry) => String(entry.id) === String(roleId));
  return role?.label || '';
};

const playerRoleLabel = (player) => {
  const roleId = player?.role || roleAssignments.value?.[normalizedId(player?.userId)];
  return roleLabelById(roleId);
};

const roleTakenBy = (roleId) => {
  const entries = Object.entries(roleAssignments.value || {});
  const found = entries.find(([, assignedRoleId]) => String(assignedRoleId) === String(roleId));
  return found ? normalizedId(found[0]) : '';
};

const pushChatEntry = (username, message) => {
  chatLog.value.push({ type: 'chat', username, message, at: new Date().toISOString() });
  chatLog.value = chatLog.value.slice(-80);
  scrollToBottom();
};

const setToast = (message, ms = 3200) => {
  systemMessage.value = message;
  setTimeout(() => {
    if (systemMessage.value === message) systemMessage.value = '';
  }, ms);
};

const copyRoomCode = async () => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(roomCode.value);
      setToast(`Codigo ${roomCode.value} copiado.`);
      return;
    }
  } catch {
    // ignore
  }
  setToast(`Codigo de sala: ${roomCode.value}`);
};

const entryKey = (entry) => {
  const at = entry?.at || entry?.createdAt || Date.now();
  return `${entry?.type || 'item'}-${entry?.username || ''}-${entry?.choiceId || ''}-${String(at)}`;
};

const entryCssType = (entry) => {
  if (entry?.type === 'chat') return 'chat';
  if (entry?.type === 'turn') return 'action';
  return 'system';
};

const entryTag = (entry) => {
  if (entry?.type === 'chat') return 'CHAT';
  if (entry?.type === 'turn') return 'TURNO';
  return 'SISTEMA';
};

const entryText = (entry) => {
  if (entry?.type === 'chat') return `${entry.username}: ${entry.message}`;
  if (entry?.type === 'turn') {
    const actor = entry.username || 'Jugador';
    const choice = entry.choiceLabel || 'decision';
    const outcome = entry.outcome || '';
    return `${actor} eligio ${choice}. ${outcome}`;
  }
  return entry?.message || 'Evento de sistema';
};

const setupWebsocketListeners = () => {
  listenerDisposers.push(
    wsService.on('playerJoined', async (msg) => {
      setToast(`${msg.username} se ha unido a la sala.`);
      await refreshRoom();
    })
  );

  listenerDisposers.push(
    wsService.on('playerLeft', async (msg) => {
      setToast(`${msg.username} ha salido de la sala.`);
      await refreshRoom();
    })
  );

  listenerDisposers.push(
    wsService.on('chat', (msg) => {
      pushChatEntry(msg.username, msg.message);
    })
  );

  listenerDisposers.push(
    wsService.on('gameStarted', async (msg) => {
      setToast(`Partida iniciada por ${msg.username}.`);
      await refreshRoom();
    })
  );
};

const refreshRoom = async () => {
  try {
    const response = await axios.get(`${API_URL}/rooms/${roomCode.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.data?.success || !response.data?.room) {
      throw new Error('No se pudo cargar sala');
    }

    const room = response.data.room;
    roomData.value = room;
    roomPlayers.value = Array.isArray(room.players) ? room.players : [];
    hostId.value = room.hostId || '';
    roomName.value = room.roomName || 'Sala sin nombre';
    roomStatus.value = room.status || 'waiting';
    maxPlayers.value = Number(room.maxPlayers) || 4;

    const catalog = Array.isArray(room?.gameState?.roleCatalog) ? room.gameState.roleCatalog : [];
    roleCatalog.value = catalog.length > 0
      ? catalog
      : (Array.isArray(response.data?.roleCatalog) ? response.data.roleCatalog : roleCatalog.value);

    const me = roomPlayers.value.find((player) => normalizedId(player.userId) === currentUserId);
    if (me?.character && !String(currentUser.value?.character || '').trim()) {
      const localUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...localUser, character: me.character }));
      currentUser.value = JSON.parse(localStorage.getItem('user') || '{}');
    }

    await scrollToBottom();
  } catch (error) {
    console.error('fetch room error', error);
    router.push({ name: 'RoomLobby' });
  }
};

const initRoom = async () => {
  await refreshRoom();

  const alreadyInRoom = roomPlayers.value.some((player) => normalizedId(player.userId) === currentUserId);
  if (!alreadyInRoom) {
    try {
      const response = await axios.post(`${API_URL}/rooms/join`, {
        roomCode: roomCode.value,
        userId: currentUserId,
        username: currentUser.value.username,
        character: currentUser.value.character || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'No se pudo unir a la sala');
      }
    } catch (error) {
      setToast(error.response?.data?.message || 'No se pudo unir a la sala.');
      router.push({ name: 'RoomLobby' });
      return;
    }

    await refreshRoom();
  }
};

const saveCharacter = async () => {
  const value = characterDraft.value.trim();
  if (!value) return;

  savingCharacter.value = true;
  try {
    const response = await axios.post(`${API_URL}/rooms/character`, {
      roomCode: roomCode.value,
      userId: currentUserId,
      character: value
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'No se pudo guardar personaje');
    }

    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...localUser, character: value }));
    currentUser.value = JSON.parse(localStorage.getItem('user') || '{}');

    setToast('Personaje actualizado.');
    await refreshRoom();
  } catch (error) {
    setToast(error.response?.data?.message || error.message || 'No se pudo guardar personaje.');
  } finally {
    savingCharacter.value = false;
  }
};

const assignRole = async (roleId) => {
  assigningRole.value = true;
  try {
    const response = await axios.post(`${API_URL}/rooms/role`, {
      roomCode: roomCode.value,
      userId: currentUserId,
      roleId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'No se pudo asignar rol');
    }

    setToast(`Rol ${roleLabelById(roleId)} asignado.`);
    await refreshRoom();
  } catch (error) {
    setToast(error.response?.data?.message || error.message || 'No se pudo asignar rol.');
  } finally {
    assigningRole.value = false;
  }
};

const playChoice = async (choiceId) => {
  if (!isMyTurn.value) return;

  submittingChoice.value = true;
  try {
    const response = await axios.post(`${API_URL}/rooms/turn-choice`, {
      roomCode: roomCode.value,
      userId: currentUserId,
      choiceId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'No se pudo procesar la eleccion');
    }

    await refreshRoom();
  } catch (error) {
    setToast(error.response?.data?.message || error.message || 'No se pudo procesar la eleccion.');
  } finally {
    submittingChoice.value = false;
  }
};

const sendChat = () => {
  const text = chatMessage.value.trim();
  if (!text) return;
  wsService.sendChat(roomCode.value, currentUser.value.username, text);
  pushChatEntry(currentUser.value.username, text);
  chatMessage.value = '';
};

const startMultiplayerGame = async () => {
  if (!isHost.value) {
    setToast('Solo el host puede iniciar la partida.');
    return;
  }

  try {
    const response = await axios.post(`${API_URL}/rooms/start`, {
      roomCode: roomCode.value,
      userId: currentUserId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'No se pudo iniciar');
    }

    wsService.startGame(roomCode.value, currentUserId, currentUser.value.username);
    setToast(response.data?.message || 'Partida iniciada.');
    await refreshRoom();
  } catch (error) {
    setToast(error.response?.data?.message || error.message || 'No se pudo iniciar la partida.');
  }
};

const leaveRoom = async () => {
  try {
    await axios.post(`${API_URL}/rooms/leave`, {
      roomCode: roomCode.value,
      userId: currentUserId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('leave room error', error);
  }

  wsService.leaveRoom(roomCode.value);
  wsService.disconnect();
  router.push({ name: 'RoomLobby' });
};

const confirmLeaveRoom = () => {
  if (confirm('Seguro que quieres salir de la sala?')) leaveRoom();
};

const deleteRoom = async () => {
  if (!isHost.value) {
    setToast('Solo el host puede eliminar la sala.');
    return;
  }

  if (!confirm('Eliminar esta sala para todos?')) return;

  try {
    const response = await axios.post(`${API_URL}/rooms/delete`, {
      roomCode: roomCode.value,
      userId: currentUserId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'No se pudo eliminar la sala');
    }

    wsService.disconnect();
    router.push({ name: 'RoomLobby' });
  } catch (error) {
    setToast(error.response?.data?.message || error.message || 'No se pudo eliminar la sala.');
  }
};

const goToLobby = () => {
  router.push({ name: 'RoomLobby' });
};

const scrollToBottom = async () => {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
};

onMounted(async () => {
  if (!currentUserId || !currentUser.value?.username) {
    router.push('/login');
    return;
  }

  currentBackground.value = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'><rect fill='%23050505' width='1920' height='1080'/><defs><linearGradient id='g' x1='0' y1='0' x2='100' y2='100'><stop offset='0%25' style='stop-color:%23c5a059;stop-opacity:0.12'/><stop offset='100%25' style='stop-color:%23000;stop-opacity:0.5'/></linearGradient></defs><rect fill='url(%23g)' width='1920' height='1080'/></svg>";

  await initRoom();

  try {
    await wsService.connect();
    setupWebsocketListeners();
    wsService.joinRoom(roomCode.value, currentUserId, currentUser.value.username);
  } catch (error) {
    console.error('ws connect error', error);
    setToast('No se pudo conectar al chat de sala.');
  }

  refreshTimer = setInterval(refreshRoom, 3500);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  listenerDisposers.forEach((dispose) => {
    try { dispose(); } catch {
      // ignore
    }
  });
  wsService.disconnect();
});
</script>

<style scoped lang="scss" src="../styles/game-room.scss"></style>
