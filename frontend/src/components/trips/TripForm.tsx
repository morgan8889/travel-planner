import { useState, type FormEvent } from 'react'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import type { TripCreate, TripStatus, TripType, TripUpdate } from '../../lib/types'
import { useTrips } from '../../hooks/useTrips'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface TripFormProps {
  defaultValues?: Partial<TripCreate>
  onSubmit: (data: TripCreate | TripUpdate) => void
  onCancel: () => void
  isLoading?: boolean
  submitLabel?: string
}

const tripTypes: { value: TripType; label: string; description: string; icon: string }[] = [
  {
    value: 'vacation',
    label: 'Vacation',
    description: 'Time off to explore and relax',
    icon: '☀️',
  },
  {
    value: 'remote_week',
    label: 'Remote Week',
    description: 'Work remotely from a new location',
    icon: '💻',
  },
  {
    value: 'sabbatical',
    label: 'Sabbatical',
    description: 'Extended time for personal growth',
    icon: '🧭',
  },
]

const statusOptions: { value: TripStatus; label: string }[] = [
  { value: 'dreaming', label: 'Dreaming' },
  { value: 'planning', label: 'Planning' },
  { value: 'booked', label: 'Booked' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export function TripForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Create Trip',
}: TripFormProps) {
  const [type, setType] = useState<TripType>(defaultValues?.type ?? 'vacation')
  const [destination, setDestination] = useState(defaultValues?.destination ?? '')
  const [startDate, setStartDate] = useState(defaultValues?.start_date ?? '')
  const [endDate, setEndDate] = useState(defaultValues?.end_date ?? '')
  const [status, setStatus] = useState<TripStatus>(defaultValues?.status ?? 'dreaming')
  const [notes, setNotes] = useState(defaultValues?.notes ?? '')
  const [parentTripId, setParentTripId] = useState<string | null>(defaultValues?.parent_trip_id ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: allTrips } = useTrips()
  const sabbaticals = allTrips?.filter((t) => t.type === 'sabbatical') ?? []
  const showParentTrip = type === 'vacation' && sabbaticals.length > 0

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!destination.trim()) {
      newErrors.destination = 'Destination is required'
    }
    if (!startDate) {
      newErrors.startDate = 'Start date is required'
    }
    if (!endDate) {
      newErrors.endDate = 'End date is required'
    }
    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = 'End date must be on or after start date'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      type,
      destination: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      status,
      notes: notes.trim() || null,
      parent_trip_id: showParentTrip ? parentTripId : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Trip Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Trip Type
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tripTypes.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                type === option.value
                  ? 'border-blue-500 bg-blue-50 shadow-md ring-1 ring-blue-500/20'
                  : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'
              }`}
            >
              <span className="text-3xl">{option.icon}</span>
              <span className={`text-sm font-semibold ${type === option.value ? 'text-blue-700' : 'text-gray-900'}`}>
                {option.label}
              </span>
              <span className={`text-xs text-center ${type === option.value ? 'text-blue-600' : 'text-gray-500'}`}>
                {option.description}
              </span>
              {type === option.value && (
                <div className="absolute top-2 right-2">
                  <CheckCircleIcon className="w-5 h-5 text-blue-500" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Destination */}
      <div>
        <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1.5">
          Destination
        </label>
        <input
          id="destination"
          type="text"
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value)
            if (errors.destination) setErrors((prev) => ({ ...prev, destination: '' }))
          }}
          placeholder="Where are you going?"
          className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.destination ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
        />
        {errors.destination && (
          <p className="mt-1 text-sm text-red-600">{errors.destination}</p>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: '' }))
              if (errors.endDate && e.target.value <= endDate) {
                setErrors((prev) => ({ ...prev, endDate: '' }))
              }
            }}
            className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.startDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
          />
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
          )}
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1.5">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: '' }))
            }}
            className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.endDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
          />
          {errors.endDate && (
            <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
          )}
        </div>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1.5">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TripStatus)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Parent Trip */}
      {showParentTrip && (
        <div>
          <label htmlFor="parent-trip" className="block text-sm font-medium text-gray-700 mb-1.5">
            Part of Sabbatical
            <span className="text-gray-400 font-normal ml-1">(optional)</span>
          </label>
          <select
            id="parent-trip"
            value={parentTripId ?? ''}
            onChange={(e) => setParentTripId(e.target.value || null)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">None</option>
            {sabbaticals.map((s) => (
              <option key={s.id} value={s.id}>
                {s.destination} ({s.start_date} - {s.end_date})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
          Notes
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any additional details about the trip..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
        >
          {isLoading && <LoadingSpinner size="sm" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
