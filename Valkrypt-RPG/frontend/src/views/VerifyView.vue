<template>
  <div class="auth-container">
    <div class="auth-box">
      <div class="rune-decoration">ᚠ ᚢ ᚦ</div>
      <h1>VERIFICACIÓ</h1>
      <p class="instruction">Introdueix el codi OTP enviat al teu correu electrònic.</p>

      <form @submit.prevent="handleVerify">
        <input
          v-model.trim="username"
          type="text"
          placeholder="Nom d'usuari"
          class="user-input"
          required
        />
        <input
          v-model="code"
          type="text"
          placeholder="000000"
          maxlength="6"
          class="code-input"
          required
        />
        <button type="submit" class="btn-auth" :disabled="loadingVerify">
          {{ loadingVerify ? 'VERIFICANT...' : 'ACTIVAR COMPTE' }}
        </button>
      </form>

      <button type="button" class="btn-resend" :disabled="cooldown > 0" @click="resendOtp">
        {{ cooldown > 0 ? `REENVIA EN ${cooldown}s` : 'REENVIA CODI OTP' }}
      </button>

      <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="feedback success">{{ successMessage }}</p>

      <button @click="router.push('/login')" class="btn-back">TORNAR A L'ACCÉS</button>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';

const username = ref('');
const code = ref('');
const cooldown = ref(0);
const loadingVerify = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const router = useRouter();
let cooldownTimer = null;

const startCooldown = (seconds = 60) => {
  cooldown.value = Math.max(0, Number(seconds) || 60);
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldown.value = Math.max(0, cooldown.value - 1);
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
};

const handleVerify = async () => {
  const normalizedUsername = String(username.value || '').trim();
  const normalizedCode = code.value.replace(/\D/g, '').slice(0, 6);
  errorMessage.value = '';
  successMessage.value = '';

  if (!normalizedUsername) {
    errorMessage.value = "Introdueix el nom d'usuari.";
    return;
  }

  if (normalizedCode.length !== 6) {
    errorMessage.value = 'El codi OTP ha de tenir 6 dígits.';
    return;
  }

  loadingVerify.value = true;
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: normalizedUsername,
        code: normalizedCode
      })
    });

    const data = await response.json();
    if (response.ok) {
      successMessage.value = 'Compte verificat! Ja pots entrar.';
      localStorage.removeItem('temp_user');
      localStorage.removeItem('pending_verification');
      setTimeout(() => router.push('/login'), 700);
    } else {
      errorMessage.value = data.error || 'Codi incorrecte';
    }
  } catch (err) {
    console.error('Error en la verificació:', err);
    errorMessage.value = getApiErrorMessage(err, 'Error de connexió amb el servidor');
  } finally {
    loadingVerify.value = false;
  }
};

const resendOtp = async () => {
  const normalizedUsername = String(username.value || '').trim();
  errorMessage.value = '';
  successMessage.value = '';
  if (!normalizedUsername || cooldown.value > 0) return;
  try {
    const response = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normalizedUsername })
    });
    const data = await response.json();
    if (response.ok) {
      successMessage.value = data.message || 'Nou codi enviat.';
      startCooldown(60);
      return;
    }
    const msg = String(data?.error || '');
    const waitMatch = msg.match(/(\d+)s/);
    if (response.status === 429 && waitMatch) {
      startCooldown(Number(waitMatch[1]));
    }
    errorMessage.value = msg || "No s'ha pogut reenviar el codi.";
  } catch (err) {
    console.error('Error reenviant OTP:', err);
    errorMessage.value = getApiErrorMessage(err, 'Error de connexió amb el servidor');
  }
};

onMounted(() => {
  try {
    const pending = JSON.parse(localStorage.getItem('pending_verification') || '{}');
    if (pending?.username) {
      username.value = String(pending.username);
    } else {
      username.value = localStorage.getItem('temp_user') || '';
    }
  } catch {
    username.value = localStorage.getItem('temp_user') || '';
  }
});

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});
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
  background: rgba(0, 0, 0, 0.9);
  padding: 40px;
  border: 1px solid #d4af37;
  text-align: center;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

.rune-decoration {
  color: #8a0b0b;
  letter-spacing: 15px;
  margin-bottom: 10px;
}

h1 { color: #d4af37; letter-spacing: 3px; margin-bottom: 10px; }

.instruction {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 25px;
}

.user-input {
  width: 100%;
  padding: 12px;
  margin-bottom: 12px;
  background: #111;
  border: 1px solid #333;
  color: #f5f5f5;
  outline: none;
}

.user-input:focus {
  border-color: #d4af37;
}

.code-input {
  width: 100%;
  padding: 15px;
  margin-bottom: 25px;
  background: #111;
  border: 1px solid #333;
  color: #d4af37;
  font-size: 2rem;
  text-align: center;
  letter-spacing: 8px;
  outline: none;
}

.code-input:focus {
  border-color: #d4af37;
}

.btn-auth {
  width: 100%;
  padding: 12px;
  background: #8a0b0b;
  color: white;
  border: 1px solid #d4af37;
  cursor: pointer;
  font-weight: bold;
  transition: 0.3s;
}

.btn-auth:hover:enabled {
  background: #b30e0e;
  transform: scale(1.02);
}

.btn-auth:disabled {
  opacity: 0.6;
  cursor: wait;
}

.btn-back {
  margin-top: 20px;
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: underline;
}

.btn-back:hover { color: #d4af37; }

.btn-resend {
  margin-top: 12px;
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid #555;
  color: #d5d5d5;
  cursor: pointer;
}

.btn-resend:disabled {
  opacity: 0.6;
  cursor: wait;
}

.feedback {
  margin: 10px 0 0;
  font-size: 0.82rem;
}

.feedback.error {
  color: #ff9f9f;
}

.feedback.success {
  color: #96ecbb;
}
</style>
