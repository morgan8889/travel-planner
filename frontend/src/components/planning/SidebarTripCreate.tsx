import { useState } from 'react'
import { useCreateTrip } from '../../hooks/useTrips'
import type { TripType } from '../../lib/types'

interface SidebarTripCreateProps {
  initialStartDate: string
  initialEndDate: string
  onCreated: () => void
}

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'remote_week', label: 'Remote Week' },
  { value: 'sabbatical', label: 'Sabbatical' },
]

export function SidebarTripCreate({ initialStartDate, initialEndDate, onCreated }: SidebarTripCreateProps) {
  const [destination, setDestination] = useState('')
  const [tripType, setTripType] = useState<TripType>('vacation')
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const createTrip = useCreateTrip()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return

    await createTrip.mutateAsync({
      destination: destination.trim(),
      type: tripType,
      start_date: startDate,
      end_date: endDate,
      status: 'planning',
      destination_latitude: null,
      destination_longitude: null,
    })
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-cloud-900">New Trip</h3>

      <div>
        <label htmlFor="destination" className="block text-sm font-medium text-cloud-700 mb-1">
          Destination
        </label>
        <input
          id="destination"
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. Paris, France"
          required
          className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white placeholder:text-cloud-400 text-cloud-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-cloud-700 mb-1">
            Start
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-cloud-700 mb-1">
            End
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            required
            className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
          />
        </div>
      </div>

      <div>
        <label htmlFor="trip-type" className="block text-sm font-medium text-cloud-700 mb-1">
          Trip Type
        </label>
        <select
          id="trip-type"
          value={tripType}
          onChange={(e) => setTripType(e.target.value as TripType)}
          className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
        >
          {TRIP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={createTrip.isPending || !destination.trim()}
        className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {createTrip.isPending ? 'Creating...' : 'Create Trip'}
      </button>
    </form>
  )
}
