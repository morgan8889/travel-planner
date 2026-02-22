import { Suspense, lazy } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, Calendar, ArrowRight, CheckCircle2, Plane, Hotel } from 'lucide-react'
import { useTrips } from '../hooks/useTrips'
import { useAuth } from '../contexts/AuthContext'
import { TripStatusBadge } from '../components/trips/TripStatusBadge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { TripMarker } from '../components/map/TripMarker'
import type { TripSummary } from '../lib/types'

const MapView = lazy(() => import('../components/map/MapView').then((m) => ({ default: m.MapView })))

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

const STATUS_ORDER: Record<string, number> = { active: 0, booked: 1, planning: 2 }

type ActionItem = {
  tripId: string
  destination: string
  icon: React.ElementType
  label: string
}

function getActionItems(trips: TripSummary[]): ActionItem[] {
  const actionable = trips.filter((t) =>
    ['planning', 'booked', 'active'].includes(t.status)
  )
  actionable.sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    return a.start_date.localeCompare(b.start_date)
  })

  const items: ActionItem[] = []
  for (const trip of actionable) {
    const unconfirmedFlights = (trip.transport_total ?? 0) - (trip.transport_confirmed ?? 0)
    if (unconfirmedFlights > 0) {
      items.push({
        tripId: trip.id,
        destination: trip.destination,
        icon: Plane,
        label: `${unconfirmedFlights} flight${unconfirmedFlights > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unconfirmedHotels = (trip.lodging_total ?? 0) - (trip.lodging_confirmed ?? 0)
    if (unconfirmedHotels > 0) {
      items.push({
        tripId: trip.id,
        destination: trip.destination,
        icon: Hotel,
        label: `${unconfirmedHotels} hotel${unconfirmedHotels > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unplannedDays = (trip.itinerary_day_count ?? 0) - (trip.days_with_activities ?? 0)
    if (unplannedDays > 0) {
      items.push({
        tripId: trip.id,
        destination: trip.destination,
        icon: Calendar,
        label: `${unplannedDays} day${unplannedDays > 1 ? 's' : ''} not planned`,
      })
    }
    if (items.length >= 5) break
  }
  return items.slice(0, 5)
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: trips, isLoading } = useTrips()
  const navigate = useNavigate()

  const displayName = getDisplayName(user?.email)

  const upcomingTrips = trips
    ?.filter((t) => t.status !== 'completed')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3) ?? []

  const tripsWithCoords = trips?.filter(
    (t) => t.destination_latitude !== null && t.destination_longitude !== null
  ) ?? []

  // Compute bounds for fitBounds from all trip pins (clamped to valid lat/lng ranges)
  const fitBounds: [[number, number], [number, number]] | undefined =
    tripsWithCoords.length >= 2
      ? [
          [
            Math.max(-180, Math.min(...tripsWithCoords.map((t) => t.destination_longitude!)) - 5),
            Math.max(-90, Math.min(...tripsWithCoords.map((t) => t.destination_latitude!)) - 5),
          ],
          [
            Math.min(180, Math.max(...tripsWithCoords.map((t) => t.destination_longitude!)) + 5),
            Math.min(90, Math.max(...tripsWithCoords.map((t) => t.destination_latitude!)) + 5),
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
                  onClick={(id) => navigate({ to: '/trips/$tripId', params: { tripId: id } })}
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

        {/* Needs Attention */}
        <div>
          <h2 className="text-lg font-semibold text-cloud-900 mb-3">Needs Attention</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
          ) : (() => {
            const items = getActionItems(trips ?? [])
            if (items.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-cloud-200 p-6 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-cloud-600">All caught up</p>
                </div>
              )
            }
            return (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <Link
                    key={idx}
                    to="/trips/$tripId"
                    params={{ tripId: item.tripId }}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-cloud-200 hover:border-amber-200 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-cloud-800 group-hover:text-indigo-700 truncate">{item.destination}</p>
                        <p className="text-xs text-cloud-500">{item.label}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-cloud-400 group-hover:text-indigo-500 shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            )
          })()}

          {/* Quick links */}
          <div className="flex gap-3 mt-4">
            <Link
              to="/trips/new"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cloud-700 bg-white border border-cloud-200 rounded-lg hover:border-indigo-200 hover:text-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Trip
            </Link>
            <Link
              to="/calendar"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cloud-700 bg-white border border-cloud-200 rounded-lg hover:border-indigo-200 hover:text-indigo-700 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              View Calendar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
