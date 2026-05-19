<template>
  <div class="room-lobby" @mousemove="onMouseMove">
    <div class="fx-stars"></div>
    <div class="fx-stars fx-stars-alt"></div>
    <div class="fx-aurora" :style="auroraStyle"></div>
    <div class="fx-nebula"></div>
    <div class="fx-runes"></div>
    <div class="fx-vignette"></div>

    <div class="lobby-container">
      <header class="lobby-header reveal-up">
        <div>
          <h1>Salas de Valkrypt</h1>
          <p>Centro cooperativo completo: crea, filtra, entra y coordina tu escuadra.</p>
        </div>
        <div class="header-actions">
          <button @click="backToMenu" class="btn-back">← Volver</button>
          <button @click="fetchRooms()" class="btn-refresh" :disabled="loadingRooms">↻ Actualizar</button>
        </div>
      </header>

      <section class="hero-strip reveal-up delay-1">
        <article>
          <small>ACTIVAS</small>
          <strong>{{ availableRooms.length }}</strong>
        </article>
        <article>
          <small>JUGADORES</small>
          <strong>{{ totalPlayers }}</strong>
        </article>
        <article>
          <small>PING GLOBAL</small>
          <strong>Estable</strong>
        </article>
        <article>
          <small>ESTADO</small>
          <strong class="ok">ONLINE</strong>
        </article>
      </section>

      <div class="lobby-content">
        <section class="create-room-section reveal-up delay-2">
          <h2>Crear sala</h2>
          <div class="form-group">
            <input v-model="newRoom.roomName" type="text" placeholder="Nombre de la sala" class="input-field" maxlength="30" />
            <select v-model.number="newRoom.maxPlayers" class="input-field">
              <option value="2">2 jugadores</option>
              <option value="3">3 jugadores</option>
              <option value="4">4 jugadores</option>
            </select>
            <button @click="createRoom" class="btn-create" :disabled="loading">
              <span class="btn-shine"></span>
              {{ loading ? 'Creando...' : 'Crear sala' }}
            </button>
          </div>

          <div class="tips-box">
            <h3>Consejos de host</h3>
            <ul>
              <li>Usa un nombre corto y reconocible.</li>
              <li>4 jugadores mejora sinergias de rol.</li>
              <li>Reinicia sala solo si todo el grupo está listo.</li>
            </ul>
          </div>
        </section>

        <section class="active-rooms-section reveal-up delay-3">
          <div class="rooms-title-row">
            <h2>Salas disponibles</h2>
            <span class="counter pulse-soft">{{ availableRooms.length }}</span>
          </div>

          <div v-if="loadingRooms" class="loading-state">
            <div class="skeleton" v-for="n in 4" :key="n"></div>
          </div>

          <div v-else-if="availableRooms.length === 0" class="no-rooms">
            No hay salas por ahora. Crea una para empezar.
          </div>

          <transition-group v-else name="stagger" tag="div" class="rooms-grid">
            <article v-for="room in availableRooms" :key="room.roomCode" class="room-card" :class="{ hot: room.players.length >= room.maxPlayers - 1 }">
              <header class="room-header">
                <h3>{{ room.roomName }}</h3>
                <span class="room-code">{{ room.roomCode }}</span>
              </header>

              <div class="room-info">
                <p><strong>Host:</strong> {{ room.hostName }}</p>
                <p><strong>Jugadores:</strong> {{ room.players.length }}/{{ room.maxPlayers }}</p>
                <p><strong>Estado:</strong> {{ room.status === 'in-progress' ? 'en progreso' : 'esperando' }}</p>
              </div>

              <div class="capacity-track">
                <div class="capacity-fill" :style="{ width: ((room.players.length / room.maxPlayers) * 100) + '%' }"></div>
              </div>

              <div class="room-players">
                <div v-for="player in room.players" :key="player.userId" class="player-badge floaty">
                  {{ player.username.substring(0, 2).toUpperCase() }}
                </div>
              </div>

              <button @click="joinRoom(room)" class="btn-join" :disabled="loading || (room.status === 'in-progress' && !isUserInRoom(room)) || (room.players.length >= room.maxPlayers && !isUserInRoom(room))">
                <span class="btn-shine"></span>
                {{ loading ? 'Entrando...' : (isUserInRoom(room) ? 'Entrar' : 'Unirse') }}
              </button>
            </article>
          </transition-group>
        </section>
      </div>

      <transition name="toast-pop">
        <div v-if="error" class="error-notification">{{ error }}</div>
      </transition>
      <transition name="toast-pop">
        <div v-if="success" class="success-notification">{{ success }}</div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { getApiErrorMessage } from '../services/apiClient';

const router = useRouter();
const API_URL = '/api';

const newRoom = ref({ roomName: '', maxPlayers: 4 });
const loading = ref(false);
const visitedRooms = ref(new Set());
const visitedRoomsKey = 'visitedRooms';
const loadingRooms = ref(false);
const error = ref('');
const success = ref('');
const availableRooms = ref([]);

const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const userId = user.value?.id || user.value?._id || '';
const token = localStorage.getItem('token');

const mouseX = ref(0);
const mouseY = ref(0);
const auroraStyle = computed(() => ({ transform: `translate3d(${mouseX.value * 16}px, ${mouseY.value * 16}px, 0)` }));
const totalPlayers = computed(() => availableRooms.value.reduce((acc, room) => acc + (Array.isArray(room.players) ? room.players.length : 0), 0));

const onMouseMove = (event) => {
  mouseX.value = (event.clientX / window.innerWidth - 0.5) * -1;
  mouseY.value = (event.clientY / window.innerHeight - 0.5) * -1;
};

const roomFingerprint = (room) => ({
  roomCode: room?.roomCode || '',
  roomName: room?.roomName || '',
  hostName: room?.hostName || '',
  status: room?.status || '',
  maxPlayers: Number(room?.maxPlayers || 0),
  players: Array.isArray(room?.players) ? room.players.map((player) => ({ userId: String(player?.userId || ''), username: String(player?.username || '') })) : [],
});

const normalizeRooms = (rooms) => (Array.isArray(rooms) ? rooms.map(roomFingerprint) : []);

const showError = (message) => {
  error.value = message;
  setTimeout(() => (error.value = ''), 2200);
};

const showSuccess = (message) => {
  success.value = message;
  setTimeout(() => (success.value = ''), 2200);
};

const fetchRooms = async ({ silent = false } = {}) => {
  try {
    if (!silent) loadingRooms.value = true;
    const response = await axios.get(`${API_URL}/rooms/active`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.data.success) {
      const nextRooms = normalizeRooms(response.data.rooms);
      const currentSignature = JSON.stringify(availableRooms.value);
      const nextSignature = JSON.stringify(nextRooms);
      if (currentSignature !== nextSignature) availableRooms.value = nextRooms;
    }
  } catch (err) {
    console.error('Error fetching rooms:', err);
    showError(getApiErrorMessage(err, 'No se pudieron cargar las salas'));
  } finally {
    if (!silent) loadingRooms.value = false;
  }
};

const createRoom = async () => {
  if (!newRoom.value.roomName.trim()) return showError('Escribe un nombre para la sala');
  if (!userId || !user.value?.username) return router.push('/login');

  try {
    loading.value = true;
    const response = await axios.post(`${API_URL}/rooms/create`, {
      roomName: newRoom.value.roomName,
      maxPlayers: newRoom.value.maxPlayers,
      userId,
      username: user.value.username,
      character: user.value.character || null
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (response.data.success) {
      showSuccess('Sala creada. Entrando...');
      newRoom.value.roomName = '';
      setTimeout(() => router.push({ name: 'GameRoom', params: { roomCode: response.data.room.roomCode } }), 650);
    }
  } catch (err) {
    console.error('Error creating room:', err);
    showError(getApiErrorMessage(err, 'No se pudo crear la sala'));
  } finally {
    loading.value = false;
  }
};

const joinRoom = async (room) => {
  if (!userId || !user.value?.username) return router.push('/login');
  if (isUserInRoom(room)) return router.push({ name: 'GameRoom', params: { roomCode: room.roomCode } });

  try {
    loading.value = true;
    const response = await axios.post(`${API_URL}/rooms/join`, {
      roomCode: room.roomCode,
      userId,
      username: user.value.username,
      character: user.value.character
    }, { headers: { Authorization: `Bearer ${token}` } });

    if (response.data.success) {
      showSuccess('Te has unido. Entrando...');
      visitedRooms.value.add(room.roomCode);
      localStorage.setItem(visitedRoomsKey, JSON.stringify([...visitedRooms.value]));
      setTimeout(() => router.push({ name: 'GameRoom', params: { roomCode: room.roomCode } }), 650);
    }
  } catch (err) {
    console.error('Error joining room:', err);
    showError(getApiErrorMessage(err, 'No se pudo unir a la sala'));
  } finally {
    loading.value = false;
  }
};

const isUserInRoom = (room) => (Array.isArray(room?.players) ? room.players : []).some((player) => String(player?.userId || '') === String(userId));
const backToMenu = () => router.push({ name: 'friends' });

let refreshInterval;
onMounted(() => {
  if (!userId || !user.value?.username) return router.push('/login');
  try {
    const stored = JSON.parse(localStorage.getItem(visitedRoomsKey) || '[]');
    stored.forEach((code) => visitedRooms.value.add(code));
  } catch {}
  fetchRooms();
  refreshInterval = setInterval(() => fetchRooms({ silent: true }), 3000);
});

onBeforeUnmount(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<style scoped lang="scss">
$bg: #040408;
$panel: rgba(9, 10, 15, 0.94);
$gold: #c5a059;
$border: rgba(255, 255, 255, 0.15);
$success: #27ae60;
$danger: #e74c3c;

.room-lobby { min-height: 100dvh; position: relative; padding: 18px; background: radial-gradient(circle at 20% 10%, #14101f 0%, $bg 58%, #010102 100%); color: #dedee6; overflow: hidden; }
.fx-stars,.fx-aurora,.fx-nebula,.fx-runes,.fx-vignette { position: absolute; inset: -8%; pointer-events: none; }
.fx-stars { opacity:.18; background-image: radial-gradient(circle, rgba(255,255,255,.8) 1px, transparent 1px); background-size: 4px 4px; animation: drift 36s linear infinite; }
.fx-aurora { background: radial-gradient(circle at 50% 50%, rgba(84,50,145,.2), transparent 52%), radial-gradient(circle at 30% 70%, rgba(197,160,89,.12), transparent 48%); filter: blur(14px); transition: transform .22s ease-out; }
.fx-vignette { background: radial-gradient(circle, transparent 28%, rgba(0,0,0,.9) 100%); }

.fx-stars-alt { opacity:.08; background-size: 6px 6px; animation: driftReverse 58s linear infinite; mix-blend-mode: screen; }
.fx-nebula {
  background:
    radial-gradient(circle at 20% 30%, rgba(94, 57, 168, 0.24), transparent 40%),
    radial-gradient(circle at 70% 60%, rgba(28, 139, 171, 0.18), transparent 42%),
    radial-gradient(circle at 45% 75%, rgba(197, 160, 89, 0.16), transparent 36%);
  filter: blur(22px);
  animation: nebulaShift 16s ease-in-out infinite alternate;
}
.fx-runes {
  opacity: .14;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='none' stroke='%23c5a059' stroke-opacity='.35'%3E%3Cpath d='M110 20l24 42h-48zM110 200l-24-42h48zM20 110l42-24v48zM200 110l-42 24V86z'/%3E%3Ccircle cx='110' cy='110' r='64'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 240px 240px;
  animation: runeSpin 50s linear infinite;
  mix-blend-mode: plus-lighter;
}


.lobby-container { position: relative; z-index: 2; width: min(96vw, 1480px); margin: 0 auto; min-height: calc(100dvh - 44px); background: $panel; border: 1px solid rgba(197,160,89,.55); border-radius: 16px; padding: 16px; box-shadow: 0 24px 50px rgba(0,0,0,.4); backdrop-filter: blur(10px); display:grid; grid-template-rows:auto auto 1fr; gap:14px; }
.lobby-header { display:flex; justify-content:space-between; align-items:end; gap:16px; border-bottom:1px solid rgba(197,160,89,.35); padding-bottom:12px; }
.lobby-header h1 { margin:0; color:$gold; font-size: clamp(1.7rem,3vw,2.4rem); }
.lobby-header p { margin:8px 0 0; color:#b3b3bd; font-size:.95rem; }
.header-actions { display:flex; gap:10px; }

.hero-strip { display:grid; grid-template-columns: repeat(4,1fr); gap:10px; }
.hero-strip article { border:1px solid $border; background: linear-gradient(150deg, rgba($gold,.13), rgba(255,255,255,.03)); border-radius:12px; padding:12px; }
.hero-strip small { display:block; color:#a6a8b6; font-size:.7rem; letter-spacing:1.4px; }
.hero-strip strong { display:block; margin-top:4px; font-size:1.2rem; color:#f5f5f8; }
.hero-strip .ok { color:#8dedb7; }

.lobby-content { min-height: 0; display:grid; grid-template-columns: 320px 1fr; gap:14px; }
section { background: rgba(7,8,12,.9); border:1px solid $border; border-radius: 12px; padding: 16px; }
section h2 { margin:0 0 12px; color:$gold; font-size:1.2rem; }

.form-group { display:grid; gap:10px; }
.input-field { background:#151722; border:1px solid #3b3f50; border-radius:10px; color:#ececf2; padding:12px 14px; font-size:1rem; }
.input-field:focus { outline:none; border-color:$gold; box-shadow: 0 0 0 3px rgba(197,160,89,.12); }

.tips-box { margin-top:12px; border-top:1px solid rgba(255,255,255,.08); padding-top:12px; }
.tips-box h3 { margin:0 0 8px; font-size:1rem; color:#ddd; }
.tips-box ul { margin:0; padding-left:18px; color:#a9a9b2; }
.tips-box li { margin:6px 0; font-size:.94rem; }

.rooms-title-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.counter { min-width: 36px; text-align:center; padding:4px 10px; border-radius:999px; border:1px solid rgba(197,160,89,.6); color:$gold; font-size:.92rem; }
.loading-state { display:grid; gap:10px; }
.skeleton { height:92px; border-radius:12px; background: linear-gradient(90deg, rgba(255,255,255,.03), rgba(255,255,255,.11), rgba(255,255,255,.03)); background-size:200% 100%; animation: shimmer 1.2s infinite; }
.no-rooms { text-align:center; color:#9ca1af; padding:30px 10px; font-size:.95rem; }

.rooms-grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); gap:12px; max-height: calc(100dvh - 300px); overflow:auto; padding-right:6px; }
.room-card { background: rgba(11,12,18,.92); border:1px solid #3d4258; border-radius:12px; padding:12px; transition:.24s ease; position:relative; overflow:hidden; }
.room-card::before{content:"";position:absolute;inset:-2px;opacity:0;background:conic-gradient(from 180deg, transparent 0deg, rgba(197,160,89,.25) 80deg, transparent 160deg);transition:.25s ease;}
.room-card:hover { transform: translateY(-3px) scale(1.01); border-color: rgba(197,160,89,.75); box-shadow: 0 10px 26px rgba(0,0,0,.35); }
.room-card:hover::before{opacity:1;animation: sweep 1.4s linear infinite;}
.room-card.hot { box-shadow: 0 0 0 1px rgba(197,160,89,.35), 0 0 28px rgba(197,160,89,.18); }
.room-header { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.room-header h3 { margin:0; font-size:1rem; }
.room-code { font-size:.75rem; color:$gold; border:1px solid rgba(197,160,89,.45); border-radius:999px; padding:4px 9px; }
.room-info { margin:10px 0; color:#969baa; }
.room-info p { margin:4px 0; font-size:.95rem; }

.capacity-track { height:10px; border-radius:999px; background:#181b27; border:1px solid rgba(255,255,255,.1); overflow:hidden; margin-bottom:10px; }
.capacity-fill { height:100%; background: linear-gradient(90deg, #4f8cff, #c5a059); transition: width .35s ease; }
.room-players { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; }
.player-badge { width:32px; height:32px; display:grid; place-items:center; border-radius:50%; border:1px solid rgba(197,160,89,.65); color:$gold; background:rgba(0,0,0,.35); font-size:.76rem; font-weight:700; }

.btn-create,.btn-join,.btn-back,.btn-refresh { border-radius:10px; border:1px solid transparent; padding:11px 14px; cursor:pointer; transition:.2s ease; font-weight:700; position:relative; overflow:hidden; }
.btn-shine { position:absolute; inset:0; background:linear-gradient(120deg, transparent 30%, rgba(255,255,255,.2), transparent 70%); transform: translateX(-120%); }
.btn-create:hover .btn-shine,.btn-join:hover .btn-shine { animation: shine .85s ease; }
.btn-create { background: linear-gradient(90deg,#3e0c12,#63151d); border-color: rgba(197,160,89,.7); color:#fff; }
.btn-join { width:100%; background: linear-gradient(90deg,#25543a,#1a3b2a); color:#fff; }
.btn-back,.btn-refresh { background:transparent; border-color:#4a4f65; color:#d4d7e3; }
.btn-create:hover:not(:disabled),.btn-join:hover:not(:disabled),.btn-back:hover:not(:disabled),.btn-refresh:hover:not(:disabled){ filter:brightness(1.09); transform:translateY(-1px);} 
.btn-join:disabled,.btn-create:disabled,.btn-refresh:disabled{ opacity:.55; cursor:not-allowed; }

.error-notification,.success-notification { position:fixed; top:14px; right:14px; padding:11px 13px; border-radius:9px; font-weight:600; z-index:10; }
.error-notification { background: rgba(231,76,60,.9); border:1px solid $danger; }
.success-notification { background: rgba(39,174,96,.9); border:1px solid $success; }

.reveal-up{ opacity:0; transform:translateY(10px); animation: reveal .45s forwards; }
.delay-1{ animation-delay:.05s; } .delay-2{ animation-delay:.1s; } .delay-3{ animation-delay:.14s; }
.pulse-soft{ animation:pulse 1.8s infinite; }
.floaty{ animation:float 2.2s ease-in-out infinite; }
.stagger-enter-active,.stagger-leave-active{ transition:all .25s ease; }
.stagger-enter-from,.stagger-leave-to{ opacity:0; transform:translateY(8px); }
.toast-pop-enter-active,.toast-pop-leave-active{ transition:all .2s ease; }
.toast-pop-enter-from,.toast-pop-leave-to{ opacity:0; transform:translateY(-6px); }

@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(-120px,-80px,0)}}
@keyframes driftReverse{from{transform:translate3d(0,0,0)}to{transform:translate3d(120px,60px,0)}}
@keyframes nebulaShift{0%{transform:translate3d(-1%,0,0) scale(1)}100%{transform:translate3d(1.5%,-1%,0) scale(1.08)}}
@keyframes runeSpin{from{transform:rotate(0deg) scale(1)}to{transform:rotate(360deg) scale(1.05)}}
@keyframes sweep{from{transform:translateX(-35%) rotate(0deg)}to{transform:translateX(35%) rotate(360deg)}}
@keyframes reveal{to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(197,160,89,.35)}50%{box-shadow:0 0 0 10px rgba(197,160,89,0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes shine{from{transform:translateX(-120%)}to{transform:translateX(120%)}}

@media (max-width: 1200px) {
  .hero-strip { grid-template-columns: repeat(2,1fr); }
  .lobby-content { grid-template-columns: 1fr; }
  .rooms-grid { max-height: none; }
}
@media (max-width: 760px) {
  .lobby-container { width: 100%; border-radius: 0; min-height:100dvh; }
  .lobby-header { flex-direction: column; align-items: start; }
  .header-actions { width:100%; }
  .btn-back,.btn-refresh { flex:1; }
  .hero-strip { grid-template-columns: 1fr; }
}
</style>
