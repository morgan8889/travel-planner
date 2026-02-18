import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ItineraryDay } from '../../lib/types'
import { useActivities, useReorderActivities } from '../../hooks/useItinerary'
import { ActivityItem } from './ActivityItem'
import { AddActivityModal } from './AddActivityModal'

interface ItineraryDayCardProps {
  day: ItineraryDay
  tripId: string
}

export function ItineraryDayCard({ day, tripId }: ItineraryDayCardProps) {
  const { data: activities, isLoading, isError, error } = useActivities(day.id)
  const reorderActivities = useReorderActivities(day.id)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !activities) return

    const oldIndex = activities.findIndex((a) => a.id === active.id)
    const newIndex = activities.findIndex((a) => a.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...activities]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    reorderActivities.mutate(reordered.map((a) => a.id))
  }

  const formattedDate = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
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
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load activities'}
          </p>
        </div>
      ) : activities && activities.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={activities.map(a => a.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} tripId={tripId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
