import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useCreateDay } from '../../hooks/useItinerary'

interface AddDayModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
}

export function AddDayModal({ isOpen, onClose, tripId }: AddDayModalProps) {
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const createMutation = useCreateDay(tripId)

  const resetForm = () => {
    setDate('')
    setNotes('')
  }

  const handleClose = () => {
    resetForm()
    createMutation.reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createMutation.mutateAsync({ date, notes: notes || undefined })
      resetForm()
      onClose()
    } catch {
      // Error is captured by mutation state and displayed below
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Itinerary Day">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="day-date" className="block text-sm font-medium text-gray-700 mb-1">
            Date *
          </label>
          <input
            type="date"
            id="day-date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={createMutation.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="day-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="day-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for this day..."
            disabled={createMutation.isPending}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
          />
        </div>

        {createMutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Failed to add day'}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !date}
            className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Adding...' : 'Add Day'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
