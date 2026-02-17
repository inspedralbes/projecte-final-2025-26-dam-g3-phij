<template>
  <div class="valkrypt-landing">
    <nav class="simple-nav">
      <div class="nav-brand">VALKRYPT</div>
      <div class="nav-links">
        <router-link to="/login" class="login-btn">ENTRAR AL REINO</router-link>
      </div>
    </nav>

    <header class="hero">
      <div class="hero-content">
        <h1 class="title">VALKRYPT</h1>
        <div class="divider"></div>
        <p class="tagline">CRÓNICAS DE LA SOMBRA</p>
        
        <button class="start-button" @click="goToLogin">
          COMENZAR HISTORIA
        </button>
      </div>
    </header>

    <footer class="footer">
      <p>Valkrypt RPG &copy; 2026</p>
    </footer>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const goToLogin = () => {
  router.push('/login');
};
</script>

<style scoped>
.valkrypt-landing {
  background-color: #050505;
  color: #e0e0e0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Cinzel', serif;
}

.simple-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: black;
  border-bottom: 1px solid #333;
}

.nav-brand { 
  color: #d4af37; 
  font-weight: bold; 
  font-size: 1.2rem; 
  letter-spacing: 2px;
}

.login-btn { 
  color: #d4af37; 
  text-decoration: none; 
  font-size: 0.8rem;
  border: 1px solid #d4af37;
  padding: 8px 16px;
  transition: 0.3s;
}

.login-btn:hover {
  background: #d4af37;
  color: black;
}

.hero {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, #1a0505 0%, #050505 100%);
  text-align: center;
}

.title { 
  font-size: 5rem; 
  margin: 0; 
  color: #fff; 
  letter-spacing: 10px;
  text-shadow: 0 0 20px rgba(138, 11, 11, 0.5);
}

.divider {
  height: 2px;
  width: 100px;
  background: #8a0b0b;
  margin: 15px auto;
}

.tagline { 
  font-size: 1.2rem;
  letter-spacing: 4px;
  color: #888;
  margin-bottom: 40px;
}

.start-button {
  padding: 18px 50px;
  background: transparent;
  color: #d4af37;
  border: 2px solid #d4af37;
  cursor: pointer;
  font-size: 1.1rem;
  font-family: inherit;
  transition: all 0.4s;
}

.start-button:hover {
  background: #8a0b0b;
  border-color: #ff1a1a;
  color: white;
  box-shadow: 0 0 30px rgba(138, 11, 11, 0.6);
  transform: translateY(-3px);
}

.footer { 
  text-align: center; 
  padding: 20px; 
  color: #333; 
  font-size: 0.7rem; 
  background: black;
}

@media (max-width: 768px) {
  .title { font-size: 3rem; }
}
</style>