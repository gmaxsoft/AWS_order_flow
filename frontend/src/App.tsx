import { useState } from 'react'
import type { Product, Order } from '@aws-order-flow/shared'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const sampleProduct: Product = { id: '1', name: 'Sample Product', price: 29.99 }
  const sampleOrder: Order = {
    id: 'ord-1',
    customerId: 'cust-1',
    items: [{ productId: '1', quantity: 2, unitPrice: 29.99 }],
    status: 'pending',
    totalAmount: 59.98,
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
      <div className="flex gap-4 mb-6">
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="h-24 p-4 hover:drop-shadow-lg transition" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="h-24 p-4 hover:drop-shadow-lg transition" alt="React logo" />
        </a>
      </div>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">AWS Order Flow</h1>
      <p className="text-gray-600 mb-6">Vite + React + Tailwind + TypeScript</p>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <button
          onClick={() => setCount((c) => c + 1)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          count is {count}
        </button>
        <p className="mt-4 text-sm text-gray-500">
          Shared types: {sampleProduct.name} · Order #{sampleOrder.id}
        </p>
      </div>
    </div>
  )
}

export default App
