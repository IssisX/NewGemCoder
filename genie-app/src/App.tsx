import { useEffect } from 'react'
import './App.css'
import { orchestrate } from './utils/agent'
import { useGenieStore } from './store/genieStore'

function App() {
  const { apiKey, setApiKey, prompt, status, updateStatus, logs } = useGenieStore()

  useEffect(() => {
    if (['REFINING', 'PLANNING', 'CODING'].includes(status)) {
      orchestrate()
    }
  }, [status])

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Genie Prototype</h1>
      <div>
        <label className="block text-sm">API Key</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="border p-1 text-black"
        />
      </div>
      <div>
        <label className="block text-sm">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => useGenieStore.setState({ prompt: e.target.value })}
          className="border p-1 w-full text-black"
        />
      </div>
      <button
        onClick={() => updateStatus('REFINING')}
        disabled={!apiKey}
        className="bg-blue-500 text-white px-3 py-1 rounded"
      >
        Start
      </button>
      <div>
        <strong>Status:</strong> {status}
      </div>
      <ul>
        {logs.map((l, i) => (
          <li key={i}>{l.type}: {l.message}</li>
        ))}
      </ul>
    </div>
  )
}

export default App
