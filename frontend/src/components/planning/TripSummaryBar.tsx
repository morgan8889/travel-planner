import { useMemo, useState, useRef } from 'react'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

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
  zoomLevel: 'month' | 'quarter' | 'year'
  currentMonth: number
  currentYear: number
  holidays: HolidayEntry[]
  customDays: CustomDay[]
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getPeriodRange(zoomLevel: string, month: number, year: number): [string, string] {
  if (zoomLevel === 'month') {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return [start, end]
  }
  if (zoomLevel === 'quarter') {
    const qStart = Math.floor(month / 3) * 3
    const start = `${year}-${String(qStart + 1).padStart(2, '0')}-01`
    const endMonth = qStart + 2
    const lastDay = new Date(year, endMonth + 1, 0).getDate()
    const end = `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return [start, end]
  }
  return [`${year}-01-01`, `${year}-12-31`]
}

export function TripSummaryBar({
  trips, onTripClick, zoomLevel, currentMonth, currentYear, holidays, customDays,
}: TripSummaryBarProps) {
  const [periodStart, periodEnd] = useMemo(
    () => getPeriodRange(zoomLevel, currentMonth, currentYear),
    [zoomLevel, currentMonth, currentYear]
  )

  const filteredTrips = useMemo(
    () => trips
      .filter((t) => t.start_date <= periodEnd && t.end_date >= periodStart)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [trips, periodStart, periodEnd]
  )

  const holidayCount = useMemo(
    () => holidays.filter((h) => h.date >= periodStart && h.date <= periodEnd).length,
    [holidays, periodStart, periodEnd]
  )

  const eventCount = useMemo(() => {
    return customDays.filter((cd) => {
      const dateStr = cd.recurring ? `${currentYear}-${cd.date.slice(5)}` : cd.date
      return dateStr >= periodStart && dateStr <= periodEnd
    }).length
  }, [customDays, periodStart, periodEnd, currentYear])

  const [expanded, setExpanded] = useState(false)

  // Reset expanded state when the period changes (avoids useEffect + setState)
  const prevPeriodRef = useRef(`${periodStart}-${periodEnd}`)
  const currentPeriodKey = `${periodStart}-${periodEnd}`
  if (prevPeriodRef.current !== currentPeriodKey) {
    prevPeriodRef.current = currentPeriodKey
    if (expanded) {
      setExpanded(false)
    }
  }

  if (filteredTrips.length === 0 && holidayCount === 0 && eventCount === 0) return null

  const visible = expanded ? filteredTrips : filteredTrips.slice(0, 8)
  const overflow = expanded ? 0 : filteredTrips.length - Math.min(filteredTrips.length, 8)

  const statParts: string[] = []
  if (filteredTrips.length > 0) statParts.push(`${filteredTrips.length} trip${filteredTrips.length !== 1 ? 's' : ''}`)
  if (holidayCount > 0) statParts.push(`${holidayCount} holiday${holidayCount !== 1 ? 's' : ''}`)
  if (eventCount > 0) statParts.push(`${eventCount} event${eventCount !== 1 ? 's' : ''}`)

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2 bg-cloud-50 rounded-xl border border-cloud-200">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
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
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer transition-colors"
          >
            +{overflow} more
          </button>
        )}
        {expanded && filteredTrips.length > 8 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer transition-colors"
          >
            Show less
          </button>
        )}
      </div>
      <p className="text-xs text-cloud-500 whitespace-nowrap shrink-0 pt-1">{statParts.join(' | ')}</p>
    </div>
  )
}
