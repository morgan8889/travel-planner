import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { YearView } from '../components/planning/YearView'
import type { TripSummary, CustomDay } from '../lib/types'

const baseProps = {
  year: 2026,
  trips: [],
  holidays: [],
  customDays: [],
  selectedDate: null,
  onMonthClick: () => {},
  onDayClick: () => {},
  onTripClick: () => {},
}

const makeTripSummary = (overrides: Partial<TripSummary>): TripSummary => ({
  id: 'trip-1',
  type: 'vacation',
  destination: 'Paris',
  start_date: '2026-06-01',
  end_date: '2026-06-07',
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

describe('YearView grid lines', () => {
  it('renders day grids with border-t border-l border-cloud-100', () => {
    const { container } = render(<YearView {...baseProps} />)
    const dayGrids = container.querySelectorAll('.grid.grid-cols-7.border-t.border-l')
    expect(dayGrids.length).toBeGreaterThan(0)
  })

  it('does not use gap-px', () => {
    const { container } = render(<YearView {...baseProps} />)
    const gapGrids = container.querySelectorAll('.gap-px')
    expect(gapGrids.length).toBe(0)
  })

  it('renders padding cells with border-b border-r border-cloud-100', () => {
    const { container } = render(<YearView {...baseProps} />)
    const paddingCells = container.querySelectorAll('.aspect-square.border-b.border-r.border-cloud-100:not(.cursor-pointer)')
    expect(paddingCells.length).toBeGreaterThan(0)
  })
})

describe('YearView week container layout', () => {
  it('week container uses flex flex-col', () => {
    const { container } = render(<YearView {...baseProps} />)
    const flexContainers = container.querySelectorAll('.flex.flex-col')
    expect(flexContainers.length).toBeGreaterThan(0)
  })

  it('renders a relative h-8 trip bar strip below the day grid', () => {
    const { container } = render(<YearView {...baseProps} />)
    const strips = container.querySelectorAll('.relative.h-8')
    expect(strips.length).toBeGreaterThan(0)
  })
})

describe('YearView layout', () => {
  it('uses 3-column grid for mini calendars', () => {
    const { container } = render(<YearView {...baseProps} />)
    const threeColGrid = container.querySelector('.grid.grid-cols-3')
    expect(threeColGrid).toBeInTheDocument()
  })
})

describe('YearView trip inventory panel', () => {
  it('renders trip inventory panel heading', () => {
    render(<YearView {...baseProps} />)
    expect(screen.getByText(/trips 2026/i)).toBeInTheDocument()
  })

  it('renders a trip row in the inventory panel', () => {
    const trips = [makeTripSummary({ destination: 'Tokyo', start_date: '2026-09-01', end_date: '2026-09-14' })]
    render(<YearView {...baseProps} trips={trips} />)
    // destination appears in inventory panel
    expect(screen.getAllByText('Tokyo').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a gap row when two trips have 14+ days between them', () => {
    const trips = [
      makeTripSummary({ id: 'trip-1', destination: 'Paris', start_date: '2026-03-01', end_date: '2026-03-07' }),
      makeTripSummary({ id: 'trip-2', destination: 'Tokyo', start_date: '2026-06-01', end_date: '2026-06-07' }),
    ]
    render(<YearView {...baseProps} trips={trips} />)
    expect(screen.getByText(/weeks free/i)).toBeInTheDocument()
  })

  it('does not render a gap row when trips are fewer than 14 days apart', () => {
    const trips = [
      makeTripSummary({ id: 'trip-1', destination: 'Paris', start_date: '2026-03-01', end_date: '2026-03-07' }),
      makeTripSummary({ id: 'trip-2', destination: 'Tokyo', start_date: '2026-03-10', end_date: '2026-03-14' }),
    ]
    render(<YearView {...baseProps} trips={trips} />)
    expect(screen.queryByText(/weeks free/i)).not.toBeInTheDocument()
  })

  it('renders custom days section when custom days exist', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Ironman Zurich', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    render(<YearView {...baseProps} customDays={customDays} />)
    expect(screen.getByText('Ironman Zurich')).toBeInTheDocument()
  })

  it('does not render custom days section when there are no custom days', () => {
    render(<YearView {...baseProps} customDays={[]} />)
    expect(screen.queryByText(/events/i)).not.toBeInTheDocument()
  })

  it('shows no trips message when year has no trips', () => {
    render(<YearView {...baseProps} trips={[]} />)
    expect(screen.getByText(/no trips planned/i)).toBeInTheDocument()
  })
})
