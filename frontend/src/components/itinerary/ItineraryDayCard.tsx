import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import type { ItineraryDay } from '../../lib/types'
import { useActivities } from '../../hooks/useItinerary'
import { ActivityItem } from './ActivityItem'
import { AddActivityModal } from './AddActivityModal'

interface ItineraryDayCardProps {
  day: ItineraryDay
  tripId: string
}

export function ItineraryDayCard({ day, tripId }: ItineraryDayCardProps) {
  const { data: activities, isLoading } = useActivities(day.id)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const formattedDate = new Date(day.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{formattedDate}</h3>
          {day.notes && (
            <p className="text-sm text-gray-600 mt-1">{day.notes}</p>
          )}
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500 text-center py-8">Loading activities...</div>
      ) : activities && activities.length > 0 ? (
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} tripId={tripId} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 text-center py-8">
          No activities yet. Click "Add Activity" to get started.
        </div>
      )}

      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        dayId={day.id}
        tripId={tripId}
      />
    </div>
  )
}
