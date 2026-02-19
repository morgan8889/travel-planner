import { useState } from 'react'
import { useCreateCustomDay } from '../../hooks/useHolidays'

interface SidebarCustomDayFormProps {
  year: number
  onCreated: () => void
}

export function SidebarCustomDayForm({ year, onCreated }: SidebarCustomDayFormProps) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [recurring, setRecurring] = useState(false)
  const createCustomDay = useCreateCustomDay(year)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !date) return

    await createCustomDay.mutateAsync({ name: name.trim(), date, recurring })
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-cloud-900">Add Custom Day</h3>

      <div>
        <label htmlFor="day-name" className="block text-sm font-medium text-cloud-700 mb-1">
          Name
        </label>
        <input
          id="day-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mom's birthday"
          required
          className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white placeholder:text-cloud-400 text-cloud-800"
        />
      </div>

      <div>
        <label htmlFor="day-date" className="block text-sm font-medium text-cloud-700 mb-1">
          Date
        </label>
        <input
          id="day-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full px-3 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white text-cloud-800"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-cloud-700">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="rounded border-cloud-300 text-indigo-600 focus:ring-indigo-500"
        />
        Recurring annually
      </label>

      <button
        type="submit"
        disabled={createCustomDay.isPending || !name.trim() || !date}
        className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {createCustomDay.isPending ? 'Adding...' : 'Add Day'}
      </button>
    </form>
  )
}
