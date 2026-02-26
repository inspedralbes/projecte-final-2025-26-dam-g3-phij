<template>
  <div class="game-viewport">
    <div class="fx-layer bg-image" :style="{ backgroundImage: `url(${currentBackground || '/assets/default-bg.jpg'})` }"></div>
    <div class="fx-layer vignette"></div>
    <div class="fx-layer grain"></div>
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
        </div>
      </div>

      <div class="nav-right">
        <button class="btn-hud alliance-btn" @click="showFriends = !showFriends">
          <i class="fas fa-shield-alt"></i>
          <span class="online-indicator">3</span>
          <span class="btn-label">ALIANZAS</span>
        </button>
      </div>
    </nav>

    <div class="main-layout">
      <aside class="party-sidebar">
        <div class="sidebar-header">COMPAÑEROS</div>
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
            <div class="hero-hp-text">HP {{ hero.hp }} / {{ hero.maxHp }}</div>
          </div>
        </div>
      </aside>

      <main class="game-stage">
        <div class="log-container" ref="logContainer">
          <div v-for="(entry, index) in history" :key="index" class="log-entry-wrapper">
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
            <span class="typing-text">EL NARRADOR ESTÁ FORJANDO LA HISTORIA...</span>
          </div>
        </div>

        <footer class="action-bar" :class="{ 'bar-disabled': isTyping }">
          <div class="action-grid">
            <button 
              v-for="option in currentOptions" 
              :key="option.id" 
              @click="handleAction(option)" 
              class="btn-action-fantasy"
              :class="{ 'btn-danger': option.type === 'combat' }"
              :disabled="isTyping"
            >
              <span class="btn-inner">{{ option.label }}</span>
            </button>
          </div>
        </footer>
      </main>
    </div>

    <transition name="panel-slide">
      <div v-if="showFriends" class="friends-panel">
        <div class="panel-header">
          <h3>ALIANZAS ACTIVAS</h3>
          <button class="close-btn" @click="showFriends = false">✕</button>
        </div>
        <div class="friends-list">
          <div class="friend-card online">
            <div class="status-dot"></div>
            <div class="f-info"><strong>Marco_Dam</strong> <small>En Bastión Real</small></div>
          </div>
          <div class="friend-card offline">
            <div class="status-dot"></div>
            <div class="f-info"><strong>Jordi_66</strong> <small>Desconectado</small></div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';


const router = useRouter();
const logContainer = ref(null);
const isTyping = ref(false);
const showFriends = ref(false);

const userId = ref(null);
const campaignTitle = ref("LA SOMBRA DE PIEDRAPROFUNDA");
const locationName = ref("Cargando...");
const currentBackground = ref("");
const party = ref([]);
const history = ref([]);
const currentOptions = ref([]);


const fetchGameState = async () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return router.push('/login');
  userId.value = user.id || user._id;

  try {
    const response = await fetch(`/api/game/load/${userId.value}`);
    const data = await response.json();
    if (response.ok) {
      locationName.value = data.locationName || "Desconocido";
      currentBackground.value = data.currentBackground;
      party.value = data.party || [];
      history.value = data.history || [];
      currentOptions.value = data.currentOptions || [];
      await scrollToBottom();
    }
  } catch (err) {
    console.error("Error crítico de carga:", err);
  }
};


const handleAction = async (option) => {
  if (isTyping.value) return;
  
  try {

    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId.value, action: option })
    });
    
    const newState = await res.json();
    if (res.ok) {
      history.value = newState.history;
      currentOptions.value = [];
      await callNarrator(option.label);
    }
  } catch (err) {
    console.error("Error en acción:", err);
  }
};

const callNarrator = async (playerAction) => {
  isTyping.value = true;
  try {
    const response = await fetch('/api/game/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAction,
        storyHistory: history.value.map(h => ({ 
          role: h.type === 'narrative' ? 'model' : 'user', 
          text: h.content 
        })),
        worldSeed: `Contexto: ${locationName.value}`
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let aiEntry = { type: 'narrative', content: '' };
    history.value.push(aiEntry);

    let fullOutput = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullOutput += chunk;


      aiEntry.content = fullOutput
        .split('<DECISIONES>')[0]
        .replace(/<NARRATIVA>|<\/NARRATIVA>/g, '')
        .trim();

      await scrollToBottom();
    }

   
    processFinalTags(fullOutput);
  } catch (err) {
    console.error("Error en stream:", err);
  } finally {
    isTyping.value = false;
  }
};

const processFinalTags = (text) => {
  const decisions = text.match(/<DECISIONES>([\s\S]*?)<\/DECISIONES>/);
  if (decisions) {
    const lines = decisions[1].trim().split('\n');
    currentOptions.value = lines.map(line => {
      const m = line.match(/\[id:(.*?)\]\s*(.*)/);
      return m ? { id: m[1], label: m[2], type: 'narrative' } : null;
    }).filter(o => o);
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

onMounted(fetchGameState);
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital,wght@0,400;0,700;1,400&display=swap');

$gold: #c5a059;
$gold-bright: #f0d7a3;
$crimson: #8a1c1c;
$bg-dark: #050505;
$border-alpha: rgba(197, 160, 89, 0.2);

.game-viewport {
  width: 100vw; height: 100vh; background: $bg-dark;
  color: #eee; overflow: hidden; position: relative;
  display: flex; flex-direction: column;
}


.fx-layer {
  position: absolute; inset: 0; pointer-events: none;
  &.bg-image { background-size: cover; background-position: center; opacity: 0.3; transition: 2s; z-index: 1; }
  &.vignette { background: radial-gradient(circle, transparent 20%, #000 100%); z-index: 2; }
  &.grain { background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.05; z-index: 3; }
  &.scanlines { background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02)); background-size: 100% 4px, 3px 100%; z-index: 4; }
}

.hud-top {
  height: 70px; display: flex; justify-content: space-between; align-items: center;
  padding: 0 30px; border-bottom: 1px solid $border-alpha; z-index: 10;
  background: linear-gradient(to bottom, rgba(0,0,0,0.9), transparent);

  .location-display {
    text-align: center;
    .campaign-name { font-size: 0.7rem; color: #777; letter-spacing: 3px; font-family: 'Cinzel'; }
    .location-tag { color: $gold; font-family: 'Cinzel'; font-weight: bold; font-size: 1.1rem; text-shadow: 0 0 10px rgba($gold, 0.5); }
  }
}

.btn-hud {
  background: rgba(20,20,20,0.6); border: 1px solid $border-alpha; color: $gold;
  padding: 10px 20px; font-family: 'Cinzel'; cursor: pointer; transition: 0.3s;
  display: flex; align-items: center; gap: 10px;
  &:hover { background: $gold; color: #000; border-color: $gold; }
}


.main-layout { display: grid; grid-template-columns: 320px 1fr; height: calc(100vh - 70px); position: relative; z-index: 5; }

.party-sidebar {
  background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); border-right: 1px solid $border-alpha;
  padding: 30px 20px; display: flex; flex-direction: column; gap: 20px;
  .sidebar-header { font-family: 'Cinzel'; color: #555; font-size: 0.8rem; letter-spacing: 2px; text-align: center; }
}

.hero-card {
  background: rgba(15,15,15,0.8); border: 1px solid #222; padding: 15px; display: flex; gap: 15px;
  transition: 0.4s; position: relative;
  &:hover { border-color: $gold; transform: translateX(5px); background: rgba($gold, 0.05); }
  &.hero-dead { filter: grayscale(1); opacity: 0.4; }

  .hero-icon { font-size: 2rem; }
  .hp-bar-bg { width: 100%; height: 4px; background: #000; margin-top: 8px; border: 1px solid #333; }
  .hp-fill { height: 100%; background: linear-gradient(90deg, $crimson, #ff4d4d); transition: 1s ease-out; }
  .hero-name { font-family: 'Cinzel'; color: $gold; font-size: 1rem; }
  .hero-role { font-size: 0.7rem; color: #666; text-transform: uppercase; }
  .hero-hp-text { font-size: 0.7rem; color: #999; margin-top: 5px; }
}


.game-stage { display: flex; flex-direction: column; max-width: 900px; margin: 0 auto; width: 100%; }

.log-container {
  flex: 1; overflow-y: auto; padding: 50px 20px; display: flex; flex-direction: column; gap: 30px;
  mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  .text-narrative { font-family: 'Crimson Text', serif; font-size: 1.3rem; line-height: 1.8; color: #ccc; animation: fadeIn 1.5s ease; }
  .text-combat { background: rgba($crimson, 0.1); border-left: 3px solid $crimson; padding: 20px; color: #ff6b6b; font-family: 'Cinzel'; }
  .text-action { font-family: 'Cinzel'; color: $gold; opacity: 0.7; font-size: 0.9rem; }
}

.ai-typing {
  display: flex; align-items: center; gap: 15px; color: $gold; font-family: 'Cinzel'; font-size: 0.8rem;
  .typing-loader { display: flex; gap: 5px; span { width: 4px; height: 4px; background: $gold; border-radius: 50%; animation: bounce 1.4s infinite; } }
}

.action-bar {
  padding: 40px 0; border-top: 1px solid rgba($gold, 0.1);
  &.bar-disabled { opacity: 0.5; pointer-events: none; }
  .action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
}

.btn-action-fantasy {
  background: rgba(10,10,10,0.8); border: 1px solid #333; color: #aaa;
  padding: 18px; cursor: pointer; font-family: 'Cinzel'; transition: 0.4s;
  position: relative; overflow: hidden;
  &:hover { border-color: $gold; color: $gold; background: rgba($gold, 0.05); }
  &.btn-danger:hover { border-color: $crimson; color: #ff4d4d; background: rgba($crimson, 0.05); }
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }

.friends-panel {
  position: absolute; right: 0; top: 0; bottom: 0; width: 350px;
  background: rgba(5,5,5,0.98); border-left: 1px solid $gold; z-index: 100; padding: 40px;
  .panel-header { display: flex; justify-content: space-between; color: $gold; font-family: 'Cinzel'; margin-bottom: 30px; }
  .friend-card { display: flex; gap: 15px; align-items: center; margin-bottom: 20px; opacity: 0.6; &.online { opacity: 1; } }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #444; }
  .online .status-dot { background: #2ecc71; box-shadow: 0 0 5px #2ecc71; }
  .close-btn { background: none; border: none; color: #fff; cursor: pointer; font-size: 1.5rem; }
}

.panel-slide-enter-active, .panel-slide-leave-active { transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(100%); }
</style>
