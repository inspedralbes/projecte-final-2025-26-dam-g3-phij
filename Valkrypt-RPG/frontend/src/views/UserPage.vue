<template>
  <div class="user-page">
    <nav class="user-nav">
      <div class="nav-brand">VALKRYPT</div>
      <div class="nav-actions">
        <router-link to="/friends" class="nav-link">AMIGOS</router-link>
        <router-link to="/profile" class="profile-container">
          <div class="profile-avatar">{{ userInitial }}</div>
        </router-link>
      </div>
    </nav>

    <main class="content">
      <header class="section-header">
        <h1>MIS AVENTURAS</h1>
        <p>Continúa tu leyenda o forja una nueva.</p>
      </header>

      <section class="stories-grid">
        <div class="story-card saved-story" v-for="story in savedStories" :key="story.id">
          <div class="card-overlay">
            <h3>{{ story.title }}</h3>
            <span class="last-played">Visto: {{ story.date }}</span>
            <button class="btn-play" @click="resumeGame(story.id)">CONTINUAR</button>
          </div>
        </div>

        <div class="story-card create-story" @click="startNewGame">
          <div class="plus-icon">+</div>
          <p>NUEVA HISTORIA</p>
        </div>
      </section>

      <section class="friends-footer">
        <button class="btn-add-friends" @click="router.push('/friends')">
          + AGREGAR AMIGOS
        </button>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userInitial = ref('?');


const savedStories = ref([
  { id: 1, title: 'El Despertar del Caos', date: '12/02' },
  { id: 2, title: 'Sombras en el Norte', date: 'Ayer' }
]);

onMounted(() => {

  const userData = JSON.parse(localStorage.getItem('user'));
  if (userData && userData.username) {
    userInitial.value = userData.username.charAt(0).toUpperCase();
  }
});

const resumeGame = (id) => {
  console.log("Cargando historia:", id);
  router.push('/game');
};

const startNewGame = () => {
  router.push('/game');
};
</script>

<style scoped>
.user-page {
  min-height: 100vh;
  background-color: #050505;
  color: #e0e0e0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.user-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 40px;
  background: #000;
  border-bottom: 2px solid #d4af37;
}

.nav-brand {
  color: #d4af37;
  font-weight: bold;
  letter-spacing: 2px;
  font-size: 1.2rem;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 25px;
}

.nav-link {
  color: #aaa;
  text-decoration: none;
  font-size: 0.9rem;
  transition: 0.3s;
}

.nav-link:hover { color: #d4af37; }

.profile-avatar {
  width: 38px;
  height: 38px;
  background: #1a1a1a;
  border: 1px solid #d4af37;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d4af37;
  font-weight: bold;
}

.content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 50px 20px;
}

.section-header h1 {
  font-size: 2rem;
  color: #fff;
  margin-bottom: 5px;
}

.section-header p {
  color: #666;
  margin-bottom: 40px;
}

.stories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 30px;
  margin-bottom: 60px;
}

.story-card {
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  transition: transform 0.3s;
  border: 1px solid #222;
}

.saved-story {
  background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.9)), 
              url('https://images.unsplash.com/photo-1519074063912-ad25b5ce4924?q=80&w=500');
  background-size: cover;
  display: flex;
  align-items: flex-end;
  padding: 20px;
}

.card-overlay h3 { margin: 0; font-size: 1.1rem; }
.last-played { font-size: 0.75rem; color: #888; display: block; margin-bottom: 15px; }

.btn-play {
  background: #d4af37;
  color: black;
  border: none;
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
}

.create-story {
  border: 2px dashed #333;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #444;
  cursor: pointer;
}

.create-story:hover {
  border-color: #d4af37;
  color: #d4af37;
  transform: translateY(-5px);
}

.plus-icon { font-size: 3rem; margin-bottom: 10px; }

.friends-footer {
  border-top: 1px solid #1a1a1a;
  padding-top: 40px;
  text-align: center;
}

.btn-add-friends {
  background: transparent;
  color: #888;
  border: 1px solid #444;
  padding: 12px 30px;
  border-radius: 25px;
  cursor: pointer;
  transition: 0.3s;
}

.btn-add-friends:hover {
  border-color: #d4af37;
  color: #d4af37;
  background: rgba(212, 175, 55, 0.05);
}
</style>