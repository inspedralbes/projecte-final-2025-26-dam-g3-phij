<template>
  <div class="auth-container">
    <div class="ambient-glow"></div>
    <div class="auth-box">
      <div class="decorative-line top"></div>
      <header class="auth-header">
        <span class="rune">ᚱ</span>
        <h1>REGISTRO</h1>
        <span class="rune">ᚱ</span>
      </header>
      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="input-group">
          <label>NOMBRE DE USUARIO</label>
          <input v-model="username" type="text" required />
        </div>
        <div class="input-group">
          <label>CORREO ELECTRÓNICO</label>
          <input v-model="email" type="email" required />
        </div>
        <div class="input-group">
          <label>CONTRASEÑA</label>
          <input v-model="password" type="password" required />
        </div>
        <button type="submit" class="btn-submit">
          <span class="btn-text">VINCULAR ALMA</span>
          <div class="btn-shimmer"></div>
        </button>
      </form>
      <footer class="auth-footer">
        <p>¿YA TIENES CUENTA? <router-link to="/login">ENTRAR</router-link></p>
      </footer>
      <div class="decorative-line bottom"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const username = ref('');
const email = ref('');
const password = ref('');
const router = useRouter();

const handleRegister = async () => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        email: email.value,
        password: password.value
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error en el servidor');
    }

    const data = await response.json();
    if (data.success) {
      router.push('/login');
    }
  } catch (err) {
    alert(err.message);
    console.error("Fallo en registro:", err);
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

.auth-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #050505;
  background-image: radial-gradient(circle at center, #1a0808 0%, #050505 100%), url('https://www.transparenttextures.com/patterns/dark-matter.png');
  font-family: 'Cinzel', serif;
  overflow: hidden;
  position: relative;
}
.ambient-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% 50%, rgba(138, 11, 11, 0.1) 0%, transparent 70%);
  pointer-events: none;
}
.auth-box {
  background: rgba(10, 10, 10, 0.95);
  padding: 50px 40px;
  border: 1px solid #2a2a2a;
  width: 100%;
  max-width: 450px;
  position: relative;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  text-align: center;
}
.decorative-line {
  position: absolute;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, #d4af37, transparent);
}
.decorative-line.top { top: 20px; }
.decorative-line.bottom { bottom: 20px; }
.auth-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 40px;
}
.auth-header h1 {
  color: #fff;
  font-size: 2.2rem;
  letter-spacing: 6px;
  margin: 0;
  text-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
}
.rune {
  color: #8a0b0b;
  font-size: 1.5rem;
  opacity: 0.7;
}
.input-group {
  text-align: left;
  margin-bottom: 25px;
}
.input-group label {
  display: block;
  color: #d4af37;
  font-size: 0.75rem;
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.input-group input {
  width: 100%;
  background: #151515;
  border: 1px solid #333;
  padding: 12px 15px;
  color: #eee;
  font-family: inherit;
  transition: all 0.3s ease;
  box-sizing: border-box;
}
.input-group input:focus {
  border-color: #d4af37;
  background: #1a1a1a;
  outline: none;
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.1);
}
.btn-submit {
  width: 100%;
  padding: 15px;
  background: #8a0b0b;
  border: 1px solid #d4af37;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-weight: bold;
  letter-spacing: 3px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: 0.3s;
  margin-top: 10px;
}
.btn-submit:hover {
  background: #a10d0d;
  box-shadow: 0 0 20px rgba(138, 11, 11, 0.5);
  transform: translateY(-2px);
}
.btn-shimmer {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  transition: 0.5s;
}
.btn-submit:hover .btn-shimmer { left: 150%; }
.auth-footer {
  margin-top: 30px;
  font-size: 0.8rem;
  color: #666;
}
.auth-footer a {
  color: #d4af37;
  text-decoration: none;
  margin-left: 5px;
  transition: 0.3s;
}
.auth-footer a:hover {
  color: #fff;
  text-shadow: 0 0 5px #d4af37;
}
</style>