import type { TripStatus } from '../../lib/types'
import { ArrowRight } from 'lucide-react'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface StatusTransitionButtonProps {
  currentStatus: TripStatus
  onTransition: (newStatus: TripStatus) => void
  isLoading?: boolean
}

const transitionConfig: Record<string, { label: string; nextStatus: TripStatus; classes: string } | null> = {
  dreaming: {
    label: 'Start Planning',
    nextStatus: 'planning',
    classes: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  planning: {
    label: 'Mark as Booked',
    nextStatus: 'booked',
    classes: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  booked: {
    label: 'Start Trip',
    nextStatus: 'active',
    classes: 'bg-green-500 hover:bg-green-600 text-white',
  },
  active: {
    label: 'Complete Trip',
    nextStatus: 'completed',
    classes: 'bg-stone-500 hover:bg-stone-600 text-white',
  },
  completed: null,
}

export function StatusTransitionButton({
  currentStatus,
  onTransition,
  isLoading = false,
}: StatusTransitionButtonProps) {
  const config = transitionConfig[currentStatus]
  if (!config) return null

  return (
    <button
      onClick={() => onTransition(config.nextStatus)}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${config.classes}`}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      <ArrowRight className="w-4 h-4" />
      {config.label}
    </button>
  )
}
