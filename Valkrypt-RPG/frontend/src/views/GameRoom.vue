<template>
  <div class="game-room">
    <div class="fx-layer bg-image" :style="{ backgroundImage: `url(${currentBackground})` }"></div>
    <div class="fx-layer vignette"></div>
    <div class="fx-layer grain"></div>

    <nav class="hud-top">
      <div class="nav-left">
        <button class="btn-icon-menu" @click="toggleMenu">
          <i class="fas fa-bars"></i> <span>MENÚ</span>
        </button>
      </div>

      <div class="nav-center">
        <div class="location-tag">
          <i class="fas fa-map-marker-alt"></i>
          <span>MULTIPLAYER - Room: {{ roomCode }}</span>
        </div>
      </div>

      <div class="nav-right">
        <button class="btn-players" @click="togglePlayers">
          <i class="fas fa-users"></i>
          <span class="online-indicator">{{ roomPlayers.length }}</span>
          <span>PLAYERS</span>
        </button>
        <button class="btn-exit" @click="confirmLeaveRoom">
          <i class="fas fa-door-open"></i> <span>EXIT</span>
        </button>
      </div>
    </nav>

    <div class="main-layout">
      <!-- Players sidebar -->
      <aside class="party-sidebar">
        <div v-for="hero in roomPlayers" :key="hero.userId" class="hero-card" :class="{ 'is-self': hero.userId === currentUser.id }">
          <div class="hero-avatar">
            <span class="icon">⚔️</span>
            <div class="player-status">{{ hero.username }}</div>
          </div>
          <div class="hero-info">
            <span class="hero-name">{{ hero.username }}</span>
            <span class="hero-status" :class="hero.status">{{ hero.status || 'Ready' }}</span>
          </div>
        </div>
      </aside>

      <main class="game-stage">
        <!-- Game Log -->
        <div class="log-container" ref="logContainer">
          <div v-for="(entry, index) in gameLog" :key="index" class="log-entry" :class="entry.type">
            <p v-if="entry.type === 'action'">
              <strong>{{ entry.username }}</strong> {{ entry.action }}: {{ entry.message }}
            </p>
            <p v-if="entry.type === 'system'" class="system-message">
              ⚔️ {{ entry.message }}
            </p>
            <p v-if="entry.type === 'chat'">
              <strong style="color: #d4af37;">{{ entry.username }}:</strong> {{ entry.message }}
            </p>
          </div>
        </div>

        <!-- Action bar -->
        <footer class="action-bar">
          <div class="action-grid">
            <button @click="sendAction('explorar', 'Explores the area')" class="btn-action">EXPLORAR</button>
            <button @click="sendAction('descansar', 'Rests to recover')" class="btn-action">DESCANSAR</button>
            <button @click="sendAction('atacar', 'Attacks an enemy!')" class="btn-action danger">ATACAR</button>
          </div>
          
          <!-- Chat input -->
          <div class="chat-input-group">
            <input
              v-model="chatMessage"
              @keydown.enter="sendChat"
              type="text"
              placeholder="Type message..."
              class="chat-input"
            />
            <button @click="sendChat" class="btn-send">Send</button>
          </div>
        </footer>
      </main>
    </div>

    <!-- Players overlay -->
    <transition name="slide-right">
      <div v-if="showPlayers" class="players-overlay">
        <header>
          <h3>PLAYERS IN ROOM</h3>
          <button @click="showPlayers = false">✕</button>
        </header>
        <div class="players-list">
          <div v-for="player in roomPlayers" :key="player.userId" class="player-item" :class="{ 'is-host': player.userId === hostId }">
            <div class="p-avatar">{{ player.username.substring(0, 2).toUpperCase() }}</div>
            <div class="p-info">
              <strong>{{ player.username }}</strong>
              <small v-if="player.userId === hostId"> (HOST)</small>
              <small v-else>(PLAYER)</small>
            </div>
          </div>
        </div>
        <div class="players-actions">
          <button v-if="isHost" @click="startMultiplayerGame" class="btn-start-game">START GAME</button>
          <button v-if="isHost" @click="deleteRoom" class="btn-delete-room">DELETE ROOM</button>
          <button @click="leaveRoom" class="btn-leave">LEAVE ROOM</button>
        </div>
      </div>
    </transition>

    <!-- Menu overlay -->
    <transition name="fade">
      <div v-if="showMenu" class="menu-overlay" @click="showMenu = false">
        <div class="menu-panel" @click.stop>
          <h3>GAME MENU</h3>
          <button @click="leaveRoom" class="btn-menu-option danger">Leave Room</button>
          <button @click="showMenu = false" class="btn-menu-option">Resume</button>
        </div>
      </div>
    </transition>

    <!-- System message -->
    <div v-if="systemMessage" class="system-notification">
      {{ systemMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { wsService } from '@/services/WebSocketService';

const route = useRoute();
const router = useRouter();

const API_URL = '/api';

const roomCode = ref(route.params.roomCode);
const currentUser = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const token = localStorage.getItem('token');

const roomPlayers = ref([]);
const hostId = ref('');
const gameLog = ref([]);
const showMenu = ref(false);
const showPlayers = ref(false);
const chatMessage = ref('');
const systemMessage = ref('');
const currentBackground = ref('');

const isHost = ref(false);

const setupWebsocketListeners = () => {
  wsService.on('playerJoined', (msg) => {
    roomPlayers.value.push({ username: msg.username, userId: msg.userId });
    gameLog.value.push({ type: 'system', message: `${msg.username} joined!` });
    scrollToBottom();
  });

  wsService.on('playerLeft', (msg) => {
    roomPlayers.value = roomPlayers.value.filter(p => p.userId !== msg.userId);
    gameLog.value.push({ type: 'system', message: `${msg.username} left.` });
    scrollToBottom();
  });

  wsService.on('playerAction', (msg) => {
    gameLog.value.push({ type: 'action', username: msg.username, action: msg.action, message: msg.message });
    scrollToBottom();
  });

  wsService.on('chat', (msg) => {
    gameLog.value.push({ type: 'chat', username: msg.username, message: msg.message });
    scrollToBottom();
  });

  wsService.on('gameStarted', (msg) => {
    gameLog.value.push({ type: 'system', message: `Game started by ${msg.username}!` });
    showPlayers.value = false;
  });
};

const initRoom = async () => {
  try {
    const response = await axios.get(`${API_URL}/rooms/${roomCode.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data.success) {
      const room = response.data.room;
      roomPlayers.value = room.players;
      hostId.value = room.hostId;
      isHost.value = room.hostId === currentUser.value.id;
    }
  } catch (err) {
    console.error('fetch room error', err);
    router.push({ name: 'RoomLobby' });
  }
};

const sendAction = (action, message) => {
  wsService.sendAction(roomCode.value, currentUser.value.id, currentUser.value.username, action, message);
};

const sendChat = () => {
  if (!chatMessage.value.trim()) return;
  wsService.sendChat(roomCode.value, currentUser.value.username, chatMessage.value);
  chatMessage.value = '';
};

const confirmLeaveRoom = () => {
  if (confirm('Are you sure you want to leave the room?')) {
    leaveRoom();
  }
};

const leaveRoom = async () => {
  await axios.post(`${API_URL}/rooms/leave`, { roomCode: roomCode.value, userId: currentUser.value.id }, { headers: { Authorization: `Bearer ${token}` } });
  wsService.leaveRoom(roomCode.value);
  wsService.disconnect();
  router.push({ name: 'RoomLobby' });
};

const startMultiplayerGame = async () => {
  if (!isHost.value) {
    systemMessage.value = 'Only the host can start the game';
    setTimeout(() => systemMessage.value = '', 3000);
    return;
  }
  try {
    const res = await axios.post(`${API_URL}/rooms/start`, { roomCode: roomCode.value, userId: currentUser.value.id }, { headers: { Authorization: `Bearer ${token}` } });
    if (res.data.success) {
      wsService.startGame(roomCode.value, currentUser.value.id, currentUser.value.username);
    }
  } catch (err) {
    systemMessage.value = err.response?.data?.message || 'Failed to start';
    setTimeout(() => systemMessage.value = '', 3000);
  }
};

const deleteRoom = async () => {
  if (!isHost.value) {
    systemMessage.value = 'Only the host can delete the room';
    setTimeout(() => systemMessage.value = '', 3000);
    return;
  }
  if (!confirm('Are you sure you want to delete this room? All players will be removed.')) {
    return;
  }
  try {
    const res = await axios.post(`${API_URL}/rooms/delete`, { roomCode: roomCode.value, userId: currentUser.value.id }, { headers: { Authorization: `Bearer ${token}` } });
    if (res.data.success) {
      systemMessage.value = 'Room deleted!';
      wsService.disconnect();
      setTimeout(() => {
        router.push({ name: 'RoomLobby' });
      }, 1500);
    }
  } catch (err) {
    systemMessage.value = err.response?.data?.message || 'Failed to delete room';
    setTimeout(() => systemMessage.value = '', 3000);
  }
};

const toggleMenu = () => { showMenu.value = !showMenu.value; };
const togglePlayers = () => { showPlayers.value = !showPlayers.value; };

const scrollToBottom = () => {
  nextTick(() => {
    const el = document.querySelector('.log-container');
    if (el) el.scrollTop = el.scrollHeight;
  });
};

onMounted(() => {
  initRoom();
  wsService.connect().then(() => {
    setupWebsocketListeners();
    wsService.joinRoom(roomCode.value, currentUser.value.id, currentUser.value.username);
  });
  currentBackground.value = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect fill="%23050505" width="1920" height="1080"/><defs><linearGradient id="grad" x1="0" y1="0" x2="100" y2="100"><stop offset="0%25" style="stop-color:%23d4af37;stop-opacity:0.1" /><stop offset="100%25" style="stop-color:%23000;stop-opacity:0.5" /></linearGradient></defs><rect fill="url(%23grad)" width="1920" height="1080"/></svg>';
  gameLog.value.push({ type: 'system', message: '⚔️ Welcome!' });
});

onBeforeUnmount(() => {
  wsService.disconnect();
});
</script>

<style scoped lang="scss">
$dark-bg: #050505;
$darker-bg: #0a0a0a;
$gold: #d4af37;
$red: #e74c3c;
$green: #27ae60;

// Scrollbar styling
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: rgba(20, 20, 20, 0.8);
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, $gold 0%, #c9a632 100%);
  border-radius: 6px;
  border: 2px solid rgba(20, 20, 20, 0.8);

  &:hover {
    background: linear-gradient(135deg, #e5c158 0%, #d4af37 100%);
  }
}

.game-room {
  position: relative;
  min-height: 100vh;
  background: $dark-bg;
  color: #eee;
  font-family: 'Arial', sans-serif;
  scrollbar-color: $gold rgba(20, 20, 20, 0.8);
  scrollbar-width: thin;

  .fx-layer {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background-repeat: no-repeat;
    background-size: cover;
    z-index: 0;
    &.vignette { background: radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,.8) 100%); }
    &.grain { background: url('/assets/textures/grain.png'); opacity: .2; }
  }
}

.hud-top {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: rgba(0,0,0,0.5);
  z-index: 10;
  .nav-left,
  .nav-center,
  .nav-right { display: flex; align-items: center; gap: 10px; }
  .location-tag { color: $gold; font-weight: bold; }
  .btn-icon-menu,
  .btn-players,
  .btn-exit { background: rgba(20,20,20,.7); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
  .btn-icon-menu:hover,
  .btn-players:hover { background: rgba(30,30,30,.9); }
  .btn-exit { border: 1px solid $red; }
  .btn-exit:hover { background: rgba($red,.3); }
  .btn-players .online-indicator { background: $green; border-radius: 50%; padding: 2px 6px; margin-right: 4px; }
}

.main-layout {
  display: flex;
  padding-top: 60px;
}

.party-sidebar {
  width: 240px;
  background: rgba(20,20,20,0.9);
  border-right: 1px solid rgba($gold,0.4);
  padding: 10px;
  overflow-y: auto;
  z-index: 5;
  .hero-card { 
    margin-bottom: 10px;
    padding: 8px;
    background: rgba(30,30,30,0.8);
    border: 1px solid rgba($gold,0.2);
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    &.is-self { border-color: $green; }
    .hero-avatar { font-size: 1.2em; }
    .hero-info {
      .hero-name{ font-weight: bold; }
      .hero-status{ font-size: 0.8em; color: #aaa; }
    }
  }
}

.game-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  margin-left: 240px;
  position: relative;

  .log-container {
    flex: 1;
    overflow-y: auto;
    background: rgba(10,10,10,0.8);
    padding: 15px;
    border: 1px solid rgba($gold,0.2);
    border-radius: 4px;
    .log-entry { margin-bottom: 8px;
      &.action{ color: #eee; }
      &.system{ color: $gold; font-style: italic; }
      &.chat{ color: #ccc; }
    }
  }

  .action-bar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;

    .action-grid { display: flex; gap: 10px;
      button { flex: 1; padding: 12px; border: none; border-radius: 4px; background: rgba($gold,0.8); color: #000; cursor: pointer;
        &.danger { background: $red; }
        &:hover{ opacity: .9; }
      }
    }

    .chat-input-group { display: flex; gap: 5px;
      .chat-input{ flex: 1; padding: 10px; border: 1px solid #333; border-radius: 4px; background: #111; color: #fff; }
      .btn-send{ padding: 10px 15px; background: $gold; color: #000; border: none; border-radius: 4px; cursor: pointer; }
    }
  }
}

.players-overlay,
.menu-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.85);
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #eee;
}

.players-overlay {
  .players-list{ max-height: 60vh; overflow-y: auto; }
  .player-item { padding: 10px; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px; 
                 .p-avatar{ background: $gold; width: 35px;height: 35px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
                 .p-info strong{color: $gold;} 
                 &.is-host .p-avatar{background: $green;}
  }
  .players-actions{ margin-top: 20px; button{ padding: 10px 20px; margin-right: 10px; border: none; border-radius: 4px; cursor: pointer;
       &.btn-start-game{background: $green;color: #000;}
       &.btn-delete-room{background: #e67e22;color: #fff;}
       &.btn-leave{background: $red;color: #fff;}
  }}
}

.menu-overlay .menu-panel { background: rgba(30,30,30,0.9); padding: 20px; border-radius: 8px; }
.menu-overlay .btn-menu-option{ display: block; width: 100%; padding: 10px; margin: 5px 0; border: none; border-radius: 4px; cursor: pointer;
  &.danger{background: $red; color: #fff;}
}

.system-notification{ position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: $gold; padding: 10px 20px; border-radius: 4px; color: #000; z-index: 30; }

@media(max-width:768px){
  .main-layout{flex-direction:column; margin-left:0;}
  .party-sidebar{width:100%; order:2;}
  .game-stage{margin-left:0;}
}
</style>
