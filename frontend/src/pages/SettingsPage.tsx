import { useState } from 'react'
import { Mail, User, Database } from 'lucide-react'
import { useGmailStatus, useDisconnectGmail } from '../hooks/useGmail'
import { useDeleteAccount } from '../hooks/useAuth'
import { useAuth } from '../contexts/AuthContext'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { gmailApi } from '../lib/api'
import { DevSeedContent } from '../components/dev/DevSeedContent'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { data: gmailStatus } = useGmailStatus()
  const disconnectMutation = useDisconnectGmail()
  const deleteAccountMutation = useDeleteAccount()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleConnectGmail = async () => {
    const { url } = await gmailApi.getAuthUrl()
    window.location.href = url
  }

  const handleDeleteAccount = async () => {
    setDeleteError(null)
    try {
      await deleteAccountMutation.mutateAsync()
      await signOut()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-cloud-900">Settings</h1>

      {/* Integrations */}
      <div className="bg-white rounded-xl shadow-sm border border-cloud-200 p-6">
        <h2 className="text-lg font-semibold text-cloud-900 mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Integrations
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-cloud-800">Gmail</p>
            <p className="text-xs text-cloud-500 mt-0.5">
              {gmailStatus?.connected
                ? 'Connected — scan travel emails from any trip'
                : 'Connect to import travel bookings from confirmation emails'}
            </p>
          </div>
          {gmailStatus?.connected ? (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="text-sm px-3 py-1.5 border border-cloud-300 rounded-lg text-cloud-600 hover:bg-cloud-50 disabled:opacity-50 transition-colors"
            >
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={handleConnectGmail}
              className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Connect Gmail
            </button>
          )}
        </div>
      </div>

      {/* Account */}
      <div className="bg-white rounded-xl shadow-sm border border-cloud-200 p-6">
        <h2 className="text-lg font-semibold text-cloud-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4" />
          Account
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-cloud-800">{user?.email}</p>
            <p className="text-xs text-cloud-500 mt-0.5">Your account email</p>
          </div>
        </div>
        <div className="mt-6 pt-5 border-t border-cloud-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Delete account</p>
              <p className="text-xs text-cloud-500 mt-0.5">
                Permanently delete your account and all your trips.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteAccountMutation.isPending}
              className="ml-4 shrink-0 text-sm px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Delete account
            </button>
          </div>
          {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
        </div>
      </div>

      {/* Dev Tools — only in development */}
      {import.meta.env.DEV && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6">
          <h2 className="text-lg font-semibold text-cloud-900 mb-4 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Dev Tools
          </h2>
          <DevSeedContent />
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Delete account?"
        message="This will permanently delete your account and all your trips. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteAccountMutation.isPending}
      />
    </div>
  )
}
