# Trip Detail Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate the trip detail page into a two-panel layout with inline activity editing, auto-generated itinerary days, location autocomplete on all location fields, and checklist delete support.

**Architecture:** Refactor `TripDetailPage.tsx` in-place — remove tabs, replace with a scrollable content column (left) and sticky map sidebar (right). Replace activity modals with inline expandable cards. Add backend endpoints for checklist/item deletion.

**Tech Stack:** React, TypeScript, Tailwind CSS, FastAPI, SQLAlchemy, react-map-gl, @dnd-kit, TanStack Query

---

### Task 1: Backend — Add delete checklist endpoint

**Files:**
- Modify: `backend/src/travel_planner/routers/checklist.py`
- Test: `backend/tests/test_checklist.py`

**Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_delete_checklist(client, auth_headers, override_get_db, mock_db_session):
    """Deleting a checklist returns 204."""
    from unittest.mock import AsyncMock, MagicMock
    from travel_planner.models.checklist import Checklist

    trip_id = uuid4()
    checklist_id = uuid4()

    mock_checklist = MagicMock(spec=Checklist)
    mock_checklist.id = checklist_id
    mock_checklist.trip_id = trip_id

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_checklist
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = await client.delete(
        f"/api/checklist/trips/{trip_id}/checklists/{checklist_id}",
        headers=auth_headers,
    )
    assert response.status_code == 204
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_checklist.py::test_delete_checklist -v`
Expected: FAIL (404, endpoint doesn't exist)

**Step 3: Implement the endpoint**

Add to `backend/src/travel_planner/routers/checklist.py`:

```python
@router.delete("/trips/{trip_id}/checklists/{checklist_id}", status_code=204)
async def delete_checklist(
    trip_id: UUID,
    checklist_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete a checklist and all its items."""
    await verify_trip_member(trip_id, db, user_id)

    result = await db.execute(select(Checklist).where(Checklist.id == checklist_id))
    checklist = result.scalar_one_or_none()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    await db.delete(checklist)
    await db.commit()
    return Response(status_code=204)
```

Add `Response` to the FastAPI imports at the top of the file.

**Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_checklist.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/travel_planner/routers/checklist.py backend/tests/test_checklist.py
git commit -m "feat: add delete checklist endpoint"
```

---

### Task 2: Backend — Add delete checklist item endpoint

**Files:**
- Modify: `backend/src/travel_planner/routers/checklist.py`
- Test: `backend/tests/test_checklist.py`

**Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_delete_checklist_item(client, auth_headers, override_get_db, mock_db_session):
    """Deleting a checklist item returns 204."""
    from unittest.mock import AsyncMock, MagicMock
    from travel_planner.models.checklist import ChecklistItem, Checklist

    item_id = uuid4()
    mock_checklist = MagicMock(spec=Checklist)
    mock_checklist.trip_id = uuid4()

    mock_item = MagicMock(spec=ChecklistItem)
    mock_item.id = item_id
    mock_item.checklist = mock_checklist

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_item
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.delete = AsyncMock()
    mock_db_session.commit = AsyncMock()

    response = await client.delete(
        f"/api/checklist/items/{item_id}",
        headers=auth_headers,
    )
    assert response.status_code == 204
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_checklist.py::test_delete_checklist_item -v`
Expected: FAIL (404 or 405)

**Step 3: Implement the endpoint**

```python
@router.delete("/items/{item_id}", status_code=204)
async def delete_checklist_item(
    item_id: UUID,
    user_id: CurrentUserId,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single checklist item."""
    result = await db.execute(
        select(ChecklistItem)
        .options(selectinload(ChecklistItem.checklist))
        .where(ChecklistItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    await verify_trip_member(item.checklist.trip_id, db, user_id)
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)
```

**Step 4: Run tests**

Run: `cd backend && uv run pytest tests/test_checklist.py -v`
Expected: PASS

**Step 5: Run full backend checks and commit**

Run: `cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest`
Expected: All pass

```bash
git add backend/src/travel_planner/routers/checklist.py backend/tests/test_checklist.py
git commit -m "feat: add delete checklist item endpoint"
```

---

### Task 3: Frontend — Add checklist delete hooks and API helpers

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/hooks/useChecklists.ts`

**Step 1: Add API helpers**

In `frontend/src/lib/api.ts`, add to the `checklistApi` object:

```typescript
delete: (tripId: string, checklistId: string) =>
  api.delete(`/checklist/trips/${tripId}/checklists/${checklistId}`),

deleteItem: (itemId: string) =>
  api.delete(`/checklist/items/${itemId}`),
```

**Step 2: Add hooks**

In `frontend/src/hooks/useChecklists.ts`, add:

```typescript
export function useDeleteChecklist(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (checklistId: string) => {
      await checklistApi.delete(tripId, checklistId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.lists(tripId) })
    },
  })
}

export function useDeleteChecklistItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      await checklistApi.deleteItem(itemId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.lists(tripId) })
    },
  })
}
```

**Step 3: Verify types pass**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useChecklists.ts
git commit -m "feat: add checklist delete API helpers and hooks"
```

---

### Task 4: Frontend — Add delete to ChecklistCard

**Files:**
- Modify: `frontend/src/components/checklist/ChecklistCard.tsx`

**Step 1: Add delete checklist and delete item UI**

Import `useDeleteChecklist`, `useDeleteChecklistItem` from hooks. Import `Trash2`, `X` from lucide-react. Import `ConfirmDialog` from `../ui/ConfirmDialog`.

Add to each checklist card header: a delete button that opens a `ConfirmDialog`.

Add to each checklist item: an X button to delete the item (with inline confirmation or immediate delete since items are lightweight).

Add a progress bar below the title:

```tsx
{totalCount > 0 && (
  <div className="w-full bg-cloud-100 rounded-full h-1.5 mt-2">
    <div
      className="bg-indigo-500 h-1.5 rounded-full transition-all"
      style={{ width: `${(completedCount / totalCount) * 100}%` }}
    />
  </div>
)}
```

**Step 2: Verify types and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/checklist/ChecklistCard.tsx
git commit -m "feat: add delete checklist, delete item, and progress bar"
```

---

### Task 5: Frontend — Create inline ActivityForm component

**Files:**
- Create: `frontend/src/components/itinerary/ActivityForm.tsx`

**Step 1: Build the inline activity form**

This replaces both `AddActivityModal` and `EditActivityModal`. It's a form that renders inline (not in a modal). It accepts an optional `activity` prop — if provided, it's editing; if not, it's creating.

```tsx
import { useState } from 'react'
import type { Activity, ActivityCategory, GeocodeSuggestion } from '../../lib/types'
import { CategorySelector } from './CategorySelector'
import { LocationAutocomplete } from '../form/LocationAutocomplete'

interface ActivityFormProps {
  activity?: Activity  // if provided, editing mode
  dayId: string
  tripId: string
  onSave: (data: ActivityFormData) => Promise<void>
  onCancel: () => void
  isPending: boolean
  error: Error | null
}

export interface ActivityFormData {
  title: string
  category: ActivityCategory
  start_time: string | null
  end_time: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  confirmation_number: string | null
}

export function ActivityForm({
  activity,
  onSave,
  onCancel,
  isPending,
  error,
}: ActivityFormProps) {
  const [title, setTitle] = useState(activity?.title ?? '')
  const [category, setCategory] = useState<ActivityCategory>(activity?.category ?? 'activity')
  const [startTime, setStartTime] = useState(activity?.start_time ?? '')
  const [endTime, setEndTime] = useState(activity?.end_time ?? '')
  const [location, setLocation] = useState(activity?.location ?? '')
  const [latitude, setLatitude] = useState<number | null>(activity?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(activity?.longitude ?? null)
  const [notes, setNotes] = useState(activity?.notes ?? '')
  const [confirmationNumber, setConfirmationNumber] = useState(activity?.confirmation_number ?? '')
  const [locationDirty, setLocationDirty] = useState(false)

  const handleLocationChange = (val: string) => {
    setLocation(val)
    setLocationDirty(true)
    // Clear coordinates when user types (will be set again on select)
    setLatitude(null)
    setLongitude(null)
  }

  const handleLocationSelect = (suggestion: GeocodeSuggestion) => {
    setLocation(suggestion.place_name)
    setLatitude(suggestion.latitude)
    setLongitude(suggestion.longitude)
    setLocationDirty(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      title,
      category,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location || null,
      // Preserve original coords if location wasn't touched
      latitude: locationDirty ? latitude : (activity?.latitude ?? null),
      longitude: locationDirty ? longitude : (activity?.longitude ?? null),
      notes: notes || null,
      confirmation_number: confirmationNumber || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-white border border-cloud-200 rounded-lg">
      {/* Title */}
      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Activity title *"
        disabled={isPending}
        className="w-full px-3 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 text-sm"
        autoFocus
      />

      {/* Category */}
      <CategorySelector value={category} onChange={setCategory} disabled={isPending} />

      {/* Time */}
      <div className="grid grid-cols-2 gap-2">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          disabled={isPending} placeholder="Start" className="..." />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          disabled={isPending} placeholder="End" className="..." />
      </div>

      {/* Location with autocomplete */}
      <LocationAutocomplete
        value={location}
        onChange={handleLocationChange}
        onSelect={handleLocationSelect}
        placeholder="Search for a location..."
        disabled={isPending}
      />

      {/* Notes */}
      <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes" disabled={isPending} className="..." />

      {/* Confirmation number */}
      <input type="text" value={confirmationNumber}
        onChange={(e) => setConfirmationNumber(e.target.value)}
        placeholder="Confirmation number" disabled={isPending} className="..." />

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error.message}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={isPending}
          className="flex-1 px-3 py-1.5 text-sm text-cloud-700 bg-cloud-100 rounded-lg hover:bg-cloud-200">
          Cancel
        </button>
        <button type="submit" disabled={isPending || !title.trim()}
          className="flex-1 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? 'Saving...' : (activity ? 'Save' : 'Add')}
        </button>
      </div>
    </form>
  )
}
```

Key feature: `locationDirty` flag tracks whether the user touched the location field. If they didn't, original coordinates are preserved on save.

**Step 2: Verify types pass**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/itinerary/ActivityForm.tsx
git commit -m "feat: create inline ActivityForm with location autocomplete"
```

---

### Task 6: Frontend — Refactor ActivityItem to expandable card

**Files:**
- Modify: `frontend/src/components/itinerary/ActivityItem.tsx`

**Step 1: Replace modal-based editing with inline expansion**

The `ActivityItem` component currently shows a compact row with edit/delete icons that open modals. Replace with:

- `isExpanded` state (default: false)
- Compact mode: click the row to set `isExpanded = true`
- Expanded mode: render `ActivityForm` inline with the activity data pre-filled
- Save calls `useUpdateActivity` then collapses
- Cancel collapses without saving
- Delete still uses `ConfirmDialog` (keep existing pattern)
- Remove `EditActivityModal` import and usage

```tsx
// Compact row (when !isExpanded):
<div onClick={() => setIsExpanded(true)} className="cursor-pointer ...">
  <GripVertical /> <CategoryIcon /> {title} {timeRange} {location}
  <Trash2 onClick={(e) => { e.stopPropagation(); setIsConfirmOpen(true) }} />
</div>

// Expanded form (when isExpanded):
<ActivityForm
  activity={activity}
  dayId={activity.itinerary_day_id}
  tripId={tripId}
  onSave={async (data) => {
    await updateActivity.mutateAsync({ activityId: activity.id, dayId: activity.itinerary_day_id, data })
    setIsExpanded(false)
  }}
  onCancel={() => setIsExpanded(false)}
  isPending={updateActivity.isPending}
  error={updateActivity.isError ? (updateActivity.error as Error) : null}
/>
```

**Step 2: Verify types and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/itinerary/ActivityItem.tsx
git commit -m "feat: refactor ActivityItem to inline expandable card"
```

---

### Task 7: Frontend — Refactor ItineraryDayCard for inline add

**Files:**
- Modify: `frontend/src/components/itinerary/ItineraryDayCard.tsx`

**Step 1: Replace AddActivityModal with inline form**

Add `isAddingActivity` state. When true, render `ActivityForm` at the bottom of the activity list (no `activity` prop = create mode). On save, call `useCreateActivity` then collapse.

Replace the "Add Activity" button:

```tsx
{isAddingActivity ? (
  <ActivityForm
    dayId={day.id}
    tripId={tripId}
    onSave={async (data) => {
      await createActivity.mutateAsync(data)
      setIsAddingActivity(false)
    }}
    onCancel={() => setIsAddingActivity(false)}
    isPending={createActivity.isPending}
    error={createActivity.isError ? (createActivity.error as Error) : null}
  />
) : (
  <button onClick={() => setIsAddingActivity(true)} className="...">
    <Plus /> Add Activity
  </button>
)}
```

Remove `AddActivityModal` import and usage.

**Step 2: Verify types and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/itinerary/ItineraryDayCard.tsx
git commit -m "feat: replace AddActivityModal with inline form in ItineraryDayCard"
```

---

### Task 8: Frontend — Refactor TripDetailPage layout

**Files:**
- Modify: `frontend/src/pages/TripDetailPage.tsx`

**Step 1: Remove tabs, implement two-panel layout**

This is the biggest change. Key modifications:

1. **Remove tab state** and the Overview/Itinerary/Checklists tab UI
2. **Trip header** at the top (destination, status, type, dates, members) — extracted from Overview tab
3. **Two-panel layout:**
   ```tsx
   <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
     {/* Left column: scrollable content */}
     <div className="lg:col-span-3 space-y-4">
       {/* Itinerary days */}
       {days?.map(day => <ItineraryDayCard key={day.id} day={day} tripId={tripId} />)}

       {/* Checklists section */}
       <div className="space-y-4">
         <h2>Checklists</h2>
         {checklists?.map(cl => <ChecklistCard key={cl.id} checklist={cl} tripId={tripId} />)}
         <NewChecklistButton />
       </div>

       {/* Danger zone */}
       {isOwner && <DangerZone />}
     </div>

     {/* Right column: sticky sidebar */}
     <div className="lg:col-span-2">
       <div className="lg:sticky lg:top-4 space-y-4">
         {/* Map */}
         <MapSection />
         {/* Members */}
         <MembersSection />
         {/* Notes */}
         {trip.notes && <NotesSection />}
       </div>
     </div>
   </div>
   ```
4. **Mobile:** Map renders as a 200px banner at the top, above the content column

**Step 2: Add auto-generate days effect**

```tsx
const { data: days } = useItineraryDays(tripId)
const generateDays = useGenerateDays(tripId)
const hasGeneratedRef = useRef(false)

useEffect(() => {
  if (days && days.length === 0 && trip?.start_date && trip?.end_date
      && !generateDays.isPending && !hasGeneratedRef.current) {
    hasGeneratedRef.current = true
    generateDays.mutate()
  }
}, [days, trip?.start_date, trip?.end_date, generateDays])
```

**Step 3: Verify types and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS (some existing tests may need updates for removed tab UI)

**Step 4: Commit**

```bash
git add frontend/src/pages/TripDetailPage.tsx
git commit -m "feat: refactor TripDetailPage to two-panel layout with auto-generated days"
```

---

### Task 9: Frontend — Add day sync on trip date changes

**Files:**
- Modify: `frontend/src/pages/TripDetailPage.tsx`

**Step 1: Implement day sync logic**

After trip dates are edited (via the existing edit trip form), compare existing days with the new date range:

```tsx
// After trip update succeeds and days are refetched:
useEffect(() => {
  if (!days || !trip?.start_date || !trip?.end_date) return

  const tripStart = new Date(trip.start_date + 'T00:00:00')
  const tripEnd = new Date(trip.end_date + 'T00:00:00')

  // Check if any days are missing
  const existingDates = new Set(days.map(d => d.date))
  let hasMissing = false
  for (let d = new Date(tripStart); d <= tripEnd; d.setDate(d.getDate() + 1)) {
    if (!existingDates.has(d.toISOString().split('T')[0])) {
      hasMissing = true
      break
    }
  }

  if (hasMissing && !generateDays.isPending) {
    generateDays.mutate()
  }

  // Check for orphaned days with activities
  const orphanedWithActivities = days.filter(d => {
    return (d.date < trip.start_date || d.date > trip.end_date) && d.activity_count > 0
  })

  if (orphanedWithActivities.length > 0) {
    setOrphanedDays(orphanedWithActivities)
    setShowOrphanConfirm(true)
  } else {
    // Delete empty orphaned days silently
    const emptyOrphans = days.filter(d =>
      (d.date < trip.start_date || d.date > trip.end_date) && d.activity_count === 0
    )
    emptyOrphans.forEach(d => deleteDay.mutate(d.id))
  }
}, [days, trip?.start_date, trip?.end_date])
```

Add a `ConfirmDialog` for orphaned days with activities: "These days are outside your trip dates and have activities. Remove them?"

**Step 2: Verify types pass**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/TripDetailPage.tsx
git commit -m "feat: auto-sync itinerary days when trip dates change"
```

---

### Task 10: Frontend — Remove unused modal components

**Files:**
- Remove: `frontend/src/components/itinerary/AddActivityModal.tsx`
- Remove: `frontend/src/components/itinerary/EditActivityModal.tsx`

**Step 1: Verify no remaining imports**

Run: `cd frontend && npx tsc --noEmit`

If no type errors, the modals are no longer imported anywhere.

**Step 2: Delete the files**

```bash
rm frontend/src/components/itinerary/AddActivityModal.tsx
rm frontend/src/components/itinerary/EditActivityModal.tsx
```

**Step 3: Verify clean build**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add -A frontend/src/components/itinerary/
git commit -m "refactor: remove unused AddActivityModal and EditActivityModal"
```

---

### Task 11: Frontend — Update tests

**Files:**
- Modify: `frontend/src/__tests__/trips.test.tsx` (or wherever TripDetailPage tests live)

**Step 1: Update tests for new layout**

- Remove tests that assert tab UI existence (Overview, Itinerary, Checklists tabs)
- Add test for two-panel layout rendering
- Add test that itinerary days are visible without tab switching
- Add test that checklists are visible below days
- Add test for inline activity form expansion
- Update any mocks that relied on modal components

**Step 2: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add frontend/src/__tests__/
git commit -m "test: update tests for consolidated trip detail layout"
```

---

### Task 12: Final verification

**Step 1: Run full frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: All pass

**Step 2: Run full backend checks**

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest
```

Expected: All pass

**Step 3: Manual browser test**

Start servers and verify:
1. Navigate to a trip detail page — verify two-panel layout (content left, map right)
2. No tabs visible — itinerary days and checklists on one scroll
3. First visit to a trip with dates but no days — days auto-generate
4. Click an activity — verify inline form expands with location autocomplete
5. Edit a location using autocomplete — verify coordinates update, map marker moves
6. Click "+" on a day — verify inline add form appears (no modal)
7. Delete a checklist — verify confirmation dialog and removal
8. Delete a checklist item — verify item removed
9. Edit trip dates to shorter range — verify orphaned days with activities prompt confirmation
10. Mobile responsive — map banner at top, content below

**Step 4: Commit any final fixes and push**

```bash
git push origin <branch-name>
```
