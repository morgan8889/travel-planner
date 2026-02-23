import { Suspense, lazy, useState } from 'react'
import type { ElementType } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, Calendar, ArrowRight, CheckCircle2, Plane, Hotel, UtensilsCrossed } from 'lucide-react'
import { useTrips } from '../hooks/useTrips'
import { useAuth } from '../contexts/AuthContext'
import { TripStatusBadge } from '../components/trips/TripStatusBadge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { TripMarker } from '../components/map/TripMarker'
import { getEventName } from '../lib/tripUtils'
import { getDaysUntil } from '../lib/dateUtils'
import type { TripSummary } from '../lib/types'

const MapView = lazy(() => import('../components/map/MapView').then((m) => ({ default: m.MapView })))

function getDisplayName(email: string | undefined): string {
  if (!email) return 'there'
  return email.split('@')[0]
}

function UpcomingTripCard({ trip }: { trip: TripSummary }) {
  const daysText = getDaysUntil(trip.start_date)

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

type TripActionGroup = {
  tripId: string
  displayName: string
  startDate: string
  items: { icon: ElementType; label: string }[]
}

function getActionGroups(trips: TripSummary[]): TripActionGroup[] {
  const actionable = trips.filter((t) =>
    ['planning', 'booked', 'active'].includes(t.status)
  )
  actionable.sort((a, b) => a.start_date.localeCompare(b.start_date))

  const groups: TripActionGroup[] = []
  for (const trip of actionable) {
    const items: { icon: ElementType; label: string }[] = []

    const unconfirmedFlights = (trip.transport_total ?? 0) - (trip.transport_confirmed ?? 0)
    if (unconfirmedFlights > 0) {
      items.push({
        icon: Plane,
        label: `${unconfirmedFlights} flight${unconfirmedFlights > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unconfirmedHotels = (trip.lodging_total ?? 0) - (trip.lodging_confirmed ?? 0)
    if (unconfirmedHotels > 0) {
      items.push({
        icon: Hotel,
        label: `${unconfirmedHotels} hotel${unconfirmedHotels > 1 ? 's' : ''} not confirmed`,
      })
    }
    const unconfirmedRestaurants = (trip.restaurant_total ?? 0) - (trip.restaurant_confirmed ?? 0)
    if (unconfirmedRestaurants > 0) {
      items.push({
        icon: UtensilsCrossed,
        label: `${unconfirmedRestaurants} restaurant booking${unconfirmedRestaurants > 1 ? 's' : ''} to confirm`,
      })
    }
    const unplannedDays = (trip.itinerary_day_count ?? 0) - (trip.days_with_activities ?? 0)
    if (unplannedDays > 0) {
      items.push({
        icon: Calendar,
        label: `${unplannedDays} day${unplannedDays > 1 ? 's' : ''} not planned`,
      })
    }

    if (items.length > 0) {
      groups.push({
        tripId: trip.id,
        displayName: trip.type === 'event'
          ? (getEventName(trip.notes) ?? trip.destination)
          : trip.destination,
        startDate: trip.start_date,
        items,
      })
    }
  }
  return groups
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: trips, isLoading } = useTrips()
  const navigate = useNavigate()
  const [needsAttentionExpanded, setNeedsAttentionExpanded] = useState(false)

  const displayName = getDisplayName(user?.email)

  const upcomingTrips = trips
    ?.filter((t) => t.status !== 'completed')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5) ?? []

  // Map: only show trips in next 90 days (planning/booked/active); fall back to non-completed
  const now = new Date()
  const cutoffDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const upcomingMapTrips =
    trips?.filter((t) => {
      if (!['planning', 'booked', 'active'].includes(t.status)) return false
      return new Date(t.start_date + 'T00:00:00') <= cutoffDate
    }) ?? []

  const mapTrips =
    upcomingMapTrips.length > 0
      ? upcomingMapTrips
      : (trips?.filter((t) => t.status !== 'completed') ?? [])

  const tripsWithCoords = mapTrips.filter(
    (t) => t.destination_latitude !== null && t.destination_longitude !== null
  )

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

  // Next Up overlay: soonest planning/booked/active trip
  const nextUpTrip =
    (trips ?? [])
      .filter((t) => ['planning', 'booked', 'active'].includes(t.status))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null

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
        <div className="h-80 md:h-[440px] relative">
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
          {/* Next Up overlay */}
          {nextUpTrip && (
            <Link
              to="/trips/$tripId"
              params={{ tripId: nextUpTrip.id }}
              className="absolute bottom-4 left-4 z-10"
              data-testid="next-up-overlay"
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-cloud-200 p-3 max-w-[240px] hover:border-indigo-300 transition-colors">
                <p className="font-semibold text-cloud-900 text-sm truncate">
                  {nextUpTrip.type === 'event'
                    ? (getEventName(nextUpTrip.notes) ?? nextUpTrip.destination)
                    : nextUpTrip.destination}
                </p>
                <p className="text-xs text-cloud-500 mt-0.5">
                  {nextUpTrip.start_date} · {getDaysUntil(nextUpTrip.start_date)}
                </p>
                <div className="mt-1.5">
                  <TripStatusBadge status={nextUpTrip.status} />
                </div>
              </div>
            </Link>
          )}
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
            const groups = getActionGroups(trips ?? [])
            if (groups.length === 0) {
              return (
                <div className="bg-white rounded-xl border border-cloud-200 p-6 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-cloud-600">All caught up</p>
                </div>
              )
            }
            const visibleGroups = needsAttentionExpanded ? groups : groups.slice(0, 3)
            const hiddenCount = groups.length - visibleGroups.length
            return (
              <div>
                <div className="space-y-3">
                  {visibleGroups.map((group) => (
                    <div key={group.tripId} className="bg-white rounded-xl border border-cloud-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-cloud-100">
                        <div className="min-w-0 mr-2">
                          <span className="text-sm font-semibold text-cloud-800 truncate block">
                            {group.displayName}
                          </span>
                          <span className="text-xs text-cloud-500">
                            {group.startDate} · {getDaysUntil(group.startDate)}
                          </span>
                        </div>
                        <Link
                          to="/trips/$tripId"
                          params={{ tripId: group.tripId }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap shrink-0"
                        >
                          View trip →
                        </Link>
                      </div>
                      <div className="divide-y divide-cloud-50">
                        {group.items.map((item, idx) => (
                          <Link
                            key={idx}
                            to="/trips/$tripId"
                            params={{ tripId: group.tripId }}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-cloud-50/50 transition-colors group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <item.icon className="w-4 h-4 text-amber-500 shrink-0" />
                              <p className="text-sm text-cloud-700 group-hover:text-indigo-700 truncate">
                                {item.label}
                              </p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-cloud-400 group-hover:text-indigo-500 shrink-0 ml-2" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setNeedsAttentionExpanded(true)}
                    className="w-full mt-2 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  >
                    Show more ({hiddenCount} more)
                  </button>
                )}
                {needsAttentionExpanded && groups.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setNeedsAttentionExpanded(false)}
                    className="w-full mt-2 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  >
                    Show less
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
