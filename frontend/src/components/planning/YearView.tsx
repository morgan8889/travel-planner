import { useMemo, useState, useRef } from 'react'
import { DayCell } from './DayCell'
import { TripSpan } from './TripSpan'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

interface YearViewProps {
  year: number
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  selectedDate?: string | null
  onMonthClick: (month: number) => void
  onDayClick: (date: string) => void
  onTripClick: (trip: TripSummary) => void
  onHolidayClick?: (date: string) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_DOT: Record<string, string> = {
  dreaming: 'bg-purple-400',
  planning: 'bg-blue-400',
  booked: 'bg-green-400',
  active: 'bg-orange-400',
  completed: 'bg-cloud-400',
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getMiniGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: { date: string; dayNumber: number; isCurrentMonth: boolean }[] = []
  for (let i = 0; i < startPadding; i++) {
    days.push({ date: '', dayNumber: 0, isCurrentMonth: false })
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push({ date: formatDate(year, month, d), dayNumber: d, isCurrentMonth: true })
  }
  return days
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type InventoryItem =
  | { type: 'trip'; trip: TripSummary }
  | { type: 'gap'; weeks: number }

function buildInventory(trips: TripSummary[], year: number): InventoryItem[] {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const yearTrips = trips
    .filter((t) => t.start_date <= yearEnd && t.end_date >= yearStart)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const items: InventoryItem[] = []
  for (let i = 0; i < yearTrips.length; i++) {
    if (i > 0) {
      const prevEnd = yearTrips[i - 1].end_date
      const currStart = yearTrips[i].start_date
      const gapDays = Math.floor(
        (new Date(currStart + 'T00:00:00').getTime() - new Date(prevEnd + 'T00:00:00').getTime()) /
          (1000 * 60 * 60 * 24)
      )
      if (gapDays >= 14) {
        items.push({ type: 'gap', weeks: Math.floor(gapDays / 7) })
      }
    }
    items.push({ type: 'trip', trip: yearTrips[i] })
  }
  return items
}

export function YearView({
  year,
  trips,
  holidays,
  customDays,
  selectedDate,
  onMonthClick,
  onDayClick,
  onTripClick,
  onHolidayClick,
}: YearViewProps) {
  const today = new Date().toISOString().split('T')[0]

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of holidays) {
      map.set(h.date, h.name)
    }
    return map
  }, [holidays])

  const customDaySet = useMemo(() => {
    return new Set(customDays.map((cd) => (cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date)))
  }, [customDays, year])

  const inventory = useMemo(() => buildInventory(trips, year), [trips, year])

  const customDaysForYear = useMemo(() => {
    return customDays
      .map((cd) => ({ ...cd, resolvedDate: cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date }))
      .filter((cd) => cd.resolvedDate.startsWith(String(year)))
      .sort((a, b) => a.resolvedDate.localeCompare(b.resolvedDate))
  }, [customDays, year])

  const [highlightedTripId, setHighlightedTripId] = useState<string | null>(null)
  const monthRefs = useRef<(HTMLDivElement | null)[]>(Array(12).fill(null))

  function handleInventoryTripClick(trip: TripSummary) {
    if (highlightedTripId === trip.id) {
      setHighlightedTripId(null)
    } else {
      setHighlightedTripId(trip.id)
      const month = new Date(trip.start_date + 'T00:00:00').getMonth()
      const el = monthRefs.current[month]
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }

  return (
    <div className="flex">
      {/* Mini calendar grid — 3 columns */}
      <div className="flex-1 grid grid-cols-3 gap-6 p-4 min-w-0">
        {MONTH_NAMES.map((name, month) => {
          const days = getMiniGrid(year, month)
          const monthStart = formatDate(year, month, 1)
          const monthEnd = formatDate(year, month, new Date(year, month + 1, 0).getDate())
          const monthTrips = trips.filter((t) => t.start_date <= monthEnd && t.end_date >= monthStart)

          const weeks: typeof days[] = []
          for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7))
          }

          const eventCount = customDaysForYear.filter((cd) => {
            const m = new Date(cd.resolvedDate + 'T00:00:00').getMonth()
            return m === month
          }).length

          return (
            <div key={month} ref={(el) => { monthRefs.current[month] = el }}>
              <div className="flex items-center gap-1 mb-2">
                <button
                  onClick={() => onMonthClick(month)}
                  className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors"
                >
                  {name}
                </button>
                {eventCount > 0 && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                    title={customDaysForYear
                      .filter(
                        (cd) =>
                          new Date(cd.resolvedDate + 'T00:00:00').getMonth() === month,
                      )
                      .map((cd) => cd.name)
                      .join(', ')}
                  />
                )}
              </div>
              {weeks.map((week, weekIdx) => {
                const weekStart = week.find((d) => d.isCurrentMonth)?.date ?? monthStart
                const weekEnd = [...week].reverse().find((d) => d.isCurrentMonth)?.date ?? monthEnd
                const weekTrips = monthTrips.filter(
                  (t) => t.start_date <= weekEnd && t.end_date >= weekStart
                )
                return (
                  <div key={weekIdx} className="flex flex-col">
                    <div className="grid grid-cols-7 border-t border-l border-cloud-100">
                      {week.map((day, i) => {
                        if (!day.isCurrentMonth) {
                          return <div key={i} className="aspect-square border-b border-r border-cloud-100" />
                        }
                        return (
                          <DayCell
                            key={day.date}
                            date={day.date}
                            dayNumber={day.dayNumber}
                            isToday={day.date === today}
                            isCurrentMonth
                            isSelected={false}
                            isSelectedForCreate={day.date === selectedDate}
                            holidayLabel={holidayMap.get(day.date)}
                            customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
                            compact
                            onClick={() => onDayClick(day.date)}
                            onHolidayClick={onHolidayClick}
                          />
                        )
                      })}
                    </div>
                    {/* Trip bar strip — h-8 to fit medium-size bars */}
                    <div className="relative h-8">
                      {weekTrips.slice(0, 2).map((trip, tripIdx) => {
                        const startCol = Math.max(
                          0,
                          week.findIndex((d) => d.isCurrentMonth && d.date >= trip.start_date)
                        )
                        const endIdx = week.findIndex((d) => d.isCurrentMonth && d.date > trip.end_date)
                        const endCol = endIdx === -1 ? 7 : endIdx
                        const colSpan = endCol - startCol
                        if (colSpan <= 0) return null

                        return (
                          <TripSpan
                            key={trip.id}
                            destination={trip.destination}
                            status={trip.status}
                            colorBy="type"
                            tripType={trip.type}
                            startCol={startCol}
                            colSpan={colSpan}
                            stackIndex={tripIdx}
                            size="medium"
                            startDate={trip.start_date}
                            endDate={trip.end_date}
                            isHighlighted={trip.id === highlightedTripId}
                            onClick={() => onTripClick(trip)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Trip inventory panel */}
      <div className="w-60 shrink-0 border-l border-cloud-200 p-4 overflow-y-auto">
        <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide mb-3">
          Trips {year}
        </h3>

        {inventory.length === 0 && (
          <p className="text-xs text-cloud-400 italic">No trips planned</p>
        )}

        {inventory.map((item, idx) => {
          if (item.type === 'gap') {
            return (
              <div key={`gap-${idx}`} className="flex items-center gap-1 py-2">
                <div className="flex-1 border-t border-dashed border-cloud-200" />
                <span className="text-[10px] text-cloud-400 whitespace-nowrap shrink-0">
                  {item.weeks} weeks free
                </span>
                <div className="flex-1 border-t border-dashed border-cloud-200" />
              </div>
            )
          }

          const { trip } = item
          const dotColor = STATUS_DOT[trip.status] ?? 'bg-cloud-400'
          return (
            <button
              key={trip.id}
              onClick={() => handleInventoryTripClick(trip)}
              className="w-full flex items-start gap-2 py-2 text-left hover:bg-cloud-50 rounded-lg px-1 -mx-1 transition-colors group"
            >
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${dotColor}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-cloud-800 truncate group-hover:text-indigo-700 transition-colors">
                  {trip.destination}
                </p>
                <p className="text-[10px] text-cloud-500">
                  {formatShortDate(trip.start_date)} – {formatShortDate(trip.end_date)}
                </p>
              </div>
            </button>
          )
        })}

        {/* Custom days / events section */}
        {customDaysForYear.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cloud-200">
            <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide mb-3">
              Events
            </h3>
            {customDaysForYear.map((cd) => (
              <div key={cd.id} className="flex items-start gap-2 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-cloud-800 truncate">{cd.name}</p>
                  <p className="text-[10px] text-cloud-500">{formatShortDate(cd.resolvedDate)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
