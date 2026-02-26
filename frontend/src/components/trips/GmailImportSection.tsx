import { Mail } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useGmailStatus, usePendingImportCount } from '../../hooks/useGmail'

interface GmailImportSectionProps {
  tripId: string
}

export function GmailImportSection({ tripId }: GmailImportSectionProps) {
  const { data: status } = useGmailStatus()
  const pendingCount = usePendingImportCount(tripId)

  if (!status?.connected) return null

  return (
    <div className="mt-8 border-t border-cloud-100 pt-4">
      <Link
        to="/settings"
        className="flex items-center gap-2 text-xs text-cloud-500 hover:text-indigo-600 transition-colors"
      >
        <Mail size={12} />
        {pendingCount > 0
          ? `${pendingCount} pending Gmail import${pendingCount !== 1 ? 's' : ''} · Review in Settings`
          : 'Gmail connected · Scan all trips in Settings'}
      </Link>
    </div>
  )
}
