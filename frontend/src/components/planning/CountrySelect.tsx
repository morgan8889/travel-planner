import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SupportedCountry } from '../../lib/types'

interface CountrySelectProps {
  supportedCountries: SupportedCountry[]
  enabledCodes: string[]
  onToggle: (code: string) => void
}

// Fixed order: US first, UK second, then alphabetical by code
function sortCountries(countries: SupportedCountry[]): SupportedCountry[] {
  return [...countries].sort((a, b) => {
    if (a.code === 'US') return -1
    if (b.code === 'US') return 1
    if (a.code === 'UK') return -1
    if (b.code === 'UK') return 1
    return a.code.localeCompare(b.code)
  })
}

export function CountrySelect({ supportedCountries, enabledCodes, onToggle }: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const sorted = sortCountries(supportedCountries)
  const label = enabledCodes.length > 0 ? enabledCodes.join(', ') : 'None'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-cloud-700 bg-white border border-cloud-200 rounded-lg hover:bg-cloud-50 transition-colors"
      >
        <span className="text-cloud-500 mr-0.5">Holidays:</span>
        <span className="max-w-[8rem] truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-cloud-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-cloud-200 rounded-xl shadow-lg z-50 py-1">
          {sorted.map((c) => (
            <label
              key={c.code}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-cloud-50 cursor-pointer text-sm text-cloud-700"
            >
              <input
                type="checkbox"
                checked={enabledCodes.includes(c.code)}
                onChange={() => onToggle(c.code)}
                className="rounded border-cloud-300 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span className="font-medium">{c.code}</span>
              <span className="text-cloud-500">{c.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
