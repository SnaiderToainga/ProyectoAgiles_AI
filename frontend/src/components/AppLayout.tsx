import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />
      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
