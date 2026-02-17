import type { TripStatus } from '../../lib/types'
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
    classes: 'bg-gray-500 hover:bg-gray-600 text-white',
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
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 ${config.classes}`}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      {config.label}
    </button>
  )
}
