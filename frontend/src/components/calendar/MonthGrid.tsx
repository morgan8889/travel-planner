import type { CalendarBlock, TripSummaryForCalendar } from '../../lib/types'

interface MonthGridProps {
  year: number
  month: number
  blocks: CalendarBlock[]
  trips: TripSummaryForCalendar[]
  onDeleteBlock?: (blockId: string) => void
  onDateSelect?: (start: string, end: string) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

type EventType = 'pto' | 'holiday' | 'vacation' | 'remote_week' | 'sabbatical' | 'trip'

function getEventColor(type: EventType): string {
  switch (type) {
    case 'pto': return 'bg-amber-400/80'
    case 'holiday': return 'bg-red-400/80'
    case 'vacation': return 'bg-blue-400/80'
    case 'remote_week': return 'bg-emerald-400/80'
    case 'sabbatical': return 'bg-purple-400/80'
    default: return 'bg-blue-400/80'
  }
}

interface DayEvent {
  id: string
  type: EventType
  label: string
  isBlockStart: boolean
  isBlockEnd: boolean
  isBlock: boolean
}

function getEventsForDay(
  dateStr: string,
  blocks: CalendarBlock[],
  trips: TripSummaryForCalendar[],
): DayEvent[] {
  const events: DayEvent[] = []

  for (const block of blocks) {
    if (dateStr >= block.start_date && dateStr <= block.end_date) {
      events.push({
        id: block.id,
        type: block.type as EventType,
        label: block.destination || block.type.toUpperCase(),
        isBlockStart: dateStr === block.start_date,
        isBlockEnd: dateStr === block.end_date,
        isBlock: true,
      })
    }
  }

  for (const trip of trips) {
    if (dateStr >= trip.start_date && dateStr <= trip.end_date) {
      events.push({
        id: trip.id,
        type: (trip.type as EventType) || 'trip',
        label: trip.destination,
        isBlockStart: dateStr === trip.start_date,
        isBlockEnd: dateStr === trip.end_date,
        isBlock: false,
      })
    }
  }

  return events
}

export function MonthGrid({ year, month, blocks, trips, onDateSelect }: MonthGridProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const today = new Date()
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="bg-white rounded-xl border border-cloud-200 p-3">
      <h3 className="text-sm font-semibold text-cloud-700 mb-2">{MONTH_NAMES[month]}</h3>

      <div className="grid grid-cols-7 gap-px">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-[10px] font-medium text-cloud-400 text-center pb-1">
            {d}
          </div>
        ))}

        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-7" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = formatDate(year, month, day)
          const isToday = dateStr === todayStr
          const events = getEventsForDay(dateStr, blocks, trips)
          const hasEvent = events.length > 0

          return (
            <button
              key={day}
              onClick={() => {
                if (onDateSelect) {
                  onDateSelect(dateStr, dateStr)
                }
              }}
              className={`
                relative h-7 text-xs flex items-center justify-center rounded transition-colors
                ${isToday ? 'font-bold text-indigo-600 ring-1 ring-indigo-300' : 'text-cloud-600'}
                ${hasEvent ? '' : 'hover:bg-cloud-100'}
              `}
              title={events.map(e => `${e.type}: ${e.label}`).join(', ') || undefined}
            >
              <span className="relative z-10">{day}</span>
              {hasEvent && (
                <div className="absolute inset-0.5 flex flex-col gap-px justify-end">
                  {events.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={`h-1 rounded-full ${getEventColor(event.type)}`}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
