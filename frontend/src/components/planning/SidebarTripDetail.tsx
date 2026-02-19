import { Link } from '@tanstack/react-router'
import { ArrowRight, Trash2 } from 'lucide-react'
import { TripStatusBadge } from '../trips/TripStatusBadge'
import type { TripSummary } from '../../lib/types'

interface SidebarTripDetailProps {
  trip: TripSummary
  onDelete: (tripId: string) => void
}

export function SidebarTripDetail({ trip, onDelete }: SidebarTripDetailProps) {
  const start = new Date(trip.start_date + 'T00:00:00')
  const end = new Date(trip.end_date + 'T00:00:00')
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-cloud-900">{trip.destination}</h3>
        <p className="text-sm text-cloud-500 mt-1">
          {trip.start_date} to {trip.end_date} ({days} days)
        </p>
      </div>

      <TripStatusBadge status={trip.status} />

      <div className="space-y-2 pt-2">
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          View Trip Details
          <ArrowRight className="w-4 h-4" />
        </Link>
        <button
          type="button"
          onClick={() => onDelete(trip.id)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Trip
        </button>
      </div>
    </div>
  )
}
