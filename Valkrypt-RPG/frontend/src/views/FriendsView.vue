<template>
  <div class="friends-hub">
    <div ref="vantaHost" class="vanta-layer"></div>
    <div class="fx fog"></div>
    <div class="fx vignette"></div>
    <nav class="hub-nav">
      <router-link to="/userpage" class="back-link">← TORNAR AL BASTIÓ</router-link>
      <div class="nav-title">
        <small>VALKRYPT SOCIAL HUB</small>
        <h1>ALIANCES I MISSATGES</h1>
      </div>
      <button class="btn-nav" @click="goToLobby">OBRIR LOBBY</button>
    </nav>
    <section class="summary-grid">
      <article class="summary-card">
        <span class="label">ALIATS</span>
        <strong>{{ friends.length }}</strong>
      </article>
      <article class="summary-card online">
        <span class="label">ACTIUS</span>
        <strong>{{ onlineFriendsCount }}</strong>
      </article>
      <article class="summary-card warn">
        <span class="label">SOL·LICITUDS</span>
        <strong>{{ incomingRequests.length }}</strong>
      </article>
      <article class="summary-card">
        <span class="label">SALES OBERTES</span>
        <strong>{{ activeRooms.length }}</strong>
      </article>
    </section>
    <main class="hub-grid">
      <section class="panel social-panel">
        <header class="panel-head">
          <h2>Gestionar alianzas</h2>
          <button class="btn-nav secondary" :disabled="loadingSocial" @click="loadSocialState">
            {{ loadingSocial ? 'ACTUALIZANDO...' : 'REFRESCAR' }}
          </button>
        </header>
        <div class="add-friend-box">
          <h3>Buscar jugador</h3>
          <div class="add-friend-row">
            <input
              v-model="searchCandidate"
              type="text"
              class="search-input"
              placeholder="Nom d'usuari"
              @keydown.enter.prevent="performUserSearch"
            />
            <button class="btn-primary" :disabled="searchingUsers" @click="performUserSearch">
              {{ searchingUsers ? 'CERCANT...' : 'CERCAR' }}
            </button>
          </div>
          <div v-if="searchResults.length > 0" class="search-results">
            <article v-for="candidate in searchResults" :key="candidate" class="result-card">
              <span>{{ candidate }}</span>
              <button class="btn-primary" :disabled="sendingRequestTo === candidate" @click="sendFriendRequest(candidate)">
                {{ sendingRequestTo === candidate ? 'ENVIANT...' : 'ENVIAR SOL·LICITUD' }}
              </button>
            </article>
          </div>
          <p v-else-if="searchTouched && !searchingUsers" class="mini-note">
            No hi ha resultats amb aquest nom.
          </p>
        </div>
        <div class="requests-box">
          <h3>Solicitudes entrantes</h3>
          <div v-if="incomingRequests.length === 0" class="empty-note">No tienes solicitudes pendientes.</div>
          <div v-else class="request-list">
            <article v-for="username in incomingRequests" :key="username" class="request-card">
              <strong>{{ username }}</strong>
              <div class="request-actions">
                <button class="btn-accept" :disabled="processingRequest === username" @click="acceptFriendRequest(username)">ACCEPTAR</button>
                <button class="btn-reject" :disabled="processingRequest === username" @click="rejectFriendRequest(username)">REBUTJAR</button>
              </div>
            </article>
          </div>
        </div>
        <div class="requests-box outgoing">
          <h3>Solicitudes enviadas</h3>
          <div v-if="outgoingRequests.length === 0" class="empty-note">No tienes solicitudes enviadas.</div>
          <div v-else class="outgoing-list">
            <span v-for="username in outgoingRequests" :key="username" class="outgoing-pill">{{ username }}</span>
          </div>
        </div>
      </section>
      <section class="panel allies-panel">
        <header class="panel-head">
          <h2>Aliados</h2>
          <input v-model="friendFilter" type="text" class="search-input" placeholder="Filtrar aliats" />
        </header>
        <div v-if="filteredFriends.length === 0" class="empty-note">No hi ha aliats per mostrar.</div>
        <div v-else class="allies-list">
          <article
            v-for="friend in filteredFriends"
            :key="friend.username"
            class="ally-card"
            :class="friend.status"
          >
            <div class="avatar">{{ friend.username.charAt(0).toUpperCase() }}</div>
            <div class="ally-info">
              <h3>{{ friend.username }}</h3>
              <p>{{ friend.statusLabel }}</p>
            </div>
            <div class="ally-actions">
              <button class="btn-ally ghost" @click="openPublicProfile(friend.username)">VER PERFIL</button>
              <button class="btn-ally" @click="openChat(friend.username)">CHAT</button>
              <button class="btn-ally ghost" @click="inviteToRoom(friend.username)">INVITAR</button>
            </div>
          </article>
        </div>
      </section>
      <section class="panel chat-panel">
        <header class="panel-head chat-head">
          <h2>Chat privado</h2>
          <small v-if="selectedChatFriend">Con {{ selectedChatFriend }}</small>
        </header>
        <div v-if="!selectedChatFriend" class="empty-note chat-empty">
          Selecciona un aliat per obrir conversa.
        </div>
        <template v-else>
          <div class="chat-messages" ref="chatContainer">
            <div v-if="loadingChat" class="mini-note">Carregant missatges...</div>
            <article
              v-for="msg in chatMessages"
              :key="msg.id"
              class="chat-msg"
              :class="{ mine: msg.fromUsername === myUsername }"
            >
              <small>{{ msg.fromUsername }} · {{ formatChatDate(msg.createdAt) }}</small>
              <p>{{ msg.message }}</p>
            </article>
            <div v-if="chatMessages.length === 0 && !loadingChat" class="mini-note">
              Encara no hi ha missatges en aquesta conversa.
            </div>
          </div>
          <div class="chat-send-row">
            <textarea
              v-model="chatDraft"
              class="chat-input"
              rows="2"
              maxlength="1000"
              placeholder="Escriu un missatge..."
              @keydown.enter.exact.prevent="sendChatMessage"
            ></textarea>
            <button class="btn-primary" :disabled="sendingChat || !chatDraft.trim()" @click="sendChatMessage">
              {{ sendingChat ? 'ENVIANT...' : 'ENVIAR' }}
            </button>
          </div>
        </template>
      </section>
      <section class="panel rooms-panel">
        <header class="panel-head rooms-head">
          <h2>Salas activas</h2>
          <div class="rooms-tools">
            <button class="btn-nav secondary" :disabled="loadingRooms" @click="fetchActiveRooms">
              {{ loadingRooms ? 'ACTUALIZANDO...' : 'REFRESCAR' }}
            </button>
            <button class="btn-nav" @click="goToLobby">LOBBY</button>
          </div>
        </header>
        <p v-if="roomsError" class="error-msg">{{ roomsError }}</p>
        <div v-if="loadingRooms" class="mini-note">Llegint sales obertes...</div>
        <div v-else-if="activeRooms.length === 0" class="empty-note">
          No hi ha sales disponibles ara mateix.
        </div>
        <div v-else class="rooms-list">
          <article v-for="room in activeRooms" :key="room.roomCode" class="room-card">
            <header>
              <h3>{{ room.roomName }}</h3>
              <span class="room-code">{{ room.roomCode }}</span>
            </header>
            <p class="room-meta">
              {{ room.players.length }}/{{ room.maxPlayers }} jugadores · Host: {{ room.hostName }}
            </p>
            <div class="room-players">
              <span
                v-for="player in room.players"
                :key="`${room.roomCode}-${player.userId}`"
                class="player-pill"
              >
                {{ player.username }}
              </span>
            </div>
            <button
              class="btn-join"
              :disabled="joiningRoomCode === room.roomCode || (room.status === 'in-progress' && !isUserInRoom(room))"
              @click="joinRoom(room)"
            >
              {{
                joiningRoomCode === room.roomCode
                  ? 'UNIENDO...'
                  : (isUserInRoom(room) ? 'ENTRAR A LA SALA' : 'UNIR-SE A AQUESTA SALA')
              }}
            </button>
          </article>
        </div>
      </section>
    </main>
    <p v-if="statusMessage" class="status-msg">{{ statusMessage }}</p>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';
const router = useRouter();
const vantaHost = ref(null);
let vantaEffect = null;
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const userId = user.value?.id || user.value?._id || '';
const myUsername = user.value?.username || '';
const token = localStorage.getItem('token');
const loadingSocial = ref(false);
const friends = ref([]);
const incomingRequests = ref([]);
const outgoingRequests = ref([]);
const friendFilter = ref('');
const searchCandidate = ref('');
const searchResults = ref([]);
const searchingUsers = ref(false);
const sendingRequestTo = ref('');
const processingRequest = ref('');
const searchTouched = ref(false);
const activeRooms = ref([]);
const loadingRooms = ref(false);
const roomsError = ref('');
const joiningRoomCode = ref('');
const selectedChatFriend = ref('');
const chatMessages = ref([]);
const chatDraft = ref('');
const loadingChat = ref(false);
const sendingChat = ref(false);
const chatContainer = ref(null);
const statusMessage = ref('');
const socialPresence = ref({});
let socialTimer = null;
let roomsTimer = null;
let chatTimer = null;
const normalizeUsername = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    if (typeof value.username === 'string') return value.username.trim();
    if (typeof value.name === 'string') return value.name.trim();
  }
  return '';
};
const normalizedFriends = computed(() => {
  return friends.value.map((friendEntry) => {
    const username = normalizeUsername(friendEntry);
    if (!username) return null;
    const key = username.toLowerCase();
    const presence = socialPresence.value?.[key];
    return {
      username,
      status: presence?.status === 'online' ? 'online' : 'offline',
      statusLabel: presence?.statusLabel || 'Desconectado'
    };
  }).filter(Boolean);
});
const filteredFriends = computed(() => {
  const term = friendFilter.value.trim().toLowerCase();
  if (!term) return normalizedFriends.value;
  return normalizedFriends.value.filter((friend) => friend.username.toLowerCase().includes(term));
});
const onlineFriendsCount = computed(() => normalizedFriends.value.filter((f) => f.status === 'online').length);
const setLocalUserSocial = () => {
  const localUser = JSON.parse(localStorage.getItem('user') || '{}');
  localStorage.setItem('user', JSON.stringify({
    ...localUser,
    friends: [...friends.value],
    friendRequests: {
      incoming: [...incomingRequests.value],
      outgoing: [...outgoingRequests.value]
    }
  }));
};
const authHeaders = () => {
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const loadSocialState = async ({ silent = false } = {}) => {
  if (!silent) loadingSocial.value = true;
  try {
    const response = await fetch(`/api/social/state/${encodeURIComponent(userId)}`, {
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    friends.value = Array.isArray(data.friends)
      ? data.friends.map(normalizeUsername).filter(Boolean)
      : [];
    incomingRequests.value = Array.isArray(data?.friendRequests?.incoming)
      ? data.friendRequests.incoming.map(normalizeUsername).filter(Boolean)
      : [];
    outgoingRequests.value = Array.isArray(data?.friendRequests?.outgoing)
      ? data.friendRequests.outgoing.map(normalizeUsername).filter(Boolean)
      : [];
    socialPresence.value = data?.presence && typeof data.presence === 'object'
      ? data.presence
      : {};
    if (!selectedChatFriend.value && friends.value.length > 0) {
      selectedChatFriend.value = normalizeUsername(friends.value[0]);
      await fetchChatMessages();
    }
    setLocalUserSocial();
  } catch (error) {
    console.error("Error carregant l'estat social:", error);
    statusMessage.value = getApiErrorMessage(error, "No s'ha pogut carregar l'estat social.");
  } finally {
    if (!silent) loadingSocial.value = false;
  }
};
const performUserSearch = async () => {
  const query = searchCandidate.value.trim();
  searchTouched.value = true;
  searchResults.value = [];
  if (query.length < 2) {
    statusMessage.value = 'Escriu almenys 2 caràcters per cercar usuaris.';
    return;
  }
  searchingUsers.value = true;
  try {
    const response = await fetch(`/api/social/users/search?userId=${encodeURIComponent(userId)}&q=${encodeURIComponent(query)}`, {
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    searchResults.value = Array.isArray(data.users) ? data.users : [];
  } catch (error) {
    console.error('Error cercant usuaris:', error);
    statusMessage.value = getApiErrorMessage(error, "No s'han pogut cercar usuaris.");
  } finally {
    searchingUsers.value = false;
  }
};
const sendFriendRequest = async (username) => {
  sendingRequestTo.value = username;
  try {
    const response = await fetch('/api/social/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        fromUserId: userId,
        toUsername: username
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    statusMessage.value = data.message || `Sol·licitud enviada a ${username}`;
    searchResults.value = searchResults.value.filter((entry) => entry !== username);
    await loadSocialState();
  } catch (error) {
    console.error('Error enviant sol·licitud:', error);
    statusMessage.value = getApiErrorMessage(error, "No s'ha pogut enviar la sol·licitud.");
  } finally {
    sendingRequestTo.value = '';
  }
};
const acceptFriendRequest = async (fromUsername) => {
  processingRequest.value = fromUsername;
  try {
    const response = await fetch('/api/social/friends/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        userId,
        fromUsername
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    statusMessage.value = data.message || `Ara ets aliat de ${fromUsername}`;
    await loadSocialState();
  } catch (error) {
    console.error('Error acceptant sol·licitud:', error);
    statusMessage.value = getApiErrorMessage(error, "No s'ha pogut acceptar la sol·licitud.");
  } finally {
    processingRequest.value = '';
  }
};
const rejectFriendRequest = async (fromUsername) => {
  processingRequest.value = fromUsername;
  try {
    const response = await fetch('/api/social/friends/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        userId,
        fromUsername
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    statusMessage.value = data.message || `Sol·licitud rebutjada de ${fromUsername}`;
    await loadSocialState();
  } catch (error) {
    console.error('Error rebutjant sol·licitud:', error);
    statusMessage.value = getApiErrorMessage(error, "No s'ha pogut rebutjar la sol·licitud.");
  } finally {
    processingRequest.value = '';
  }
};
const fetchActiveRooms = async ({ silent = false } = {}) => {
  if (!silent) loadingRooms.value = true;
  if (!silent) roomsError.value = '';
  try {
    const response = await fetch('/api/rooms/active', {
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Error ${response.status}`);
    }
    activeRooms.value = Array.isArray(data.rooms) ? data.rooms : [];
  } catch (error) {
    console.error("No s'han pogut carregar sales:", error);
    if (!silent) {
      roomsError.value = getApiErrorMessage(error, "No s'han pogut carregar les sales actives.");
      activeRooms.value = [];
    }
  } finally {
    if (!silent) loadingRooms.value = false;
  }
};
const isUserInRoom = (room) => {
  const players = Array.isArray(room?.players) ? room.players : [];
  return players.some((player) => String(player?.userId || '') === String(userId));
};
const joinRoom = async (room) => {
  joiningRoomCode.value = room.roomCode;
  statusMessage.value = '';
  if (isUserInRoom(room)) {
    router.push({ name: 'GameRoom', params: { roomCode: room.roomCode } });
    joiningRoomCode.value = '';
    return;
  }
  try {
    const response = await fetch('/api/rooms/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        roomCode: room.roomCode,
        userId,
        username: myUsername,
        character: user.value.character || null
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Error ${response.status}`);
    }
    router.push({ name: 'GameRoom', params: { roomCode: room.roomCode } });
  } catch (error) {
    console.error('Error en unir-se a la sala:', error);
    statusMessage.value = getApiErrorMessage(error, "No ha estat possible unir-se a la sala.");
  } finally {
    joiningRoomCode.value = '';
  }
};
const goToLobby = () => {
  router.push({ name: 'RoomLobby' });
};
const inviteToRoom = async (username) => {
  const ownRoom = activeRooms.value.find((room) => {
    const players = Array.isArray(room.players) ? room.players : [];
    return players.some((player) => {
      const playerId = String(player?.userId || '').trim();
      const playerName = String(player?.username || '').trim().toLowerCase();
      return playerId === String(userId) || playerName === String(myUsername).toLowerCase();
    });
  });
  if (!ownRoom) {
    statusMessage.value = `No ets en cap sala. Crea'n una o uneix-te a una per convidar ${username}.`;
    return;
  }
  const inviteText = `Et convido a la meva sala de Valkrypt: ${ownRoom.roomCode}`;
  try {
    const response = await fetch('/api/social/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        fromUserId: userId,
        toUsername: username,
        message: inviteText
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    statusMessage.value = `Invitació enviada a ${username} (sala ${ownRoom.roomCode}).`;
    if (selectedChatFriend.value === username) {
      await fetchChatMessages();
    }
  } catch (error) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(ownRoom.roomCode).catch(() => {});
    }
    statusMessage.value = `No s'ha pogut enviar pel xat. Codi ${ownRoom.roomCode} copiat per convidar a ${username}.`;
  }
};
const openPublicProfile = async (username) => {
  const target = String(username || '').trim();
  if (!target) return;
  router.push({ name: 'profile-public', params: { username: target } });
};
const openChat = async (username) => {
  selectedChatFriend.value = username;
  chatDraft.value = '';
  await fetchChatMessages();
};
const fetchChatMessages = async () => {
  if (!selectedChatFriend.value) return;
  loadingChat.value = true;
  try {
    const response = await fetch(
      `/api/social/chat?userId=${encodeURIComponent(userId)}&with=${encodeURIComponent(selectedChatFriend.value)}&limit=120`,
      { headers: authHeaders() }
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    chatMessages.value = Array.isArray(data.messages) ? data.messages : [];
    await nextTick();
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  } catch (error) {
    console.error('Error carregant xat:', error);
    statusMessage.value = getApiErrorMessage(error, "No s'ha pogut carregar el xat privat.");
  } finally {
    loadingChat.value = false;
  }
};
const sendChatMessage = async () => {
  const text = chatDraft.value.trim();
  if (!text || !selectedChatFriend.value) return;
  sendingChat.value = true;
  try {
    const response = await fetch('/api/social/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        fromUserId: userId,
        toUsername: selectedChatFriend.value,
        message: text
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    chatDraft.value = '';
    if (data.message) {
      chatMessages.value.push(data.message);
      await nextTick();
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    }
  } catch (error) {
    console.error('Error enviant missatge:', error);
    statusMessage.value = getApiErrorMessage(error, "No s'ha pogut enviar el missatge.");
  } finally {
    sendingChat.value = false;
  }
};
const formatChatDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
onMounted(async () => {
  if (!userId || !myUsername) {
    router.push('/login');
    return;
  }
  await Promise.all([loadSocialState(), fetchActiveRooms()]);
  socialTimer = setInterval(() => loadSocialState({ silent: true }), 8000);
  roomsTimer = setInterval(() => fetchActiveRooms({ silent: true }), 5000);
  chatTimer = setInterval(() => {
    if (selectedChatFriend.value) fetchChatMessages();
  }, 4000);

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
      highlightColor: 0x651111,
      midtoneColor: 0x0e0b0d,
      lowlightColor: 0x06070a,
      baseColor: 0x040507,
      blurFactor: 0.5,
      speed: 0.5,
      zoom: 0.62
    });
  } catch (error) {
    console.error('No s’ha pogut carregar Vanta Fog a Friends:', error);
  }
});
onBeforeUnmount(() => {
  if (socialTimer) clearInterval(socialTimer);
  if (roomsTimer) clearInterval(roomsTimer);
  if (chatTimer) clearInterval(chatTimer);
  if (vantaEffect && typeof vantaEffect.destroy === 'function') vantaEffect.destroy();
});
</script>
<style scoped lang="scss" src="../styles/friends-view.scss"></style>
