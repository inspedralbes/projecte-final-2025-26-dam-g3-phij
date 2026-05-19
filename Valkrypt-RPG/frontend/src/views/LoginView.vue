<template>
  <div class="auth-shell">
    <div class="auth-bg"></div>
    <div class="auth-wrap">
      <section class="auth-card">
        <header class="auth-brand">
          <img src="/branding/valkrypt-logo.png" alt="Valkrypt" />
          <span>VALKRYPT</span>
        </header>
        <h1 class="auth-title">ENTRA</h1>
        <p class="auth-sub">Accedeix al bastió i reprèn la campanya.</p>
        <form class="auth-form" @submit.prevent="handleLogin">
          <div class="field">
            <label for="login-user">NOM D'USUARI</label>
            <input id="login-user" v-model="username" type="text" placeholder="Nom d'usuari" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="login-pass">CONTRASENYA</label>
            <input id="login-pass" v-model="password" type="password" placeholder="Contrasenya" autocomplete="current-password" required />
          </div>
          <button type="submit" class="auth-btn" :disabled="loading">
            {{ loading ? 'ACCEDINT...' : 'ACCEDIR' }}
          </button>
        </form>
        <p v-if="errorMessage" class="auth-alert">{{ errorMessage }}</p>
        <p class="auth-foot">
          ETS NOU? <router-link to="/register">CREA EL TEU COMPTE</router-link>
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';

const username = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const router = useRouter();

const handleLogin = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Error de configuració: el servidor no respon en format JSON.');
    }

    const data = await response.json();
    if (!response.ok) {
      if (data.needsVerification) {
        localStorage.setItem('temp_user', username.value);
        router.push('/verify');
        return;
      }
      throw new Error(data.error || 'Credencials incorrectes');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    router.push('/userpage');
  } catch (err) {
    console.error(err);
    errorMessage.value = getApiErrorMessage(err, "No s'ha pogut connectar amb el servidor de Valkrypt.");
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="scss" src="../styles/auth-premium.scss"></style>
