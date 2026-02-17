import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TripStatusBadge } from '../components/trips/TripStatusBadge'
import type { TripStatus } from '../lib/types'

describe('TripStatusBadge', () => {
  const statuses: { value: TripStatus; label: string; colorClass: string }[] = [
    { value: 'dreaming', label: 'Dreaming', colorClass: 'bg-purple-50' },
    { value: 'planning', label: 'Planning', colorClass: 'bg-amber-50' },
    { value: 'booked', label: 'Booked', colorClass: 'bg-blue-50' },
    { value: 'active', label: 'Active', colorClass: 'bg-green-50' },
    { value: 'completed', label: 'Completed', colorClass: 'bg-gray-50' },
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
