import { useState } from 'react'
import { Plus, TriangleAlert } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTrips } from '../hooks/useTrips'
import { TripCard } from '../components/trips/TripCard'
import { EmptyTripsState } from '../components/trips/EmptyTripsState'
import type { TripStatus } from '../lib/types'

const statusFilters: { value: TripStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'dreaming', label: 'Dreaming' },
  { value: 'planning', label: 'Planning' },
  { value: 'booked', label: 'Booked' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-6 bg-stone-200 rounded-lg w-2/3" />
        <div className="h-5 bg-stone-200 rounded-full w-20" />
      </div>
      <div className="h-4 bg-stone-200 rounded w-1/2 mb-4" />
      <div className="flex items-center justify-between">
        <div className="h-5 bg-stone-200 rounded-full w-16" />
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full bg-stone-200" />
          <div className="w-7 h-7 rounded-full bg-stone-200" />
        </div>
      </div>
    </div>
  )
}

export function TripsPage() {
  const [statusFilter, setStatusFilter] = useState<TripStatus | undefined>(undefined)
  const { data: trips, isLoading, error, refetch } = useTrips(statusFilter)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-stone-900">My Trips</h1>
        <Link
          to="/trips/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          New Trip
        </Link>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map((filter) => (
          <button
            key={filter.label}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
              statusFilter === filter.value
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20 ring-offset-1'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-50 to-red-100/80 ring-1 ring-red-200/50 mb-4">
            <TriangleAlert className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-stone-600 mb-4">Something went wrong loading your trips.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && trips && trips.length === 0 && (
        <EmptyTripsState />
      )}

      {/* Trip Grid */}
      {!isLoading && !error && trips && trips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  )
}
