import { useState } from 'react'
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
      <div className="h-4 bg-gray-200 rounded w-24 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-10 bg-gray-200 rounded-lg w-3/4" />
          <div className="flex gap-2">
            <div className="h-6 bg-gray-200 rounded-full w-20" />
            <div className="h-6 bg-gray-200 rounded-full w-24" />
          </div>
          <div className="h-5 bg-gray-200 rounded w-1/2" />
          <div className="h-20 bg-gray-200 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-24" />
          <div className="h-12 bg-gray-200 rounded-lg" />
          <div className="h-12 bg-gray-200 rounded-lg" />
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load trip</h2>
        <p className="text-gray-600 mb-4">Something went wrong. The trip may not exist or you may not have access.</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/trips"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-6">
          <span className="text-4xl">🔍</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Trip not found</h2>
        <p className="text-gray-600 mb-6">This trip does not exist or has been deleted.</p>
        <Link
          to="/trips"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to My Trips
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb / Back */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link to="/trips" className="text-gray-500 hover:text-blue-600 transition-colors">
          My Trips
        </Link>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium truncate">{trip.destination}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Trip</h2>
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {trip.destination}
                  </h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 mb-4">
                  <TripTypeBadge type={trip.type} />
                  <TripStatusBadge status={trip.status} />
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3 text-gray-600 mb-4">
                  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                  <span className="text-sm text-gray-400">
                    ({getCountdownText(trip.start_date)})
                  </span>
                </div>

                {/* Notes */}
                {trip.notes && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Notes</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{trip.notes}</p>
                  </div>
                )}

                {/* Status Transition */}
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <StatusTransitionButton
                    currentStatus={trip.status}
                    onTransition={handleStatusTransition}
                    isLoading={updateTrip.isPending}
                  />
                </div>
              </div>

              {/* Sub-trips for sabbaticals */}
              {trip.type === 'sabbatical' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Sub-trips
                      {trip.children.length > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
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
                    <p className="text-sm text-gray-500 py-4 text-center">
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
                  <p className="text-sm text-gray-600 mb-4">
                    Once you delete a trip, there is no going back. Please be certain.
                  </p>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Trip
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Members
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
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
