import { useState } from 'react'
import { Modal } from '../ui/Modal'
import type { BlockType, CreateCalendarBlock } from '../../lib/types'

interface CreateBlockModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Omit<CreateCalendarBlock, 'annual_plan_id'>) => void
  initialDates?: { start: string; end: string } | null
}

export function CreateBlockModal({ isOpen, onClose, onSubmit, initialDates }: CreateBlockModalProps) {
  const [type, setType] = useState<BlockType>('pto')
  const [startDate, setStartDate] = useState(initialDates?.start ?? '')
  const [endDate, setEndDate] = useState(initialDates?.end ?? '')
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!startDate || !endDate) {
      setError('Start and end dates are required')
      return
    }
    if (endDate < startDate) {
      setError('End date must be on or after start date')
      return
    }

    onSubmit({
      type,
      start_date: startDate,
      end_date: endDate,
      destination: destination || null,
      notes: notes || null,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Calendar Block">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
          <div className="flex gap-2">
            {([
              { value: 'pto', label: 'PTO', color: 'bg-amber-400' },
              { value: 'holiday', label: 'Holiday', color: 'bg-red-400' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                  ${type === opt.value
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'}
                `}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-stone-700 mb-1">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-stone-700 mb-1">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-stone-700 mb-1">
            Destination <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="destination"
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="e.g. Beach house"
            maxLength={255}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-stone-700 mb-1">
            Notes <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={5000}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Block
          </button>
        </div>
      </form>
    </Modal>
  )
}
