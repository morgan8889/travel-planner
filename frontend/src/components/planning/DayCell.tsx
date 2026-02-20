import { memo } from 'react'

interface DayCellProps {
  date: string  // YYYY-MM-DD
  dayNumber: number
  isToday: boolean
  isCurrentMonth: boolean
  isSelected: boolean
  isSelectedForCreate?: boolean
  holidayLabel?: string
  customDayLabel?: string
  compact?: boolean  // true for quarter/year views
  showLabel?: boolean  // show label text in compact mode (quarter view)
  onMouseDown?: (date: string) => void
  onMouseEnter?: (date: string) => void
  onClick?: (date: string) => void
  onHolidayClick?: (date: string) => void
}

export const DayCell = memo(function DayCell({
  date,
  dayNumber,
  isToday,
  isCurrentMonth,
  isSelected,
  isSelectedForCreate = false,
  holidayLabel,
  customDayLabel,
  compact = false,
  showLabel = false,
  onMouseDown,
  onMouseEnter,
  onClick,
  onHolidayClick,
}: DayCellProps) {
  const label = holidayLabel || customDayLabel

  if (compact) {
    return (
      <div
        className={`w-full ${showLabel ? 'h-full min-h-[2.5rem]' : 'aspect-square'} border-b border-r border-cloud-100 flex flex-col items-start p-1 text-xs cursor-pointer
          ${isCurrentMonth ? 'text-cloud-700' : 'text-cloud-300'}
          ${isToday ? 'ring-2 ring-indigo-500 ring-inset font-bold' : ''}
          ${!isToday && isSelectedForCreate ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}
          ${isSelected ? 'bg-indigo-100' : ''}
          ${holidayLabel ? 'font-semibold text-red-600' : ''}
          ${customDayLabel ? 'font-semibold text-amber-600' : ''}
        `}
        onClick={() => {
          if (holidayLabel && onHolidayClick) {
            onHolidayClick(date)
          } else {
            onClick?.(date)
          }
        }}
        title={label}
      >
        {dayNumber}
        {showLabel && label && (
          <span className={`text-[10px] leading-tight truncate max-w-full ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
            {label}
          </span>
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
      <span
        className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full
          ${isToday ? 'bg-indigo-600 text-white font-bold' : ''}
          ${!isToday && isCurrentMonth ? 'text-cloud-800' : ''}
          ${!isToday && !isCurrentMonth ? 'text-cloud-400' : ''}
        `}
      >
        {dayNumber}
      </span>
      {label && (
        <p className={`text-[10px] leading-tight mt-0.5 truncate ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
          {label}
        </p>
      )}
    </div>
  )
})
