import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TripSummaryBar } from '../components/planning/TripSummaryBar'
import type { TripSummary, HolidayEntry } from '../lib/types'

const baseMockTrip: TripSummary = {
  id: '1', destination: 'Paris', status: 'planning',
  start_date: '2026-03-05', end_date: '2026-03-12',
  type: 'vacation', member_count: 1,
  destination_latitude: null, destination_longitude: null,
  notes: null, parent_trip_id: null,
  created_at: '2026-01-01T00:00:00Z',
}

const defaultProps = {
  onTripClick: vi.fn(),
  zoomLevel: 'year' as const,
  currentMonth: 0,
  currentYear: 2026,
  holidays: [] as HolidayEntry[],
  customDays: [],
}

describe('TripSummaryBar', () => {
  it('renders trip chips with destination and dates', () => {
    const trips = [
      { ...baseMockTrip, id: '1', destination: 'Paris' },
      { ...baseMockTrip, id: '2', destination: 'Tokyo', start_date: '2026-06-01', end_date: '2026-06-15', status: 'booked' as const },
    ]
    render(<TripSummaryBar {...defaultProps} trips={trips} />)
    expect(screen.getByText(/Paris/)).toBeInTheDocument()
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument()
  })

  it('calls onTripClick when a chip is clicked', () => {
    const onClick = vi.fn()
    const trips = [baseMockTrip]
    render(<TripSummaryBar {...defaultProps} trips={trips} onTripClick={onClick} />)
    fireEvent.click(screen.getByText(/Paris/))
    expect(onClick).toHaveBeenCalledWith(baseMockTrip)
  })

  it('renders nothing when no trips and no holidays in period', () => {
    const { container } = render(<TripSummaryBar {...defaultProps} trips={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('filters trips to the visible month period', () => {
    const trips = [
      { ...baseMockTrip, id: '1', destination: 'Paris', start_date: '2026-03-05', end_date: '2026-03-12' },
      { ...baseMockTrip, id: '2', destination: 'Tokyo', start_date: '2026-06-01', end_date: '2026-06-15' },
    ]
    render(
      <TripSummaryBar
        {...defaultProps}
        trips={trips}
        zoomLevel="month"
        currentMonth={2}
        currentYear={2026}
      />
    )
    expect(screen.getByText(/Paris/)).toBeInTheDocument()
    expect(screen.queryByText(/Tokyo/)).not.toBeInTheDocument()
  })

  it('shows stats line with trip, holiday, and event counts', () => {
    const trips = [
      { ...baseMockTrip, id: '1', destination: 'Paris', start_date: '2026-03-05', end_date: '2026-03-12' },
    ]
    const holidays: HolidayEntry[] = [
      { date: '2026-03-17', name: "St. Patrick's Day", country_code: 'US' },
    ]
    render(
      <TripSummaryBar
        {...defaultProps}
        trips={trips}
        holidays={holidays}
        zoomLevel="month"
        currentMonth={2}
        currentYear={2026}
      />
    )
    expect(screen.getByText(/1 trip/)).toBeInTheDocument()
    expect(screen.getByText(/1 holiday/)).toBeInTheDocument()
  })
})
