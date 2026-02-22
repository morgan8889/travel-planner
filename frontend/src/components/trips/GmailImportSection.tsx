import { Mail } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import {
  useConfirmImport,
  useGmailStatus,
  usePendingImports,
  useRejectImport,
  useScanGmail,
} from '../../hooks/useGmail'
import type { Activity } from '../../lib/types'

interface GmailImportSectionProps {
  tripId: string
}

export function GmailImportSection({ tripId }: GmailImportSectionProps) {
  const { data: status, isLoading } = useGmailStatus()
  const { data: pending = [] } = usePendingImports(tripId)
  const scanMutation = useScanGmail(tripId)
  const confirmMutation = useConfirmImport(tripId)
  const rejectMutation = useRejectImport(tripId)

  if (isLoading) return null

  return (
    <section className="mt-8 border-t border-cloud-100 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-cloud-700 flex items-center gap-2">
          <Mail size={14} />
          Gmail Import
        </h2>
        {status?.connected ? (
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {scanMutation.isPending ? 'Scanning...' : 'Scan emails'}
          </button>
        ) : (
          <Link
            to="/settings"
            className="text-xs text-cloud-500 hover:text-indigo-600 transition-colors"
          >
            Connect in Settings
          </Link>
        )}
      </div>

      {scanMutation.data && (
        <p className="text-xs text-cloud-500 mb-3">
          Found {scanMutation.data.imported_count} new booking
          {scanMutation.data.imported_count !== 1 ? 's' : ''}
          {scanMutation.data.skipped_count > 0
            ? ` · ${scanMutation.data.skipped_count} already imported`
            : ''}
        </p>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-cloud-600 mb-2">
            Pending review ({pending.length})
          </p>
          {pending.map((activity: Activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
            >
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
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => rejectMutation.mutate(activity.id)}
                  disabled={rejectMutation.isPending}
                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {status?.connected && pending.length === 0 && !scanMutation.data && (
        <p className="text-xs text-cloud-400 italic">
          No pending imports. Scan emails to find travel bookings.
        </p>
      )}
    </section>
  )
}
