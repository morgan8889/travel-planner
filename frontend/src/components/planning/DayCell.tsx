import { useState, memo } from 'react'

interface DayCellProps {
  date: string  // YYYY-MM-DD
  dayNumber: number
  isToday: boolean
  isCurrentMonth: boolean
  isSelected: boolean
  isSelectedForCreate?: boolean
  holidayLabel?: string
  customDayName?: string
  compact?: boolean  // true for quarter/year views
  showLabel?: boolean  // show label text in compact mode (quarter view)
  onMouseDown?: (date: string) => void
  onMouseEnter?: (date: string) => void
  onClick?: (date: string) => void
  onHolidayClick?: (date: string) => void
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function CustomDayPopover({ customDayName, date, align }: {
  customDayName: string
  date: string
  align: 'left' | 'right'
}) {
  return (
    <div className={`absolute bottom-full ${align === 'left' ? 'left-0' : 'right-0'} mb-1 px-2.5 py-2 bg-cloud-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none min-w-[100px]`}>
      <div className="font-semibold leading-tight">{customDayName}</div>
      <div className="opacity-70 mt-0.5">{formatShortDate(date)}</div>
    </div>
  )
}

export const DayCell = memo(function DayCell({
  date,
  dayNumber,
  isToday,
  isCurrentMonth,
  isSelected,
  isSelectedForCreate = false,
  holidayLabel,
  customDayName,
  compact = false,
  showLabel = false,
  onMouseDown,
  onMouseEnter,
  onClick,
  onHolidayClick,
}: DayCellProps) {
  const [showCustomPopover, setShowCustomPopover] = useState(false)
  const label = holidayLabel || customDayName

  if (compact) {
    return (
      <div
        className={`relative w-full ${showLabel ? 'h-full min-h-[2.5rem]' : 'aspect-square'} border-b border-r border-cloud-100 flex flex-col items-start p-1 text-xs cursor-pointer
          ${isCurrentMonth ? 'text-cloud-700' : 'text-cloud-300'}
          ${isToday ? 'ring-2 ring-indigo-500 ring-inset font-bold' : ''}
          ${!isToday && isSelectedForCreate ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}
          ${isSelected ? 'bg-indigo-100' : ''}
          ${holidayLabel ? 'font-semibold text-red-600' : ''}
        `}
        onClick={() => {
          if (holidayLabel && onHolidayClick) {
            onHolidayClick(date)
          } else {
            onClick?.(date)
          }
        }}
        title={holidayLabel}
        onMouseLeave={() => setShowCustomPopover(false)}
      >
        {dayNumber}
        {showLabel && label && (
          <span className={`text-[10px] leading-tight truncate max-w-full ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
            {label}
          </span>
        )}
        {customDayName && (
          <>
            <div
              className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 cursor-default"
              onMouseEnter={() => setShowCustomPopover(true)}
              onMouseLeave={() => setShowCustomPopover(false)}
            />
            {showCustomPopover && (
              <CustomDayPopover customDayName={customDayName} date={date} align="left" />
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className={`min-h-[5rem] p-1.5 border-b border-r border-cloud-100 cursor-pointer select-none transition-colors
        ${isCurrentMonth ? 'bg-white' : 'bg-cloud-50/50'}
        ${isSelected ? 'bg-indigo-50' : ''}
        ${isSelectedForCreate ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50' : ''}
        hover:bg-cloud-50
      `}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown?.(date)
      }}
      onMouseEnter={() => onMouseEnter?.(date)}
      onClick={() => {
        if (holidayLabel && onHolidayClick) {
          onHolidayClick(date)
        }
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full shrink-0
            ${isToday ? 'bg-indigo-600 text-white font-bold' : ''}
            ${!isToday && isCurrentMonth ? 'text-cloud-800' : ''}
            ${!isToday && !isCurrentMonth ? 'text-cloud-400' : ''}
          `}
        >
          {dayNumber}
        </span>
        {holidayLabel && (
          <span className="text-[10px] leading-tight mt-1 truncate max-w-[calc(100%-2rem)] text-right text-red-500">
            {holidayLabel}
          </span>
        )}
        {customDayName && !holidayLabel && (
          <div className="relative">
            <div
              className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1 cursor-default"
              onMouseEnter={() => setShowCustomPopover(true)}
              onMouseLeave={() => setShowCustomPopover(false)}
            />
            {showCustomPopover && (
              <CustomDayPopover customDayName={customDayName} date={date} align="right" />
            )}
          </div>
        )}
      </div>
    </div>
  )
})
