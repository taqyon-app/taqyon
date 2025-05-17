import { useEffect, useState } from 'react'
import './App.css'
import reactLogo from './assets/react.svg'
import { setupQtConnection } from './qwebchannel-bridge.js'
import viteLogo from '/vite.svg'

function App() {
  const [count, setCount] = useState(0)
  const [message, setMessage] = useState('')
  const [backend, setBackend] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('Initializing...')

  useEffect(() => {
    console.log('Component mounted, setting up Qt connection')
    setConnectionStatus('Connecting to Qt backend...')

    setupQtConnection()
      .then(backendObj => {
        setBackend(backendObj)
        setConnectionStatus('Connected to backend ✓')
        console.log('✅ Successfully connected to backend')

        // Get initial values
        // Ensure properties exist before accessing, providing defaults
        setCount(backendObj.count !== undefined ? backendObj.count : 0)
        setMessage(backendObj.message !== undefined ? backendObj.message : '')
        console.log('Initial values from backend:', {
          count: backendObj.count,
          message: backendObj.message,
        })

        // Connect to signals
        if (backendObj.countChanged && typeof backendObj.countChanged.connect === 'function') {
          backendObj.countChanged.connect(newCount => {
            console.log('💬 Signal: countChanged received with value:', newCount)
            setCount(newCount)
          })
        } else {
          console.warn('Backend `countChanged` signal not available or not connectable.')
        }

        if (backendObj.messageChanged && typeof backendObj.messageChanged.connect === 'function') {
          backendObj.messageChanged.connect(newMessage => {
            console.log('💬 Signal: messageChanged received with value:', newMessage)
            setMessage(newMessage)
          })
        } else {
          console.warn('Backend `messageChanged` signal not available or not connectable.')
        }
        
        if (backendObj.sendToFrontend && typeof backendObj.sendToFrontend.connect === 'function') {
          backendObj.sendToFrontend.connect((text) => {
            console.log("💬 Signal: sendToFrontend received with:", text)
            // Optionally, update a state here if you want to display this text
          })
        } else {
          console.warn('Backend `sendToFrontend` signal not available or not connectable.')
        }

        // Test the connection with a simple method call
        try {
          console.log('Testing connection to backend...')
          if (backendObj.sendToBackend && typeof backendObj.sendToBackend === 'function') {
            backendObj.sendToBackend('Hello from React frontend')
          } else {
            console.warn('Backend `sendToBackend` method not available.')
          }
        } catch (err) {
          console.warn('⚠️ Test message failed:', err)
        }
      })
      .catch(error => {
        setConnectionStatus(`Error connecting to backend: ${error.message}`)
        console.error('❌ Connection error:', error)
      })
  }, []) // Empty dependency array ensures this runs once on mount

  function incrementCount() {
    if (backend && backend.incrementCount && typeof backend.incrementCount === 'function') {
      try {
        console.log('🔄 Calling backend incrementCount method')
        backend.incrementCount()
        // Do NOT update count directly - wait for the countChanged signal
      } catch (err) {
        console.error('❌ Error calling incrementCount on backend:', err)
        // Fallback to local increment if backend call fails
        setCount(prevCount => prevCount + 1)
        console.log('Fallback: incremented locally to', count + 1)
      }
    } else {
      console.log('⚠️ No backend connection or incrementCount method unavailable, incrementing count locally')
      setCount(prevCount => prevCount + 1)
      console.log('Local count is now:', count + 1)
    }
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React + Qt</h1>

      <div className={`status-message ${connectionStatus.includes('Error') ? 'error' : ''}`}>
        <p>{connectionStatus}</p>
      </div>

      {message && (
        <div className="backend-message">
          <p>{message}</p>
        </div>
      )}

      <div className="card">
        <button onClick={incrementCount}>
          count is {count}
        </button>
        <p>
          This count is synced with the C++ backend when running in the app.
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
