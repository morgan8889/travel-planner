import { useState } from 'react'
import { TriangleAlert, ArrowLeft, ChevronRight, SquarePen, Calendar, Trash2, MapPinOff } from 'lucide-react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useTrip, useUpdateTrip, useDeleteTrip } from '../hooks/useTrips'
import { useAddMember, useRemoveMember, useUpdateMemberRole } from '../hooks/useMembers'
import { useAuth } from '../contexts/AuthContext'
import { TripStatusBadge } from '../components/trips/TripStatusBadge'
import { TripTypeBadge } from '../components/trips/TripTypeBadge'
import { StatusTransitionButton } from '../components/trips/StatusTransitionButton'
import { TripForm } from '../components/trips/TripForm'
import { TripMembersList } from '../components/trips/TripMembersList'
import { AddMemberModal } from '../components/trips/AddMemberModal'
import { TripCard } from '../components/trips/TripCard'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import type { TripCreate, TripStatus, TripUpdate } from '../lib/types'

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  const startFormatted = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
  const endFormatted = end.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return `${startFormatted} - ${endFormatted}`
}

function getCountdownText(startDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffTime = start.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays > 1) return `in ${diffDays} days`
  if (diffDays === 1) return 'tomorrow'
  if (diffDays === 0) return 'today'
  if (diffDays === -1) return 'yesterday'
  return `${Math.abs(diffDays)} days ago`
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-stone-200 rounded w-24 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-10 bg-stone-200 rounded-lg w-3/4" />
          <div className="flex gap-2">
            <div className="h-6 bg-stone-200 rounded-full w-20" />
            <div className="h-6 bg-stone-200 rounded-full w-24" />
          </div>
          <div className="h-5 bg-stone-200 rounded w-1/2" />
          <div className="h-20 bg-stone-200 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-stone-200 rounded w-24" />
          <div className="h-12 bg-stone-200 rounded-lg" />
          <div className="h-12 bg-stone-200 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function TripDetailPage() {
  const { tripId } = useParams({ from: '/trips/$tripId' })
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: trip, isLoading, error, refetch } = useTrip(tripId)
  const updateTrip = useUpdateTrip(tripId)
  const deleteTrip = useDeleteTrip()
  const addMember = useAddMember(tripId)
  const removeMember = useRemoveMember(tripId)
  const updateMemberRole = useUpdateMemberRole(tripId)

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)

  const isOwner = trip?.members.some(
    (m) => m.user_id === user?.id && m.role === 'owner'
  ) ?? false

  function handleStatusTransition(newStatus: TripStatus) {
    updateTrip.mutate({ status: newStatus })
  }

  function handleUpdate(data: TripCreate | TripUpdate) {
    updateTrip.mutate(data as TripUpdate, {
      onSuccess: () => setIsEditing(false),
    })
  }

  function handleDelete() {
    deleteTrip.mutate(tripId, {
      onSuccess: () => navigate({ to: '/trips' }),
    })
  }

  function handleAddMember(email: string) {
    setAddMemberError(null)
    addMember.mutate(email, {
      onSuccess: () => {
        setShowAddMember(false)
        setAddMemberError(null)
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : 'Failed to add member'
        setAddMemberError(message)
      },
    })
  }

  function handleRemoveMember(memberId: string) {
    removeMember.mutate(memberId)
  }

  function handleUpdateRole(memberId: string, role: 'owner' | 'member') {
    updateMemberRole.mutate({ memberId, role })
  }

  // Loading state
  if (isLoading) {
    return <DetailSkeleton />
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-50 to-red-100/80 ring-1 ring-red-200/50 mb-4">
          <TriangleAlert className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-stone-900 mb-2">Unable to load trip</h2>
        <p className="text-stone-600 mb-4">Something went wrong. The trip may not exist or you may not have access.</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/trips"
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Back to Trips
          </Link>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Not found
  if (!trip) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-stone-50 to-stone-100/80 ring-1 ring-stone-200/50 mb-6">
          <MapPinOff className="w-10 h-10 text-stone-400" />
        </div>
        <h2 className="text-xl font-semibold text-stone-900 mb-2">Trip not found</h2>
        <p className="text-stone-600 mb-6">This trip does not exist or has been deleted.</p>
        <Link
          to="/trips"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Trips
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb / Back */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link to="/trips" className="text-stone-500 hover:text-blue-600 transition-colors">
          My Trips
        </Link>
        <ChevronRight className="w-4 h-4 text-stone-400" />
        <span className="text-stone-900 font-medium truncate">{trip.destination}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <div className="bg-white rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-stone-200 p-6">
              <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit Trip</h2>
              <TripForm
                defaultValues={{
                  type: trip.type,
                  destination: trip.destination,
                  start_date: trip.start_date,
                  end_date: trip.end_date,
                  status: trip.status,
                  notes: trip.notes,
                  parent_trip_id: trip.parent_trip_id,
                }}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
                isLoading={updateTrip.isPending}
                submitLabel="Save Changes"
              />
            </div>
          ) : (
            <>
              {/* Trip Header */}
              <div className="bg-white rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-stone-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <h1 className="text-3xl font-bold text-stone-900">
                    {trip.destination}
                  </h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 hover:text-stone-900 transition-colors shrink-0"
                  >
                    <SquarePen className="w-4 h-4" />
                    Edit
                  </button>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 mb-4">
                  <TripTypeBadge type={trip.type} />
                  <TripStatusBadge status={trip.status} />
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3 text-stone-600 mb-4">
                  <Calendar className="w-5 h-5 text-stone-400 shrink-0" />
                  <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                  <span className="text-sm text-stone-400">
                    ({getCountdownText(trip.start_date)})
                  </span>
                </div>

                {/* Notes */}
                {trip.notes && (
                  <div className="mt-4 p-4 bg-stone-50/80 border border-stone-100 rounded-lg">
                    <h3 className="text-sm font-medium text-stone-700 mb-1">Notes</h3>
                    <p className="text-sm text-stone-600 whitespace-pre-wrap">{trip.notes}</p>
                  </div>
                )}

                {/* Status Transition */}
                <div className="mt-5 pt-5 border-t border-stone-100">
                  <StatusTransitionButton
                    currentStatus={trip.status}
                    onTransition={handleStatusTransition}
                    isLoading={updateTrip.isPending}
                  />
                </div>
              </div>

              {/* Sub-trips for sabbaticals */}
              {trip.type === 'sabbatical' && (
                <div className="bg-white rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-stone-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-stone-900">
                      Sub-trips
                      {trip.children.length > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                          {trip.children.length}
                        </span>
                      )}
                    </h2>
                    <Link
                      to="/trips/new"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      + Add Sub-trip
                    </Link>
                  </div>

                  {trip.children.length === 0 ? (
                    <p className="text-sm text-stone-500 py-4 text-center">
                      No sub-trips yet. Add vacations or remote weeks within this sabbatical.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {trip.children.map((child) => (
                        <TripCard key={child.id} trip={child} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Danger Zone */}
              {isOwner && (
                <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                  <h2 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h2>
                  <p className="text-sm text-stone-600 mb-4">
                    Once you delete a trip, there is no going back. Please be certain.
                  </p>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Trip
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-900">
                Members
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                  {trip.members.length}
                </span>
              </h2>
              {isOwner && (
                <button
                  onClick={() => {
                    setAddMemberError(null)
                    setShowAddMember(true)
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  + Add
                </button>
              )}
            </div>

            <TripMembersList
              members={trip.members}
              isOwner={isOwner}
              onRemove={handleRemoveMember}
              onUpdateRole={handleUpdateRole}
            />

            {(removeMember.isPending || updateMemberRole.isPending) && (
              <div className="flex items-center justify-center py-2">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Trip"
        message={`Are you sure you want to delete "${trip.destination}"? This action cannot be undone and will remove all members and associated data.`}
        confirmLabel="Delete Trip"
        isLoading={deleteTrip.isPending}
      />

      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => {
          setShowAddMember(false)
          setAddMemberError(null)
        }}
        onAdd={handleAddMember}
        isLoading={addMember.isPending}
        error={addMemberError}
      />
    </div>
  )
}
