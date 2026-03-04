<template>
  <div class="simple-page">
    <nav class="top-nav">
      <router-link to="/userpage">← VOLVER</router-link>
      <h1>CÓDICE</h1>
    </nav>
    <section class="panel">
      <p>Este apartado estará conectado al contenido de lore, bestiario y facciones.</p>
      <p>Por ahora es una vista temporal para evitar rutas rotas.</p>
    </section>
  </div>
</template>

<style scoped>
.simple-page {
  min-height: 100vh;
  background: #050505;
  color: #ddd;
  font-family: 'Cinzel', serif;
  padding: 24px;
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.top-nav a {
  color: #c5a059;
  text-decoration: none;
}

.top-nav h1 {
  margin: 0;
  color: #c5a059;
  font-size: 1.2rem;
  letter-spacing: 2px;
}

.panel {
  border: 1px solid rgba(197, 160, 89, 0.3);
  background: rgba(15, 15, 15, 0.8);
  padding: 20px;
}

.panel p {
  margin: 0 0 10px;
}
</style>
