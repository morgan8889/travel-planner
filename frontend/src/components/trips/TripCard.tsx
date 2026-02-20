import { Link } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'
import type { TripSummary } from '../../lib/types'
import { TripStatusBadge } from './TripStatusBadge'
import { TripTypeBadge } from './TripTypeBadge'

interface TripCardProps {
  trip: TripSummary
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const endDay = end.getDate()
  const endYear = end.getFullYear()

  if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay} - ${endDay}, ${endYear}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`
  }
  return `${startMonth} ${startDay}, ${start.getFullYear()} - ${endMonth} ${endDay}, ${endYear}`
}

export function TripCard({ trip }: TripCardProps) {
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const { member_count, member_previews, itinerary_day_count, days_with_activities } = trip

  const progressLabel =
    days_with_activities >= itinerary_day_count
      ? 'All days planned'
      : `${days_with_activities} / ${itinerary_day_count} days planned`
  const progressPct =
    itinerary_day_count > 0
      ? Math.round((days_with_activities / itinerary_day_count) * 100)
      : 0

  return (
    <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block group">
      <div className="bg-white rounded-2xl border border-cloud-200 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-cloud-300/20 hover:-translate-y-0.5 hover:border-indigo-200 animate-card-enter">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-cloud-900 group-hover:text-indigo-700 transition-colors duration-300 truncate mr-2">
            {trip.destination}
          </h3>
          <TripTypeBadge type={trip.type} />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-cloud-500 mb-3">
          <Calendar className="w-4 h-4 shrink-0" />
          <span data-testid="trip-dates">{dateRange}</span>
        </div>

        {itinerary_day_count > 0 && (
          <div className="mb-3" data-testid="itinerary-progress">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-cloud-500">{progressLabel}</span>
            </div>
            <div className="w-full h-1 bg-cloud-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <TripStatusBadge status={trip.status} />

          <div className="flex items-center -space-x-2" data-testid="member-count">
            {member_count === 0 ? (
              <div className="w-7 h-7 rounded-full bg-cloud-200 border-2 border-white flex items-center justify-center">
                <span className="text-[10px] font-medium text-cloud-600">—</span>
              </div>
            ) : (
              <>
                {member_previews.map((m, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center"
                    style={{ backgroundColor: m.color }}
                  >
                    <span className="text-[10px] font-medium text-white">{m.initials}</span>
                  </div>
                ))}
                {member_count > 3 && (
                  <div className="w-7 h-7 rounded-full bg-cloud-200 border-2 border-white flex items-center justify-center">
                    <span className="text-[10px] font-medium text-cloud-600">
                      +{member_count - 3}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
