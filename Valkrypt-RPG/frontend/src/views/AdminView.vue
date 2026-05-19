<template>
  <div class="admin-page">
    <header class="admin-head">
      <button class="btn-back" @click="goBack">← Tornar</button>
      <h1>Panell Admin</h1>
      <button class="btn-refresh" @click="reloadAll">Recarrega</button>
    </header>

    <section class="admin-grid">
      <article class="card">
        <h2>Settings IA</h2>
        <label>Model</label>
        <input v-model.trim="ai.model" type="text" maxlength="100" />
        <label>Temperature</label>
        <input v-model.number="ai.temperature" type="number" min="0" max="2" step="0.05" />
        <label>Master Prompt</label>
        <textarea v-model.trim="ai.systemPrompt" rows="7" maxlength="6000"></textarea>
        <div class="actions">
          <button @click="saveAi">Desa</button>
          <button @click="testAi">Test</button>
        </div>
        <p class="state">{{ aiState }}</p>
      </article>

      <article class="card">
        <h2>Inventari global</h2>
        <div class="row">
          <input v-model.trim="search" placeholder="Cerca per nom..." @keyup.enter="loadInventory(1)" />
          <button @click="loadInventory(1)">Cerca</button>
        </div>
        <div class="row form-row">
          <input v-model.trim="itemForm.name" placeholder="Nom" maxlength="80" />
          <select v-model="itemForm.type">
            <option value="consumable">consumable</option>
            <option value="equipment">equipment</option>
          </select>
          <select v-model="itemForm.rarity">
            <option value="common">common</option>
            <option value="rare">rare</option>
            <option value="epic">epic</option>
            <option value="legendary">legendary</option>
          </select>
          <input v-model.number="itemForm.quantity" type="number" min="1" />
          <button @click="createItem">Afegir</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Tipus</th>
                <th>Raresa</th>
                <th>Q</th>
                <th>Accions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in inventory.items" :key="item.id">
                <td><input v-model.trim="item.name" maxlength="80" /></td>
                <td>
                  <select v-model="item.type">
                    <option value="consumable">consumable</option>
                    <option value="equipment">equipment</option>
                  </select>
                </td>
                <td>
                  <select v-model="item.rarity">
                    <option value="common">common</option>
                    <option value="rare">rare</option>
                    <option value="epic">epic</option>
                    <option value="legendary">legendary</option>
                  </select>
                </td>
                <td><input v-model.number="item.quantity" type="number" min="1" /></td>
                <td class="actions">
                  <button @click="updateItem(item)">Desa</button>
                  <button class="danger" @click="deleteItem(item.id)">Elimina</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pager">
          <button :disabled="inventory.page <= 1" @click="loadInventory(inventory.page - 1)">←</button>
          <span>Pàgina {{ inventory.page }}</span>
          <button :disabled="inventory.page * inventory.pageSize >= inventory.total" @click="loadInventory(inventory.page + 1)">→</button>
        </div>
        <p class="state">{{ inventoryState }}</p>
      </article>
    </section>

    <section class="admin-grid">
      <article class="card">
        <h2>Usuaris</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Usuari</th><th>Email</th><th>Verificat</th><th>Estat</th><th>Ban</th></tr></thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.username }}</td>
                <td>{{ u.email }}</td>
                <td>{{ u.verified ? 'sí' : 'no' }}</td>
                <td>{{ u.suspended ? 'suspès' : 'actiu' }}</td>
                <td><button @click="toggleBan(u)">{{ u.suspended ? 'Desbanea' : 'Banea' }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <h2>Logs Admin</h2>
        <ul class="logs">
          <li v-for="log in logs" :key="log.id">
            <strong>{{ log.action }}</strong>
            <small>{{ formatDate(log.createdAt) }}</small>
          </li>
        </ul>
      </article>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApiErrorMessage } from '../services/apiClient';

const router = useRouter();
const adminName = ref('admin');
const ai = reactive({ model: 'gemini-2.0-flash', temperature: 0.75, systemPrompt: '' });
const aiState = ref('');
const search = ref('');
const inventoryState = ref('');
const inventory = reactive({ items: [], page: 1, pageSize: 10, total: 0 });
const itemForm = reactive({ name: '', type: 'consumable', rarity: 'common', quantity: 1 });
const users = ref([]);
const logs = ref([]);

const withJson = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};
const toError = async (response, fallback) => {
  const data = await parseJson(response);
  const message = response?.apiError?.message || data?.error || fallback;
  const requestId = response?.requestId || response?.apiError?.requestId || data?.requestId || '';
  return requestId ? `${message} (ref: ${requestId})` : message;
};

const goBack = () => router.push('/userpage');

const loadAi = async () => {
  try {
    const res = await fetch('/api/admin/ai-settings');
    const data = await parseJson(res);
    if (!res.ok) {
      aiState.value = await toError(res, 'Error carregant settings IA.');
      return;
    }
    const settings = data?.settings || {};
    ai.model = settings.model || 'gemini-2.0-flash';
    ai.temperature = settings?.generationConfig?.temperature ?? 0.75;
    ai.systemPrompt = settings.systemPrompt || '';
  } catch (error) {
    aiState.value = getApiErrorMessage(error, 'Error carregant settings IA.');
  }
};

const saveAi = async () => {
  aiState.value = 'Desant...';
  try {
    const res = await fetch('/api/admin/ai-settings', withJson('PUT', {
      model: ai.model,
      temperature: ai.temperature,
      systemPrompt: ai.systemPrompt,
      updatedBy: adminName.value
    }));
    aiState.value = res.ok ? 'Configuració desada.' : await toError(res, 'Error desant configuració.');
  } catch (error) {
    aiState.value = getApiErrorMessage(error, 'Error desant configuració.');
  }
};

const testAi = async () => {
  aiState.value = 'Provant...';
  try {
    const res = await fetch('/api/admin/ai-settings/test', withJson('POST', {}));
    const data = await parseJson(res);
    aiState.value = res.ok ? `OK (${data?.test?.model || 'model'})` : await toError(res, 'Error de test.');
  } catch (error) {
    aiState.value = getApiErrorMessage(error, 'Error de test.');
  }
};

const loadInventory = async (page = 1) => {
  try {
    const res = await fetch(`/api/admin/inventory?page=${page}&pageSize=${inventory.pageSize}&search=${encodeURIComponent(search.value)}`);
    const data = await parseJson(res);
    if (!res.ok) {
      inventoryState.value = await toError(res, 'Error carregant inventari.');
      return;
    }
    inventory.page = data.page;
    inventory.pageSize = data.pageSize;
    inventory.total = data.total;
    inventory.items = Array.isArray(data.items) ? data.items : [];
    inventoryState.value = `${inventory.total} items`;
  } catch (error) {
    inventoryState.value = getApiErrorMessage(error, 'Error carregant inventari.');
  }
};

const createItem = async () => {
  try {
    const res = await fetch('/api/admin/inventory', withJson('POST', { ...itemForm, updatedBy: adminName.value }));
    if (!res.ok) {
      inventoryState.value = await toError(res, 'No s\'ha pogut crear.');
      return;
    }
    itemForm.name = '';
    itemForm.quantity = 1;
    await loadInventory(1);
  } catch (error) {
    inventoryState.value = getApiErrorMessage(error, 'No s\'ha pogut crear.');
  }
};

const updateItem = async (item) => {
  try {
    const res = await fetch(`/api/admin/inventory/${encodeURIComponent(item.id)}`, withJson('PUT', { ...item, updatedBy: adminName.value }));
    inventoryState.value = res.ok ? 'Item actualitzat.' : await toError(res, 'Error actualitzant item.');
  } catch (error) {
    inventoryState.value = getApiErrorMessage(error, 'Error actualitzant item.');
  }
};

const deleteItem = async (id) => {
  const ok = window.confirm('Vols eliminar aquest item?');
  if (!ok) return;
  try {
    const res = await fetch(`/api/admin/inventory/${encodeURIComponent(id)}`, withJson('DELETE', { updatedBy: adminName.value }));
    if (res.ok) {
      await loadInventory(inventory.page);
      return;
    }
    inventoryState.value = await toError(res, 'No s\'ha pogut eliminar.');
  } catch (error) {
    inventoryState.value = getApiErrorMessage(error, 'No s\'ha pogut eliminar.');
  }
};

const loadUsers = async () => {
  try {
    const res = await fetch('/api/admin/users');
    const data = await parseJson(res);
    if (!res.ok) {
      aiState.value = await toError(res, 'Error carregant usuaris.');
      return;
    }
    users.value = Array.isArray(data?.users) ? data.users : [];
  } catch (error) {
    aiState.value = getApiErrorMessage(error, 'Error carregant usuaris.');
  }
};

const toggleBan = async (user) => {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/suspension`, withJson('PATCH', {
      suspended: !user.suspended,
      updatedBy: adminName.value
    }));
    if (res.ok) {
      await loadUsers();
      return;
    }
    aiState.value = await toError(res, 'No s\'ha pogut actualitzar la suspensió.');
  } catch (error) {
    aiState.value = getApiErrorMessage(error, 'No s\'ha pogut actualitzar la suspensió.');
  }
};

const loadLogs = async () => {
  try {
    const res = await fetch('/api/admin/logs');
    const data = await parseJson(res);
    if (!res.ok) {
      aiState.value = await toError(res, 'Error carregant logs.');
      return;
    }
    logs.value = Array.isArray(data?.logs) ? data.logs : [];
  } catch (error) {
    aiState.value = getApiErrorMessage(error, 'Error carregant logs.');
  }
};

const reloadAll = async () => {
  await Promise.all([loadAi(), loadInventory(inventory.page), loadUsers(), loadLogs()]);
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ca-ES');
};

onMounted(async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  adminName.value = String(user?.username || 'admin');
  await reloadAll();
});
</script>

<style scoped>
.admin-page { min-height: 100vh; background: #0b0c13; color: #f1f1f1; padding: 20px; }
.admin-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 10px; }
.admin-head h1 { margin: 0; font-size: 1.4rem; }
.btn-back, .btn-refresh, button { background: #1e2436; color: #fff; border: 1px solid #39425a; border-radius: 6px; padding: 8px 10px; cursor: pointer; }
.admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.card { border: 1px solid #2e3243; border-radius: 8px; background: rgba(18, 20, 30, 0.9); padding: 12px; }
.card h2 { margin: 0 0 10px 0; font-size: 1.05rem; }
label { font-size: 0.85rem; opacity: 0.85; margin-top: 8px; display: block; }
input, select, textarea { width: 100%; box-sizing: border-box; margin-top: 6px; margin-bottom: 8px; background: #101623; border: 1px solid #384055; color: #f1f1f1; border-radius: 6px; padding: 8px; }
.row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.form-row > * { flex: 1; }
.table-wrap { max-height: 320px; overflow: auto; border: 1px solid #2f3446; border-radius: 6px; }
table { width: 100%; border-collapse: collapse; }
th, td { font-size: 0.82rem; text-align: left; padding: 8px; border-bottom: 1px solid #2b3040; }
td .actions, .actions { display: flex; gap: 6px; }
.danger { background: #5e2020; border-color: #7c2a2a; }
.pager { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.state { font-size: 0.82rem; opacity: 0.9; margin: 8px 0 0; }
.logs { list-style: none; margin: 0; padding: 0; max-height: 280px; overflow: auto; }
.logs li { padding: 6px 0; border-bottom: 1px solid #2f3344; display: flex; justify-content: space-between; gap: 8px; }
.logs small { opacity: 0.75; font-size: 0.75rem; }
@media (max-width: 980px) { .admin-grid { grid-template-columns: 1fr; } }
</style>
