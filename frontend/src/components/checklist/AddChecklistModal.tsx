import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useCreateChecklist } from '../../hooks/useChecklists'

interface AddChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
}

export function AddChecklistModal({ isOpen, onClose, tripId }: AddChecklistModalProps) {
  const [title, setTitle] = useState('')
  const createMutation = useCreateChecklist(tripId)

  const resetForm = () => {
    setTitle('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createMutation.mutateAsync({ title })

      // Reset form and close only on success
      resetForm()
      onClose()
    } catch {
      // Error is automatically captured by mutation state and displayed
      // Keep modal open to show error message
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Checklist">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-cloud-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Packing List"
            disabled={createMutation.isPending}
            className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            autoFocus
          />
        </div>

        {createMutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Failed to create checklist'}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="flex-1 px-4 py-2 text-cloud-700 bg-cloud-100 rounded-lg hover:bg-cloud-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
