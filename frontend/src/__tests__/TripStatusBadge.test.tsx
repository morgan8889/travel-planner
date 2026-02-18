import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TripStatusBadge } from '../components/trips/TripStatusBadge'
import type { TripStatus } from '../lib/types'

describe('TripStatusBadge', () => {
  const statuses: { value: TripStatus; label: string; colorClass: string }[] = [
    { value: 'dreaming', label: 'Dreaming', colorClass: 'bg-[#F0EDFF]' },
    { value: 'planning', label: 'Planning', colorClass: 'bg-[#FFF7ED]' },
    { value: 'booked', label: 'Booked', colorClass: 'bg-[#EEF2FF]' },
    { value: 'active', label: 'Active', colorClass: 'bg-[#F0FDF4]' },
    { value: 'completed', label: 'Completed', colorClass: 'bg-[#F3F4F6]' },
  ]

  statuses.forEach(({ value, label, colorClass }) => {
    it(`renders "${label}" for status "${value}"`, () => {
      render(<TripStatusBadge status={value} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })

    it(`has correct color class for status "${value}"`, () => {
      render(<TripStatusBadge status={value} />)
      const badge = screen.getByTestId('trip-status-badge')
      expect(badge.className).toContain(colorClass)
    })
  })
})
