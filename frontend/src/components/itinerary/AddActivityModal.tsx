import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useCreateActivity } from '../../hooks/useItinerary'
import type { ActivityCategory } from '../../lib/types'
import { CategorySelector } from './CategorySelector'
import { LocationAutocomplete } from '../form/LocationAutocomplete'

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
    latitude: null as number | null,
    longitude: null as number | null,
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
      latitude: null,
      longitude: null,
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

    try {
      await createActivity.mutateAsync({
        title: formData.title,
        category: formData.category,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        location: formData.location || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        notes: formData.notes || null,
        confirmation_number: formData.confirmation_number || null,
      })

      // Reset form and close only on success
      resetForm()
      onClose()
    } catch {
      // Error is automatically captured by mutation state and displayed
      // Keep modal open to show error message
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-cloud-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            disabled={createActivity.isPending}
            className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-cloud-700 mb-1">Category *</span>
          <CategorySelector
            value={formData.category}
            onChange={(cat) => setFormData({ ...formData, category: cat })}
            disabled={createActivity.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start_time" className="block text-sm font-medium text-cloud-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              id="start_time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              disabled={createActivity.isPending}
              className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="end_time" className="block text-sm font-medium text-cloud-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              id="end_time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              disabled={createActivity.isPending}
              className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-cloud-700 mb-1">
            Location
          </label>
          <LocationAutocomplete
            id="location"
            value={formData.location}
            onChange={(val) => setFormData({ ...formData, location: val, latitude: null, longitude: null })}
            onSelect={(s) => setFormData({ ...formData, location: s.place_name, latitude: s.latitude, longitude: s.longitude })}
            placeholder="Search for a location…"
            disabled={createActivity.isPending}
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-cloud-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            disabled={createActivity.isPending}
            className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="confirmation_number" className="block text-sm font-medium text-cloud-700 mb-1">
            Confirmation Number
          </label>
          <input
            type="text"
            id="confirmation_number"
            value={formData.confirmation_number}
            onChange={(e) => setFormData({ ...formData, confirmation_number: e.target.value })}
            disabled={createActivity.isPending}
            className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
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
            className="flex-1 px-4 py-2 text-cloud-700 bg-cloud-100 rounded-lg hover:bg-cloud-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createActivity.isPending}
            className="flex-1 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createActivity.isPending ? 'Adding...' : 'Add Activity'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
