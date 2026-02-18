import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { geocodeApi } from '../../lib/api'
import type { GeocodeSuggestion } from '../../lib/types'

interface LocationAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: GeocodeSuggestion) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function LocationAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder = 'Search for a place…',
  disabled = false,
  required = false,
  className = '',
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await geocodeApi.search(query)
      setSuggestions(data)
      setOpen(data.length > 0)
    } catch {
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    onChange(suggestion.place_name)
    onSelect(suggestion)
    setSuggestions([])
    setOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cloud-400 pointer-events-none" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
          className={`w-full pl-9 pr-9 py-2 border border-cloud-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white placeholder:text-cloud-400 text-cloud-800 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cloud-400 animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-cloud-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-cloud-50 transition-colors"
                onClick={() => handleSelect(s)}
              >
                <MapPin className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-cloud-800 leading-tight">
                    {s.place_name.split(',')[0]}
                  </p>
                  {s.context && (
                    <p className="text-xs text-cloud-500 mt-0.5">{s.context}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
