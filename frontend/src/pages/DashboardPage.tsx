import { Suspense, lazy } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Calendar, ArrowRight } from 'lucide-react'
import { useTrips } from '../hooks/useTrips'
import { useAuth } from '../contexts/AuthContext'
import { TripStatusBadge } from '../components/trips/TripStatusBadge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

const MapView = lazy(() => import('../components/map/MapView').then((m) => ({ default: m.MapView })))
const TripMarker = lazy(() =>
  import('../components/map/TripMarker').then((m) => ({ default: m.TripMarker }))
)

function getDisplayName(email: string | undefined): string {
  if (!email) return 'there'
  return email.split('@')[0]
}

function UpcomingTripCard({ trip }: { trip: { id: string; destination: string; start_date: string; end_date: string; status: import('../lib/types').TripStatus } }) {
  const start = new Date(trip.start_date + 'T00:00:00')
  const daysUntil = Math.ceil((start.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  const daysText = daysUntil > 1 ? `in ${daysUntil} days` : daysUntil === 1 ? 'tomorrow' : daysUntil === 0 ? 'today' : `${Math.abs(daysUntil)} days ago`

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      className="flex items-center justify-between p-4 bg-white rounded-xl border border-cloud-200 hover:border-indigo-200 hover:shadow-sm transition-all group"
    >
      <div>
        <p className="font-semibold text-cloud-800 group-hover:text-indigo-700 transition-colors">
          {trip.destination}
        </p>
        <p className="text-sm text-cloud-500 mt-0.5">{trip.start_date} · {daysText}</p>
      </div>
      <div className="flex items-center gap-3">
        <TripStatusBadge status={trip.status} />
        <ArrowRight className="w-4 h-4 text-cloud-400 group-hover:text-indigo-500 transition-colors" />
      </div>
    </Link>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: trips, isLoading } = useTrips()

  const displayName = getDisplayName(user?.email)

  const upcomingTrips = trips
    ?.filter((t) => t.status !== 'completed')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3) ?? []

  const tripsWithCoords = trips?.filter(
    (t) => t.destination_latitude !== null && t.destination_longitude !== null
  ) ?? []

  // Compute bounds for fitBounds from all trip pins
  const fitBounds: [[number, number], [number, number]] | undefined =
    tripsWithCoords.length >= 2
      ? [
          [
            Math.min(...tripsWithCoords.map((t) => t.destination_longitude!)) - 5,
            Math.min(...tripsWithCoords.map((t) => t.destination_latitude!)) - 5,
          ],
          [
            Math.max(...tripsWithCoords.map((t) => t.destination_longitude!)) + 5,
            Math.max(...tripsWithCoords.map((t) => t.destination_latitude!)) + 5,
          ],
        ]
      : undefined

  const singleCenter =
    tripsWithCoords.length === 1
      ? ([tripsWithCoords[0].destination_longitude!, tripsWithCoords[0].destination_latitude!] as [number, number])
      : undefined

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-cloud-900">
          Welcome back, {displayName}
        </h1>
        <p className="text-cloud-500 mt-1">Here's what's coming up.</p>
      </div>

      {/* World Map */}
      <div className="bg-white rounded-2xl border border-cloud-200 shadow-sm overflow-hidden">
        <div className="h-72 md:h-96">
          <Suspense fallback={<div className="h-full bg-cloud-100 animate-pulse" />}>
            <MapView
              center={singleCenter}
              zoom={singleCenter ? 8 : 1.5}
              fitBounds={fitBounds}
              interactive
              className="h-full"
            >
              {tripsWithCoords.map((trip) => (
                <TripMarker
                  key={trip.id}
                  tripId={trip.id}
                  longitude={trip.destination_longitude!}
                  latitude={trip.destination_latitude!}
                  destination={trip.destination}
                  status={trip.status}
                />
              ))}
            </MapView>
          </Suspense>
        </div>
        {tripsWithCoords.length === 0 && (
          <div className="px-6 py-3 border-t border-cloud-100 text-sm text-cloud-500">
            Create trips with locations to see them on the map.
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Trips */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-cloud-900">Upcoming Trips</h2>
            <Link to="/trips" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
              View all
            </Link>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : upcomingTrips.length > 0 ? (
            <div className="space-y-3">
              {upcomingTrips.map((trip) => (
                <UpcomingTripCard key={trip.id} trip={trip} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-cloud-200 p-8 text-center">
              <p className="text-cloud-500 text-sm mb-3">No upcoming trips yet.</p>
              <Link
                to="/trips/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Plan a Trip
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-cloud-900 mb-3">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/trips/new"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cloud-200 hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <Plus className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-cloud-800 group-hover:text-indigo-700 transition-colors">New Trip</p>
                <p className="text-sm text-cloud-500">Start planning your next adventure</p>
              </div>
            </Link>
            <Link
              to="/calendar"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-cloud-200 hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-cloud-800 group-hover:text-indigo-700 transition-colors">View Calendar</p>
                <p className="text-sm text-cloud-500">Manage PTO blocks and holidays</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
