import { useState, useCallback } from 'react'
import { TriangleAlert, CalendarPlus } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { PlanningHeader, type ZoomLevel } from '../components/planning/PlanningHeader'
import { MonthView } from '../components/planning/MonthView'
import { QuarterView } from '../components/planning/QuarterView'
import { YearView } from '../components/planning/YearView'
import { PlanSidebar } from '../components/planning/PlanSidebar'
import { SidebarTripDetail } from '../components/planning/SidebarTripDetail'
import { SidebarTripCreate } from '../components/planning/SidebarTripCreate'
import { SidebarHolidayDetail } from '../components/planning/SidebarHolidayDetail'
import { SidebarCustomDayForm } from '../components/planning/SidebarCustomDayForm'
import { TripSummaryBar } from '../components/planning/TripSummaryBar'
import { useDragSelect } from '../components/planning/useDragSelect'
import { useTrips, useDeleteTrip } from '../hooks/useTrips'
import { useHolidays } from '../hooks/useHolidays'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import type { TripSummary } from '../lib/types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type SidebarContent =
  | { type: 'trip-detail'; trip: TripSummary }
  | { type: 'trip-create'; startDate: string; endDate: string }
  | { type: 'holiday'; name: string; date: string; countryCode: string }
  | { type: 'custom-day-form' }

export function PlanningCenterPage() {
  const now = new Date()
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month')
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [sidebarContent, setSidebarContent] = useState<SidebarContent | null>(null)

  const { selection, isDragging, onDragStart, onDragMove, onDragEnd, clearSelection } = useDragSelect()
  const { data: trips, isLoading: tripsLoading, isError: tripsError, refetch: refetchTrips } = useTrips()
  const { data: holidayData, isLoading: holidaysLoading, isError: holidaysError, refetch: refetchHolidays } = useHolidays(currentYear)
  const deleteTrip = useDeleteTrip()

  const currentQuarter = Math.floor(currentMonth / 3)

  const closeSidebar = useCallback(() => {
    setSidebarContent(null)
    clearSelection()
  }, [clearSelection])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    const result = onDragEnd()
    if (result && result.startDate !== result.endDate) {
      setSidebarContent({ type: 'trip-create', startDate: result.startDate, endDate: result.endDate })
    } else if (result) {
      setSidebarContent({ type: 'trip-create', startDate: result.startDate, endDate: result.startDate })
    }
  }, [isDragging, onDragEnd])

  const handleTripClick = useCallback((trip: TripSummary) => {
    setSidebarContent({ type: 'trip-detail', trip })
  }, [])

  const handleDayClick = useCallback((date: string) => {
    setSidebarContent({ type: 'trip-create', startDate: date, endDate: date })
  }, [])

  const handleDeleteTrip = useCallback(async (tripId: string) => {
    await deleteTrip.mutateAsync(tripId)
    closeSidebar()
  }, [deleteTrip, closeSidebar])

  const handleMonthClick = useCallback((month: number) => {
    setCurrentMonth(month)
    setZoomLevel('month')
  }, [setCurrentMonth, setZoomLevel])

  // Navigation
  const handlePrev = () => {
    if (zoomLevel === 'month') {
      if (currentMonth === 0) {
        setCurrentMonth(11)
        setCurrentYear((y) => y - 1)
      } else {
        setCurrentMonth((m) => m - 1)
      }
    } else if (zoomLevel === 'quarter') {
      if (currentQuarter === 0) {
        setCurrentMonth(9) // Q4 of prev year
        setCurrentYear((y) => y - 1)
      } else {
        setCurrentMonth((currentQuarter - 1) * 3)
      }
    } else {
      setCurrentYear((y) => y - 1)
    }
  }

  const handleNext = () => {
    if (zoomLevel === 'month') {
      if (currentMonth === 11) {
        setCurrentMonth(0)
        setCurrentYear((y) => y + 1)
      } else {
        setCurrentMonth((m) => m + 1)
      }
    } else if (zoomLevel === 'quarter') {
      if (currentQuarter === 3) {
        setCurrentMonth(0) // Q1 of next year
        setCurrentYear((y) => y + 1)
      } else {
        setCurrentMonth((currentQuarter + 1) * 3)
      }
    } else {
      setCurrentYear((y) => y + 1)
    }
  }

  const periodLabel = (() => {
    if (zoomLevel === 'month') return `${MONTH_NAMES[currentMonth]} ${currentYear}`
    if (zoomLevel === 'quarter') return `Q${currentQuarter + 1} ${currentYear}`
    return String(currentYear)
  })()

  if (tripsLoading || holidaysLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  if (tripsError || holidaysError) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-50 to-red-100/80 ring-1 ring-red-200/50 mb-4">
          <TriangleAlert className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-cloud-600 mb-4">Something went wrong loading your planning data.</p>
        <button
          onClick={() => { void refetchTrips(); void refetchHolidays() }}
          className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  const allTrips = trips ?? []
  const allHolidays = holidayData?.holidays ?? []
  const allCustomDays = holidayData?.custom_days ?? []
  const enabledCountries = holidayData?.enabled_countries ?? []

  return (
    <div
      className="space-y-4"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <PlanningHeader
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        periodLabel={periodLabel}
        onPrev={handlePrev}
        onNext={handleNext}
        year={currentYear}
        enabledCountries={enabledCountries}
        onAddCustomDay={() => setSidebarContent({ type: 'custom-day-form' })}
      />

      <TripSummaryBar trips={allTrips} onTripClick={handleTripClick} />

      {allTrips.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700">
          <CalendarPlus className="w-4 h-4 shrink-0" />
          <span>No trips planned yet. Drag on the calendar to create one, or </span>
          <Link to="/trips/new" className="font-medium underline underline-offset-2 hover:text-indigo-900">
            add a trip
          </Link>
          <span>.</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-cloud-200 shadow-sm overflow-hidden">
        {zoomLevel === 'month' && (
          <MonthView
            year={currentYear}
            month={currentMonth}
            trips={allTrips}
            holidays={allHolidays}
            customDays={allCustomDays}
            selection={selection}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onTripClick={handleTripClick}
          />
        )}
        {zoomLevel === 'quarter' && (
          <QuarterView
            year={currentYear}
            quarter={currentQuarter}
            trips={allTrips}
            holidays={allHolidays}
            customDays={allCustomDays}
            onMonthClick={handleMonthClick}
            onDayClick={handleDayClick}
            onTripClick={handleTripClick}
          />
        )}
        {zoomLevel === 'year' && (
          <YearView
            year={currentYear}
            trips={allTrips}
            holidays={allHolidays}
            customDays={allCustomDays}
            onMonthClick={handleMonthClick}
            onDayClick={handleDayClick}
            onTripClick={handleTripClick}
          />
        )}
      </div>

      <PlanSidebar isOpen={sidebarContent !== null} onClose={closeSidebar}>
        {sidebarContent?.type === 'trip-detail' && (
          <SidebarTripDetail
            trip={sidebarContent.trip}
            onDelete={handleDeleteTrip}
          />
        )}
        {sidebarContent?.type === 'trip-create' && (
          <SidebarTripCreate
            startDate={sidebarContent.startDate}
            endDate={sidebarContent.endDate}
            onCreated={closeSidebar}
          />
        )}
        {sidebarContent?.type === 'holiday' && (
          <SidebarHolidayDetail
            name={sidebarContent.name}
            date={sidebarContent.date}
            countryCode={sidebarContent.countryCode}
          />
        )}
        {sidebarContent?.type === 'custom-day-form' && (
          <SidebarCustomDayForm
            year={currentYear}
            onCreated={closeSidebar}
          />
        )}
      </PlanSidebar>
    </div>
  )
}
