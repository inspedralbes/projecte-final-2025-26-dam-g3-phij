<template>
  <div class="game-page">
    <nav class="game-nav">
      <button class="nav-back" @click="router.push('/UserPage')">VOLVER</button>
      <div class="nav-brand">VALKRYPT | NARRATIVA EN VIVO</div>
    </nav>

    <main class="game-main">
      <section ref="storyContainer" class="story-container">
        <article
          v-for="(message, index) in storyMessages"
          :key="`${message.role}-${index}`"
          class="story-message"
          :class="message.role"
        >
          <header class="message-role">
            {{ message.role === 'player' ? 'TÚ' : 'NARRADOR' }}
          </header>
          <p class="message-text">{{ message.text }}</p>
        </article>

        <div v-if="isGenerating" class="streaming-status">
          El narrador está tejiendo el siguiente fragmento...
        </div>
      </section>

      <form class="action-form" @submit.prevent="submitAction">
        <label for="action-input">Tu acción</label>
        <textarea
          id="action-input"
          v-model="playerAction"
          class="action-input"
          placeholder="Ejemplo: avanzo sigilosamente por el pasillo y observo los símbolos del altar."
          rows="3"
          :disabled="isGenerating"
        />

        <div class="form-footer">
          <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
          <button class="send-btn" type="submit" :disabled="isGenerating || !playerAction.trim()">
            {{ isGenerating ? 'GENERANDO...' : 'ENVIAR ACCIÓN' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const storyContainer = ref(null);

const worldSeed = ref(
  'Valkrypt es un reino en decadencia donde ruinas antiguas, magia prohibida y juramentos rotos dominan la noche.'
);
const playerAction = ref('');
const isGenerating = ref(false);
const errorMessage = ref('');
const storyMessages = ref([]);

function buildApiHistory() {
  return storyMessages.value
    .filter((message) => message && typeof message.text === 'string' && message.text.trim())
    .map((message) => ({
      role: message.role === 'player' ? 'user' : 'model',
      text: message.text,
    }));
}

async function scrollStoryToBottom() {
  await nextTick();
  const el = storyContainer.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function streamNarration(bodyStream, targetMessage) {
  const reader = bodyStream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      targetMessage.text += chunk;
      await scrollStoryToBottom();
    }
  }
}

async function submitAction(initialAction) {
  if (isGenerating.value) return;

  const action = (typeof initialAction === 'string' ? initialAction : playerAction.value).trim();
  if (!action) return;

  errorMessage.value = '';
  if (typeof initialAction !== 'string') playerAction.value = '';

  const history = buildApiHistory();
  storyMessages.value.push({ role: 'player', text: action });
  const narratorMessage = { role: 'narrator', text: '' };
  storyMessages.value.push(narratorMessage);

  isGenerating.value = true;
  await scrollStoryToBottom();

  try {
    const response = await fetch('/api/narrative/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAction: action,
        worldSeed: worldSeed.value,
        storyHistory: history,
      }),
    });

    if (!response.ok) {
      let backendMessage = 'No se pudo generar la narrativa.';
      try {
        const errorData = await response.json();
        backendMessage = errorData.error || backendMessage;
      } catch (_) {
        // Si no llega JSON, mantenemos el mensaje por defecto.
      }
      throw new Error(backendMessage);
    }

    if (!response.body) {
      throw new Error('El navegador no soporta streaming en esta petición.');
    }

    await streamNarration(response.body, narratorMessage);

    if (!narratorMessage.text.trim()) {
      narratorMessage.text = 'El narrador guarda silencio. Prueba con una acción distinta.';
    }
  } catch (error) {
    errorMessage.value = error.message || 'Error desconocido al contactar con Gemini.';
    narratorMessage.text = `Error: ${errorMessage.value}`;
  } finally {
    isGenerating.value = false;
    await scrollStoryToBottom();
  }
}

async function startNewAdventure() {
  if (storyMessages.value.length > 0) return;

  await submitAction(
    'Comienza una aventura nueva. Presenta la escena inicial, una amenaza inmediata y 3 opciones para actuar.'
  );
}

onMounted(async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    router.replace('/login');
    return;
  }

  await startNewAdventure();
});
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  background: radial-gradient(circle at top, #220707 0%, #070707 55%, #030303 100%);
  color: #e7e7e7;
  font-family: 'Cinzel', serif;
  display: flex;
  flex-direction: column;
}

.game-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #3e2a00;
  background: rgba(0, 0, 0, 0.85);
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-back {
  border: 1px solid #d4af37;
  background: transparent;
  color: #d4af37;
  padding: 8px 14px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 1px;
}

.nav-back:hover {
  background: #d4af37;
  color: #080808;
}

.nav-brand {
  color: #d4af37;
  letter-spacing: 1px;
  font-size: 0.9rem;
}

.game-main {
  width: min(980px, 92vw);
  margin: 24px auto 32px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 20px;
  flex: 1;
}

.story-container {
  border: 1px solid #2e2e2e;
  background: rgba(7, 7, 7, 0.92);
  border-radius: 8px;
  padding: 18px;
  overflow-y: auto;
  min-height: 48vh;
  max-height: 62vh;
}

.story-message {
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 8px;
  white-space: pre-wrap;
  line-height: 1.6;
}

.story-message.player {
  background: rgba(212, 175, 55, 0.12);
  border: 1px solid rgba(212, 175, 55, 0.36);
}

.story-message.narrator {
  background: rgba(138, 11, 11, 0.16);
  border: 1px solid rgba(138, 11, 11, 0.42);
}

.message-role {
  font-size: 0.72rem;
  letter-spacing: 2px;
  color: #d4af37;
  margin-bottom: 6px;
}

.message-text {
  margin: 0;
}

.streaming-status {
  margin-top: 8px;
  color: #b6b6b6;
  font-size: 0.85rem;
}

.action-form {
  border: 1px solid #2e2e2e;
  background: rgba(0, 0, 0, 0.72);
  border-radius: 8px;
  padding: 14px;
}

.action-form label {
  display: block;
  margin-bottom: 8px;
  color: #d4af37;
  font-size: 0.78rem;
  letter-spacing: 2px;
}

.action-input {
  width: 100%;
  resize: vertical;
  min-height: 86px;
  background: #141414;
  color: #f0f0f0;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
  padding: 12px;
  box-sizing: border-box;
  font-family: inherit;
}

.action-input:focus {
  outline: none;
  border-color: #d4af37;
}

.form-footer {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.error-text {
  color: #ff9f9f;
  font-size: 0.85rem;
}

.send-btn {
  padding: 10px 18px;
  border: 1px solid #d4af37;
  background: #8a0b0b;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 1px;
}

.send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.send-btn:not(:disabled):hover {
  background: #a60f0f;
}

@media (max-width: 760px) {
  .game-main {
    width: 94vw;
    margin-top: 14px;
  }

  .story-container {
    min-height: 52vh;
    max-height: 60vh;
  }

  .form-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
