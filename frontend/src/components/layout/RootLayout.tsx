import { Outlet, Link } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'

export function RootLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/trips" className="flex items-center gap-2 group">
            <span className="text-2xl">✈️</span>
            <h1 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              Travel Planner
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
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
