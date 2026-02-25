<template>
  <div class="user-page">
    <div class="ambient-overlay">
      <div class="fog"></div>
      <div class="vignette"></div>
    </div>

    <nav class="nav-shell">
      <div class="nav-container">
        <div class="brand">
          <i class="ra ra-sword-brandish"></i>
          <span>VALKRYPT</span>
        </div>

        <div class="nav-center">
          <router-link to="/friends" class="nav-link">
            <i class="fas fa-users"></i> ALIANZAS
          </router-link>
          <router-link to="/codice" class="nav-link">
            <i class="fas fa-book-dead"></i> CÓDICE
          </router-link>
        </div>

        <div class="nav-right">
          <router-link to="/profile" class="profile-pill">
            <div class="avatar">{{ userInitial }}</div>
            <span class="p-label">PERFIL</span>
          </router-link>
          <button @click="handleLogout" class="btn-exit" title="Cerrar Sesión">
            <i class="fas fa-power-off"></i>
          </button>
        </div>
      </div>
    </nav>

    <main class="dashboard">
      <header class="page-head">
        <p class="kicker">Crónicas del Reino</p>
        <h1>MIS AVENTURAS</h1>
      </header>

      <section class="adventures-grid">
        <div class="adv-card create" @click="isSelectingCampaign = true">
          <div class="card-inner">
            <span class="icon">+</span>
            <h3>INICIAR NUEVA LEYENDA</h3>
            <p>La IA tejerá un nuevo camino hacia el Abismo.</p>
          </div>
        </div>

        <div v-for="save in savedGames" :key="save.id" class="adv-card saved">
          <div class="card-img" :style="{ backgroundImage: `url(${save.img})` }">
            <div class="status-tag">{{ save.location }}</div>
          </div>
          <div class="card-body">
            <h3>{{ save.title }}</h3>
            <p class="last-event">"{{ save.lastEvent }}"</p>
            <div class="card-meta">
              <span><i class="far fa-clock"></i> {{ save.date }}</span>
              <button class="btn-play" @click="resumeGame(save.id)">CONTINUAR</button>
            </div>
          </div>
        </div>
      </section>

      <transition name="fade">
        <div v-if="isSelectingCampaign" class="campaign-selector-overlay">
          <div class="selector-content">
            <header class="selector-header">
              <h2>ELIGE TU HISTORIA</h2>
              <button class="btn-close" @click="isSelectingCampaign = false">✕</button>
            </header>
            
            <div class="campaign-options">
              <div 
                v-for="camp in availableCampaigns" 
                :key="camp.id" 
                class="camp-option-card"
              >
                <div class="camp-image" :style="{ backgroundImage: `url(${camp.img})` }"></div>
                <div class="camp-info">
                  <h3>{{ camp.title }}</h3>
                  <p>{{ camp.desc }}</p>
                  
                  <div class="camp-actions">
                    <button class="btn-camp-new" @click="startNewGame(camp.id)">
                      <i class="fas fa-plus"></i> EMPEZAR
                    </button>
                    <button class="btn-camp-continue" @click="resumeGame(camp.id)">
                      <i class="fas fa-play"></i> CONTINUAR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const userInitial = ref('?');
const isSelectingCampaign = ref(false);

// Partidas guardadas - Simulacion aun no esta conectado a la base de datos de mongo atlas
const savedGames = ref([
  {
    id: 'piedraprofunda',
    title: "La Sombra de Piedraprofunda",
    location: "El Perro Ciego",
    lastEvent: "Kaelen y Vax discuten el plan bajo la lluvia de ceniza.",
    date: "Hace 2 horas",
    img: "https://images.unsplash.com/photo-1519074063912-ad25b5ce4924?q=80&w=500"
  }
]);

const availableCampaigns = [
  {
    id: 'piedraprofunda',
    title: 'La Sombra de Piedraprofunda',
    desc: 'El Rey Alaric ha despertado un poder antiguo en las profundidades de Bastión Real.',
    img: 'https://images.unsplash.com/photo-1519074063912-ad25b5ce4924?q=80&w=600'
  },
  {
    id: 'minas',
    title: 'Las Minas del Norte',
    desc: 'El invierno eterno oculta secretos que nunca debieron ser desenterrados.',
    img: 'https://images.unsplash.com/photo-1505118380757-91f5f5832de0?q=80&w=600'
  }
];

onMounted(() => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.username) {
    userInitial.value = user.username.charAt(0).toUpperCase();
  }
});

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};


const startNewGame = (campId) => {
  router.push({ 
    path: '/select', 
    query: { campaign: campId } 
  });
};

const resumeGame = (id) => {
  router.push(`/game/${id}`);
};
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

$gold: #c5a059;
$dark-bg: #050505;
$card-bg: rgba(20, 20, 20, 0.9);

.user-page {
  min-height: 100vh;
  background: $dark-bg;
  color: #eee;
  position: relative;
  overflow-x: hidden;
  font-family: 'Lato', sans-serif;
}


.ambient-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  .fog {
    position: absolute;
    inset: 0;
    background: url('https://raw.githubusercontent.com/danielstuart14/CSS_FOG_ANIMATION/master/img/fog1.png') repeat-x;
    opacity: 0.1;
    animation: fogMove 60s linear infinite;
  }
  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.9) 100%);
  }
}

.nav-shell {
  position: relative;
  z-index: 10;
  background: rgba(0,0,0,0.9);
  border-bottom: 1px solid rgba($gold, 0.3);
  .nav-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    height: 70px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: $gold;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  letter-spacing: 3px;
  i { font-size: 1.2rem; }
}

.nav-link {
  color: #888;
  text-decoration: none;
  margin: 0 1.5rem;
  font-size: 0.85rem;
  font-family: 'Cinzel', serif;
  transition: 0.3s;
  &:hover { color: $gold; text-shadow: 0 0 8px rgba($gold, 0.4); }
}

.profile-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  background: rgba(255,255,255,0.03);
  padding: 6px 18px;
  border-radius: 20px;
  border: 1px solid rgba($gold, 0.2);
  transition: 0.3s;
  .avatar {
    width: 26px;
    height: 26px;
    background: $gold;
    color: black;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.8rem;
  }
  .p-label { color: #fff; font-size: 0.75rem; font-weight: bold; letter-spacing: 1px; }
  &:hover { border-color: $gold; background: rgba($gold, 0.05); }
}

.btn-exit {
  background: none;
  border: none;
  color: #633;
  cursor: pointer;
  font-size: 1.1rem;
  transition: 0.3s;
  &:hover { color: #ff4444; transform: scale(1.1); }
}


.dashboard {
  position: relative;
  z-index: 5;
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.page-head {
  margin-bottom: 3.5rem;
  .kicker { color: $gold; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 4px; margin-bottom: 0.5rem; }
  h1 { font-family: 'Cinzel', serif; font-size: 2.8rem; color: #fff; text-shadow: 0 0 20px rgba(0,0,0,0.5); }
}

.adventures-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 2.5rem;
}

.adv-card {
  background: $card-bg;
  border: 1px solid #222;
  border-radius: 4px;
  transition: 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  overflow: hidden;
  
  &:hover {
    border-color: $gold;
    transform: translateY(-8px);
    box-shadow: 0 12px 30px rgba(0,0,0,0.6);
  }

  &.create {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 2px dashed #2a2a2a;
    padding: 4rem 2rem;
    cursor: pointer;
    .icon { font-size: 3.5rem; color: #333; display: block; margin-bottom: 1.5rem; transition: 0.3s; }
    h3 { font-family: 'Cinzel', serif; color: #666; transition: 0.3s; }
    p { color: #444; font-size: 0.9rem; transition: 0.3s; }
    
    &:hover {
      border-color: $gold;
      background: rgba($gold, 0.02);
      .icon, h3 { color: $gold; }
      p { color: #888; }
    }
  }
}

.card-img {
  height: 190px;
  background-size: cover;
  background-position: center;
  position: relative;
  .status-tag {
    position: absolute;
    bottom: 0; left: 0;
    background: rgba(0,0,0,0.85);
    color: $gold;
    padding: 6px 15px;
    font-size: 0.7rem;
    font-family: 'Cinzel', serif;
    letter-spacing: 1px;
    border-top-right-radius: 4px;
  }
}

.card-body {
  padding: 1.8rem;
  h3 { font-family: 'Cinzel', serif; color: $gold; margin-bottom: 12px; font-size: 1.2rem; }
  .last-event { font-size: 0.85rem; color: #999; font-style: italic; min-height: 45px; line-height: 1.5; }
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  span { font-size: 0.75rem; color: #555; }
}

.btn-play {
  background: $gold;
  color: black;
  border: none;
  padding: 10px 22px;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  font-size: 0.8rem;
  cursor: pointer;
  border-radius: 2px;
  transition: 0.3s;
  &:hover { background: #d4b47a; transform: translateY(-2px); }
}

.campaign-selector-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.96);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 25px;
  backdrop-filter: blur(8px);
}

.selector-content {
  width: 100%;
  max-width: 950px;
  background: #0a0a0a;
  border: 1px solid rgba($gold, 0.4);
  padding: 45px;
  border-radius: 4px;
  position: relative;
  box-shadow: 0 0 50px rgba(0,0,0,1);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 35px;
  border-bottom: 1px solid rgba($gold, 0.1);
  padding-bottom: 20px;
  h2 { font-family: 'Cinzel', serif; color: $gold; letter-spacing: 2px; }
}

.btn-close {
  background: none; border: none; color: #444; font-size: 1.6rem; cursor: pointer;
  transition: 0.3s;
  &:hover { color: #fff; transform: rotate(90deg); }
}

.campaign-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 25px;
}

.camp-option-card {
  background: #111;
  border: 1px solid #222;
  border-radius: 4px;
  overflow: hidden;
  transition: 0.3s;
  
  .camp-image { 
    height: 170px; 
    background-size: cover; 
    background-position: center; 
    filter: grayscale(40%); 
    transition: 0.5s; 
  }
  
  &:hover {
    border-color: rgba($gold, 0.5);
    .camp-image { filter: grayscale(0%); }
  }

  .camp-info { 
    padding: 22px; 
    h3 { color: $gold; font-family: 'Cinzel', serif; margin-bottom: 12px; font-size: 1.1rem; }
    p { font-size: 0.88rem; color: #888; margin-bottom: 25px; min-height: 48px; line-height: 1.4; }
  }
}

.camp-actions {
  display: flex;
  gap: 12px;
  
  button {
    flex: 1;
    padding: 12px 5px;
    font-family: 'Cinzel', serif;
    font-weight: bold;
    font-size: 0.75rem;
    cursor: pointer;
    transition: 0.3s;
    border-radius: 2px;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    i { font-size: 0.7rem; }
  }
}

.btn-camp-new {
  background: transparent;
  border: 1px solid $gold;
  color: $gold;
  &:hover {
    background: rgba($gold, 0.1);
    box-shadow: inset 0 0 10px rgba($gold, 0.2);
  }
}

.btn-camp-continue {
  background: $gold;
  border: 1px solid $gold;
  color: #000;
  &:hover {
    background: #d4b47a;
    box-shadow: 0 0 15px rgba($gold, 0.3);
  }
}

@keyframes fogMove {
  from { background-position: 0 0; }
  to { background-position: 1000px 0; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>