<template>
  <div class="game-viewport">
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
          <span>{{ campaignTitle }} - {{ locationName }}</span>
        </div>
      </div>

      <div class="nav-right">
        <button class="btn-friends" @click="toggleFriends">
          <i class="fas fa-users"></i>
          <span class="online-indicator">3</span>
          <span>ALIANZAS</span>
        </button>
      </div>
    </nav>

    <div class="main-layout">
      <aside class="party-sidebar">
        <div v-for="hero in party" :key="hero.id" class="hero-card" :class="{ 'hero-dead': hero.hp <= 0 }">
          <div class="hero-avatar">
            <span class="icon">{{ hero.icon }}</span>
            <div class="hp-bar">
              <div class="hp-fill" :style="{ width: (hero.hp / hero.maxHp) * 100 + '%' }"></div>
            </div>
          </div>
          <div class="hero-info">
            <span class="hero-name">{{ hero.name }}</span>
            <span class="hero-role">{{ hero.role }}</span>
            <div class="hero-stats-mini">
              <span>HP {{ hero.hp }}/{{ hero.maxHp }}</span>
            </div>
          </div>
        </div>
      </aside>

      <main class="game-stage">
        <div class="log-container" ref="logContainer">
          <div v-for="(entry, index) in history" :key="index" class="log-entry" :class="entry.type">
            <p v-if="entry.type === 'narrative'" class="text-narrative">{{ entry.content }}</p>
            <div v-if="entry.type === 'combat'" class="text-combat">
              <i class="fas fa-skull"></i> {{ entry.content }}
            </div>
          </div>
        </div>

        <footer class="action-bar">
          <div class="action-grid">
            <button @click="handleAction('explorar')" class="btn-action">EXPLORAR</button>
            <button @click="handleAction('descansar')" class="btn-action">DESCANSAR</button>
            <button @click="handleAction('atacar')" class="btn-action danger">ATACAR</button>
          </div>
        </footer>
      </main>
    </div>

    <transition name="slide-right">
      <div v-if="showFriends" class="friends-overlay">
        <header>
          <h3>ALIANZAS ACTIVAS</h3>
          <button @click="showFriends = false">✕</button>
        </header>
        <div class="friends-list">
          <div class="friend-item online">
            <div class="f-avatar">MA</div>
            <div class="f-info"><strong>Marco_Dam</strong> <small>En Bastión Real</small></div>
          </div>
          <div class="friend-item online">
            <div class="f-avatar">EL</div>
            <div class="f-info"><strong>Elena_Valk</strong> <small>En las Minas</small></div>
          </div>
          <div class="friend-item offline">
            <div class="f-avatar">JO</div>
            <div class="f-info"><strong>Jordi_66</strong> <small>Desconectado</small></div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();


const showFriends = ref(false);
const showMenu = ref(false);


const campaignTitle = ref("La Sombra de Piedraprofunda");
const locationName = ref("Taberna El Perro Ciego");
const currentBackground = ref("https://images.unsplash.com/photo-1519074063912-ad25b5ce4924?q=80&w=1200");

const party = ref([
  { id: 1, name: 'Kaelen', role: 'Guerrero', hp: 45, maxHp: 50, icon: '⚔️' },
  { id: 2, name: 'Vax', role: 'Pícaro', hp: 22, maxHp: 30, icon: '🗡️' },
  { id: 3, name: 'Elara', role: 'Maga', hp: 18, maxHp: 25, icon: '🩸' },
  { id: 4, name: 'Sorin', role: 'Clérigo', hp: 28, maxHp: 35, icon: '⚖️' }
]);

const history = ref([
  { type: 'narrative', content: 'La lluvia golpea el tejado de la taberna. El Rey Alaric busca algo... y vuestras almas están marcadas.' },
  { type: 'combat', content: '¡Un asesino de la Guardia de Hierro emerge de las sombras!' }
]);

const toggleFriends = () => showFriends.value = !showFriends.value;
const toggleMenu = () => alert("Menú: Guardar / Ajustes / Salir");

const handleAction = (type) => {
  history.value.push({ type: 'narrative', content: `Decides ${type} la zona con cautela...` });
};

onMounted(() => {

  const savedSession = JSON.parse(localStorage.getItem('valkrypt_current_game'));
  if (savedSession) {
    campaignTitle.value = savedSession.campaignTitle;
    party.value = savedSession.party.map(p => ({ ...p, hp: 30, maxHp: 30 })); 
  }
});
</script>

<style scoped lang="scss">
$gold: #c5a059;
$dark-card: rgba(15, 15, 15, 0.9);
$crimson: #8a1c1c;

.game-viewport {
  width: 100vw;
  height: 100vh;
  background: #000;
  color: #eee;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}


.fx-layer {
  position: absolute;
  inset: 0;
  &.bg-image { background-size: cover; background-position: center; opacity: 0.4; }
  &.vignette { background: radial-gradient(circle, transparent 30%, #000 100%); }
  &.grain { background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.05; }
}

.hud-top {
  height: 60px;
  background: linear-gradient(to bottom, rgba(0,0,0,1), transparent);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  z-index: 10;
  border-bottom: 1px solid rgba($gold, 0.2);

  .nav-center .location-tag {
    font-family: 'Cinzel', serif;
    color: $gold;
    display: flex;
    align-items: center;
    gap: 10px;
    letter-spacing: 1px;
  }
}

.btn-icon-menu, .btn-friends {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba($gold, 0.3);
  color: #fff;
  padding: 8px 15px;
  cursor: pointer;
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 8px;
  &:hover { background: rgba($gold, 0.2); }
}

.online-indicator {
  background: #2ecc71;
  color: black;
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 10px;
  font-weight: bold;
}


.main-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  position: relative;
  z-index: 5;
  height: calc(100vh - 60px);
}


.party-sidebar {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  border-right: 1px solid rgba($gold, 0.1);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.hero-card {
  background: $dark-card;
  border: 1px solid #333;
  padding: 12px;
  display: flex;
  gap: 12px;
  border-radius: 4px;
  transition: 0.3s;
  
  &:hover { border-color: $gold; transform: translateX(5px); }

  .hero-avatar {
    width: 50px;
    .icon { font-size: 2rem; display: block; text-align: center; }
  }

  .hp-bar {
    width: 100%;
    height: 4px;
    background: #222;
    margin-top: 8px;
    .hp-fill { height: 100%; background: $crimson; transition: 0.5s; }
  }

  .hero-name { font-family: 'Cinzel', serif; display: block; color: $gold; font-size: 0.9rem; }
  .hero-role { font-size: 0.7rem; color: #888; text-transform: uppercase; }
  .hero-stats-mini { font-size: 0.7rem; margin-top: 5px; color: #bbb; }
}


.game-stage {
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  background: rgba(0,0,0,0.3);
  mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);

  .text-narrative { font-size: 1.1rem; line-height: 1.6; color: #ccc; }
  .text-combat { color: #ff6b6b; font-weight: bold; padding: 10px; background: rgba(138, 28, 28, 0.1); border-left: 3px solid $crimson; }
}


.action-bar {
  height: 120px;
  padding: 20px;
  .action-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    max-width: 800px;
    margin: 0 auto;
  }
}

.btn-action {
  background: rgba(255,255,255,0.05);
  border: 1px solid #444;
  color: #fff;
  padding: 15px;
  font-family: 'Cinzel', serif;
  cursor: pointer;
  transition: 0.3s;
  &:hover { background: $gold; color: #000; border-color: $gold; }
  &.danger:hover { background: $crimson; color: #fff; border-color: $crimson; }
}


.friends-overlay {
  position: absolute;
  right: 0; top: 60px; bottom: 0;
  width: 300px;
  background: #0a0a0a;
  border-left: 1px solid $gold;
  z-index: 100;
  padding: 20px;

  header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 20px;
    h3 { font-family: 'Cinzel', serif; color: $gold; font-size: 0.9rem; }
    button { background: none; border: none; color: #fff; cursor: pointer; }
  }
}

.friend-item {
  display: flex; gap: 10px; margin-bottom: 15px; align-items: center;
  opacity: 0.6;
  &.online { opacity: 1; .f-avatar { border-color: #2ecc71; } }
  .f-avatar { width: 35px; height: 35px; background: #222; border: 1px solid #444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
  .f-info { strong { display: block; font-size: 0.85rem; } small { color: $gold; font-size: 0.7rem; } }
}

.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.3s ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-thumb { background: #333; }
</style>