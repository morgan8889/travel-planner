import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useCreateActivity } from '../../hooks/useItinerary'
import type { ActivityCategory } from '../../lib/types'

interface AddActivityModalProps {
  isOpen: boolean
  onClose: () => void
  dayId: string
  tripId: string
}

export function AddActivityModal({ isOpen, onClose, dayId, tripId }: AddActivityModalProps) {
  const createActivity = useCreateActivity(dayId, tripId)
  const [formData, setFormData] = useState({
    title: '',
    category: 'activity' as ActivityCategory,
    start_time: '',
    end_time: '',
    location: '',
    notes: '',
    confirmation_number: '',
  })

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'activity',
      start_time: '',
      end_time: '',
      location: '',
      notes: '',
      confirmation_number: '',
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await createActivity.mutateAsync({
      title: formData.title,
      category: formData.category,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      location: formData.location || null,
      notes: formData.notes || null,
      confirmation_number: formData.confirmation_number || null,
    })

    // Reset form and close
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            disabled={createActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            id="category"
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ActivityCategory })}
            disabled={createActivity.isPending}
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
            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              id="start_time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              disabled={createActivity.isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              id="end_time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              disabled={createActivity.isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            disabled={createActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            disabled={createActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="confirmation_number" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmation Number
          </label>
          <input
            type="text"
            id="confirmation_number"
            value={formData.confirmation_number}
            onChange={(e) => setFormData({ ...formData, confirmation_number: e.target.value })}
            disabled={createActivity.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {createActivity.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              {createActivity.error instanceof Error
                ? createActivity.error.message
                : 'Failed to add activity'}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={createActivity.isPending}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createActivity.isPending}
            className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createActivity.isPending ? 'Adding...' : 'Add Activity'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
