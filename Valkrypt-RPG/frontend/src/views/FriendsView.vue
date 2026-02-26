<template>
  <div class="friends-page">
    <nav class="sec-nav">
      <router-link to="/userpage" class="nav-back">← VOLVER</router-link>
      <h2>AMIGOS & MULTIPLAYER</h2>
    </nav>

    <main>
      <section class="friends-list">
        <h3>Lista de amigos</h3>
        <div v-if="friends.length === 0" class="empty">Aún no tienes amigos agregados.</div>
        <ul v-else>
          <li v-for="f in friends" :key="f.username">
            <span class="avatar">{{ f.username.charAt(0).toUpperCase() }}</span>
            <span class="name">{{ f.username }}</span>
            <button class="btn-chat" @click="startPrivateChat(f.username)">Chat</button>
          </li>
        </ul>
      </section>

      <section class="multiplayer">
        <h3>Multijugador</h3>
        <p>Únete a una sala o crea la tuya para jugar con otros usuarios.</p>
        <button class="btn-rooms" @click="goToLobby">Ir al Lobby</button>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const friends = ref([]);

onMounted(() => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user || !user.username) {
    router.push('/login');
    return;
  }
  // load friends list (temporary, could fetch from backend later)
  friends.value = user.friends || [];
});

const goToLobby = () => {
  router.push({ name: 'RoomLobby' });
};

const startPrivateChat = (username) => {
  alert(`Abrir chat privado con ${username}`);
};
</script>

<style scoped lang="scss">
.friends-page {
  min-height: 100vh;
  background: #050505;
  color: #eee;
  padding: 20px;
  font-family: 'Arial', sans-serif;
}

.sec-nav {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 40px;

  .nav-back {
    color: #aaa;
    text-decoration: none;
    &:hover { color: #fff; }
  }

  h2 {
    color: #d4af37;
    margin: 0;
  }
}

main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;

  @media(max-width:768px) {
    grid-template-columns: 1fr;
  }
}

.friends-list {
  background: rgba(20,20,20,0.9);
  padding: 20px;
  border-radius: 6px;

  h3 { color: #d4af37; margin-bottom: 15px; }

  .empty { color: #777; font-style: italic; }

  ul { list-style: none; margin: 0; padding: 0;
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #333;

      .avatar {
        background: #d4af37;
        color: #000;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }

      .name { flex: 1; }

      .btn-chat {
        background: #27ae60;
        border: none;
        color: #000;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: 0.2s;
        &:hover { background: #2ecc71; }
      }
    }
  }
}

.multiplayer {
  background: rgba(20,20,20,0.9);
  padding: 20px;
  border-radius: 6px;

  h3 { color: #d4af37; margin-bottom: 15px; }

  .btn-rooms {
    background: #c5a059;
    border: none;
    color: #000;
    padding: 10px 20px;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
    &:hover { background: #d4af37; }
  }
}
</style>
