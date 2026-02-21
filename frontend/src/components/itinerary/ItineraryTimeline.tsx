import { useState, useMemo, type ReactNode } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
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
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ItineraryDay, Activity } from '../../lib/types'
import {
  useMoveActivity,
  useReorderActivitiesForDay,
  useCreateActivityInDay,
  useDeleteDay,
} from '../../hooks/useItinerary'
import { ActivityItem } from './ActivityItem'
import { ActivityDragCard } from './ActivityDragCard'
import { ActivityForm } from './ActivityForm'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface ItineraryTimelineProps {
  days: ItineraryDay[]
  allActivities: Activity[]
  tripId: string
}

function EmptyDayDropZone({ dayId }: { dayId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `empty-${dayId}`, data: { dayId } })
  return (
    <div
      ref={setNodeRef}
      className={`h-10 rounded border-2 border-dashed transition-colors ${
        isOver ? 'border-indigo-400 bg-indigo-50' : 'border-cloud-200'
      }`}
    />
  )
}

function DroppableDay({ dayId, hasActivities, children }: { dayId: string; hasActivities: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayId}`, data: { dayId } })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[2.5rem] rounded transition-colors ${isOver && !hasActivities ? 'bg-indigo-50/50' : ''}`}
    >
      {children}
      {isOver && hasActivities && (
        <div
          data-testid="drop-hint"
          className="h-10 rounded border-2 border-dashed border-indigo-400 bg-indigo-50 mt-2 transition-colors"
        />
      )}
    </div>
  )
}

export function ItineraryTimeline({ days, allActivities, tripId }: ItineraryTimelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [insertionPoint, setInsertionPoint] = useState<{
    dayId: string
    beforeActivityId: string | null
  } | null>(null)
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [deletingDayId, setDeletingDayId] = useState<string | null>(null)

  const moveActivity = useMoveActivity(tripId)
  const reorderActivities = useReorderActivitiesForDay(tripId)
  const createActivity = useCreateActivityInDay(tripId)
  const deleteDay = useDeleteDay(tripId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Group activities by day ID, sorted by sort_order
  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of allActivities) {
      const group = map.get(a.itinerary_day_id) ?? []
      group.push(a)
      map.set(a.itinerary_day_id, group)
    }
    for (const [key, acts] of map) {
      map.set(key, [...acts].sort((a, b) => a.sort_order - b.sort_order))
    }
    return map
  }, [allActivities])

  const activeActivity = useMemo(
    () => (activeId ? allActivities.find((a) => a.id === activeId) ?? null : null),
    [activeId, allActivities],
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); setInsertionPoint(null) }}
    >
      <div className="relative ml-4" data-testid="itinerary-timeline">
        {/* Spine line */}
        <div className="absolute left-0 top-2 bottom-2 border-l-2 border-cloud-200" />

        {days.map((day) => {
          const dayActs = activitiesByDay.get(day.id) ?? []
          const formattedDate = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
          const isAdding = expandedDayId === day.id

          return (
            <div key={day.id} className="mb-6">
              {/* Day header */}
              <div className="flex items-center gap-3 mb-2 relative">
                <div className="absolute -left-[1.1875rem] w-3 h-3 rounded-full bg-cloud-300 border-2 border-white flex-shrink-0" />
                <span className="ml-3 text-sm font-semibold text-cloud-700">{formattedDate}</span>
                <div className="flex-1" />
                <button
                  onClick={() => setExpandedDayId(isAdding ? null : day.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  {isAdding ? (
                    <>
                      <X className="w-3 h-3" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      Add activity
                    </>
                  )}
                </button>
                <button
                  onClick={() => setDeletingDayId(day.id)}
                  className="p-1 text-cloud-400 hover:text-red-600 rounded transition-colors"
                  aria-label="Delete day"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Activities list */}
              <div className="ml-6 space-y-2">
                <DroppableDay dayId={day.id} hasActivities={dayActs.length > 0}>
                  <SortableContext
                    items={dayActs.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {dayActs.map((act, idx) => {
                      const showLineBefore =
                        insertionPoint?.dayId === day.id &&
                        insertionPoint.beforeActivityId === act.id &&
                        idx === 0
                      const nextActivity = dayActs[idx + 1]
                      const showLineBetween =
                        insertionPoint?.dayId === day.id &&
                        nextActivity !== undefined &&
                        insertionPoint.beforeActivityId === nextActivity.id
                      const showLineAfter =
                        insertionPoint?.dayId === day.id &&
                        insertionPoint.beforeActivityId === null &&
                        idx === dayActs.length - 1
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
                  {dayActs.length === 0 && !isAdding && (
                    <EmptyDayDropZone dayId={day.id} />
                  )}
                </DroppableDay>
                {isAdding && (
                  <ActivityForm
                    dayId={day.id}
                    tripId={tripId}
                    onSave={async (data) => {
                      await createActivity.mutateAsync({ dayId: day.id, data })
                      setExpandedDayId(null)
                    }}
                    onCancel={() => setExpandedDayId(null)}
                    isPending={createActivity.isPending}
                    error={createActivity.isError ? (createActivity.error as Error) : null}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <DragOverlay>
        {activeActivity && <ActivityDragCard activity={activeActivity} />}
      </DragOverlay>

      <ConfirmDialog
        isOpen={deletingDayId !== null}
        onClose={() => setDeletingDayId(null)}
        onConfirm={() => {
          if (deletingDayId) {
            deleteDay.mutate(deletingDayId)
            setDeletingDayId(null)
          }
        }}
        title="Delete Day"
        message="Delete this day and all its activities?"
        confirmLabel="Delete"
        isLoading={deleteDay.isPending}
      />
    </DndContext>
  )
}
