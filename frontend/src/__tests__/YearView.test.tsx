import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
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

  it('outer flex container uses items-start', () => {
    const { container } = render(<YearView {...baseProps} />)
    const outerFlex = container.querySelector('.flex.items-start')
    expect(outerFlex).toBeInTheDocument()
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

  it('renders a recurring custom day resolved to the current year', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-2', user_id: 'u-1', name: 'Annual Review', date: '2024-11-15', recurring: true, created_at: '2026-01-01T00:00:00Z' },
    ]
    render(<YearView {...baseProps} customDays={customDays} />)
    expect(screen.getByText('Annual Review')).toBeInTheDocument()
  })

  it('event-type trip appears in Events section, not Trips section', () => {
    const trips = [
      makeTripSummary({
        type: 'event',
        destination: 'Austin, TX',
        notes: '3M Half Marathon — local race',
      }),
    ]
    render(<YearView {...baseProps} trips={trips} />)
    // Event name (from notes) appears in Events section (may also appear in bar label)
    expect(screen.getAllByText('3M Half Marathon').length).toBeGreaterThanOrEqual(1)
    // Trips section shows no trips (only non-event trips go there)
    expect(screen.getByText(/no trips planned/i)).toBeInTheDocument()
  })

  it('non-event trip stays in Trips section, not Events section', () => {
    const trips = [makeTripSummary({ type: 'vacation', destination: 'Paris' })]
    render(<YearView {...baseProps} trips={trips} />)
    // Paris appears in trips inventory
    expect(screen.getAllByText('Paris').length).toBeGreaterThanOrEqual(1)
    // Events section does not appear (no event trips or custom days)
    expect(screen.queryByText(/^events$/i)).not.toBeInTheDocument()
  })

  it('shows "+ N more" button when there are more than 5 trips', () => {
    const trips = Array.from({ length: 6 }, (_, i) =>
      makeTripSummary({
        id: `trip-${i}`,
        destination: `City ${i}`,
        start_date: `2026-01-${String(i * 5 + 1).padStart(2, '0')}`,
        end_date: `2026-01-${String(i * 5 + 3).padStart(2, '0')}`,
      }),
    )
    render(<YearView {...baseProps} trips={trips} />)
    expect(screen.getByText(/\+ \d+ more/i)).toBeInTheDocument()
  })

  it('expands trips section when "+ N more" is clicked', async () => {
    const user = userEvent.setup()
    const trips = Array.from({ length: 6 }, (_, i) =>
      makeTripSummary({
        id: `trip-${i}`,
        destination: `City ${i}`,
        start_date: `2026-01-${String(i * 5 + 1).padStart(2, '0')}`,
        end_date: `2026-01-${String(i * 5 + 3).padStart(2, '0')}`,
      }),
    )
    render(<YearView {...baseProps} trips={trips} />)
    await user.click(screen.getByText(/\+ \d+ more/i))
    // After expanding, the "N more" button disappears
    expect(screen.queryByText(/\+ \d+ more/i)).not.toBeInTheDocument()
  })

})

describe('YearView inventory highlight', () => {
  it('calls onTripClick when inventory panel trip is clicked', async () => {
    const user = userEvent.setup()
    const onTripClick = vi.fn()
    const trips = [makeTripSummary({ destination: 'Rome' })]
    render(<YearView {...baseProps} trips={trips} onTripClick={onTripClick} />)
    const romeButtons = screen.getAllByRole('button', { name: /rome/i })
    // Inventory button is last in DOM order (after all grid bars)
    await user.click(romeButtons[romeButtons.length - 1])
    expect(onTripClick).toHaveBeenCalledWith(expect.objectContaining({ destination: 'Rome' }))
  })

  it('renders holidays section heading when holidays exist but items are collapsed by default', () => {
    const holidays = [
      { date: '2026-01-01', name: "New Year's Day", country_code: 'US' },
      { date: '2026-07-04', name: 'Independence Day', country_code: 'US' },
    ]
    render(<YearView {...baseProps} holidays={holidays} />)
    expect(screen.getByText(/holidays/i)).toBeInTheDocument()
    // Items are collapsed by default
    expect(screen.queryByText("New Year's Day")).not.toBeInTheDocument()
    expect(screen.queryByText('Independence Day')).not.toBeInTheDocument()
    // Show button is present
    expect(screen.getByRole('button', { name: /show 2/i })).toBeInTheDocument()
  })

  it('does not render holidays section when holidays list is empty', () => {
    render(<YearView {...baseProps} holidays={[]} />)
    expect(screen.queryByText(/^holidays$/i)).not.toBeInTheDocument()
  })

  it('calls onHolidayClick when a holiday in the panel is clicked (after expanding)', async () => {
    const user = userEvent.setup()
    const onHolidayClick = vi.fn()
    const holidays = [{ date: '2026-01-01', name: "New Year's Day", country_code: 'US' }]
    render(<YearView {...baseProps} holidays={holidays} onHolidayClick={onHolidayClick} />)
    // Expand holidays first
    await user.click(screen.getByRole('button', { name: /show 1/i }))
    await user.click(screen.getByText("New Year's Day"))
    expect(onHolidayClick).toHaveBeenCalledWith('2026-01-01')
  })

  it('grid bar click still calls onTripClick', async () => {
    const user = userEvent.setup()
    const onTripClick = vi.fn()
    const trips = [makeTripSummary({ destination: 'Paris', start_date: '2026-06-01', end_date: '2026-06-07' })]
    render(<YearView {...baseProps} trips={trips} onTripClick={onTripClick} />)
    // The grid bar is a button with the destination text — grid bars appear before inventory button
    const gridBars = screen.getAllByRole('button', { name: /paris/i })
    // Click the first one — grid bars come before the inventory button in DOM order
    await user.click(gridBars[0])
    expect(onTripClick).toHaveBeenCalledWith(expect.objectContaining({ destination: 'Paris' }))
  })
})

describe('YearView event badges', () => {
  it('renders an amber dot on the month heading when custom days exist in that month', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'cd-2', user_id: 'u-1', name: 'Fun Run', date: '2026-07-20', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    const { container } = render(<YearView {...baseProps} customDays={customDays} />)
    const dots = container.querySelectorAll('span.bg-amber-400.w-2.h-2.rounded-full')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('does not show a numeric count inside the dot', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'cd-2', user_id: 'u-1', name: 'Fun Run', date: '2026-07-20', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    const { container } = render(<YearView {...baseProps} customDays={customDays} />)
    const dots = container.querySelectorAll('span.bg-amber-400.w-2.h-2.rounded-full')
    dots.forEach((dot) => {
      expect(dot.textContent).toBe('')
    })
  })

  it('renders exactly one dot for a single month with events', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    const { container } = render(<YearView {...baseProps} customDays={customDays} />)
    const dots = container.querySelectorAll('span.bg-amber-400.w-2.h-2.rounded-full')
    expect(dots.length).toBe(1)
  })

  it('does not render any dot for months with no events', () => {
    // No amber-400 heading spans when there are no events
    const { container } = render(<YearView {...baseProps} customDays={[]} />)
    const dots = container.querySelectorAll('span.bg-amber-400.w-2.h-2.rounded-full')
    expect(dots.length).toBe(0)
  })

  it('shows hover popover with custom day names when month dot is hovered', () => {
    const customDays: CustomDay[] = [
      { id: 'cd-1', user_id: 'u-1', name: 'Race Day', date: '2026-07-14', recurring: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'cd-2', user_id: 'u-1', name: 'Fun Run', date: '2026-07-20', recurring: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    const { container } = render(<YearView {...baseProps} customDays={customDays} />)
    // The calendar grid is the flex-1 child, sidebar is the w-60 child
    // Month header dots are inside buttons in the grid area
    const monthHeaderDots = container.querySelectorAll(
      '.flex-1 span.bg-amber-400.w-2.h-2.rounded-full'
    )
    // Before hover: 'Race Day' visible once in Events panel
    expect(screen.getAllByText('Race Day').length).toBe(1)
    fireEvent.mouseEnter(monthHeaderDots[0])
    // After hover: 'Race Day' appears again in popover (twice total)
    expect(screen.getAllByText('Race Day').length).toBe(2)
    expect(screen.getAllByText('Fun Run').length).toBe(2)
    fireEvent.mouseLeave(monthHeaderDots[0])
    // After leave: back to once
    expect(screen.getAllByText('Race Day').length).toBe(1)
  })
})

describe('YearView custom day hover popover', () => {
  it('shows custom day name in popover on hover', () => {
    const customDays: CustomDay[] = [
      {
        id: 'cd-1',
        user_id: 'u-1',
        name: 'Race Day',
        date: '2026-07-14',
        recurring: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    render(<YearView {...baseProps} customDays={customDays} />)
    // Initially: 'Race Day' appears once (in the item label)
    expect(screen.getAllByText('Race Day').length).toBe(1)
    // Hover the custom day item row (it has a relative wrapper with onMouseEnter)
    const nameEl = screen.getByText('Race Day')
    fireEvent.mouseEnter(nameEl.closest('.relative') ?? nameEl)
    // After hover: 'Race Day' appears twice (item label + popover)
    expect(screen.getAllByText('Race Day').length).toBe(2)
  })

  it('hides custom day popover on mouse leave', () => {
    const customDays: CustomDay[] = [
      {
        id: 'cd-1',
        user_id: 'u-1',
        name: 'Race Day',
        date: '2026-07-14',
        recurring: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    render(<YearView {...baseProps} customDays={customDays} />)
    const nameEl = screen.getByText('Race Day')
    const wrapper = nameEl.closest('.relative') ?? nameEl
    fireEvent.mouseEnter(wrapper)
    expect(screen.getAllByText('Race Day').length).toBe(2)
    fireEvent.mouseLeave(wrapper)
    expect(screen.getAllByText('Race Day').length).toBe(1)
  })
})
