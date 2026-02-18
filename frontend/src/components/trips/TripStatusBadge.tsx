import type { TripStatus } from '../../lib/types'

interface TripStatusBadgeProps {
  status: TripStatus
}

const statusConfig: Record<TripStatus, { label: string; classes: string; dotColor: string }> = {
  dreaming: {
    label: 'Dreaming',
    classes: 'bg-[#F0EDFF] text-[#6B5CB5] ring-1 ring-[#6B5CB5]/20',
    dotColor: 'bg-[#6B5CB5]',
  },
  planning: {
    label: 'Planning',
    classes: 'bg-[#FFF7ED] text-[#B8862D] ring-1 ring-[#B8862D]/20',
    dotColor: 'bg-[#B8862D]',
  },
  booked: {
    label: 'Booked',
    classes: 'bg-[#EEF2FF] text-[#4A6DB5] ring-1 ring-[#4A6DB5]/20',
    dotColor: 'bg-[#4A6DB5]',
  },
  active: {
    label: 'Active',
    classes: 'bg-[#F0FDF4] text-[#3D8A5E] ring-1 ring-[#3D8A5E]/20',
    dotColor: 'bg-[#3D8A5E]',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-[#F3F4F6] text-[#7A7F91] ring-1 ring-[#7A7F91]/20',
    dotColor: 'bg-[#7A7F91]',
  },
}

export function TripStatusBadge({ status }: TripStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
      data-testid="trip-status-badge"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  )
}
