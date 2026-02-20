<template>
  <div class="auth-container">
    <div class="auth-box">
      <div class="rune-decoration">ᚠ ᚢ ᚦ</div>
      <h1>VERIFICACIÓN</h1>
      <p class="instruction">Introduce el código de 6 dígitos que ha llegado a tu correo.</p>
      
      <form @submit.prevent="handleVerify">
        <input 
          v-model="code" 
          type="text" 
          placeholder="000000" 
          maxlength="6" 
          class="code-input"
          required 
        />
        <button type="submit" class="btn-auth">DESBLOQUEAR CUENTA</button>
      </form>

      <button @click="router.push('/login')" class="btn-back">
        VOLVER AL LOGIN
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const code = ref('');
const router = useRouter();

const handleVerify = async () => {
  const username = localStorage.getItem('temp_user');

  if (!username) {
    alert("No se encontró el usuario. Por favor, regístrate de nuevo.");
    router.push('/register');
    return;
  }

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: username, 
        code: code.value
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert("¡Cuenta verificada! Ya puedes entrar.");
      localStorage.removeItem('temp_user');
      router.push('/login');
    } else {
      alert(data.error || "Código incorrecto");
    }
  } catch (err) {
    console.error("Error en la verificación:", err);
    alert("Error de conexión con el servidor");
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
  background: rgba(0, 0, 0, 0.9);
  padding: 40px;
  border: 1px solid #d4af37;
  text-align: center;
  width: 100%;
  max-width: 400px;
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

.btn-auth:hover {
  background: #b30e0e;
  transform: scale(1.02);
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
</style>
