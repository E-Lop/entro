import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          entro
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Food Expiry Tracker - Setup in corso...
        </p>
        <button
          onClick={() => setCount((count) => count + 1)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
        >
          Test counter: {count}
        </button>
      </div>
    </div>
  )
}

export default App
