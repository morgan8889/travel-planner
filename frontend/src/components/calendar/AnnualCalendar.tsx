import type { CalendarBlock, TripSummaryForCalendar } from '../../lib/types'
import { MonthGrid } from './MonthGrid'
import { Trash2 } from 'lucide-react'

interface AnnualCalendarProps {
  year: number
  blocks: CalendarBlock[]
  trips: TripSummaryForCalendar[]
  onDeleteBlock?: (blockId: string) => void
  onDateSelect?: (start: string, end: string) => void
}

type EventType = 'pto' | 'holiday' | 'vacation' | 'remote_week' | 'sabbatical'

function getEventColor(type: EventType): string {
  switch (type) {
    case 'pto': return 'bg-amber-400'
    case 'holiday': return 'bg-red-400'
    case 'vacation': return 'bg-blue-400'
    case 'remote_week': return 'bg-emerald-400'
    case 'sabbatical': return 'bg-purple-400'
    default: return 'bg-blue-400'
  }
}

function getEventLabel(type: string): string {
  switch (type) {
    case 'pto': return 'PTO'
    case 'holiday': return 'Holiday'
    case 'vacation': return 'Vacation'
    case 'remote_week': return 'Remote Week'
    case 'sabbatical': return 'Sabbatical'
    default: return type
  }
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AnnualCalendar({ year, blocks, trips, onDeleteBlock, onDateSelect }: AnnualCalendarProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, month) => (
          <MonthGrid
            key={month}
            year={year}
            month={month}
            blocks={blocks}
            trips={trips}
            onDeleteBlock={onDeleteBlock}
            onDateSelect={onDateSelect}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {blocks.length > 0 && (
          <div className="bg-white rounded-xl border border-cloud-200 p-5">
            <h3 className="text-sm font-semibold text-cloud-700 mb-3">PTO & Holidays</h3>
            <div className="space-y-2">
              {blocks.map(block => (
                <div key={block.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getEventColor(block.type as EventType)}`} />
                    <span className="text-sm text-cloud-700 truncate">
                      {block.destination || getEventLabel(block.type)}
                    </span>
                    <span className="text-xs text-cloud-400 shrink-0">
                      {formatDateShort(block.start_date)} — {formatDateShort(block.end_date)}
                    </span>
                  </div>
                  {onDeleteBlock && (
                    <button
                      onClick={() => onDeleteBlock(block.id)}
                      className="p-1 text-cloud-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Delete block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {trips.length > 0 && (
          <div className="bg-white rounded-xl border border-cloud-200 p-5">
            <h3 className="text-sm font-semibold text-cloud-700 mb-3">Trips</h3>
            <div className="space-y-2">
              {trips.map(trip => (
                <div key={trip.id} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getEventColor(trip.type as EventType)}`} />
                  <span className="text-sm text-cloud-700 truncate">{trip.destination}</span>
                  <span className="text-xs text-cloud-400 shrink-0">
                    {formatDateShort(trip.start_date)} — {formatDateShort(trip.end_date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-cloud-200 p-5">
          <h3 className="text-sm font-semibold text-cloud-700 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { type: 'vacation', label: 'Vacation' },
              { type: 'remote_week', label: 'Remote Week' },
              { type: 'sabbatical', label: 'Sabbatical' },
              { type: 'pto', label: 'PTO' },
              { type: 'holiday', label: 'Holiday' },
            ].map(({ type, label }) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${getEventColor(type as EventType)}`} />
                <span className="text-xs text-cloud-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
