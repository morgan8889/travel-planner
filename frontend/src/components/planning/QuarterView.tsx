import { useMemo } from 'react'
import { DayCell } from './DayCell'
import { TripSpan } from './TripSpan'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

interface QuarterViewProps {
  year: number
  quarter: number  // 0-3 (Q1-Q4)
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  onMonthClick: (month: number) => void      // month header click (drill-down)
  onDayClick: (date: string) => void          // empty day click (quick-add)
  onTripClick: (trip: TripSummary) => void    // trip bar click (detail sidebar)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

export function QuarterView({
  year,
  quarter,
  trips,
  holidays,
  customDays,
  onMonthClick,
  onDayClick,
  onTripClick,
}: QuarterViewProps) {
  const months = [quarter * 3, quarter * 3 + 1, quarter * 3 + 2]
  const today = new Date().toISOString().split('T')[0]

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])
  const customDaySet = useMemo(() => {
    return new Set(customDays.map((cd) =>
      cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date
    ))
  }, [customDays, year])

  return (
    <div className="grid grid-cols-3 gap-6 p-4">
      {months.map((month) => {
        const days = getMiniGrid(year, month)
        const monthStart = formatDate(year, month, 1)
        const monthEnd = formatDate(year, month, new Date(year, month + 1, 0).getDate())
        const monthTrips = trips.filter(
          (t) => t.start_date <= monthEnd && t.end_date >= monthStart
        )

        // Chunk days into week rows
        const weeks: typeof days[] = []
        for (let i = 0; i < days.length; i += 7) {
          weeks.push(days.slice(i, i + 7))
        }

        return (
          <div key={month}>
            <button
              onClick={() => onMonthClick(month)}
              className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors mb-2"
            >
              {MONTH_NAMES[month]}
            </button>
            <div className="grid grid-cols-7 gap-px mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] text-cloud-400 pb-1">{d}</div>
              ))}
            </div>
            {weeks.map((week, _weekIdx) => {
              const weekStart = week.find((d) => d.isCurrentMonth)?.date ?? monthStart
              const weekEnd = [...week].reverse().find((d) => d.isCurrentMonth)?.date ?? monthEnd
              const weekTrips = monthTrips.filter(
                (t) => t.start_date <= weekEnd && t.end_date >= weekStart
              )
              return (
                <div key={_weekIdx} className="relative pb-3">
                  <div className="grid grid-cols-7 gap-px">
                    {week.map((day, i) => {
                      if (!day.isCurrentMonth) {
                        return <div key={i} className="aspect-square" />
                      }
                      return (
                        <DayCell
                          key={day.date}
                          date={day.date}
                          dayNumber={day.dayNumber}
                          isToday={day.date === today}
                          isCurrentMonth
                          isSelected={false}
                          holidayLabel={holidaySet.has(day.date) ? 'holiday' : undefined}
                          customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
                          compact
                          onClick={() => onDayClick(day.date)}
                        />
                      )
                    })}
                  </div>
                  {/* Compact trip bars — max 2 visible per week */}
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
                        startCol={startCol}
                        colSpan={colSpan}
                        stackIndex={tripIdx}
                        compact
                        showLabel
                        startDate={trip.start_date}
                        endDate={trip.end_date}
                        onClick={() => onTripClick(trip)}
                      />
                    )
                  })}
                  {weekTrips.length > 2 && (
                    <span className="absolute right-0 bottom-0 text-[8px] text-cloud-500">
                      +{weekTrips.length - 2}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
