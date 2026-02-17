import type { TripStatus } from '../../lib/types'

interface TripStatusBadgeProps {
  status: TripStatus
}

const statusConfig: Record<TripStatus, { label: string; classes: string; dotColor: string }> = {
  dreaming: {
    label: 'Dreaming',
    classes: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
    dotColor: 'bg-purple-500',
  },
  planning: {
    label: 'Planning',
    classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dotColor: 'bg-amber-500',
  },
  booked: {
    label: 'Booked',
    classes: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    dotColor: 'bg-blue-500',
  },
  active: {
    label: 'Active',
    classes: 'bg-green-50 text-green-700 ring-1 ring-green-200',
    dotColor: 'bg-green-500',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
    dotColor: 'bg-gray-400',
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
