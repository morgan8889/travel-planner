import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MonthView } from '../components/planning/MonthView'
import type { TripSummary } from '../lib/types'

const baseProps = {
  year: 2026,
  month: 0, // January
  trips: [],
  holidays: [],
  customDays: [],
  selectedDate: null,
  selection: null,
  onDragStart: () => {},
  onDragMove: () => {},
  onTripClick: () => {},
}

const makeTrip = (id: string, overrides: Partial<TripSummary> = {}): TripSummary => ({
  id,
  type: 'vacation',
  destination: `Trip ${id}`,
  start_date: '2026-01-05',
  end_date: '2026-01-10',
  status: 'planning',
  notes: null,
  parent_trip_id: null,
  created_at: '2026-01-01T00:00:00Z',
  member_count: 1,
  destination_latitude: null,
  destination_longitude: null,
  member_previews: [],
  itinerary_day_count: 0,
  days_with_activities: 0,
  ...overrides,
})

describe('MonthView overflow indicator', () => {
  it('renders styled pill with rounded-full when more than 3 trips overlap a week', () => {
    const trips = [
      makeTrip('t1'),
      makeTrip('t2'),
      makeTrip('t3'),
      makeTrip('t4'),
    ]
    const { container } = render(<MonthView {...baseProps} trips={trips} />)
    const pill = container.querySelector('.rounded-full')
    expect(pill).toBeInTheDocument()
    expect(pill?.textContent).toMatch(/\+1 more/)
  })

  it('does not render overflow pill when 3 or fewer trips overlap', () => {
    const trips = [makeTrip('t1'), makeTrip('t2'), makeTrip('t3')]
    const { container } = render(<MonthView {...baseProps} trips={trips} />)
    expect(container.querySelector('.rounded-full')).not.toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  it('overflow pill has bg-cloud-100 class', () => {
    const trips = [makeTrip('t1'), makeTrip('t2'), makeTrip('t3'), makeTrip('t4')]
    const { container } = render(<MonthView {...baseProps} trips={trips} />)
    const pill = container.querySelector('.bg-cloud-100')
    expect(pill).toBeInTheDocument()
  })
})
