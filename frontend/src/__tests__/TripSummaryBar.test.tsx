import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TripSummaryBar } from '../components/planning/TripSummaryBar'
import type { TripSummary } from '../lib/types'

const mockTrips: TripSummary[] = [
  {
    id: '1', destination: 'Paris', status: 'planning',
    start_date: '2026-03-05', end_date: '2026-03-12',
    type: 'vacation', member_count: 1,
    destination_latitude: null, destination_longitude: null,
    notes: null, parent_trip_id: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2', destination: 'Tokyo', status: 'booked',
    start_date: '2026-06-01', end_date: '2026-06-15',
    type: 'vacation', member_count: 2,
    destination_latitude: null, destination_longitude: null,
    notes: null, parent_trip_id: null,
    created_at: '2026-01-01T00:00:00Z',
  },
]

describe('TripSummaryBar', () => {
  it('renders trip chips with destination and dates', () => {
    render(<TripSummaryBar trips={mockTrips} onTripClick={vi.fn()} />)
    expect(screen.getByText(/Paris/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument()
  })

  it('calls onTripClick when a chip is clicked', () => {
    const onClick = vi.fn()
    render(<TripSummaryBar trips={mockTrips} onTripClick={onClick} />)
    fireEvent.click(screen.getByText(/Paris/))
    expect(onClick).toHaveBeenCalledWith(mockTrips[0])
  })

  it('renders nothing when no trips', () => {
    const { container } = render(<TripSummaryBar trips={[]} onTripClick={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
