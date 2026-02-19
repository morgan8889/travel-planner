import { useState } from 'react'
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
  /** Display size: 'small' (thin bar, tooltip only), 'medium' (bar with inline label), 'full' (month view) */
  size?: 'small' | 'medium' | 'full'
  /** Full date range for tooltip display */
  startDate?: string
  endDate?: string
  colorBy?: 'status' | 'type'
  tripType?: TripType
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
}: TripSpanProps) {
  const [hovered, setHovered] = useState(false)
  const colorClasses = colorBy === 'type' && tripType
    ? (TYPE_COLORS[tripType] || TRIP_COLORS.planning)
    : (TRIP_COLORS[status] || TRIP_COLORS.planning)

  if (size === 'small' || size === 'medium') {
    const heightClass = size === 'small' ? 'h-1.5' : 'h-3'
    const bottomOffset = size === 'small' ? stackIndex * 4 : stackIndex * 5

    return (
      <button
        type="button"
        className={`absolute left-0 ${heightClass} rounded-full cursor-pointer transition-colors ${colorClasses}`}
        style={{
          width: `${(colSpan / 7) * 100}%`,
          marginLeft: `${(startCol / 7) * 100}%`,
          bottom: `${2 + bottomOffset}px`,
        }}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {size === 'medium' && (
          <span className="absolute inset-0 flex items-center px-0.5 text-[7px] leading-none truncate pointer-events-none">
            {destination}
          </span>
        )}
        {hovered && startDate && endDate && (
          <div className="absolute bottom-full left-0 mb-1 px-2 py-1.5 bg-cloud-900 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
            <div className="font-semibold">{destination}</div>
            <div className="opacity-80">{startDate} to {endDate}</div>
            <div className="opacity-60 capitalize">{status}{tripType ? ` · ${tripType.replace('_', ' ')}` : ''}</div>
          </div>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`absolute left-0 h-5 rounded-sm text-[11px] font-medium px-1.5 truncate cursor-pointer transition-colors ${colorClasses}`}
      style={{
        gridColumnStart: startCol + 1,
        gridColumnEnd: startCol + colSpan + 1,
        top: `${2.5 + stackIndex * 1.5}rem`,
        width: `${(colSpan / 7) * 100}%`,
        marginLeft: `${(startCol / 7) * 100}%`,
      }}
      onClick={onClick}
      title={destination}
    >
      {destination}
    </button>
  )
}
