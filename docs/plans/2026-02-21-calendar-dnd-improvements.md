# Calendar & DnD Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Four UX improvements to the planning calendar and itinerary drag-and-drop.

**Architecture:** All changes are purely frontend. No backend schema changes needed — `UpdateActivity` already accepts `sort_order?: number`.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react, @dnd-kit/core, @dnd-kit/sortable

**Design doc:** `docs/plans/2026-02-21-calendar-dnd-improvements-design.md`

---

## Verification commands

```bash
# Type check
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit

# Unit tests
cd /Users/nick/Code/travel-planner/frontend && npx vitest run

# Lint
cd /Users/nick/Code/travel-planner/frontend && npm run lint
```

---

## Task 1 — Star icon for custom days in DayCell (Feature 1)

**Files:**
- Modify: `frontend/src/components/planning/DayCell.tsx`
- Modify: `frontend/src/__tests__/DayCell.test.tsx`

### Step 1: Write the failing test

Add to `frontend/src/__tests__/DayCell.test.tsx` — a new `describe` block at the bottom of the file:

```typescript
describe('DayCell full mode custom day icon', () => {
  it('renders Star icon when customDayLabel is present in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayLabel="Ironman"
      />
    )
    // lucide-react Star renders as an SVG
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('does NOT render Star icon when holidayLabel takes precedence', () => {
    const { container } = render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
        customDayLabel="My Event"
      />
    )
    // holiday text renders, no star
    expect(screen.getByText('Christmas')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('does NOT render Star icon in compact mode', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayLabel="Ironman"
        compact={true}
      />
    )
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})
```

### Step 2: Run test — verify it fails

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: FAIL — no SVG found.

### Step 3: Implement — modify DayCell.tsx

**Add `Star` import** (first line of file, alongside memo):

```typescript
import { memo } from 'react'
import { Star } from 'lucide-react'
```

**Replace the full-mode label block** (around line 97-101 in the full mode `return`):

Current code:
```tsx
{label && (
  <span className={`text-[10px] leading-tight mt-1 truncate max-w-[calc(100%-2rem)] text-right ${holidayLabel ? 'text-red-500' : 'text-amber-500'}`}>
    {label}
  </span>
)}
```

Replace with:
```tsx
{holidayLabel && (
  <span className="text-[10px] leading-tight mt-1 truncate max-w-[calc(100%-2rem)] text-right text-red-500">
    {holidayLabel}
  </span>
)}
{customDayLabel && !holidayLabel && (
  <Star className="w-3 h-3 text-amber-500 shrink-0 mt-1" />
)}
```

Note: keep `const label = holidayLabel || customDayLabel` — it is still used in compact mode for the `title` attribute and the `showLabel` branch.

### Step 4: Run test — verify it passes

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/DayCell.test.tsx
```

Expected: all tests PASS.

### Step 5: Type check + lint

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint
```

Expected: no errors.

### Step 6: Commit

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/planning/DayCell.tsx frontend/src/__tests__/DayCell.test.tsx && git commit -m "feat: show Star icon for custom days in DayCell full mode

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2 — Styled overflow pill in MonthView (Feature 2)

**Files:**
- Modify: `frontend/src/components/planning/MonthView.tsx`
- Create: `frontend/src/__tests__/MonthView.test.tsx`

### Step 1: Write the failing test

Create `frontend/src/__tests__/MonthView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MonthView } from '../components/planning/MonthView'
import type { TripSummary } from '../lib/types'

const baseProps = {
  year: 2026,
  month: 0, // January
  trips: [],
  holidays: [],
  customDays: [],
  selectedDate: null,
  selection: null,
  onDragStart: () => {},
  onDragMove: () => {},
  onTripClick: () => {},
}

const makeTrip = (id: string, overrides: Partial<TripSummary> = {}): TripSummary => ({
  id,
  type: 'vacation',
  destination: `Trip ${id}`,
  start_date: '2026-01-05',
  end_date: '2026-01-10',
  status: 'planning',
  notes: null,
  parent_trip_id: null,
  created_at: '2026-01-01T00:00:00Z',
  member_count: 1,
  destination_latitude: null,
  destination_longitude: null,
  member_previews: [],
  itinerary_day_count: 0,
  days_with_activities: 0,
  ...overrides,
})

describe('MonthView overflow indicator', () => {
  it('renders styled pill with rounded-full when more than 3 trips overlap a week', () => {
    const trips = [
      makeTrip('t1'),
      makeTrip('t2'),
      makeTrip('t3'),
      makeTrip('t4'),
    ]
    const { container } = render(<MonthView {...baseProps} trips={trips} />)
    const pill = container.querySelector('.rounded-full')
    expect(pill).toBeInTheDocument()
    expect(pill?.textContent).toMatch(/\+1 more/)
  })

  it('does not render overflow pill when 3 or fewer trips overlap', () => {
    const trips = [makeTrip('t1'), makeTrip('t2'), makeTrip('t3')]
    const { container } = render(<MonthView {...baseProps} trips={trips} />)
    expect(container.querySelector('.rounded-full')).not.toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  it('overflow pill has bg-cloud-100 class', () => {
    const trips = [makeTrip('t1'), makeTrip('t2'), makeTrip('t3'), makeTrip('t4')]
    const { container } = render(<MonthView {...baseProps} trips={trips} />)
    const pill = container.querySelector('.bg-cloud-100')
    expect(pill).toBeInTheDocument()
  })
})
```

### Step 2: Run test — verify it fails

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/MonthView.test.tsx
```

Expected: FAIL — no `.rounded-full` element found.

### Step 3: Implement — modify MonthView.tsx

Find the overflow span (around line 182-189 in `MonthView.tsx`):

Current:
```tsx
{weekTrips.length > 3 && (
  <span
    className="absolute right-1 text-[10px] text-cloud-500"
    style={{ bottom: '2px' }}
  >
    +{weekTrips.length - 3} more
  </span>
)}
```

Replace with:
```tsx
{weekTrips.length > 3 && (
  <span className="absolute right-1 bottom-0.5 bg-cloud-100 text-cloud-500 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
    +{weekTrips.length - 3} more
  </span>
)}
```

### Step 4: Run test — verify it passes

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/MonthView.test.tsx
```

Expected: all PASS.

### Step 5: Type check + lint

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint
```

### Step 6: Commit

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/planning/MonthView.tsx frontend/src/__tests__/MonthView.test.tsx && git commit -m "feat: styled overflow pill for +N more trips in MonthView

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3 — Year view inventory highlight on grid (Feature 3)

**Files:**
- Modify: `frontend/src/components/planning/YearView.tsx`
- Modify: `frontend/src/components/planning/TripSpan.tsx`
- Modify: `frontend/src/__tests__/YearView.test.tsx`

### Step 1: Write the failing tests

**Replace** the last test in `frontend/src/__tests__/YearView.test.tsx` (the one that asserts `onTripClick` is called from inventory) with:

Remove this test (lines 136-144):
```typescript
it('calls onTripClick when a trip row in the inventory panel is clicked', async () => {
  // ...
})
```

Add in its place at the bottom of the file:
```typescript
describe('YearView inventory highlight', () => {
  it('does NOT call onTripClick when inventory panel trip is clicked', async () => {
    const user = userEvent.setup()
    const onTripClick = vi.fn()
    const trips = [makeTripSummary({ destination: 'Rome' })]
    render(<YearView {...baseProps} trips={trips} onTripClick={onTripClick} />)
    const romeButtons = screen.getAllByRole('button', { name: /rome/i })
    await user.click(romeButtons[0])
    // Inventory click should NOT open sidebar — no onTripClick call
    expect(onTripClick).not.toHaveBeenCalled()
  })

  it('grid bar click still calls onTripClick', async () => {
    const user = userEvent.setup()
    const onTripClick = vi.fn()
    const trips = [makeTripSummary({ destination: 'Paris', start_date: '2026-06-01', end_date: '2026-06-07' })]
    render(<YearView {...baseProps} trips={trips} onTripClick={onTripClick} />)
    // The grid bar is a button with title containing the destination
    const gridBars = screen.getAllByRole('button', { name: /paris/i })
    // There may be multiple — the last one clicked should be from the grid, not inventory
    // We just verify at least one triggers onTripClick
    await user.click(gridBars[gridBars.length - 1])
    expect(onTripClick).toHaveBeenCalledWith(expect.objectContaining({ destination: 'Paris' }))
  })
})
```

### Step 2: Run test — verify it fails

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: FAIL — `onTripClick` is still called from inventory.

### Step 3: Implement TripSpan changes

**Modify `frontend/src/components/planning/TripSpan.tsx`:**

Add `useEffect` to imports:
```typescript
import { useState, useEffect } from 'react'
```

Add `isHighlighted` to the interface:
```typescript
interface TripSpanProps {
  // ...existing props...
  isHighlighted?: boolean
}
```

Add `isHighlighted` to the destructured params (in the `export function TripSpan({...})` signature).

Add one-shot pulse logic inside the component body (before the first `if` statement):
```typescript
const [pulsing, setPulsing] = useState(false)

useEffect(() => {
  if (isHighlighted) {
    setPulsing(true)
    const timer = setTimeout(() => setPulsing(false), 1000)
    return () => clearTimeout(timer)
  }
}, [isHighlighted])
```

For the `small`/`medium` size `<button>`, add ring classes:
```tsx
className={`absolute left-0 ${heightClass} rounded-full cursor-pointer transition-colors ${colorClasses}${isHighlighted ? ` ring-2 ring-indigo-500 ring-offset-1${pulsing ? ' animate-pulse' : ''}` : ''}`}
```

For the full-size `<button>`, add ring classes similarly:
```tsx
className={`absolute left-0 h-5 rounded-sm text-[11px] font-medium px-1.5 truncate cursor-pointer transition-colors ${colorClasses}${isHighlighted ? ` ring-2 ring-indigo-500 ring-offset-1${pulsing ? ' animate-pulse' : ''}` : ''}`}
```

### Step 4: Implement YearView changes

**Modify `frontend/src/components/planning/YearView.tsx`:**

**Add imports** at the top:
```typescript
import { useMemo, useState, useRef } from 'react'
```

**Add state and ref** inside the `YearView` function body (after the existing `useMemo` calls):
```typescript
const [highlightedTripId, setHighlightedTripId] = useState<string | null>(null)
const monthRefs = useRef<(HTMLDivElement | null)[]>(Array(12).fill(null))
```

**Add the internal inventory click handler:**
```typescript
function handleInventoryTripClick(trip: TripSummary) {
  if (highlightedTripId === trip.id) {
    setHighlightedTripId(null)
  } else {
    setHighlightedTripId(trip.id)
    const month = new Date(trip.start_date + 'T00:00:00').getMonth()
    monthRefs.current[month]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}
```

**Attach ref to month container div.** Change line 134:
```tsx
// Before:
<div key={month}>

// After:
<div key={month} ref={(el) => { monthRefs.current[month] = el }}>
```

**Pass `isHighlighted` to each `TripSpan` in the grid** (around line 185-199). The `TripSpan` inside the grid `weekTrips.map`:
```tsx
<TripSpan
  key={trip.id}
  destination={trip.destination}
  status={trip.status}
  colorBy="type"
  tripType={trip.type}
  startCol={startCol}
  colSpan={colSpan}
  stackIndex={tripIdx}
  size="medium"
  startDate={trip.start_date}
  endDate={trip.end_date}
  isHighlighted={trip.id === highlightedTripId}
  onClick={() => onTripClick(trip)}
/>
```

**Change inventory button `onClick`** (around line 236-251). Replace `onClick={() => onTripClick(trip)}` with:
```tsx
onClick={() => handleInventoryTripClick(trip)}
```

### Step 5: Run tests — verify they pass

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/YearView.test.tsx
```

Expected: all tests PASS.

### Step 6: Type check + lint + all tests

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: no errors, all tests pass.

### Step 7: Commit

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/components/planning/YearView.tsx frontend/src/components/planning/TripSpan.tsx frontend/src/__tests__/YearView.test.tsx && git commit -m "feat: year view inventory click highlights trip on grid with ring and scroll

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4 — Itinerary DnD: precise drop zones + glitch fixes (Feature 4)

**Files:**
- Modify: `frontend/src/hooks/useItinerary.ts`
- Modify: `frontend/src/components/itinerary/ActivityItem.tsx`
- Modify: `frontend/src/components/itinerary/ItineraryTimeline.tsx`

### Step 1: Fix ActivityItem (opacity + transform)

**Modify `frontend/src/components/itinerary/ActivityItem.tsx`:**

Change (around line 37-41):
```typescript
// Before:
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
}

// After:
const style = {
  transform: CSS.Translate.toString(transform),
  transition,
  opacity: isDragging ? 0 : 1,
}
```

### Step 2: Extend useMoveActivity to accept sort_order

**Modify `frontend/src/hooks/useItinerary.ts`** — the `useMoveActivity` function (around line 136-165):

Change the `mutationFn` type and implementation:
```typescript
// Before:
mutationFn: async ({ activityId, targetDayId }: { activityId: string; targetDayId: string }) => {
  const { data: activity } = await itineraryApi.updateActivity(activityId, { itinerary_day_id: targetDayId })
  return activity
},
onMutate: async ({ activityId, targetDayId }) => {

// After:
mutationFn: async ({ activityId, targetDayId, sort_order }: { activityId: string; targetDayId: string; sort_order?: number }) => {
  const payload: { itinerary_day_id: string; sort_order?: number } = { itinerary_day_id: targetDayId }
  if (sort_order !== undefined) payload.sort_order = sort_order
  const { data: activity } = await itineraryApi.updateActivity(activityId, payload)
  return activity
},
onMutate: async ({ activityId, targetDayId }) => {
```

### Step 3: Write failing tests for ItineraryTimeline DnD

Check if there is an existing ItineraryTimeline test file:
```bash
ls /Users/nick/Code/travel-planner/frontend/src/__tests__/
```

Look for `ItineraryTimeline.test.tsx`. If it does not exist, create it. If it exists, add to it.

Create `frontend/src/__tests__/ItineraryTimeline.test.tsx` if not present:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ItineraryTimeline } from '../components/itinerary/ItineraryTimeline'
import type { ItineraryDay, Activity } from '../lib/types'

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
}

const baseDay: ItineraryDay = {
  id: 'day-1',
  trip_id: 'trip-1',
  date: '2026-06-01',
  notes: null,
  activity_count: 0,
}

const makeActivity = (id: string, sort_order: number): Activity => ({
  id,
  itinerary_day_id: 'day-1',
  title: `Activity ${id}`,
  category: 'activity',
  start_time: null,
  end_time: null,
  location: null,
  latitude: null,
  longitude: null,
  notes: null,
  confirmation_number: null,
  sort_order,
  check_out_date: null,
  source: 'manual',
})

describe('ItineraryTimeline drag indicator', () => {
  it('renders activities for a day', () => {
    render(
      <Wrapper>
        <ItineraryTimeline
          days={[baseDay]}
          allActivities={[makeActivity('a1', 0), makeActivity('a2', 1)]}
          tripId="trip-1"
        />
      </Wrapper>
    )
    expect(screen.getByText('Activity a1')).toBeInTheDocument()
    expect(screen.getByText('Activity a2')).toBeInTheDocument()
  })

  it('renders empty drop zone when day has no activities', () => {
    const { container } = render(
      <Wrapper>
        <ItineraryTimeline
          days={[baseDay]}
          allActivities={[]}
          tripId="trip-1"
        />
      </Wrapper>
    )
    // EmptyDayDropZone renders a dashed border element
    const dropZone = container.querySelector('.border-dashed')
    expect(dropZone).toBeInTheDocument()
  })
})
```

### Step 4: Run tests — verify they pass (not failing, just green baseline)

```bash
cd /Users/nick/Code/travel-planner/frontend && npx vitest run src/__tests__/ItineraryTimeline.test.tsx
```

Expected: PASS (these are baseline tests, not testing DnD interactions directly since DnD requires pointer events).

### Step 5: Implement ItineraryTimeline — insertionPoint state and onDragOver

**Modify `frontend/src/components/itinerary/ItineraryTimeline.tsx`:**

**Update imports** — add `DragOverEvent` and `type DragCancelEvent`:
```typescript
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
```

**Add `insertionPoint` state** inside `ItineraryTimeline` component (after `activeId` state):
```typescript
const [insertionPoint, setInsertionPoint] = useState<{
  dayId: string
  beforeActivityId: string | null
} | null>(null)
```

**Add `handleDragOver` function** (after `handleDragStart`):
```typescript
function handleDragOver(event: DragOverEvent) {
  const { active, over } = event
  if (!over) {
    setInsertionPoint(null)
    return
  }

  const overId = String(over.id)

  if (overId.startsWith('empty-')) {
    setInsertionPoint({ dayId: overId.replace('empty-', ''), beforeActivityId: null })
    return
  }
  if (overId.startsWith('day-')) {
    setInsertionPoint({ dayId: overId.replace('day-', ''), beforeActivityId: null })
    return
  }

  // Hovered over another activity — use top/bottom half to decide insert position
  const overActivity = allActivities.find((a) => a.id === overId)
  if (!overActivity) return

  const activeCenterY =
    (active.rect.current.translated?.top ?? 0) +
    (active.rect.current.translated?.height ?? 0) / 2
  const overMidY = over.rect.top + over.rect.height / 2

  if (activeCenterY < overMidY) {
    // Top half — insert before this activity
    setInsertionPoint({ dayId: overActivity.itinerary_day_id, beforeActivityId: overActivity.id })
  } else {
    // Bottom half — insert after this activity (= before the next one)
    const dayActs = activitiesByDay.get(overActivity.itinerary_day_id) ?? []
    const overIdx = dayActs.findIndex((a) => a.id === overActivity.id)
    const nextActivity = dayActs[overIdx + 1]
    setInsertionPoint({
      dayId: overActivity.itinerary_day_id,
      beforeActivityId: nextActivity ? nextActivity.id : null,
    })
  }
}
```

**Update `handleDragEnd`** — clear `insertionPoint` and use it for precise positioning:

Replace the current `handleDragEnd` with:
```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  const savedInsertionPoint = insertionPoint
  setActiveId(null)
  setInsertionPoint(null)
  if (!over) return

  const draggedActivity = allActivities.find((a) => a.id === active.id)
  if (!draggedActivity) return

  const sourceDayId = draggedActivity.itinerary_day_id
  const overId = String(over.id)

  let targetDayId: string
  if (overId.startsWith('empty-')) {
    targetDayId = overId.replace('empty-', '')
  } else if (overId.startsWith('day-')) {
    targetDayId = overId.replace('day-', '')
  } else {
    const overActivity = allActivities.find((a) => a.id === overId)
    if (!overActivity) return
    targetDayId = overActivity.itinerary_day_id
  }

  if (sourceDayId === targetDayId) {
    const dayActs = activitiesByDay.get(sourceDayId) ?? []
    if (savedInsertionPoint && savedInsertionPoint.dayId === sourceDayId) {
      // Precise within-day reorder using insertion point
      const withoutDragged = dayActs.filter((a) => a.id !== String(active.id))
      const insertIdx = savedInsertionPoint.beforeActivityId
        ? withoutDragged.findIndex((a) => a.id === savedInsertionPoint.beforeActivityId)
        : withoutDragged.length
      const newOrder = [...withoutDragged]
      newOrder.splice(insertIdx === -1 ? newOrder.length : insertIdx, 0, draggedActivity)
      reorderActivities.mutate({ dayId: sourceDayId, activityIds: newOrder.map((a) => a.id) })
    } else {
      // Fallback: closestCenter index swap
      const oldIndex = dayActs.findIndex((a) => a.id === active.id)
      const newIndex = dayActs.findIndex((a) => a.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      const reordered = [...dayActs]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      reorderActivities.mutate({ dayId: sourceDayId, activityIds: reordered.map((a) => a.id) })
    }
  } else {
    // Cross-day move with computed sort_order
    const targetActs = activitiesByDay.get(targetDayId) ?? []
    let sort_order: number
    if (savedInsertionPoint && savedInsertionPoint.dayId === targetDayId) {
      if (savedInsertionPoint.beforeActivityId === null) {
        sort_order = targetActs.length > 0 ? targetActs[targetActs.length - 1].sort_order + 1 : 0
      } else {
        const targetIdx = targetActs.findIndex((a) => a.id === savedInsertionPoint.beforeActivityId)
        sort_order = targetIdx >= 0 ? targetActs[targetIdx].sort_order : targetActs.length
      }
    } else {
      sort_order = targetActs.length > 0 ? targetActs[targetActs.length - 1].sort_order + 1 : 0
    }
    moveActivity.mutate({ activityId: String(active.id), targetDayId, sort_order })
  }
}
```

**Add `onDragOver` and `onDragCancel` to `DndContext`:**
```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
  onDragCancel={() => { setActiveId(null); setInsertionPoint(null) }}
>
```

### Step 6: Add the between-item drop indicator to the render

Inside the `days.map`, replace the activities render block. Currently activities are rendered inside `DroppableDay` → `SortableContext`. Add the drop line between items.

Find the render of `ActivityItem` inside the `SortableContext`. Wrap the activities in a `Fragment`-based render with the drop indicator:

The existing render looks approximately like:
```tsx
<DroppableDay dayId={day.id} hasActivities={dayActs.length > 0}>
  <SortableContext items={dayActs.map((a) => a.id)} strategy={verticalListSortingStrategy}>
    {dayActs.map((act) => <ActivityItem key={act.id} activity={act} tripId={tripId} />)}
  </SortableContext>
  {dayActs.length === 0 && <EmptyDayDropZone dayId={day.id} />}
</DroppableDay>
```

Change to:
```tsx
<DroppableDay dayId={day.id} hasActivities={dayActs.length > 0}>
  <SortableContext items={dayActs.map((a) => a.id)} strategy={verticalListSortingStrategy}>
    {dayActs.map((act, idx) => {
      const nextAct = dayActs[idx + 1]
      const showLineBefore =
        insertionPoint?.dayId === day.id &&
        insertionPoint.beforeActivityId === act.id
      const showLineAfter =
        insertionPoint?.dayId === day.id &&
        !nextAct &&
        insertionPoint.beforeActivityId === null
      const showLineBetween =
        insertionPoint?.dayId === day.id &&
        nextAct &&
        insertionPoint.beforeActivityId === nextAct.id
      return (
        <div key={act.id}>
          {showLineBefore && (
            <div className="h-0.5 bg-indigo-400 rounded mx-1 my-0.5" />
          )}
          <ActivityItem activity={act} tripId={tripId} />
          {showLineBetween && (
            <div className="h-0.5 bg-indigo-400 rounded mx-1 my-0.5" />
          )}
          {showLineAfter && (
            <div className="h-0.5 bg-indigo-400 rounded mx-1 my-0.5" />
          )}
        </div>
      )
    })}
  </SortableContext>
  {dayActs.length === 0 && <EmptyDayDropZone dayId={day.id} />}
</DroppableDay>
```

Note: `showLineBefore` handles the case of inserting before the first item. `showLineBetween` handles between-item. `showLineAfter` handles the trailing indicator after the last item.

### Step 7: Run all tests + type check + lint

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all pass, no type errors, no lint errors.

### Step 8: Commit

```bash
cd /Users/nick/Code/travel-planner && git add frontend/src/hooks/useItinerary.ts frontend/src/components/itinerary/ActivityItem.tsx frontend/src/components/itinerary/ItineraryTimeline.tsx frontend/src/__tests__/ItineraryTimeline.test.tsx && git commit -m "feat: precise DnD drop zones with insertion indicator, fix opacity and transform glitches

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final verification

Run full test suite after all tasks:

```bash
cd /Users/nick/Code/travel-planner/frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all tests pass, no type errors, no lint errors.
