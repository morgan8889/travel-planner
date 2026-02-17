import { Sun, Laptop, Compass, type LucideIcon } from 'lucide-react'
import type { TripType } from '../../lib/types'

interface TripTypeBadgeProps {
  type: TripType
}

const typeConfig: Record<TripType, { label: string; Icon: LucideIcon; classes: string }> = {
  vacation: {
    label: 'Vacation',
    Icon: Sun,
    classes: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  },
  remote_week: {
    label: 'Remote Week',
    Icon: Laptop,
    classes: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  },
  sabbatical: {
    label: 'Sabbatical',
    Icon: Compass,
    classes: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  },
}

export function TripTypeBadge({ type }: TripTypeBadgeProps) {
  const config = typeConfig[type]
  const { Icon } = config

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
      data-testid="trip-type-badge"
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}
