import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCalendarYear, useCreatePlan, useCreateBlock, useUpdateBlock, useDeleteBlock } from '../hooks/useCalendar'
import { AnnualCalendar } from '../components/calendar/AnnualCalendar'
import { CreateBlockModal } from '../components/calendar/CreateBlockModal'
import type { CreateCalendarBlock } from '../lib/types'

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-stone-200 rounded w-32" />
        <div className="h-10 bg-stone-200 rounded w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-48 bg-stone-200 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function CalendarPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [showCreateBlock, setShowCreateBlock] = useState(false)
  const [selectedDates, setSelectedDates] = useState<{ start: string; end: string } | null>(null)

  const { data: calendarData, isLoading, error } = useCalendarYear(year)
  const createPlan = useCreatePlan(year)
  const createBlock = useCreateBlock(year)
  const updateBlock = useUpdateBlock(year)
  const deleteBlock = useDeleteBlock(year)

  const handleEnsurePlan = async () => {
    if (!calendarData?.plan) {
      await createPlan.mutateAsync({ year })
    }
  }

  const handleCreateBlock = async (blockData: Omit<CreateCalendarBlock, 'annual_plan_id'>) => {
    await handleEnsurePlan()
    const planId = calendarData?.plan?.id || createPlan.data?.id
    if (!planId) return

    await createBlock.mutateAsync({
      ...blockData,
      annual_plan_id: planId,
    })
    setShowCreateBlock(false)
    setSelectedDates(null)
  }

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock.mutateAsync(blockId)
  }

  if (isLoading) return <CalendarSkeleton />

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        Failed to load calendar data. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Previous year"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-stone-900 tabular-nums">{year}</h1>
          <button
            onClick={() => setYear(y => y + 1)}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Next year"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => setShowCreateBlock(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Block
        </button>
      </div>

      <AnnualCalendar
        year={year}
        blocks={calendarData?.blocks ?? []}
        trips={calendarData?.trips ?? []}
        onDeleteBlock={handleDeleteBlock}
        onDateSelect={(start, end) => {
          setSelectedDates({ start, end })
          setShowCreateBlock(true)
        }}
      />

      <CreateBlockModal
        isOpen={showCreateBlock}
        onClose={() => {
          setShowCreateBlock(false)
          setSelectedDates(null)
        }}
        onSubmit={handleCreateBlock}
        initialDates={selectedDates}
      />
    </div>
  )
}
