import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useCreateTrip } from '../hooks/useTrips'
import { TripForm } from '../components/trips/TripForm'
import type { TripCreate, TripUpdate } from '../lib/types'

export function NewTripPage() {
  const navigate = useNavigate()
  const createTrip = useCreateTrip()

  function handleSubmit(data: TripCreate | TripUpdate) {
    createTrip.mutate(data as TripCreate, {
      onSuccess: (trip) => {
        navigate({ to: '/trips/$tripId', params: { tripId: trip.id } })
      },
    })
  }

  function handleCancel() {
    navigate({ to: '/trips' })
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link to="/trips" className="text-stone-500 hover:text-blue-600 transition-colors">
          My Trips
        </Link>
        <ChevronRight className="w-4 h-4 text-stone-400" />
        <span className="text-stone-900 font-medium">New Trip</span>
      </nav>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-stone-900">Plan a New Trip</h1>
            <p className="mt-1 text-sm text-stone-500">
              Fill in the details below to start planning your next adventure.
            </p>
          </div>

          <TripForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createTrip.isPending}
            submitLabel="Create Trip"
          />

          {createTrip.isError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                Failed to create trip. Please try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
