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

const TRIPS_DEFAULT = 5
const EVENTS_DEFAULT = 5

type PanelEventItem =
  | { kind: 'trip'; trip: TripSummary; date: string }
  | { kind: 'custom'; cd: CustomDay & { resolvedDate: string }; date: string }

function getEventName(notes: string | null | undefined): string | null {
  if (!notes) return null
  const dashIdx = notes.indexOf(' — ')
  return dashIdx !== -1 ? notes.slice(0, dashIdx) : notes.slice(0, 60)
}

type InventoryItem =
  | { type: 'trip'; trip: TripSummary }
  | { type: 'gap'; weeks: number }

type ExpandedState = { year: number; trips: boolean; events: boolean; holidays: boolean }

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

  const customDayMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cd of customDays) {
      const dateStr = cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date
      map.set(dateStr, cd.name)
    }
    return map
  }, [customDays, year])

  const nonEventInventory = useMemo(
    () => buildInventory(trips.filter((t) => t.type !== 'event'), year),
    [trips, year],
  )

  const customDaysForYear = useMemo(() => {
    return customDays
      .map((cd) => ({ ...cd, resolvedDate: cd.recurring ? `${year}-${cd.date.slice(5)}` : cd.date }))
      .filter((cd) => cd.resolvedDate.startsWith(String(year)))
      .sort((a, b) => a.resolvedDate.localeCompare(b.resolvedDate))
  }, [customDays, year])

  const eventItems = useMemo((): PanelEventItem[] => {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const eventTrips = trips
      .filter((t) => t.type === 'event' && t.start_date <= yearEnd && t.end_date >= yearStart)
      .map((t): PanelEventItem => ({ kind: 'trip', trip: t, date: t.start_date }))
    const customs = customDaysForYear.map(
      (cd): PanelEventItem => ({ kind: 'custom', cd, date: cd.resolvedDate }),
    )
    return [...eventTrips, ...customs].sort((a, b) => a.date.localeCompare(b.date))
  }, [trips, customDaysForYear, year])

  const holidaysForYear = useMemo(
    () =>
      holidays
        .filter((h) => h.date >= `${year}-01-01` && h.date <= `${year}-12-31`)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, year],
  )

  const [highlightedTripId, setHighlightedTripId] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<ExpandedState>({ year, trips: false, events: false, holidays: false })
  const tripsExpanded = expanded.year === year && expanded.trips
  const eventsExpanded = expanded.year === year && expanded.events
  const holidaysExpanded = expanded.year === year && expanded.holidays

  const [hoveredCustomId, setHoveredCustomId] = useState<string | null>(null)
  const [hoveredMonthDotState, setHoveredMonthDot] = useState<{ year: number; month: number } | null>(null)
  const hoveredMonthDot = hoveredMonthDotState?.year === year ? hoveredMonthDotState.month : null

  function setTripsExpanded(value: boolean) {
    setExpanded((prev) => ({ ...prev, year, trips: value }))
  }
  function setEventsExpanded(value: boolean) {
    if (!value) setHoveredCustomId(null)
    setExpanded((prev) => ({ ...prev, year, events: value }))
  }
  function setHolidaysExpanded(value: boolean) {
    setExpanded((prev) => ({ ...prev, year, holidays: value }))
  }

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
      onTripClick(trip)
    }
  }

  return (
    <div className="flex items-start">
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
                  <div className="relative">
                    <span
                      className="w-2 h-2 rounded-full bg-amber-400 shrink-0 block cursor-default"
                      onMouseEnter={() => setHoveredMonthDot({ year, month })}
                      onMouseLeave={() => setHoveredMonthDot(null)}
                    />
                    {hoveredMonthDot === month && (
                      <div className="absolute top-full left-0 mt-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[120px]">
                        {customDaysForYear
                          .filter((cd) => new Date(cd.resolvedDate + 'T00:00:00').getMonth() === month)
                          .map((cd) => (
                            <div key={cd.id} className="leading-snug">
                              <span className="font-semibold">{cd.name}</span>
                              <span className="opacity-70 ml-1">{formatShortDate(cd.resolvedDate)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
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
                            customDayName={customDayMap.get(day.date)}
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
                            notes={trip.notes}
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
      <div className="w-60 shrink-0 border-l border-cloud-200 p-4">
        {/* Trips section */}
        <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide mb-3">
          Trips {year}
        </h3>

        {nonEventInventory.length === 0 && (
          <p className="text-xs text-cloud-400 italic">No trips planned</p>
        )}

        {(tripsExpanded ? nonEventInventory : nonEventInventory.slice(0, TRIPS_DEFAULT)).map(
          (item, idx) => {
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
          },
        )}

        {!tripsExpanded && nonEventInventory.length > TRIPS_DEFAULT && (
          <button
            type="button"
            onClick={() => setTripsExpanded(true)}
            className="text-[10px] text-indigo-500 hover:text-indigo-700 py-1 text-left w-full"
          >
            + {nonEventInventory.length - TRIPS_DEFAULT} more
          </button>
        )}
        {tripsExpanded && nonEventInventory.length > TRIPS_DEFAULT && (
          <button
            type="button"
            onClick={() => setTripsExpanded(false)}
            className="text-[10px] text-indigo-500 hover:text-indigo-700 py-1 text-left w-full"
          >
            Show less
          </button>
        )}

        {/* Events section — event-type trips + custom days, merged by date */}
        {eventItems.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cloud-200">
            <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide mb-3">
              Events
            </h3>

            {(eventsExpanded ? eventItems : eventItems.slice(0, EVENTS_DEFAULT)).map((item) => {
              if (item.kind === 'trip') {
                const label = getEventName(item.trip.notes) ?? item.trip.destination
                return (
                  <button
                    key={item.trip.id}
                    onClick={() => handleInventoryTripClick(item.trip)}
                    className="w-full flex items-start gap-2 py-2 text-left hover:bg-cloud-50 rounded-lg px-1 -mx-1 transition-colors group"
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 bg-rose-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-cloud-800 truncate group-hover:text-indigo-700 transition-colors">
                        {label}
                      </p>
                      <p className="text-[10px] text-cloud-500">
                        {formatShortDate(item.trip.start_date)}
                      </p>
                    </div>
                  </button>
                )
              }
              // kind === 'custom'
              return (
                <div
                  key={item.cd.id}
                  className="relative flex items-start gap-2 py-1.5"
                  tabIndex={0}
                  onMouseEnter={() => setHoveredCustomId(item.cd.id)}
                  onMouseLeave={() => setHoveredCustomId(null)}
                  onFocus={() => setHoveredCustomId(item.cd.id)}
                  onBlur={() => setHoveredCustomId(null)}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-cloud-800 truncate">{item.cd.name}</p>
                    <p className="text-[10px] text-cloud-500">{formatShortDate(item.cd.resolvedDate)}</p>
                  </div>
                  {hoveredCustomId === item.cd.id && (
                    <div className="absolute bottom-full left-0 mb-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[120px]">
                      <div className="font-semibold leading-tight">{item.cd.name}</div>
                      <div className="opacity-70 mt-0.5">{formatShortDate(item.cd.resolvedDate)}</div>
                    </div>
                  )}
                </div>
              )
            })}

            {!eventsExpanded && eventItems.length > EVENTS_DEFAULT && (
              <button
                type="button"
                onClick={() => setEventsExpanded(true)}
                className="text-[10px] text-indigo-500 hover:text-indigo-700 py-1 text-left w-full"
              >
                + {eventItems.length - EVENTS_DEFAULT} more
              </button>
            )}
            {eventsExpanded && eventItems.length > EVENTS_DEFAULT && (
              <button
                type="button"
                onClick={() => setEventsExpanded(false)}
                className="text-[10px] text-indigo-500 hover:text-indigo-700 py-1 text-left w-full"
              >
                Show less
              </button>
            )}
          </div>
        )}

        {/* Holidays section — collapsed by default */}
        {holidaysForYear.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cloud-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-cloud-500 uppercase tracking-wide">
                Holidays
              </h3>
              {!holidaysExpanded && (
                <button
                  type="button"
                  onClick={() => setHolidaysExpanded(true)}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700"
                >
                  Show {holidaysForYear.length}
                </button>
              )}
            </div>

            {holidaysExpanded && (
              <>
                {holidaysForYear.map((h) => {
                  const itemContent = (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-cloud-800 truncate group-hover:text-indigo-700 transition-colors">
                          {h.name}
                        </p>
                        <p className="text-[10px] text-cloud-500">
                          {formatShortDate(h.date)} · {h.country_code}
                        </p>
                      </div>
                    </>
                  )
                  return onHolidayClick ? (
                    <button
                      key={`${h.country_code}-${h.date}`}
                      type="button"
                      onClick={() => onHolidayClick(h.date)}
                      className="w-full flex items-start gap-2 py-1.5 text-left hover:bg-cloud-50 rounded-lg px-1 -mx-1 transition-colors group"
                    >
                      {itemContent}
                    </button>
                  ) : (
                    <div
                      key={`${h.country_code}-${h.date}`}
                      className="flex items-start gap-2 py-1.5"
                    >
                      {itemContent}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setHolidaysExpanded(false)}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 py-1 text-left w-full"
                >
                  Show less
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
