import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (email: string) => void
  isLoading?: boolean
  error?: string | null
}

export function AddMemberModal({
  isOpen,
  onClose,
  onAdd,
  isLoading = false,
  error = null,
}: AddMemberModalProps) {
  const [email, setEmail] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    onAdd(email.trim())
  }

  function handleClose() {
    setEmail('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="member-email" className="block text-sm font-medium text-stone-700 mb-1.5">
            Email Address
          </label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50"
          >
            {isLoading && <LoadingSpinner size="sm" />}
            Add Member
          </button>
        </div>
      </form>
    </Modal>
  )
}
