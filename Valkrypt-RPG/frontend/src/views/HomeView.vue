<template>
  <div class="valkrypt-landing">
    <div ref="vantaHost" class="vanta-layer"></div>
    <div class="grain-layer"></div>
    <div class="embers-layer" aria-hidden="true">
      <span
        v-for="(seed, idx) in emberSeeds"
        :key="idx"
        class="ember"
        :style="{
          left: `${seed.left}%`,
          animationDuration: `${seed.duration}s`,
          animationDelay: `${seed.delay}s`
        }"
      ></span>
    </div>

    <nav class="simple-nav">
      <div class="nav-brand">
        <img src="/branding/valkrypt-logo.png" alt="Valkrypt" class="nav-logo" />
        <span>VALKRYPT</span>
      </div>
      <div class="nav-links">
        <router-link to="/login" class="login-btn">ENTRA AL REGNE</router-link>
      </div>
    </nav>

    <header class="hero">
      <div class="hero-content">
        <p class="eyebrow animate__animated animate__fadeInDown">DARK COOPERATIVE RPG EXPERIENCE</p>
        <h1 class="title animate__animated animate__fadeInUp">VALKRYPT</h1>
        <div class="divider"></div>
        <p class="tagline animate__animated animate__fadeInUp animate__delay-1s">CRÒNIQUES DE L'OMBRA</p>

        <div class="cta-row animate__animated animate__fadeInUp animate__delay-1s">
          <button class="start-button" @click="goToLogin">COMENÇA LA HISTÒRIA</button>
          <router-link to="/register" class="ghost-button">CREA COMPTE</router-link>
        </div>

        <section class="feature-grid animate__animated animate__fadeInUp animate__delay-2s">
          <article v-for="feature in featureCards" :key="feature.title" class="feature-card">
            <img :src="feature.image" :alt="feature.alt" />
            <div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
            </div>
          </article>
        </section>
      </div>
    </header>

    <footer class="footer">
      <p>Valkrypt RPG &copy; 2026</p>
    </footer>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { valkryptFeatureImages } from '../assets/valkryptAssets';

const router = useRouter();
const vantaHost = ref(null);
let vantaEffect = null;
const featureCards = [
  {
    title: 'ESCUADRA TÀCTICA',
    description: 'Forma aliances, assigna rols i executa estratègies cooperatives.',
    alt: 'Escuadra tàctica',
    image: valkryptFeatureImages.tacticalSquad
  },
  {
    title: 'AMENAÇA DINÀMICA',
    description: 'Cada partida evoluciona amb riscos i decisions de conseqüències reals.',
    alt: 'Amenaça dinàmica',
    image: valkryptFeatureImages.dynamicThreat
  },
  {
    title: 'PROGRÉS NARRATIU',
    description: 'Construeix la teva crònica en temps real amb el teu equip.',
    alt: 'Progrés narratiu',
    image: valkryptFeatureImages.narrativeProgress
  }
];
const emberSeeds = [
  { left: 5, duration: 13, delay: 1 },
  { left: 12, duration: 11, delay: 5 },
  { left: 18, duration: 15, delay: 2 },
  { left: 24, duration: 10, delay: 6 },
  { left: 31, duration: 14, delay: 4 },
  { left: 37, duration: 12, delay: 3 },
  { left: 44, duration: 16, delay: 7 },
  { left: 49, duration: 9, delay: 1 },
  { left: 56, duration: 13, delay: 5 },
  { left: 61, duration: 12, delay: 0 },
  { left: 67, duration: 14, delay: 6 },
  { left: 72, duration: 11, delay: 2 },
  { left: 78, duration: 15, delay: 4 },
  { left: 83, duration: 10, delay: 7 },
  { left: 88, duration: 13, delay: 1 },
  { left: 92, duration: 12, delay: 5 },
  { left: 96, duration: 14, delay: 3 },
  { left: 99, duration: 11, delay: 6 }
];

const goToLogin = () => {
  router.push('/login');
};

onMounted(async () => {
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
      highlightColor: 0x9a1a1a,
      midtoneColor: 0x1a0606,
      lowlightColor: 0x030305,
      baseColor: 0x040407,
      blurFactor: 0.6,
      speed: 0.9,
      zoom: 0.75
    });
  } catch (error) {
    console.error('No s’ha pogut carregar Vanta Fog:', error);
  }
});

onBeforeUnmount(() => {
  if (vantaEffect && typeof vantaEffect.destroy === 'function') {
    vantaEffect.destroy();
  }
});
</script>

<style scoped lang="scss">
@import url('https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css');
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=MedievalSharp&display=swap');

.valkrypt-landing {
  background-color: #050505;
  color: #e0e0e0;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  font-family: 'Cinzel', serif;
  position: relative;
  overflow: hidden;
}

.vanta-layer,
.grain-layer,
.embers-layer {
  position: absolute;
  inset: 0;
}

.vanta-layer {
  z-index: 0;
}

.grain-layer {
  z-index: 1;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.02), transparent 38%),
    radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.018), transparent 40%),
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 2px,
      rgba(255, 255, 255, 0.01) 2px,
      rgba(255, 255, 255, 0.01) 3px
    );
  mix-blend-mode: screen;
}

.embers-layer {
  z-index: 2;
  pointer-events: none;
}

.ember {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(245, 176, 85, 0.7);
  box-shadow: 0 0 12px rgba(245, 176, 85, 0.6);
  animation: ember-float linear infinite;
  opacity: 0;
}

.simple-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: rgba(0, 0, 0, 0.7);
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 5;
}

.nav-brand { 
  color: #d4af37; 
  font-weight: bold; 
  font-size: 1.2rem; 
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-logo {
  width: 26px;
  height: 26px;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.35));
}

.login-btn { 
  color: #d4af37; 
  text-decoration: none; 
  font-size: 0.8rem;
  border: 1px solid rgba(212, 175, 55, 0.75);
  padding: 10px 18px;
  transition: 0.25s ease;
  letter-spacing: 1px;
}

.login-btn:hover {
  background: rgba(212, 175, 55, 0.15);
  color: #ffe8ac;
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.2);
  transform: translateY(-1px);
}

.hero {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  z-index: 5;
  padding: 24px;
}

.hero-content {
  max-width: 1100px;
  width: 100%;
}

.eyebrow {
  margin: 0 0 8px;
  color: rgba(212, 175, 55, 0.85);
  letter-spacing: 3px;
  font-size: 0.72rem;
}

.title { 
  font-size: clamp(2.8rem, 6vw, 5.4rem);
  margin: 0; 
  color: #fffdf7; 
  letter-spacing: 10px;
  text-shadow:
    0 0 20px rgba(138, 11, 11, 0.55),
    0 0 40px rgba(0, 0, 0, 0.5);
}

.divider {
  height: 1px;
  width: 170px;
  background: linear-gradient(90deg, transparent, #8a0b0b, #d4af37, #8a0b0b, transparent);
  margin: 14px auto 12px;
}

.tagline { 
  font-size: 1.05rem;
  letter-spacing: 4px;
  color: #b5b5bb;
  margin-bottom: 28px;
  font-family: 'MedievalSharp', cursive;
}

.cta-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.start-button {
  padding: 16px 38px;
  background: linear-gradient(135deg, rgba(138, 11, 11, 0.88), rgba(112, 9, 9, 0.88));
  color: #d4af37;
  border: 1px solid #d4af37;
  cursor: pointer;
  font-size: 0.95rem;
  font-family: inherit;
  letter-spacing: 2px;
  transition: all 0.25s ease;
}

.start-button:hover {
  border-color: #ffd77f;
  color: #fff;
  box-shadow: 0 12px 36px rgba(138, 11, 11, 0.5);
  transform: translateY(-2px);
}

.ghost-button {
  padding: 16px 30px;
  border: 1px solid rgba(212, 175, 55, 0.6);
  text-decoration: none;
  color: #dbc38f;
  font-size: 0.9rem;
  letter-spacing: 1px;
  transition: all 0.25s ease;
  background: rgba(0, 0, 0, 0.28);
}

.ghost-button:hover {
  color: #fff;
  border-color: #f5d58a;
  background: rgba(212, 175, 55, 0.12);
}

.feature-grid {
  width: min(1000px, 94%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.feature-card {
  border: 1px solid rgba(212, 175, 55, 0.22);
  background: rgba(8, 8, 11, 0.64);
  padding: 12px;
  display: grid;
  grid-template-columns: 66px 1fr;
  gap: 10px;
  align-items: center;
  text-align: left;
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;

  img {
    width: 66px;
    height: 66px;
    border: 1px solid rgba(212, 175, 55, 0.3);
    background: #0a0a0d;
    object-fit: cover;
  }

  h3 {
    margin: 0 0 4px;
    color: #e9cb84;
    font-size: 0.86rem;
    letter-spacing: 1px;
  }

  p {
    margin: 0;
    font-size: 0.79rem;
    line-height: 1.35;
    color: #b1b1b7;
  }
}

.feature-card:hover {
  transform: translateY(-3px);
  border-color: rgba(212, 175, 55, 0.5);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
}

.footer { 
  text-align: center; 
  padding: 20px; 
  color: #65656a; 
  font-size: 0.7rem; 
  background: rgba(0, 0, 0, 0.72);
  border-top: 1px solid rgba(212, 175, 55, 0.12);
  position: relative;
  z-index: 5;
}

@media (max-width: 768px) {
  .simple-nav {
    padding: 16px 14px;
  }

  .nav-brand {
    font-size: 0.96rem;
    letter-spacing: 1px;
  }

  .title { letter-spacing: 6px; }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .feature-card {
    grid-template-columns: 56px 1fr;
    img {
      width: 56px;
      height: 56px;
    }
  }
}

@keyframes ember-float {
  0% {
    transform: translateY(0) translateX(0) scale(0.8);
    opacity: 0;
  }
  15% {
    opacity: 0.9;
  }
  100% {
    transform: translateY(-100vh) translateX(-35px) scale(1.1);
    opacity: 0;
  }
}
</style>
