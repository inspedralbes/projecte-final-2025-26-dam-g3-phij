<template>
  <div class="login-wrapper">
    <div class="login-box">
      <h2>IDENTIFÍCATE</h2>
      <form @submit.prevent="login">
        <input v-model="username" placeholder="Usuario" class="input-rpg" type="text">
        <input v-model="password" placeholder="Contraseña" class="input-rpg" type="password">
        <button type="submit" class="btn-main">ACCEDER</button>
      </form>
      <p v-if="error" style="color: #8a1c1c; margin-top: 10px;">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');

const login = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    const data = await res.json();
    
    if (data.success) {
      alert("Bienvenido, viajero.");
    } else {
      error.value = data.error;
    }
  } catch (e) {
    error.value = "Error de conexión con el servidor";
  }
}
</script>

<style scoped>
.login-wrapper { height: 100vh; display: flex; align-items: center; justify-content: center; background: #050505; }
.login-box { width: 400px; padding: 40px; border: 1px solid #333; background: #0a0a0c; text-align: center; }
h2 { color: #c5a059; margin-bottom: 30px; letter-spacing: 3px; }
</style>