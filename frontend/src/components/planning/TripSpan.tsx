import { useState, useEffect } from 'react'
import type { TripStatus, TripType } from '../../lib/types'

const TRIP_COLORS: Record<string, string> = {
  dreaming: 'bg-purple-200 text-purple-800 hover:bg-purple-300',
  planning: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
  booked: 'bg-green-200 text-green-800 hover:bg-green-300',
  active: 'bg-orange-200 text-orange-800 hover:bg-orange-300',
  completed: 'bg-cloud-200 text-cloud-600 hover:bg-cloud-300',
}

const TYPE_COLORS: Record<string, string> = {
  vacation: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
  remote_week: 'bg-teal-200 text-teal-800 hover:bg-teal-300',
  sabbatical: 'bg-amber-200 text-amber-800 hover:bg-amber-300',
  event: 'bg-rose-300 text-rose-900 hover:bg-rose-400',
}

interface TripSpanProps {
  destination: string
  status: TripStatus
  /** Column index (0-6) where the span starts in this row */
  startCol: number
  /** Number of columns the span covers in this row */
  colSpan: number
  /** Vertical offset for stacking overlapping trips */
  stackIndex: number
  onClick: () => void
  /** Display size: 'small' (thin bar, popover only), 'medium' (bar with inline label), 'full' (month view) */
  size?: 'small' | 'medium' | 'full'
  /** Full date range for popover display */
  startDate?: string
  endDate?: string
  colorBy?: 'status' | 'type'
  tripType?: TripType
  isHighlighted?: boolean
  /** Trip notes — used to extract event name for event-type trips */
  notes?: string | null
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getEventName(notes: string | null | undefined): string | null {
  if (!notes) return null
  const dashIdx = notes.indexOf(' — ')
  return dashIdx !== -1 ? notes.slice(0, dashIdx) : notes.slice(0, 60)
}

interface TripPopoverProps {
  destination: string
  tripType?: TripType
  notes?: string | null
  startDate?: string
  endDate?: string
}

function TripPopover({ destination, tripType, notes, startDate, endDate }: TripPopoverProps) {
  const isEvent = tripType === 'event'
  const primaryLabel = isEvent ? (getEventName(notes) ?? destination) : destination

  const dateLabel = (() => {
    if (!startDate) return null
    if (startDate === endDate) return formatShortDate(startDate)
    return `${formatShortDate(startDate)} – ${formatShortDate(endDate ?? startDate)}`
  })()

  return (
    <div className="absolute bottom-full left-0 mb-1.5 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[120px]">
      <div className="font-semibold leading-tight">{primaryLabel}</div>
      {dateLabel && <div className="opacity-70 mt-0.5">{dateLabel}</div>}
      {tripType && (
        <div className="opacity-60 capitalize mt-0.5">
          {tripType.replaceAll('_', ' ')}
        </div>
      )}
    </div>
  )
}

export function TripSpan({
  destination,
  status,
  startCol,
  colSpan,
  stackIndex,
  onClick,
  size = 'full',
  startDate,
  endDate,
  colorBy,
  tripType,
  isHighlighted,
  notes,
}: TripSpanProps) {
  const [hovered, setHovered] = useState(false)
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (!isHighlighted) {
      const t = setTimeout(() => setPulsing(false), 0)
      return () => clearTimeout(t)
    }
    const startTimer = setTimeout(() => setPulsing(true), 0)
    const endTimer = setTimeout(() => setPulsing(false), 1000)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(endTimer)
    }
  }, [isHighlighted])

  const colorClasses =
    colorBy === 'type' && tripType
      ? TYPE_COLORS[tripType] ?? TRIP_COLORS.planning
      : TRIP_COLORS[status] ?? TRIP_COLORS.planning

  const highlightClasses = isHighlighted
    ? ` ring-2 ring-indigo-500 ring-offset-1${pulsing ? ' animate-pulse' : ''}`
    : ''

  const displayLabel =
    tripType === 'event' ? (getEventName(notes) ?? destination) : destination

  if (size === 'small' || size === 'medium') {
    const heightClass = size === 'small' ? 'h-1.5' : 'h-3'
    const bottomOffset = size === 'small' ? stackIndex * 8 : stackIndex * 14

    return (
      <button
        type="button"
        className={`absolute left-0 ${heightClass} rounded-full cursor-pointer transition-colors ${colorClasses}${highlightClasses}`}
        style={{
          width: `${(colSpan / 7) * 100}%`,
          marginLeft: `${(startCol / 7) * 100}%`,
          bottom: `${2 + bottomOffset}px`,
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {size === 'medium' && (
          <span className="absolute inset-0 flex items-center px-1 text-[9px] leading-none truncate pointer-events-none">
            {displayLabel}
          </span>
        )}
        {hovered && (
          <TripPopover
            destination={destination}
            tripType={tripType}
            notes={notes}
            startDate={startDate}
            endDate={endDate}
          />
        )}
      </button>
    )
  }

  // size === 'full' (month view)
  return (
    <button
      type="button"
      className={`absolute left-0 h-5 rounded-sm text-[11px] font-medium px-1.5 truncate cursor-pointer transition-colors ${colorClasses}${highlightClasses}`}
      style={{
        top: `${2.5 + stackIndex * 1.5}rem`,
        width: `${(colSpan / 7) * 100}%`,
        marginLeft: `${(startCol / 7) * 100}%`,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {displayLabel}
      {hovered && (
        <TripPopover
          destination={destination}
          tripType={tripType}
          notes={notes}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </button>
  )
}
