<template>
  <div class="selector-wrapper" @mousemove="onMouseMove">
    <div class="ambient-fx">
      <div class="void-gradient"></div>
      <div class="smoke smoke-a"></div>
      <div class="smoke smoke-b"></div>
      <div class="arcane-ring" :style="ringStyle"></div>
      <div class="embers"></div>
      <div class="energy-veins"></div>
      <div class="vignette"></div>
    </div>

    <div class="selector-shell">
      <div class="selector-header glass reveal-up">
        <button class="btn-back" @click="router.push('/userpage')">← Sortir</button>
        <div class="step-indicator">
          <span class="pill active">Reclutament · {{ (campaignData?.title || 'Sense campanya') }}</span>
        </div>
      </div>

      <div class="fade-in">
        <header class="step-title reveal-up delay-1">
          <h1>FORJA LA TEVA AVANTGUARDA</h1>
          <p>Selecciona els herois que s'endinsaran a <strong>{{ campaignData?.location || 'el regne' }}</strong>.</p>
        </header>

        <div class="builder-grid reveal-up delay-2">
          <div class="roster glass">
            <p v-if="isLoadingCampaign" class="campaign-status">Carregant herois des de la base de dades...</p>
            <p v-else-if="campaignError" class="campaign-status error">{{ campaignError }}</p>
            <template v-else>
              <div
                v-for="char in availableCharacters" :key="char.id"
                class="char-card"
                :class="{ 'is-selected': isInParty(char.id) }"
                @click="toggleChar(char)"
              >
                <div class="char-glow"></div>
                <div class="char-avatar-box">
                  <span class="char-icon">{{ char.icon }}</span>
                </div>
                <div class="info">
                  <strong class="char-name">{{ char.name }}</strong>
                  <small class="char-role">{{ char.role }}</small>
                  <p class="char-weapon">{{ char.weapon }}</p>
                </div>
                <div class="select-indicator"></div>
              </div>
            </template>
          </div>

          <aside class="summary-panel glass">
            <h3>HEROIS TRIATS</h3>
            <div class="party-slots">
              <div v-for="n in 4" :key="n" class="slot" :class="{ filled: party[n-1] }">
                <span v-if="party[n-1]">{{ party[n-1].icon }}</span>
                <small v-else>?</small>
              </div>
            </div>
            <p class="party-info" v-if="party.length > 0">{{ party.length }} / 4 Herois</p>

            <div class="synergy-card" :class="party.length >= 3 ? 'ok' : 'warn'">
              <strong>{{ party.length >= 3 ? 'Composició sòlida' : 'Composició fràgil' }}</strong>
              <p>{{ party.length >= 3 ? 'Bon punt de partida per a Piedraprofunda.' : 'Afegeix més herois abans d’entrar.' }}</p>
            </div>

            <button class="btn-start-adventure" :disabled="party.length === 0 || !campaignData || isLoadingCampaign" @click="start">
              <span class="shine"></span>
              COMENÇAR AVENTURA
            </button>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';
import { resolveCampaignAssetKey } from '../assets/valkryptAssets';

const router = useRouter();
const route = useRoute();
const party = ref([]);
const campaignData = ref(null);
const isLoadingCampaign = ref(false);
const campaignError = ref('');

const mouseX = ref(0);
const mouseY = ref(0);
const ringStyle = computed(() => ({ transform: `translate3d(${mouseX.value * 10}px, ${mouseY.value * 10}px, 0)` }));
const onMouseMove = (event) => {
  mouseX.value = (event.clientX / window.innerWidth - 0.5) * -1;
  mouseY.value = (event.clientY / window.innerHeight - 0.5) * -1;
};

const campaignId = computed(() => String(route.query.campaign || '').trim());
const availableCharacters = computed(() => campaignData.value?.heroes || []);

const normalizeHero = (hero) => {
  const maxHpValue = Number(hero?.maxHp ?? hero?.hp);
  const maxHp = Number.isFinite(maxHpValue) && maxHpValue > 0 ? maxHpValue : 1;
  const hpValue = Number(hero?.hp ?? maxHp);
  const hp = Number.isFinite(hpValue) ? Math.max(0, Math.min(hpValue, maxHp)) : maxHp;

  return {
    id: String(hero?.id || ''),
    name: hero?.name || 'Héroe',
    role: hero?.role || 'Aventurero',
    weapon: hero?.weapon || '',
    icon: hero?.icon || '⚔️',
    hp,
    maxHp
  };
};

const loadCampaign = async () => {
  if (!campaignId.value) {
    campaignError.value = 'Campanya no especificada.';
    campaignData.value = null;
    return;
  }

  isLoadingCampaign.value = true;
  campaignError.value = '';
  try {
    const response = await fetch(`/api/game/campaigns/${encodeURIComponent(campaignId.value)}`);
    if (!response.ok) throw new Error(`Error ${response.status}`);

    const data = await response.json();
    campaignData.value = {
      ...data,
      heroes: Array.isArray(data?.heroes) ? data.heroes.map(normalizeHero) : []
    };
    party.value = [];
  } catch (err) {
    console.error("No s'ha pogut carregar la campanya:", err);
    campaignError.value = getApiErrorMessage(err, "No s'ha pogut carregar aquesta campanya des de la base de dades.");
    campaignData.value = null;
    party.value = [];
  } finally {
    isLoadingCampaign.value = false;
  }
};

watch(campaignId, loadCampaign, { immediate: true });

const isInParty = (id) => party.value.some(c => c.id === id);

const toggleChar = (char) => {
  const idx = party.value.findIndex(c => c.id === char.id);
  if (idx > -1) party.value.splice(idx, 1);
  else if (party.value.length < 4) party.value.push(char);
};

const start = async () => {
  const userStore = JSON.parse(localStorage.getItem('user'));
  const userId = userStore?.id || userStore?._id;
  if (!campaignData.value) return alert("No s'ha carregat cap campanya vàlida.");
  if (!userId) return alert("Sessió no trobada. Inicia sessió de nou.");

  const sessionData = {
    userId,
    campaignId: campaignData.value.id || campaignId.value,
    campaignTitle: campaignData.value.title,
    location: campaignData.value.location,
    currentBackground: resolveCampaignAssetKey(campaignData.value) || campaignData.value.img || '',
    dayLimit: campaignData.value.dayLimit,
    party: party.value,
    turn: 1
  };

  try {
    const response = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: { type: 'init', label: 'Inicio de Aventura', data: sessionData } })
    });

    if (response.ok) {
      localStorage.setItem('valkrypt_current_game', JSON.stringify(sessionData));
      router.push('/game');
    } else {
      const data = await response.json().catch(() => ({}));
      alert(getApiErrorMessage(data, 'Error en desar la partida inicial.'));
    }
  } catch (err) {
    console.error('Error de xarxa en connectar amb el servidor:', err);
    alert(getApiErrorMessage(err, 'Error de xarxa en connectar amb el servidor.'));
  }
};
</script>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:wght@400;600&display=swap');

$gold: #c5a059;
$goldSoft: #e2c98f;
$darkCard: rgba(8, 8, 14, 0.9);

.selector-wrapper {
  min-height: 100dvh;
  position: relative;
  overflow: hidden;
  color: #ececf2;
  background: #04050a;
  padding: 20px;
}

.ambient-fx { position: absolute; inset: -10%; pointer-events: none; }
.void-gradient {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 22% 8%, #1a1328 0%, #09070f 48%, #020206 100%);
}
.smoke {
  position: absolute; inset: -10%;
  background: radial-gradient(circle, rgba(120,90,170,.16), transparent 55%);
  filter: blur(24px);
}
.smoke-a { animation: smokeA 18s ease-in-out infinite alternate; }
.smoke-b { animation: smokeB 26s ease-in-out infinite alternate; opacity: .75; }
.arcane-ring {
  position: absolute;
  width: 72vw; height: 72vw;
  max-width: 980px; max-height: 980px;
  left: calc(50% - 36vw); top: calc(50% - 36vw);
  border-radius: 50%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Cg fill='none' stroke='%23c5a059' stroke-opacity='.33'%3E%3Ccircle cx='300' cy='300' r='220'/%3E%3Ccircle cx='300' cy='300' r='170'/%3E%3Cpath d='M300 80l55 95h-110zM300 520l-55-95h110zM80 300l95-55v110zM520 300l-95 55V245z'/%3E%3C/g%3E%3C/svg%3E");
  background-size: cover;
  opacity: .12;
  animation: ringSpin 62s linear infinite;
  mix-blend-mode: plus-lighter;
}
.embers {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(197,160,89,.58) 1px, transparent 1px);
  background-size: 12px 12px;
  opacity: .08;
  animation: embersRise 22s linear infinite;
}
.energy-veins {
  position: absolute; inset: 0;
  background: repeating-linear-gradient(135deg, transparent 0 24px, rgba(197,160,89,.03) 24px 26px);
  animation: veinsShift 9s linear infinite;
}
.vignette { position: absolute; inset: 0; background: radial-gradient(circle, transparent 28%, rgba(0,0,0,.92) 100%); }

.selector-shell { position: relative; z-index: 4; max-width: 1320px; margin: 0 auto; }
.glass {
  background: rgba(7, 8, 14, 0.86);
  border: 1px solid rgba(197,160,89,.25);
  border-radius: 18px;
  box-shadow: 0 20px 45px rgba(0,0,0,.42), inset 0 0 0 1px rgba(255,255,255,.03);
  backdrop-filter: blur(10px);
}

.selector-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 26px; padding: 14px 18px;
}

.btn-back {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.2); color: #d9d9e4;
  font-family: 'Cinzel', serif; padding: 9px 12px; border-radius: 12px; cursor: pointer; transition: .2s ease;
}
.btn-back:hover { color: $gold; border-color: rgba($gold,.6); transform: translateY(-1px); }

.pill {
  display: inline-block; padding: 8px 12px; border-radius: 999px;
  border: 1px solid rgba($gold,.45); color: $goldSoft; font-family: 'Cinzel', serif; font-size: .86rem;
  background: linear-gradient(130deg, rgba($gold,.14), rgba(255,255,255,.02));
  box-shadow: 0 0 0 1px rgba(197,160,89,.16), 0 0 24px rgba(197,160,89,.12) inset;
}

.step-title {
  text-align: center; margin-bottom: 24px;
  h1 { font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 3.2vw, 2.7rem); color: $gold; letter-spacing: 2px; margin-bottom: 8px; text-shadow: 0 0 28px rgba(197,160,89,.22); }
  p { color: #b2b2bf; font-family: 'Crimson Text', serif; font-size: 1.08rem; }
}

.campaign-status { color: #9a9aac; text-align: center; padding: 20px; }
.campaign-status.error { color: #ff8a8a; }

.builder-grid { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }
.roster { padding: 14px; max-height: calc(100dvh - 250px); overflow: auto; }

.char-card {
  display: flex; align-items: center; position: relative; overflow: hidden;
  padding: 14px 18px; background: $darkCard; border: 1px solid rgba(255,255,255,.12);
  margin-bottom: 10px; cursor: pointer; transition: .25s ease; border-radius: 14px;
}
.char-card:hover { border-color: rgba($gold,.5); transform: translateX(4px) translateY(-1px); box-shadow: 0 12px 24px rgba(0,0,0,.28); }
.char-card.is-selected { border-color: $gold; background: linear-gradient(130deg, rgba($gold,.14), rgba(0,0,0,.24)); }
.char-glow {
  position: absolute; inset: -40%; background: radial-gradient(circle, rgba($gold,.16), transparent 55%);
  opacity: 0; transition: .25s ease; pointer-events: none;
}
.char-card:hover .char-glow, .char-card.is-selected .char-glow { opacity: 1; }

.char-avatar-box {
  font-size: 1.7rem; margin-right: 16px; background: rgba(255,255,255,.05);
  width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; border-radius: 50%;
  border: 1px solid rgba($gold,.22);
}

.info {
  .char-name { font-family: 'Cinzel', serif; font-size: 1.08rem; color: #fff; display: block; }
  .char-role { color: $gold; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 1px; }
  .char-weapon { color: #8d8d99; font-size: 0.78rem; margin-top: 2px; }
}

.select-indicator { margin-left: auto; width: 12px; height: 12px; border: 1px solid #666; border-radius: 50%; transition: .25s; }
.char-card.is-selected .select-indicator { background: $gold; box-shadow: 0 0 10px rgba($gold,.5); border-color: $gold; }

.summary-panel { padding: 20px; height: fit-content; }
.summary-panel h3 { font-family: 'Cinzel', serif; color: $gold; margin-bottom: 16px; font-size: 0.9rem; letter-spacing: 1px; }

.party-slots {
  display: flex; justify-content: center; gap: 10px; margin-bottom: 16px;
  .slot { width: 48px; height: 48px; border: 1px dashed rgba(255,255,255,.25); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; transition: .2s; }
  .slot.filled { border: 1px solid $gold; color: $gold; background: rgba($gold,0.08); animation: slotPulse 2.2s infinite; }
}

.party-info { color: #9d9dab; font-size: 0.82rem; margin-bottom: 14px; text-align: center; }

.synergy-card { border: 1px solid rgba(255,255,255,.15); border-radius: 12px; padding: 10px 12px; margin-bottom: 14px; }
.synergy-card strong { display:block; font-size:.82rem; margin-bottom:3px; }
.synergy-card p { margin:0; font-size:.85rem; color:#b8b8c5; font-family:'Crimson Text', serif; }
.synergy-card.ok { border-color: rgba(45,182,108,.45); strong{color:#8dedb7;} }
.synergy-card.warn { border-color: rgba(240,170,86,.45); strong{color:#ffc07a;} }

.btn-start-adventure {
  width: 100%; position: relative; overflow: hidden;
  background: linear-gradient(90deg, #3f0f15, #641720);
  color: #fff; border: 1px solid rgba($gold,.65); border-radius: 12px;
  padding: 13px; font-family: 'Cinzel', serif; font-weight: 700; cursor: pointer; transition: .2s;
  letter-spacing: .8px;
}
.btn-start-adventure:disabled { background: #1f1f24; color: #595962; border-color:#3a3a40; cursor: not-allowed; }
.btn-start-adventure:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 0 24px rgba($gold,.2); }
.shine { position: absolute; inset: 0; background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.2), transparent 70%); transform: translateX(-120%); }
.btn-start-adventure:hover .shine { animation: shine .8s ease; }

.fade-in { animation: fadeIn 0.45s ease-out forwards; }
.reveal-up { opacity: 0; transform: translateY(10px); animation: reveal .45s forwards; }
.delay-1 { animation-delay: .08s; }
.delay-2 { animation-delay: .14s; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes reveal { to { opacity: 1; transform: translateY(0); } }
@keyframes smokeA { from { transform: translate3d(-2%, -1%, 0) scale(1); } to { transform: translate3d(2%, 1%, 0) scale(1.08);} }
@keyframes smokeB { from { transform: translate3d(3%, -2%, 0) scale(1.02);} to { transform: translate3d(-3%, 2%, 0) scale(1.1);} }
@keyframes embersRise { from { background-position: 0 0;} to { background-position: 0 -240px;} }
@keyframes ringSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
@keyframes veinsShift { from { transform: translateX(0);} to { transform: translateX(22px);} }
@keyframes shine { from { transform: translateX(-120%);} to { transform: translateX(120%);} }
@keyframes slotPulse { 0%,100% { box-shadow: 0 0 0 0 rgba($gold,.0);} 50% { box-shadow: 0 0 14px rgba($gold,.28);} }

@media (max-width: 980px) {
  .builder-grid { grid-template-columns: 1fr; }
  .summary-panel { order: -1; }
  .roster { max-height: none; }
}
</style>
