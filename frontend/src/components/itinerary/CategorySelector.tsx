import { Plane, Utensils, MapPin, Hotel, type LucideIcon } from 'lucide-react'
import type { ActivityCategory } from '../../lib/types'

interface CategoryOption {
  value: ActivityCategory
  label: string
  icon: LucideIcon
}

const CATEGORIES: CategoryOption[] = [
  { value: 'activity', label: 'Activity', icon: MapPin },
  { value: 'transport', label: 'Transport', icon: Plane },
  { value: 'food', label: 'Food', icon: Utensils },
  { value: 'lodging', label: 'Lodging', icon: Hotel },
]

interface CategorySelectorProps {
  value: ActivityCategory
  onChange: (value: ActivityCategory) => void
  disabled?: boolean
}

export function CategorySelector({ value, onChange, disabled }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORIES.map(({ value: cat, label, icon: Icon }) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          disabled={disabled}
          aria-pressed={value === cat}
          className={[
            'flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs font-medium transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            value === cat
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
          ].join(' ')}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
