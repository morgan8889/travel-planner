# Icon Audit & Emoji Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all emoji used as icons with proper lucide-react components across the entire application.

**Architecture:** The app already uses lucide-react v0.564.0 for all icons. There are exactly 3 files with emoji violations — all in the itinerary feature. `ActivityItem.tsx` uses an emoji map for category icons. `AddActivityModal.tsx` and `EditActivityModal.tsx` both use emoji in `<option>` text labels inside a native `<select>`. HTML `<option>` elements cannot render React components (no SVG inside `<option>`), so the modal fix requires replacing the native `<select>` with a custom `CategorySelector` component using icon buttons — shared between both modals to stay DRY.

**Tech Stack:** React 19, TypeScript, lucide-react v0.564.0, Tailwind CSS, vitest + @testing-library/react

---

## Audit Summary

All icon usage in the app falls into two categories:
1. **lucide-react** (correct) — 17 files, 20 unique icons. No action needed.
2. **Emoji** (violation) — 3 files, all in `components/itinerary/`:
   - `ActivityItem.tsx:15-20` — `CATEGORY_ICONS` map: `✈️ 🍽️ 🎯 🏨`
   - `AddActivityModal.tsx:95-98` — `<option>` labels: `🎯 Activity`, `✈️ Transport`, etc.
   - `EditActivityModal.tsx:78-81` — same `<option>` labels

---

### Task 1: Create shared `CategorySelector` component

This component replaces the native `<select>` in both modals. It renders 4 icon-button options — one per category — that the user can click to select. Extracting it once prevents duplication.

**Files:**
- Create: `frontend/src/components/itinerary/CategorySelector.tsx`
- Create: `frontend/src/__tests__/CategorySelector.test.tsx`

**Step 1: Write the failing test**

```typescript
// frontend/src/__tests__/CategorySelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CategorySelector } from '../components/itinerary/CategorySelector'

describe('CategorySelector', () => {
  it('renders all four category options', () => {
    render(<CategorySelector value="activity" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /transport/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /food/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lodging/i })).toBeInTheDocument()
  })

  it('highlights the currently selected category', () => {
    render(<CategorySelector value="food" onChange={vi.fn()} />)
    const foodBtn = screen.getByRole('button', { name: /food/i })
    expect(foodBtn).toHaveClass('bg-indigo-50')
  })

  it('calls onChange with the clicked category', () => {
    const onChange = vi.fn()
    render(<CategorySelector value="activity" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /transport/i }))
    expect(onChange).toHaveBeenCalledWith('transport')
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<CategorySelector value="activity" onChange={vi.fn()} disabled />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => expect(btn).toBeDisabled())
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/__tests__/CategorySelector.test.tsx
```
Expected: FAIL — `CategorySelector` not found

**Step 3: Implement `CategorySelector`**

```typescript
// frontend/src/components/itinerary/CategorySelector.tsx
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
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/__tests__/CategorySelector.test.tsx
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
cd frontend
git add src/components/itinerary/CategorySelector.tsx src/__tests__/CategorySelector.test.tsx
git commit -m "feat(itinerary): add CategorySelector component with lucide-react icons"
```

---

### Task 2: Fix emoji icons in `ActivityItem.tsx`

Replace the `CATEGORY_ICONS` emoji string map with a lucide-react component map. The rendered `<div className="text-2xl">` becomes an icon component rendered at consistent `w-5 h-5`.

**Files:**
- Modify: `frontend/src/components/itinerary/ActivityItem.tsx:15-20,70-72`

**Step 1: Verify the current state**

Read lines 15-20 and 70-72. Confirm:
- `CATEGORY_ICONS` is `Record<ActivityCategory, string>` with emoji values
- The icon is rendered as `{CATEGORY_ICONS[activity.category]}` inside `<div className="text-2xl">`

**Step 2: Make the change**

In `ActivityItem.tsx`:

Replace the import line (line 2) to add the icons:
```typescript
// Before
import { GripVertical, Pencil, Trash2 } from 'lucide-react'

// After
import { GripVertical, Pencil, Trash2, Plane, Utensils, MapPin, Hotel, type LucideIcon } from 'lucide-react'
```

Replace the `CATEGORY_ICONS` map (lines 15-20):
```typescript
// Before
const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  transport: '✈️',
  food: '🍽️',
  activity: '🎯',
  lodging: '🏨',
}

// After
const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = {
  transport: Plane,
  food: Utensils,
  activity: MapPin,
  lodging: Hotel,
}
```

Replace the icon render (lines 70-72):
```typescript
// Before
<div className="text-2xl flex-shrink-0 mt-0.5">
  {CATEGORY_ICONS[activity.category]}
</div>

// After
<div className="flex-shrink-0 mt-0.5 text-gray-400">
  {(() => { const Icon = CATEGORY_ICONS[activity.category]; return <Icon className="w-5 h-5" /> })()}
</div>
```

**Step 3: Run type check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors

**Step 4: Run existing tests**

```bash
cd frontend && npx vitest run
```
Expected: All tests pass (no snapshot regressions)

**Step 5: Commit**

```bash
cd frontend
git add src/components/itinerary/ActivityItem.tsx
git commit -m "fix(itinerary): replace emoji category icons with lucide-react in ActivityItem"
```

---

### Task 3: Fix emoji in `AddActivityModal.tsx`

Replace the native `<select>` category field with `<CategorySelector>`.

**Files:**
- Modify: `frontend/src/components/itinerary/AddActivityModal.tsx:83-99`

**Step 1: Make the change**

Add the import at the top (after existing imports):
```typescript
import { CategorySelector } from './CategorySelector'
```

Replace the category `<div>` block (lines 83-99):
```typescript
// Before
<div>
  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
    Category *
  </label>
  <select
    id="category"
    required
    value={formData.category}
    onChange={(e) => setFormData({ ...formData, category: e.target.value as ActivityCategory })}
    disabled={createActivity.isPending}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
  >
    <option value="activity">🎯 Activity</option>
    <option value="transport">✈️ Transport</option>
    <option value="food">🍽️ Food</option>
    <option value="lodging">🏨 Lodging</option>
  </select>
</div>

// After
<div>
  <span className="block text-sm font-medium text-gray-700 mb-1">Category *</span>
  <CategorySelector
    value={formData.category}
    onChange={(cat) => setFormData({ ...formData, category: cat })}
    disabled={createActivity.isPending}
  />
</div>
```

Remove the now-unused `ActivityCategory` import if it was only used for the cast `e.target.value as ActivityCategory`. Check — it's still needed for `useState` initial value type, so keep it.

**Step 2: Run type check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors

**Step 3: Run tests**

```bash
cd frontend && npx vitest run
```
Expected: All pass

**Step 4: Commit**

```bash
cd frontend
git add src/components/itinerary/AddActivityModal.tsx
git commit -m "fix(itinerary): replace emoji select options with CategorySelector in AddActivityModal"
```

---

### Task 4: Fix emoji in `EditActivityModal.tsx`

Same fix as Task 3 — replace native `<select>` with `<CategorySelector>`.

**Files:**
- Modify: `frontend/src/components/itinerary/EditActivityModal.tsx:66-83`

**Step 1: Make the change**

Add the import:
```typescript
import { CategorySelector } from './CategorySelector'
```

Replace the category `<div>` block (lines 66-83):
```typescript
// Before
<div>
  <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">
    Category *
  </label>
  <select
    id="edit-category"
    required
    value={formData.category}
    onChange={(e) => setFormData({ ...formData, category: e.target.value as ActivityCategory })}
    disabled={updateActivity.isPending}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
  >
    <option value="activity">🎯 Activity</option>
    <option value="transport">✈️ Transport</option>
    <option value="food">🍽️ Food</option>
    <option value="lodging">🏨 Lodging</option>
  </select>
</div>

// After
<div>
  <span className="block text-sm font-medium text-gray-700 mb-1">Category *</span>
  <CategorySelector
    value={formData.category}
    onChange={(cat) => setFormData({ ...formData, category: cat })}
    disabled={updateActivity.isPending}
  />
</div>
```

**Step 2: Run full test suite**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```
Expected: No type errors, all tests pass

**Step 3: Commit**

```bash
cd frontend
git add src/components/itinerary/EditActivityModal.tsx
git commit -m "fix(itinerary): replace emoji select options with CategorySelector in EditActivityModal"
```

---

### Task 5: Final audit grep — confirm no emoji remain

**Step 1: Search for any remaining emoji in source files**

```bash
grep -rn $'[\U0001F300-\U0001FFFF]' frontend/src/
```
Expected: No matches (zero output)

**Step 2: Search specifically for the 4 activity-category emoji just in case**

```bash
grep -rn '✈️\|🍽️\|🎯\|🏨' frontend/src/
```
Expected: No matches

**Step 3: Run the full test suite one final time**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```
Expected: Clean pass

**Step 4: Commit if any lint auto-fixes were applied, otherwise done**

If `lint` made changes:
```bash
cd frontend
git add -p
git commit -m "style: apply lint fixes after emoji icon replacement"
```
