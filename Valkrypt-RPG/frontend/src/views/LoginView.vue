<template>
  <div class="auth-container">
    <div class="auth-box">
      <h1>ENTRAR</h1>
      <form @submit.prevent="handleLogin">
        <input v-model="username" type="text" required />
        <input v-model="password" type="password" required />
        <button type="submit" class="btn-auth">DESPERTAR</button>
      </form>
      <p class="switch-auth">
        ¿ERES NUEVO? <router-link to="/register">CREA TU ALMA AQUÍ</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const router = useRouter();

const handleLogin = async () => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/UserPage');
      } else {
        alert(data.error || "Credenciales incorrectas");
      }
    } else {
      alert("Error de configuración: El servidor no responde en formato JSON. Revisa el Proxy.");
    }
  } catch (err) {
    console.error(err);
    alert("No se pudo conectar con el servidor de Valkrypt");
  }
};
</script>

<style scoped>
.auth-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, #1a0505 0%, #050505 100%);
  font-family: 'Cinzel', serif;
}
.auth-box {
  background: rgba(0, 0, 0, 0.8);
  padding: 40px;
  border: 1px solid #d4af37;
  text-align: center;
  width: 100%;
  max-width: 400px;
}
h1 { color: #d4af37; letter-spacing: 5px; margin-bottom: 30px; }
input {
  width: 100%;
  padding: 12px;
  margin-bottom: 20px;
  background: #111;
  border: 1px solid #333;
  color: white;
  outline: none;
  box-sizing: border-box;
}
input:focus { border-color: #d4af37; }
.btn-auth {
  width: 100%;
  padding: 12px;
  background: #8a0b0b;
  color: white;
  border: 1px solid #d4af37;
  cursor: pointer;
  font-weight: bold;
  letter-spacing: 2px;
}
.btn-auth:hover { background: #b30e0e; }
.switch-auth { margin-top: 20px; font-size: 0.8rem; color: #888; text-transform: uppercase; }
.switch-auth a { color: #d4af37; text-decoration: none; }
</style>