import { Outlet, Link } from '@tanstack/react-router'
import { Plane } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function RootLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-cloud-50">
      <header className="bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] border-b border-cloud-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/trips" className="flex items-center gap-2 group">
            <Plane className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold tracking-tight text-cloud-900 group-hover:text-indigo-700 transition-colors duration-300">
              Travel Planner
            </h1>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className="px-3 py-1.5 text-sm font-medium text-cloud-500 rounded-lg hover:bg-cloud-100 hover:text-cloud-900 transition-colors"
              activeProps={{ className: 'bg-indigo-50 text-indigo-700' }}
              activeOptions={{ exact: true }}
            >
              Dashboard
            </Link>
            <Link
              to="/trips"
              className="px-3 py-1.5 text-sm font-medium text-cloud-500 rounded-lg hover:bg-cloud-100 hover:text-cloud-900 transition-colors"
              activeProps={{ className: 'bg-indigo-50 text-indigo-700' }}
            >
              Trips
            </Link>
            <Link
              to="/calendar"
              className="px-3 py-1.5 text-sm font-medium text-cloud-500 rounded-lg hover:bg-cloud-100 hover:text-cloud-900 transition-colors"
              activeProps={{ className: 'bg-indigo-50 text-indigo-700' }}
            >
              Calendar
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-cloud-500 hidden sm:inline">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 text-sm font-medium text-cloud-500 bg-white border border-cloud-200 rounded-lg hover:bg-cloud-50 hover:text-cloud-900 transition-colors"
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
