import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useSupportedCountries, useEnableCountry, useDisableCountry } from '../../hooks/useHolidays'
import { CountrySelect } from './CountrySelect'
import type { HolidayCalendarEntry } from '../../lib/types'

export type ZoomLevel = 'month' | 'quarter' | 'year'

interface PlanningHeaderProps {
  zoomLevel: ZoomLevel
  onZoomChange: (level: ZoomLevel) => void
  /** For month: "February 2026", for quarter: "Q1 2026", for year: "2026" */
  periodLabel: string
  onPrev: () => void
  onNext: () => void
  year: number
  enabledCountries: HolidayCalendarEntry[]
  onAddCustomDay: () => void
}

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

export function PlanningHeader({
  zoomLevel,
  onZoomChange,
  periodLabel,
  onPrev,
  onNext,
  year,
  enabledCountries,
  onAddCustomDay,
}: PlanningHeaderProps) {
  const { data: supportedCountries } = useSupportedCountries()
  const enableCountry = useEnableCountry(year)
  const disableCountry = useDisableCountry(year)

  const enabledCodes = enabledCountries.map((c) => c.country_code)

  const handleCountryToggle = async (code: string) => {
    if (enabledCodes.includes(code)) {
      await disableCountry.mutateAsync(code)
    } else {
      await enableCountry.mutateAsync(code)
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {/* Zoom toggle */}
        <div className="flex rounded-lg border border-cloud-200 overflow-hidden">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onZoomChange(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors
                ${zoomLevel === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-cloud-600 hover:bg-cloud-50'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-1.5 text-cloud-400 hover:text-cloud-600 hover:bg-cloud-100 rounded-lg transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold text-cloud-900 min-w-[10rem] text-center tabular-nums">
            {periodLabel}
          </span>
          <button
            onClick={onNext}
            className="p-1.5 text-cloud-400 hover:text-cloud-600 hover:bg-cloud-100 rounded-lg transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Country holiday toggles */}
        {supportedCountries && (
          <CountrySelect
            supportedCountries={supportedCountries}
            enabledCodes={enabledCodes}
            onToggle={handleCountryToggle}
          />
        )}

        {/* Add custom day */}
        <button
          onClick={onAddCustomDay}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Day
        </button>
      </div>
    </div>
  )
}
