import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Checklist } from '../../lib/types'
import { useAddChecklistItem, useToggleChecklistItem } from '../../hooks/useChecklists'

interface ChecklistCardProps {
  checklist: Checklist
  tripId: string
}

export function ChecklistCard({ checklist, tripId }: ChecklistCardProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItemText, setNewItemText] = useState('')

  const addItemMutation = useAddChecklistItem(tripId)
  const toggleMutation = useToggleChecklistItem(tripId)

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemText.trim()) return

    try {
      await addItemMutation.mutateAsync({
        checklistId: checklist.id,
        data: { text: newItemText.trim() },
      })

      // Reset form and close on success
      setNewItemText('')
      setShowAddForm(false)
    } catch (error) {
      // Error is captured by mutation state and displayed
      // Keep form open to show error message
    }
  }

  const handleCancel = () => {
    setNewItemText('')
    setShowAddForm(false)
  }

  const handleToggle = async (itemId: string) => {
    try {
      await toggleMutation.mutateAsync(itemId)
    } catch (error) {
      // Error is captured by mutation state and displayed
    }
  }

  const completedCount = checklist.items.filter((item) => item.checked).length
  const totalCount = checklist.items.length

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{checklist.title}</h3>
          <p className="text-sm text-gray-600 mt-0.5">
            {completedCount} of {totalCount} completed
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="Add item"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="New item..."
              disabled={addItemMutation.isPending}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={addItemMutation.isPending || !newItemText.trim()}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={addItemMutation.isPending}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {addItemMutation.isError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {addItemMutation.error instanceof Error
                  ? addItemMutation.error.message
                  : 'Failed to add item'}
              </p>
            </div>
          )}
        </form>
      )}

      <div className="space-y-2">
        {checklist.items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No items yet. Click 'Add item' button to get started.
          </p>
        ) : (
          checklist.items.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggle(item.id)}
                disabled={toggleMutation.isPending}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className={item.checked ? 'line-through text-gray-500' : 'text-gray-900'}>
                {item.text}
              </span>
            </label>
          ))
        )}
      </div>

      {toggleMutation.isError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            {toggleMutation.error instanceof Error
              ? toggleMutation.error.message
              : 'Failed to toggle item'}
          </p>
        </div>
      )}
    </div>
  )
}
