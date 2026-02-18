import { Outlet, Link } from '@tanstack/react-router'
import { Plane } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function RootLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/trips" className="flex items-center gap-2 group">
            <Plane className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-stone-900 group-hover:text-blue-700 transition-colors duration-300">
              Travel Planner
            </h1>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/calendar"
              className="px-3 py-1.5 text-sm font-medium text-stone-500 rounded-lg hover:bg-stone-100 hover:text-stone-900 transition-colors"
              activeProps={{ className: 'bg-stone-100 text-stone-900' }}
            >
              Calendar
            </Link>
            <Link
              to="/trips"
              className="px-3 py-1.5 text-sm font-medium text-stone-500 rounded-lg hover:bg-stone-100 hover:text-stone-900 transition-colors"
              activeProps={{ className: 'bg-stone-100 text-stone-900' }}
            >
              Trips
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500 hidden sm:inline">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 text-sm font-medium text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:text-stone-900 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
