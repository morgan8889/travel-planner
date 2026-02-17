import { Link } from '@tanstack/react-router'

export function EmptyTripsState() {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-50 mb-6">
        <span className="text-5xl">🌍</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">No trips yet</h2>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        Your next adventure is just a click away. Start planning your first trip and
        make your travel dreams a reality.
      </p>
      <Link
        to="/trips/new"
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Plan Your First Trip
      </Link>
    </div>
  )
}
