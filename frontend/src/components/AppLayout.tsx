import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#18181b] flex flex-col">
      <Navbar />
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-7 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
