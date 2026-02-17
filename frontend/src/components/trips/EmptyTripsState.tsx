import { Link } from '@tanstack/react-router'
import { Plus, Globe } from 'lucide-react'

export function EmptyTripsState() {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-50 to-blue-100/80 ring-1 ring-blue-200/50 mb-6">
        <Globe className="w-12 h-12 text-blue-600" />
      </div>
      <h2 className="text-2xl font-bold text-stone-900 mb-2">No trips yet</h2>
      <p className="text-stone-500 mb-8 max-w-md mx-auto">
        Your next adventure is just a click away. Start planning your first trip and
        make your travel dreams a reality.
      </p>
      <Link
        to="/trips/new"
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-200/50"
      >
        <Plus className="w-5 h-5" />
        Plan Your First Trip
      </Link>
    </div>
  )
}
