import { useMemo } from 'react'
import { DayCell } from './DayCell'
import type { TripSummary, HolidayEntry, CustomDay } from '../../lib/types'

interface QuarterViewProps {
  year: number
  quarter: number  // 0-3 (Q1-Q4)
  trips: TripSummary[]
  holidays: HolidayEntry[]
  customDays: CustomDay[]
  onMonthClick: (month: number) => void
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
}: QuarterViewProps) {
  const months = [quarter * 3, quarter * 3 + 1, quarter * 3 + 2]
  const today = new Date().toISOString().split('T')[0]

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])
  const customDaySet = useMemo(() => {
    return new Set(customDays.map((cd) =>
      cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date
    ))
  }, [customDays, year])

  const tripDates = useMemo(() => {
    const set = new Set<string>()
    for (const trip of trips) {
      const start = new Date(trip.start_date + 'T00:00:00')
      const end = new Date(trip.end_date + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(d.toISOString().split('T')[0])
      }
    }
    return set
  }, [trips])

  return (
    <div className="grid grid-cols-3 gap-6 p-4">
      {months.map((month) => {
        const days = getMiniGrid(year, month)
        return (
          <div key={month}>
            <button
              onClick={() => onMonthClick(month)}
              className="text-sm font-semibold text-cloud-800 hover:text-indigo-600 transition-colors mb-2"
            >
              {MONTH_NAMES[month]}
            </button>
            <div className="grid grid-cols-7 gap-px">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] text-cloud-400 pb-1">{d}</div>
              ))}
              {days.map((day, i) => {
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
                    isSelected={tripDates.has(day.date)}
                    holidayLabel={holidaySet.has(day.date) ? 'holiday' : undefined}
                    customDayLabel={customDaySet.has(day.date) ? 'custom' : undefined}
                    compact
                    onClick={() => onMonthClick(month)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
