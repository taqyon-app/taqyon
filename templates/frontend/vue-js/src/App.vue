<script setup>
import HelloWorld from './components/HelloWorld.vue';
</script>

<template>
  <div class="app-container">
    <header>
      <h1>Taqyon Counter App</h1>
      <div class="logo-container">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" class="logo" alt="Vite logo" />
        </a>
        <a href="https://vuejs.org/" target="_blank">
          <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
        </a>
      </div>
    </header>
    
    <main>
      <HelloWorld msg="Qt C++ and Vue.js Integration" />
    </main>
    
    <footer>
      <p>Built with Taqyon - Qt C++ backend + Vue.js frontend</p>
    </footer>
  </div>
</template>

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

header {
  margin-bottom: 2rem;
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

footer {
  margin-top: 2rem;
  font-size: 0.8rem;
  color: #888;
}
</style>
