import { useState, type FormEvent } from 'react'
import { CircleCheck, Sun, Laptop, Compass, type LucideIcon } from 'lucide-react'
import type { TripCreate, TripStatus, TripType, TripUpdate, GeocodeSuggestion } from '../../lib/types'
import { useTrips } from '../../hooks/useTrips'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { LocationAutocomplete } from '../form/LocationAutocomplete'

interface TripFormProps {
  defaultValues?: Partial<TripCreate>
  onSubmit: (data: TripCreate | TripUpdate) => void
  onCancel: () => void
  isLoading?: boolean
  submitLabel?: string
}

const tripTypes: { value: TripType; label: string; description: string; Icon: LucideIcon }[] = [
  {
    value: 'vacation',
    label: 'Vacation',
    description: 'Time off to explore and relax',
    Icon: Sun,
  },
  {
    value: 'remote_week',
    label: 'Remote Week',
    description: 'Work remotely from a new location',
    Icon: Laptop,
  },
  {
    value: 'sabbatical',
    label: 'Sabbatical',
    description: 'Extended time for personal growth',
    Icon: Compass,
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
  const [destinationLat, setDestinationLat] = useState<number | null>(defaultValues?.destination_latitude ?? null)
  const [destinationLng, setDestinationLng] = useState<number | null>(defaultValues?.destination_longitude ?? null)
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
      destination_latitude: destinationLat,
      destination_longitude: destinationLng,
      parent_trip_id: showParentTrip ? parentTripId : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Trip Type Selector */}
      <div>
        <label className="block text-sm font-medium text-cloud-700 mb-3">
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
                  ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-500/20'
                  : 'border-cloud-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
              }`}
            >
              <option.Icon className={`w-8 h-8 ${type === option.value ? 'text-indigo-600' : 'text-cloud-400'}`} />
              <span className={`text-sm font-semibold ${type === option.value ? 'text-indigo-700' : 'text-cloud-900'}`}>
                {option.label}
              </span>
              <span className={`text-xs text-center ${type === option.value ? 'text-indigo-600' : 'text-cloud-500'}`}>
                {option.description}
              </span>
              {type === option.value && (
                <div className="absolute top-2 right-2">
                  <CircleCheck className="w-5 h-5 text-indigo-500" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Destination */}
      <div>
        <label htmlFor="destination" className="block text-sm font-medium text-cloud-700 mb-1.5">
          Destination
        </label>
        <LocationAutocomplete
          id="destination"
          value={destination}
          onChange={(val) => {
            setDestination(val)
            // Clear coords when user types freely (not from selection)
            setDestinationLat(null)
            setDestinationLng(null)
            if (errors.destination) setErrors((prev) => ({ ...prev, destination: '' }))
          }}
          onSelect={(s: GeocodeSuggestion) => {
            setDestinationLat(s.latitude)
            setDestinationLng(s.longitude)
            if (errors.destination) setErrors((prev) => ({ ...prev, destination: '' }))
          }}
          placeholder="Where are you going?"
          disabled={isLoading}
          className={errors.destination ? 'border-red-300 bg-red-50' : ''}
        />
        {errors.destination && (
          <p className="mt-1 text-sm text-red-600">{errors.destination}</p>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-cloud-700 mb-1.5">
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
            className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              errors.startDate ? 'border-red-300 bg-red-50' : 'border-cloud-300'
            }`}
          />
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
          )}
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-cloud-700 mb-1.5">
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
            className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              errors.endDate ? 'border-red-300 bg-red-50' : 'border-cloud-300'
            }`}
          />
          {errors.endDate && (
            <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
          )}
        </div>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-cloud-700 mb-1.5">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TripStatus)}
          className="w-full px-4 py-2.5 border border-cloud-300 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
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
          <label htmlFor="parent-trip" className="block text-sm font-medium text-cloud-700 mb-1.5">
            Part of Sabbatical
            <span className="text-cloud-400 font-normal ml-1">(optional)</span>
          </label>
          <select
            id="parent-trip"
            value={parentTripId ?? ''}
            onChange={(e) => setParentTripId(e.target.value || null)}
            className="w-full px-4 py-2.5 border border-cloud-300 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
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
        <label htmlFor="notes" className="block text-sm font-medium text-cloud-700 mb-1.5">
          Notes
          <span className="text-cloud-400 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any additional details about the trip..."
          className="w-full px-4 py-2.5 border border-cloud-300 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-5 py-2.5 text-sm font-medium text-cloud-700 bg-white border border-cloud-300 rounded-lg hover:bg-cloud-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
        >
          {isLoading && <LoadingSpinner size="sm" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
