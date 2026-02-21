import { useState } from 'react'
import type { Activity, ActivityCategory, GeocodeSuggestion } from '../../lib/types'
import { CategorySelector } from './CategorySelector'
import { LocationAutocomplete } from '../form/LocationAutocomplete'

interface ActivityFormProps {
  activity?: Activity
  dayId: string
  tripId: string
  onSave: (data: ActivityFormData) => Promise<void>
  onCancel: () => void
  isPending: boolean
  error: Error | null
}

export interface ActivityFormData {
  title: string
  category: ActivityCategory
  start_time: string | null
  end_time: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  confirmation_number: string | null
  check_out_date: string | null
}

export function ActivityForm({ activity, onSave, onCancel, isPending, error }: ActivityFormProps) {
  const isEditing = Boolean(activity)

  const [title, setTitle] = useState(activity?.title ?? '')
  const [category, setCategory] = useState<ActivityCategory>(activity?.category ?? 'activity')
  const [startTime, setStartTime] = useState(activity?.start_time ?? '')
  const [endTime, setEndTime] = useState(activity?.end_time ?? '')
  const [location, setLocation] = useState(activity?.location ?? '')
  const [latitude, setLatitude] = useState<number | null>(activity?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(activity?.longitude ?? null)
  const [notes, setNotes] = useState(activity?.notes ?? '')
  const [confirmationNumber, setConfirmationNumber] = useState(activity?.confirmation_number ?? '')
  const [checkOutDate, setCheckOutDate] = useState(activity?.check_out_date ?? '')
  const [locationDirty, setLocationDirty] = useState(false)

  function handleCategoryChange(value: ActivityCategory): void {
    setCategory(value)
    if (value !== 'lodging') {
      setCheckOutDate('')
    }
  }

  function handleLocationChange(value: string): void {
    setLocation(value)
    setLatitude(null)
    setLongitude(null)
    setLocationDirty(true)
  }

  function handleLocationSelect(suggestion: GeocodeSuggestion): void {
    setLocation(suggestion.place_name)
    setLatitude(suggestion.latitude)
    setLongitude(suggestion.longitude)
    setLocationDirty(true)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()

    const resolvedLatitude = locationDirty ? latitude : (activity?.latitude ?? null)
    const resolvedLongitude = locationDirty ? longitude : (activity?.longitude ?? null)

    await onSave({
      title,
      category,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location || null,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      notes: notes || null,
      confirmation_number: confirmationNumber || null,
      check_out_date: checkOutDate || null,
    })
  }

  const fieldId = isEditing ? 'edit' : 'add'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={`${fieldId}-title`} className="block text-sm font-medium text-cloud-700 mb-1">
          Title *
        </label>
        <input
          type="text"
          id={`${fieldId}-title`}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-cloud-700 mb-1">Category *</span>
        <CategorySelector
          value={category}
          onChange={handleCategoryChange}
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${fieldId}-start_time`} className="block text-sm font-medium text-cloud-700 mb-1">
            Start Time
          </label>
          <input
            type="time"
            id={`${fieldId}-start_time`}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-end_time`} className="block text-sm font-medium text-cloud-700 mb-1">
            End Time
          </label>
          <input
            type="time"
            id={`${fieldId}-end_time`}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
        </div>
      </div>

      {category === 'lodging' && (
        <div>
          <label htmlFor={`${fieldId}-check_out_date`} className="block text-sm font-medium text-cloud-700 mb-1">
            Check-out Date
          </label>
          <input
            type="date"
            id={`${fieldId}-check_out_date`}
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
        </div>
      )}

      <div>
        <label htmlFor={`${fieldId}-location`} className="block text-sm font-medium text-cloud-700 mb-1">
          Location
        </label>
        <LocationAutocomplete
          id={`${fieldId}-location`}
          value={location}
          onChange={handleLocationChange}
          onSelect={handleLocationSelect}
          placeholder="Search for a location..."
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor={`${fieldId}-notes`} className="block text-sm font-medium text-cloud-700 mb-1">
          Notes
        </label>
        <textarea
          id={`${fieldId}-notes`}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor={`${fieldId}-confirmation_number`} className="block text-sm font-medium text-cloud-700 mb-1">
          Confirmation Number
        </label>
        <input
          type="text"
          id={`${fieldId}-confirmation_number`}
          value={confirmationNumber}
          onChange={(e) => setConfirmationNumber(e.target.value)}
          disabled={isPending}
          className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error.message}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 px-4 py-2 text-cloud-700 bg-cloud-100 rounded-lg hover:bg-cloud-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? (isEditing ? 'Saving...' : 'Adding...')
            : (isEditing ? 'Save Changes' : 'Add Activity')}
        </button>
      </div>
    </form>
  )
}
