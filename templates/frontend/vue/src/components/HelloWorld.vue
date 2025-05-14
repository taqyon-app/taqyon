<script setup>
import { onMounted, ref } from 'vue'
import { setupQtConnection } from '../qwebchannel-bridge.js'

defineProps({
  msg: String,
})

const count = ref(0)
const message = ref('')
const backend = ref(null)
const connectionStatus = ref('Initializing...')

onMounted(() => {
  console.log('Component mounted, setting up Qt connection')
  connectionStatus.value = 'Connecting to Qt backend...'
  
  // Use our QWebChannel bridge to establish connection
  setupQtConnection()
    .then(backendObj => {
      // Store the backend object
      backend.value = backendObj
      connectionStatus.value = 'Connected to backend ✓'
      console.log('✅ Successfully connected to backend')
      
      // Get initial values
      count.value = backend.value.count || 0
      message.value = backend.value.message || ''
      console.log('Initial values from backend:', { count: count.value, message: message.value })
      
      // Connect to signals
      backend.value.countChanged.connect((newCount) => {
        console.log('💬 Signal: countChanged received with value:', newCount)
        count.value = newCount
      })
      
      backend.value.messageChanged.connect((newMessage) => {
        console.log('💬 Signal: messageChanged received with value:', newMessage)
        message.value = newMessage
      })
      
      backend.value.sendToFrontend.connect((text) => {
        console.log("💬 Signal: sendToFrontend received with:", text)
      })
      
      // Test the connection with a simple method call
      try {
        console.log('Testing connection to backend...')
        backend.value.sendToBackend('Hello from Vue frontend')
      } catch (err) {
        console.warn('⚠️ Test message failed:', err)
      }
    })
    .catch(error => {
      connectionStatus.value = `Error connecting to backend: ${error.message}`
      console.error('❌ Connection error:', error)
    })
})

function incrementCount() {
  if (backend.value) {
    // In application mode: use the backend to increment the count
    try {
      // Call the backend method to increment count
      console.log('🔄 Calling backend incrementCount method')
      const result = backend.value.incrementCount()
      console.log('Backend call result:', result)
      // Do NOT update count directly - wait for the countChanged signal
    } catch (err) {
      console.error('❌ Error calling incrementCount on backend:', err)
      // Fallback to local increment if backend call fails
      count.value++
      console.log('Fallback: incremented locally to', count.value)
    }
  } else {
    // In development mode: update the count locally
    console.log('⚠️ No backend connection, incrementing count locally')
    count.value++
    console.log('Local count is now:', count.value)
  }
}
</script>

<template>
  <h1>{{ msg }}</h1>
  
  <div class="status-message" :class="{ error: connectionStatus.includes('Error') }">
    <p>{{ connectionStatus }}</p>
  </div>
  
  <div v-if="message" class="backend-message">
    <p>{{ message }}</p>
  </div>

  <div class="card">
    <button type="button" @click="incrementCount">count is {{ count }}</button>
    <p>
      This count is synced with the C++ backend when running in the app.
    </p>
  </div>

  <p>
    Check out
    <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank"
      >create-vue</a
    >, the official Vue + Vite starter
  </p>
  <p>
    Learn more about IDE Support for Vue in the
    <a
      href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
      target="_blank"
      >Vue Docs Scaling up Guide</a
    >.
  </p>
  <p class="read-the-docs">Click on the Vite and Vue logos to learn more</p>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}

.backend-message {
  background-color: #e0e0e0; /* darker gray for better contrast */
  color: #222;               /* dark text for readability */
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #bdbdbd; /* subtle border for definition */
}

.status-message {
  background-color: #c8e6c9; /* darker green for better contrast */
  color: #1b3c1b;            /* dark green text */
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 0.9em;
  border: 1px solid #81c784;
}

.status-message.error {
  background-color: #ffcdd2; /* darker red for error */
  color: #b71c1c;            /* dark red text */
  border: 1px solid #e57373;
}

</style>
