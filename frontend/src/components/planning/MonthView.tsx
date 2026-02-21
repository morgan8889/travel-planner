import { useMemo } from 'react'
import { DayCell } from './DayCell'
import { TripSpan } from './TripSpan'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'
import type { DragSelection } from './useDragSelect'

interface MonthViewProps {
  year: number
  month: number  // 0-indexed (0 = January)
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  selectedDate?: string | null
  selection: DragSelection | null
  onDragStart: (date: string) => void
  onDragMove: (date: string) => void
  onTripClick: (trip: TripSummary) => void
  onHolidayClick?: (date: string) => void
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: { date: string; dayNumber: number; isCurrentMonth: boolean }[] = []

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startPadding - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    days.push({ date: formatDate(prevYear, prevMonth, d), dayNumber: d, isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= totalDays; d++) {
    days.push({ date: formatDate(year, month, d), dayNumber: d, isCurrentMonth: true })
  }

  // Next month padding (fill to 6 rows)
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    days.push({ date: formatDate(nextYear, nextMonth, d), dayNumber: d, isCurrentMonth: false })
  }

  return days
}

export function MonthView({
  year,
  month,
  trips,
  holidays,
  customDays,
  selectedDate,
  selection,
  onDragStart,
  onDragMove,
  onTripClick,
  onHolidayClick,
}: MonthViewProps) {
  const today = new Date().toISOString().split('T')[0]
  const days = useMemo(() => getMonthGrid(year, month), [year, month])

  // Build lookup maps
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of holidays) {
      map.set(h.date, h.name)
    }
    return map
  }, [holidays])

  const customDayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cd of customDays) {
      // For recurring, map to this year's date
      const dateStr = cd.recurring
        ? `${year}-${cd.date.slice(5)}`
        : cd.date
      map.set(dateStr, cd.name)
    }
    return map
  }, [customDays, year])

  const isInSelection = (dateStr: string) => {
    if (!selection) return false
    return dateStr >= selection.startDate && dateStr <= selection.endDate
  }

  // Compute trip spans per week row
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const tripsInMonth = trips.filter((t) => {
    const monthStart = formatDate(year, month, 1)
    const monthEnd = formatDate(year, month, new Date(year, month + 1, 0).getDate())
    return t.start_date <= monthEnd && t.end_date >= monthStart
  })

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-cloud-200">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-2 text-center text-xs font-medium text-cloud-500 uppercase">
            {name}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => {
        const weekStart = week[0].date
        const weekEnd = week[6].date
        const weekTrips = tripsInMonth.filter(
          (t) => t.start_date <= weekEnd && t.end_date >= weekStart
        )

        return (
          <div
            key={weekIdx}
            className="relative"
            style={{ paddingBottom: `${Math.min(weekTrips.length, 3) * 1.5}rem` }}
          >
            <div className="grid grid-cols-7">
              {week.map((day) => (
                <DayCell
                  key={day.date}
                  date={day.date}
                  dayNumber={day.dayNumber}
                  isToday={day.date === today}
                  isCurrentMonth={day.isCurrentMonth}
                  isSelected={isInSelection(day.date)}
                  isSelectedForCreate={day.date === selectedDate}
                  holidayLabel={holidayMap.get(day.date)}
                  customDayLabel={customDayMap.get(day.date)}
                  onMouseDown={onDragStart}
                  onMouseEnter={onDragMove}
                  onHolidayClick={onHolidayClick}
                />
              ))}
            </div>

            {/* Trip spans for this week (capped at 3) */}
            {weekTrips.slice(0, 3).map((trip, tripIdx) => {
              const startCol = Math.max(0, week.findIndex((d) => d.date >= trip.start_date))
              const endCol = (() => {
                const idx = week.findIndex((d) => d.date > trip.end_date)
                return idx === -1 ? 7 : idx
              })()
              const colSpan = endCol - startCol

              if (colSpan <= 0) return null

              return (
                <TripSpan
                  key={trip.id}
                  destination={trip.destination}
                  status={trip.status}
                  startCol={startCol}
                  colSpan={colSpan}
                  stackIndex={tripIdx}
                  onClick={() => onTripClick(trip)}
                />
              )
            })}

            {weekTrips.length > 3 && (
              <span className="absolute right-1 bottom-0.5 bg-cloud-100 text-cloud-500 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                +{weekTrips.length - 3} more
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
