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
      <div className="bg-white rounded-2xl border border-cloud-200 p-5 transition-all duration-300 hover:shadow-lg hover:shadow-cloud-300/20 hover:-translate-y-0.5 hover:border-indigo-200 animate-card-enter">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-cloud-900 group-hover:text-indigo-700 transition-colors duration-300 truncate mr-2">
            {trip.destination}
          </h3>
          <TripTypeBadge type={trip.type} />
        </div>

        <div className="flex items-center gap-1.5 text-sm text-cloud-500 mb-4">
          <Calendar className="w-4 h-4 shrink-0" />
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
              <div className="w-7 h-7 rounded-full bg-cloud-200 border-2 border-white flex items-center justify-center">
                <span className="text-[10px] font-medium text-cloud-600">
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
