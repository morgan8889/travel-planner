import type { TripSummary } from '../../lib/types'

const CHIP_COLORS: Record<string, string> = {
  dreaming: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  planning: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  booked: 'bg-green-100 text-green-700 hover:bg-green-200',
  active: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  completed: 'bg-cloud-100 text-cloud-600 hover:bg-cloud-200',
}

interface TripSummaryBarProps {
  trips: TripSummary[]
  onTripClick: (trip: TripSummary) => void
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TripSummaryBar({ trips, onTripClick }: TripSummaryBarProps) {
  if (trips.length === 0) return null

  const sorted = [...trips].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const visible = sorted.slice(0, 8)
  const overflow = sorted.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-cloud-50 rounded-xl border border-cloud-200">
      {visible.map((trip) => (
        <button
          key={trip.id}
          type="button"
          onClick={() => onTripClick(trip)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${CHIP_COLORS[trip.status] || CHIP_COLORS.planning}`}
        >
          {trip.destination}
          <span className="opacity-70">
            {formatShortDate(trip.start_date)}&ndash;{formatShortDate(trip.end_date)}
          </span>
        </button>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-cloud-500">+{overflow} more</span>
      )}
    </div>
  )
}
