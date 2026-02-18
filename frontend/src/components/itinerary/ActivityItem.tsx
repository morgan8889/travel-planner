import { useState } from 'react'
import { GripVertical, Pencil, Trash2, Plane, Utensils, MapPin, Hotel, type LucideIcon } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Activity, ActivityCategory } from '../../lib/types'
import { useDeleteActivity } from '../../hooks/useItinerary'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EditActivityModal } from './EditActivityModal'

interface ActivityItemProps {
  activity: Activity
  tripId: string
}

const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = {
  transport: Plane,
  food: Utensils,
  activity: MapPin,
  lodging: Hotel,
}

export function ActivityItem({ activity, tripId }: ActivityItemProps) {
  const deleteActivity = useDeleteActivity(tripId)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleDelete = () => {
    deleteActivity.mutate({
      activityId: activity.id,
      dayId: activity.itinerary_day_id,
    })
    setIsConfirmOpen(false)
  }

  const timeRange = activity.start_time && activity.end_time
    ? `${activity.start_time} - ${activity.end_time}`
    : activity.start_time
      ? `${activity.start_time}`
      : null

  const CategoryIcon = CATEGORY_ICONS[activity.category]

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
      >
        <button
          className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-shrink-0 mt-0.5 text-gray-400">
          <CategoryIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-gray-900 break-words">{activity.title}</h4>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditOpen(true)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                aria-label="Edit activity"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsConfirmOpen(true)}
                disabled={deleteActivity.isPending}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                aria-label="Delete activity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {timeRange && (
            <p className="text-sm text-gray-600 mt-1">{timeRange}</p>
          )}
          {activity.location && (
            <p className="text-sm text-gray-600 mt-1">{activity.location}</p>
          )}
          {activity.notes && (
            <p className="text-sm text-gray-500 mt-1">{activity.notes}</p>
          )}
          {activity.confirmation_number && (
            <p className="text-xs text-gray-400 mt-1">
              Confirmation: {activity.confirmation_number}
            </p>
          )}
          {deleteActivity.isError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-600">
                {deleteActivity.error instanceof Error
                  ? deleteActivity.error.message
                  : 'Failed to delete activity'}
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Activity"
        message={`Are you sure you want to delete "${activity.title}"?`}
        confirmLabel="Delete"
        isLoading={deleteActivity.isPending}
      />

      <EditActivityModal
        key={activity.id}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        activity={activity}
        tripId={tripId}
      />
    </>
  )
}
