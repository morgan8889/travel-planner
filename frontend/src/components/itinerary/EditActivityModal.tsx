import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useUpdateActivity } from '../../hooks/useItinerary'
import type { Activity, ActivityCategory } from '../../lib/types'

interface EditActivityModalProps {
  isOpen: boolean
  onClose: () => void
  activity: Activity
  tripId: string
}

export function EditActivityModal({ isOpen, onClose, activity, tripId }: EditActivityModalProps) {
  const updateActivity = useUpdateActivity(tripId)
  const [formData, setFormData] = useState({
    title: activity.title,
    category: activity.category as ActivityCategory,
    start_time: activity.start_time ?? '',
    end_time: activity.end_time ?? '',
    location: activity.location ?? '',
    notes: activity.notes ?? '',
    confirmation_number: activity.confirmation_number ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await updateActivity.mutateAsync({
        activityId: activity.id,
        dayId: activity.itinerary_day_id,
        data: {
          title: formData.title,
          category: formData.category,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          location: formData.location || null,
          notes: formData.notes || null,
          confirmation_number: formData.confirmation_number || null,
        },
      })
      onClose()
    } catch {
      // Error displayed via mutation state
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="edit-title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            disabled={updateActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            id="edit-category"
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ActivityCategory })}
            disabled={updateActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="activity">🎯 Activity</option>
            <option value="transport">✈️ Transport</option>
            <option value="food">🍽️ Food</option>
            <option value="lodging">🏨 Lodging</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-start_time" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              id="edit-start_time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              disabled={updateActivity.isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="edit-end_time" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              id="edit-end_time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              disabled={updateActivity.isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            id="edit-location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            disabled={updateActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="edit-notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            disabled={updateActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="edit-confirmation_number" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmation Number
          </label>
          <input
            type="text"
            id="edit-confirmation_number"
            value={formData.confirmation_number}
            onChange={(e) => setFormData({ ...formData, confirmation_number: e.target.value })}
            disabled={updateActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {updateActivity.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              {updateActivity.error instanceof Error
                ? updateActivity.error.message
                : 'Failed to update activity'}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateActivity.isPending}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateActivity.isPending}
            className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateActivity.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
