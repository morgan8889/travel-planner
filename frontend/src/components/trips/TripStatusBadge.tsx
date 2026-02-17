import type { TripStatus } from '../../lib/types'

interface TripStatusBadgeProps {
  status: TripStatus
}

const statusConfig: Record<TripStatus, { label: string; classes: string }> = {
  dreaming: {
    label: 'Dreaming',
    classes: 'bg-purple-100 text-purple-700',
  },
  planning: {
    label: 'Planning',
    classes: 'bg-amber-100 text-amber-700',
  },
  booked: {
    label: 'Booked',
    classes: 'bg-blue-100 text-blue-700',
  },
  active: {
    label: 'Active',
    classes: 'bg-green-100 text-green-700',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-gray-100 text-gray-600',
  },
}

export function TripStatusBadge({ status }: TripStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
      data-testid="trip-status-badge"
    >
      {config.label}
    </span>
  )
}
