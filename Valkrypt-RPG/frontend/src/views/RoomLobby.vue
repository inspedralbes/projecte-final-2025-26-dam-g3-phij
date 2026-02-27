<template>
  <div class="room-lobby">
    <div class="lobby-container">
      <header class="lobby-header">
        <h1>⚔️ VALKRYPT - Multiplayer Lobby</h1>
        <p>Create or join a room to play with other players</p>
      </header>

      <div class="lobby-content">
        <!-- Create Room Section -->
        <section class="create-room-section">
          <h2>Create New Room</h2>
          <div class="form-group">
            <input
              v-model="newRoom.roomName"
              type="text"
              placeholder="Enter room name"
              class="input-field"
              maxlength="30"
            />
            <select v-model.number="newRoom.maxPlayers" class="input-field">
              <option value="2">2 Players</option>
              <option value="3">3 Players</option>
              <option value="4">4 Players</option>
            </select>
            <button @click="createRoom" class="btn-create" :disabled="loading">
              {{ loading ? 'Creating...' : 'Create Room' }}
            </button>
          </div>
        </section>

        <!-- Active Rooms Section -->
        <section class="active-rooms-section">
          <h2>Available Rooms ({{ availableRooms.length }})</h2>
          <div v-if="loadingRooms" class="loading">Loading rooms...</div>
          <div v-else-if="availableRooms.length === 0" class="no-rooms">
            No available rooms. Create one to get started!
          </div>
          <div v-else class="rooms-grid">
            <div
              v-for="room in availableRooms"
              :key="room.roomCode"
              class="room-card"
            >
              <header class="room-header">
                <h3>{{ room.roomName }}</h3>
                <span class="room-code">{{ room.roomCode }}</span>
              </header>
              <div class="room-info">
                <p><i class="fas fa-users"></i> {{ room.players.length }}/{{ room.maxPlayers }} Players</p>
                <p><i class="fas fa-user-crown"></i> Host: {{ room.hostName }}</p>
              </div>
              <div class="room-players">
                <div v-for="player in room.players" :key="player.userId" class="player-badge">
                  {{ player.username.substring(0, 2).toUpperCase() }}
                </div>
              </div>
              <button
                @click="joinRoom(room)"
                class="btn-join"
                :disabled="loading || room.players.length >= room.maxPlayers"
              >
                {{ loading ? 'Joining...' : 'Join Room' }}
              </button>
              <!-- Re-enter button placed on every card -->
              <button
                @click="reenterRoom(room)"
                class="btn-reenter"
                :disabled="loading || room.players.length >= room.maxPlayers"
              >
                Re-enter
              </button>

            </div>
          </div>
        </section>
      </div>

      <div class="lobby-footer">
        <button @click="backToMenu" class="btn-back">← Back to Menu</button>
      </div>

      <!-- Error notification -->
      <div v-if="error" class="error-notification">
        <i class="fas fa-exclamation-circle"></i> {{ error }}
      </div>

      <!-- Success notification -->
      <div v-if="success" class="success-notification">
        <i class="fas fa-check-circle"></i> {{ success }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const API_URL = '/api';

const newRoom = ref({
  roomName: '',
  maxPlayers: 4
});

const loading = ref(false);
const visitedRooms = ref(new Set());
const visitedRoomsKey = 'visitedRooms';
const loadingRooms = ref(false);
const error = ref('');
const success = ref('');
const availableRooms = ref([]);

const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const token = localStorage.getItem('token');

const fetchRooms = async () => {
  try {
    loadingRooms.value = true;
    const response = await axios.get(`${API_URL}/rooms/active`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data.success) {
      availableRooms.value = response.data.rooms;
    }
  } catch (err) {
    console.error('Error fetching rooms:', err);
    error.value = 'Failed to load rooms';
  } finally {
    loadingRooms.value = false;
  }
};

const createRoom = async () => {
  if (!newRoom.value.roomName.trim()) {
    error.value = 'Please enter a room name';
    return;
  }
  try {
    loading.value = true;
    error.value = '';
    const response = await axios.post(`${API_URL}/rooms/create`, {
      roomName: newRoom.value.roomName,
      maxPlayers: newRoom.value.maxPlayers,
      userId: user.value.id,
      username: user.value.username
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data.success) {
      success.value = 'Room created! Joining...';
      newRoom.value.roomName = '';
      setTimeout(() => router.push({ name: 'GameRoom', params: { roomCode: response.data.room.roomCode } }), 1000);
    }
  } catch (err) {
    console.error('Error creating room:', err);
    error.value = err.response?.data?.message || 'Failed to create room';
  } finally {
    loading.value = false;
  }
};

const joinRoom = async (room) => {
  try {
    loading.value = true;
    error.value = '';
    const response = await axios.post(`${API_URL}/rooms/join`, {
      roomCode: room.roomCode,
      userId: user.value.id,
      username: user.value.username,
      character: user.value.character
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data.success) {
      success.value = 'Joined room! Entering game...';
      visitedRooms.value.add(room.roomCode);
      localStorage.setItem(visitedRoomsKey, JSON.stringify([...visitedRooms.value]));
      setTimeout(() => router.push({ name: 'GameRoom', params: { roomCode: room.roomCode } }), 1000);
    }
  } catch (err) {
    console.error('Error joining room:', err);
    error.value = err.response?.data?.message || 'Failed to join room';
  } finally {
    loading.value = false;
  }
};

const reenterRoom = async (room) => {
  await joinRoom(room);
};

const backToMenu = () => {
  router.push({ name: 'friends' });
};



let refreshInterval;
onMounted(() => {
  try {
    const stored = JSON.parse(localStorage.getItem(visitedRoomsKey) || '[]');
    stored.forEach(code => visitedRooms.value.add(code));
  } catch {}

  fetchRooms();
  refreshInterval = setInterval(fetchRooms, 3000);
});

onBeforeUnmount(() => {
  if (refreshInterval) clearInterval(refreshInterval);
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

.room-lobby {
  min-height: 100vh;
  background: linear-gradient(135deg, $dark-bg 0%, $darker-bg 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: 'Arial', sans-serif;
  scrollbar-color: $gold rgba(20, 20, 20, 0.8);
  scrollbar-width: thin;
}

.lobby-container {
  width: 100%;
  max-width: 1200px;
  background: rgba(20, 20, 20, 0.95);
  border: 2px solid $gold;
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
}

.lobby-header {
  text-align: center;
  margin-bottom: 40px;
  border-bottom: 2px solid $gold;
  padding-bottom: 20px;

  h1 {
    color: $gold;
    font-size: 2.5em;
    margin: 0 0 10px 0;
    text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
  }

  p {
    color: #aaa;
    font-size: 1.1em;
    margin: 0;
  }
}

.lobby-content {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 30px;
  margin-bottom: 30px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

section {
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 6px;
  padding: 25px;

  h2 {
    color: $gold;
    margin-top: 0;
    margin-bottom: 20px;
    border-bottom: 1px solid $gold;
    padding-bottom: 10px;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-field {
  background: rgba(50, 50, 50, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.4);
  color: white;
  padding: 12px 15px;
  border-radius: 4px;
  font-size: 1em;

  &:focus {
    outline: none;
    border-color: $gold;
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
  }

  &::placeholder {
    color: #666;
  }
}

.btn-create {
  background: linear-gradient(135deg, $gold 0%, #c9a632 100%);
  color: #000;
  border: none;
  padding: 12px 25px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 1.1em;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    box-shadow: 0 0 15px rgba(212, 175, 55, 0.6);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.room-card {
  background: rgba(40, 40, 40, 0.9);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 6px;
  padding: 20px;
  transition: all 0.3s ease;

  &:hover {
    border-color: $gold;
    box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
    transform: translateY(-5px);
  }
}

.room-header {
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  margin-bottom: 15px;
  padding-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    color: $gold;
    margin: 0;
    font-size: 1.2em;
  }

  .room-code {
    background: rgba(212, 175, 55, 0.2);
    color: $gold;
    padding: 4px 12px;
    border-radius: 3px;
    font-size: 0.85em;
    font-weight: bold;
  }
}

.room-info {
  margin-bottom: 15px;
  color: #aaa;

  p {
    margin: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      color: $gold;
    }
  }
}

.room-players {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.player-badge {
  background: rgba(212, 175, 55, 0.2);
  color: $gold;
  width: 35px;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.8em;
  font-weight: bold;
  border: 1px solid $gold;
}

.btn-join {
  flex: 1;
  background: linear-gradient(135deg, $green 0%, #1e8449 100%);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;

  &:hover:not(:disabled) {
    box-shadow: 0 0 15px rgba(39, 174, 96, 0.5);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-reenter {
  flex: 1;
  background: linear-gradient(135deg, $gold 0%, #c9a632 100%);
  color: #000;
  border: none;
  padding: 10px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;

  &:hover:not(:disabled) {
    box-shadow: 0 0 15px rgba(212, 175, 55, 0.5);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}



.loading,
.no-rooms {
  text-align: center;
  color: #999;
  padding: 30px 10px;
  font-style: italic;
}

.lobby-footer {
  text-align: center;
  border-top: 1px solid rgba(212, 175, 55, 0.3);
  padding-top: 20px;
}

.btn-back {
  background: rgba(212, 175, 55, 0.2);
  color: $gold;
  border: 1px solid $gold;
  padding: 10px 25px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;

  &:hover {
    background: $gold;
    color: #000;
  }
}

.error-notification,
.success-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

.error-notification {
  background: rgba($red, 0.9);
  color: white;
  border: 1px solid $red;
}

.success-notification {
  background: rgba($green, 0.9);
  color: white;
  border: 1px solid $green;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
