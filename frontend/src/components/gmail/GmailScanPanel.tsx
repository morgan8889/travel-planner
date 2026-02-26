import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'
import { useGmailScan } from '../../hooks/useGmail'
import type { ScanProgressEvent } from '../../lib/types'

interface GmailScanPanelProps {
  onScanComplete: () => void
  onScanRunningChange?: (running: boolean) => void
}

function EventRow({ event, debug }: { event: ScanProgressEvent; debug: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const colorClass =
    event.status === 'imported'
      ? 'text-green-700'
      : event.status === 'unmatched'
        ? 'text-amber-700'
        : 'text-cloud-400'

  const label =
    event.status === 'imported'
      ? (event.subject ?? event.email_id)
      : `${event.subject ?? event.email_id} — ${event.skip_reason ?? 'skipped'}`

  return (
    <div className="text-xs">
      <div
        className={`flex items-center gap-1 py-0.5 ${colorClass} ${debug ? 'cursor-pointer hover:underline' : ''}`}
        onClick={() => debug && setExpanded((e) => !e)}
      >
        {debug && (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
        <span className="truncate">{label}</span>
      </div>
      {debug && expanded && (
        <pre className="mt-1 p-2 bg-cloud-50 rounded text-xs text-cloud-700 overflow-auto max-h-40">
          {JSON.stringify(
            { skip_reason: event.skip_reason, parsed: event.raw_claude_json },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  )
}

export function GmailScanPanel({ onScanComplete, onScanRunningChange }: GmailScanPanelProps) {
  const [rescanRejected, setRescanRejected] = useState(false)
  const [debug, setDebug] = useState(false)
  const { state, startScan, cancelScan } = useGmailScan()

  const handleStart = async () => {
    onScanRunningChange?.(true)
    try {
      const success = await startScan(rescanRejected)
      if (success) {
        onScanComplete()
      }
    } finally {
      onScanRunningChange?.(false)
    }
  }

  if (!state.isRunning && !state.summary && !state.error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleStart}
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Scan all trips
          </button>
          <label className="flex items-center gap-2 text-sm text-cloud-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rescanRejected}
              onChange={(e) => setRescanRejected(e.target.checked)}
              className="rounded"
            />
            Include previously rejected
          </label>
          <label className="flex items-center gap-2 text-sm text-cloud-600 cursor-pointer">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
              className="rounded"
            />
            Show debug log
          </label>
        </div>
      </div>
    )
  }

  const total = state.events.length

  return (
    <div className="space-y-3">
      {state.isRunning && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-cloud-600">
            <Loader2 size={14} className="animate-spin" />
            <span>
              {total > 0 ? `${total} emails processed` : 'Starting scan...'}
            </span>
          </div>
          <button
            onClick={cancelScan}
            className="flex items-center gap-1 text-xs text-cloud-500 hover:text-red-600 transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
        </div>
      )}

      {state.summary && (
        <p className="text-sm text-cloud-600">
          Done — {state.summary.imported} imported, {state.summary.skipped} skipped
          {state.summary.unmatched > 0 && `, ${state.summary.unmatched} need assignment`}
        </p>
      )}

      {state.error && (
        <p className="text-sm text-red-600">
          {state.error === 'gmail_auth_failed'
            ? 'Gmail disconnected — please reconnect'
            : state.error === 'timeout'
              ? 'Scan is taking longer than expected — it may still be running in the background'
              : 'Scan failed — try again'}
        </p>
      )}

      {state.events.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-0.5 border border-cloud-100 rounded-lg p-2 bg-cloud-50">
          {state.events.map((ev, i) => (
            <EventRow key={i} event={ev} debug={debug} />
          ))}
        </div>
      )}
    </div>
  )
}
