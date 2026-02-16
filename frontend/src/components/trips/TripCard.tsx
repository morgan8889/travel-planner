import { Link } from '@tanstack/react-router'
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const avatarColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
]

export function TripCard({ trip }: TripCardProps) {
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const memberCount = trip.member_count

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      className="block group"
    >
      <div className="bg-white rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-gray-300">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate mr-2">
            {trip.destination}
          </h3>
          <TripTypeBadge type={trip.type} />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span data-testid="trip-dates">{dateRange}</span>
        </div>

        <div className="flex items-center justify-between">
          <TripStatusBadge status={trip.status} />

          <div className="flex items-center -space-x-2" data-testid="member-count">
            {Array.from({ length: Math.min(memberCount, 3) }).map((_, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-full ${avatarColors[i % avatarColors.length]} border-2 border-white flex items-center justify-center`}
              >
                <span className="text-[10px] font-medium text-white">
                  {getInitials(`Member ${i + 1}`)}
                </span>
              </div>
            ))}
            {memberCount > 3 && (
              <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                <span className="text-[10px] font-medium text-gray-600">
                  +{memberCount - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
