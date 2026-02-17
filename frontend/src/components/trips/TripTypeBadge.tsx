import type { TripType } from '../../lib/types'

interface TripTypeBadgeProps {
  type: TripType
}

const typeConfig: Record<TripType, { label: string; icon: string; classes: string }> = {
  vacation: {
    label: 'Vacation',
    icon: '☀️',
    classes: 'bg-orange-50 text-orange-700',
  },
  remote_week: {
    label: 'Remote Week',
    icon: '💻',
    classes: 'bg-cyan-50 text-cyan-700',
  },
  sabbatical: {
    label: 'Sabbatical',
    icon: '🧭',
    classes: 'bg-indigo-50 text-indigo-700',
  },
}

export function TripTypeBadge({ type }: TripTypeBadgeProps) {
  const config = typeConfig[type]

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
      data-testid="trip-type-badge"
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  )
}
