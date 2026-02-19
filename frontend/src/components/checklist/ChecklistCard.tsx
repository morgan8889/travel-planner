import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { Checklist } from '../../lib/types'
import {
  useAddChecklistItem,
  useDeleteChecklist,
  useDeleteChecklistItem,
  useToggleChecklistItem,
} from '../../hooks/useChecklists'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface ChecklistCardProps {
  checklist: Checklist
  tripId: string
}

export function ChecklistCard({ checklist, tripId }: ChecklistCardProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const addItemMutation = useAddChecklistItem(tripId)
  const toggleMutation = useToggleChecklistItem(tripId)
  const deleteChecklist = useDeleteChecklist(tripId)
  const deleteChecklistItem = useDeleteChecklistItem(tripId)

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
    } catch {
      // Error is captured by mutation state and displayed
      // Keep form open to show error message
    }
  }

  const handleCancel = () => {
    setNewItemText('')
    setShowAddForm(false)
  }

  const handleToggle = async (itemId: string) => {
    setPendingToggleId(itemId)
    try {
      await toggleMutation.mutateAsync(itemId)
    } catch {
      // Error is captured by mutation state and displayed
    } finally {
      setPendingToggleId(null)
    }
  }

  const completedCount = checklist.items.filter((item) => item.checked).length
  const totalCount = checklist.items.length

  return (
    <div className="bg-white border border-cloud-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-cloud-900">{checklist.title}</h3>
          <p className="text-sm text-cloud-600 mt-0.5">
            {completedCount} of {totalCount} completed
          </p>
          {totalCount > 0 && (
            <div className="w-full bg-cloud-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            aria-label="Add item"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-cloud-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Delete checklist"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
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
              className="flex-1 px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={addItemMutation.isPending || !newItemText.trim()}
              className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={addItemMutation.isPending}
              className="px-4 py-2 text-cloud-700 bg-cloud-100 rounded-lg hover:bg-cloud-200 transition-colors disabled:opacity-50"
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
          <p className="text-sm text-cloud-500 text-center py-4">
            No items yet. Click 'Add item' button to get started.
          </p>
        ) : (
          checklist.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group">
              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-cloud-50 cursor-pointer transition-colors flex-1">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggle(item.id)}
                  disabled={pendingToggleId === item.id}
                  className="w-5 h-5 rounded border-cloud-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className={item.checked ? 'line-through text-cloud-500' : 'text-cloud-900'}>
                  {item.text}
                </span>
              </label>
              <button
                onClick={() => deleteChecklistItem.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-cloud-400 hover:text-red-600 rounded transition-all"
                aria-label="Delete item"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteChecklist.mutate(checklist.id)
          setShowDeleteConfirm(false)
        }}
        title="Delete Checklist"
        message={`Are you sure you want to delete "${checklist.title}" and all its items?`}
        confirmLabel="Delete"
        isLoading={deleteChecklist.isPending}
      />
    </div>
  )
}
