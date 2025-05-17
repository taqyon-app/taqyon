<script>
  import { onMount } from 'svelte';
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import { setupQtConnection } from './qwebchannel-bridge.js';

  let count = 0;
  let message = '';
  let backend = null;
  let connectionStatus = 'Initializing...';

  onMount(async () => {
    console.log('Component mounted, setting up Qt connection');
    connectionStatus = 'Connecting to Qt backend...';

    try {
      const backendObj = await setupQtConnection();
      backend = backendObj;
      connectionStatus = 'Connected to backend ✓';
      console.log('✅ Successfully connected to backend');

      // Get initial values
      count = backend?.count !== undefined ? backend.count : 0;
      message = backend?.message !== undefined ? backend.message : '';
      console.log('Initial values from backend:', { count, message });

      // Connect to signals
      if (backend?.countChanged && typeof backend.countChanged.connect === 'function') {
        backend.countChanged.connect(newCount => {
          console.log('💬 Signal: countChanged received with value:', newCount);
          count = newCount;
        });
      } else {
        console.warn('Backend `countChanged` signal not available or not connectable.');
      }

      if (backend?.messageChanged && typeof backend.messageChanged.connect === 'function') {
        backend.messageChanged.connect(newMessage => {
          console.log('💬 Signal: messageChanged received with value:', newMessage);
          message = newMessage;
        });
      } else {
        console.warn('Backend `messageChanged` signal not available or not connectable.');
      }

      if (backend?.sendToFrontend && typeof backend.sendToFrontend.connect === 'function') {
        backend.sendToFrontend.connect((text) => {
          console.log("💬 Signal: sendToFrontend received with:", text);
          // Optionally, update a Svelte store or variable here if you want to display this text
        });
      } else {
        console.warn('Backend `sendToFrontend` signal not available or not connectable.');
      }

      // Test the connection with a simple method call
      try {
        console.log('Testing connection to backend...');
        if (backend?.sendToBackend && typeof backend.sendToBackend === 'function') {
          backend.sendToBackend('Hello from Svelte frontend');
        } else {
          console.warn('Backend `sendToBackend` method not available.');
        }
      } catch (err) {
        console.warn('⚠️ Test message failed:', err);
      }
    } catch (error) {
      connectionStatus = `Error connecting to backend: ${error.message}`;
      console.error('❌ Connection error:', error);
    }
  });

  function incrementCount() {
    if (backend && backend.incrementCount && typeof backend.incrementCount === 'function') {
      try {
        console.log('🔄 Calling backend incrementCount method');
        backend.incrementCount();
        // Do NOT update count directly - wait for the countChanged signal
      } catch (err) {
        console.error('❌ Error calling incrementCount on backend:', err);
        // Fallback to local increment if backend call fails
        count++;
        console.log('Fallback: incremented locally to', count);
      }
    } else {
      console.log('⚠️ No backend connection or incrementCount method unavailable, incrementing count locally');
      count++;
      console.log('Local count is now:', count);
    }
  }
</script>

<main>
  <div>
    <a href="https://vite.dev" target="_blank" rel="noreferrer">
      <img src={viteLogo} class="logo" alt="Vite Logo" />
    </a>
    <a href="https://svelte.dev" target="_blank" rel="noreferrer">
      <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
    </a>
  </div>
  <h1>Vite + Svelte + Qt</h1>

  <div class="status-message" class:error={connectionStatus.includes('Error')}>
    <p>{connectionStatus}</p>
  </div>

  {#if message}
    <div class="backend-message">
      <p>{message}</p>
    </div>
  {/if}

  <div class="card">
    <button on:click={incrementCount}>
      count is {count}
    </button>
    <p>
      This count is synced with the C++ backend when running in the app.
    </p>
  </div>

  <p>
    Check out <a href="https://github.com/sveltejs/kit#readme" target="_blank" rel="noreferrer">SvelteKit</a>, the official Svelte app framework powered by Vite!
  </p>

  <p class="read-the-docs">
    Click on the Vite and Svelte logos to learn more
  </p>
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }

  .status-message {
    background-color: #c8e6c9;
    color: #1b3c1b;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 20px;
    font-size: 0.9em;
    border: 1px solid #81c784;
  }

  .status-message.error {
    background-color: #ffcdd2;
    color: #b71c1c;
    border: 1px solid #e57373;
  }

  .backend-message {
    background-color: #e0e0e0;
    color: #222;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 20px;
    border: 1px solid #bdbdbd;
  }

  .card {
    padding: 1em;
  }
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }
  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 1.5em;
    font-weight: 100;
    margin-bottom: 1em;
  }
  @media (min-width: 640px) {
    main {
      max-width: none;
    }
    h1 {
      font-size: 2em;
    }
  }
</style>
