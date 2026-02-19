import type { TripStatus } from '../../lib/types'

const TRIP_COLORS: Record<string, string> = {
  dreaming: 'bg-purple-200 text-purple-800 hover:bg-purple-300',
  planning: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
  booked: 'bg-green-200 text-green-800 hover:bg-green-300',
  active: 'bg-orange-200 text-orange-800 hover:bg-orange-300',
  completed: 'bg-cloud-200 text-cloud-600 hover:bg-cloud-300',
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
  /** Use compact (thin bar) variant for quarter/year views */
  compact?: boolean
  /** Show destination label text (compact mode only) */
  showLabel?: boolean
}

export function TripSpan({
  destination,
  status,
  startCol,
  colSpan,
  stackIndex,
  onClick,
  compact = false,
  showLabel = true,
}: TripSpanProps) {
  const colorClasses = TRIP_COLORS[status] || TRIP_COLORS.planning

  if (compact) {
    return (
      <button
        type="button"
        className={`absolute left-0 h-1.5 rounded-full cursor-pointer transition-colors ${colorClasses}`}
        style={{
          width: `${(colSpan / 7) * 100}%`,
          marginLeft: `${(startCol / 7) * 100}%`,
          bottom: `${2 + stackIndex * 4}px`,
        }}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        title={destination}
      >
        {showLabel && (
          <span className="absolute top-full left-0 text-[8px] leading-none truncate max-w-full pointer-events-none mt-px">
            {destination}
          </span>
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
