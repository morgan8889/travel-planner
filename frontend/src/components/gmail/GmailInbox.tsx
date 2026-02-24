import { useState } from 'react'
import { CheckCircle, HelpCircle, XCircle } from 'lucide-react'
import {
  useAssignUnmatched,
  useConfirmImport,
  useDismissUnmatched,
  useGmailInbox,
  useRejectImport,
} from '../../hooks/useGmail'
import { useTrips } from '../../hooks/useTrips'
import type { Activity, UnmatchedImport } from '../../lib/types'

function PendingActivityRow({ activity }: { activity: Activity }) {
  const confirmMutation = useConfirmImport()
  const rejectMutation = useRejectImport()

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 border border-amber-100">
      <div className="min-w-0">
        <p className="text-sm font-medium text-cloud-800 truncate">{activity.title}</p>
        <p className="text-xs text-cloud-500 capitalize">
          {activity.category}
          {activity.confirmation_number ? ` · ${activity.confirmation_number}` : ''}
        </p>
      </div>
      <div className="flex gap-2 shrink-0 ml-3">
        <button
          onClick={() => confirmMutation.mutate(activity.id)}
          disabled={confirmMutation.isPending}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle size={12} />
          Accept
        </button>
        <button
          onClick={() => rejectMutation.mutate(activity.id)}
          disabled={rejectMutation.isPending}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
        >
          <XCircle size={12} />
          Reject
        </button>
      </div>
    </div>
  )
}

function UnmatchedRow({ item }: { item: UnmatchedImport }) {
  const [tripId, setTripId] = useState('')
  const assignMutation = useAssignUnmatched()
  const dismissMutation = useDismissUnmatched()
  const { data: trips = [] } = useTrips()

  return (
    <div className="py-2 px-3 rounded-lg bg-cloud-50 border border-cloud-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-cloud-800 truncate">
            {item.parsed_data.title ?? 'Unknown booking'}
          </p>
          <p className="text-xs text-cloud-500">
            {item.parsed_data.category ?? 'unknown'}
            {item.parsed_data.date ? ` · ${item.parsed_data.date}` : ''}
            {item.parsed_data.location ? ` · ${item.parsed_data.location}` : ''}
          </p>
        </div>
        <HelpCircle size={14} className="text-cloud-400 shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <select
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          className="flex-1 text-xs border border-cloud-200 rounded px-2 py-1 bg-white text-cloud-700"
        >
          <option value="">Assign to trip...</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.destination}
              {t.start_date ? ` (${t.start_date})` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => assignMutation.mutate({ unmatchedId: item.id, tripId })}
          disabled={!tripId || assignMutation.isPending}
          className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Assign
        </button>
        <button
          onClick={() => dismissMutation.mutate(item.id)}
          disabled={dismissMutation.isPending}
          className="text-xs px-2 py-1 text-cloud-500 hover:text-cloud-700 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export function GmailInbox() {
  const { data: inbox, isLoading } = useGmailInbox()

  if (isLoading) return null

  const hasPending = (inbox?.pending.length ?? 0) > 0
  const hasUnmatched = (inbox?.unmatched.length ?? 0) > 0

  if (!hasPending && !hasUnmatched) {
    return (
      <p className="text-sm text-cloud-400 italic">All caught up — no imports pending</p>
    )
  }

  return (
    <div className="space-y-5">
      {hasPending && (
        <div>
          <h3 className="text-xs font-semibold text-cloud-600 uppercase tracking-wide mb-2">
            Pending review
          </h3>
          <div className="space-y-4">
            {inbox!.pending.map((group) => (
              <div key={group.trip_id}>
                <p className="text-xs font-medium text-cloud-700 mb-1.5">
                  {group.trip_destination}
                </p>
                <div className="space-y-1.5">
                  {group.activities.map((a) => (
                    <PendingActivityRow key={a.id} activity={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasUnmatched && (
        <div>
          <h3 className="text-xs font-semibold text-cloud-600 uppercase tracking-wide mb-2">
            Needs trip assignment
          </h3>
          <div className="space-y-1.5">
            {inbox!.unmatched.map((item) => (
              <UnmatchedRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
