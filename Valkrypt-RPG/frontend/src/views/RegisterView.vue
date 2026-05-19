<template>
  <div class="auth-shell">
    <div class="auth-bg"></div>
    <div class="auth-wrap">
      <section class="auth-card">
        <header class="auth-brand">
          <img src="/branding/valkrypt-logo.png" alt="Valkrypt" />
          <span>VALKRYPT</span>
        </header>
        <h1 class="auth-title">REGISTRE</h1>
        <p class="auth-sub">Forja la teva identitat i entra al regne.</p>
        <form class="auth-form" @submit.prevent="handleRegister">
          <div class="field">
            <label for="register-user">NOM D'USUARI</label>
            <input id="register-user" v-model="username" type="text" placeholder="Nom d'usuari" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="register-mail">CORREU ELECTRÒNIC</label>
            <input id="register-mail" v-model="email" type="email" placeholder="nom@domini.cat" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="register-pass">CONTRASENYA</label>
            <input id="register-pass" v-model="password" type="password" placeholder="Contrasenya" autocomplete="new-password" required />
          </div>
          <button type="submit" class="auth-btn" :disabled="loading">
            {{ loading ? 'CREANT...' : 'CREAR COMPTE' }}
          </button>
        </form>
        <p v-if="errorMessage" class="auth-alert">{{ errorMessage }}</p>
        <p v-if="successMessage" class="auth-ok">{{ successMessage }}</p>
        <p class="auth-foot">
          JA TENS COMPTE? <router-link to="/login">ENTRA</router-link>
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
const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const router = useRouter();

const handleRegister = async () => {
  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';
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

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error al servidor');
    }

    localStorage.setItem('temp_user', username.value);
    localStorage.setItem('pending_verification', JSON.stringify({
      username: username.value,
      email: email.value
    }));
    successMessage.value = data.message || 'Compte creat. Redirigint a verificació...';
    setTimeout(() => router.push('/verify'), 500);
  } catch (err) {
    errorMessage.value = getApiErrorMessage(err, 'No s’ha pogut completar el registre.');
    console.error('Error en registre:', err);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="scss" src="../styles/auth-premium.scss"></style>
