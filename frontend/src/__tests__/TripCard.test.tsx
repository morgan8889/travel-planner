import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRootRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'
import { TripCard } from '../components/trips/TripCard'
import type { TripSummary } from '../lib/types'

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const TestComponent = () => ui
  const rootRoute = createRootRoute({ component: TestComponent })
  const routeTree = rootRoute.addChildren([])
  const memoryHistory = createMemoryHistory({ initialEntries: ['/'] })
  const router = createRouter({ routeTree, history: memoryHistory })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const mockTrip: TripSummary = {
  id: 'trip-1',
  type: 'vacation',
  destination: 'Paris, France',
  start_date: '2026-06-15',
  end_date: '2026-06-22',
  status: 'planning',
  notes: null,
  parent_trip_id: null,
  created_at: '2026-01-01T00:00:00Z',
  member_count: 3,
  destination_latitude: null,
  destination_longitude: null,
  member_previews: [
    { initials: 'AS', color: '#6366f1' },
    { initials: 'BJ', color: '#22c55e' },
    { initials: 'CK', color: '#f59e0b' },
  ],
  itinerary_day_count: 7,
  days_with_activities: 3,
}

describe('TripCard', () => {
  it('renders destination', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    expect(await screen.findByText('Paris, France')).toBeInTheDocument()
  })

  it('renders formatted date range', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const dates = await screen.findByTestId('trip-dates')
    expect(dates).toHaveTextContent('Jun 15 - 22, 2026')
  })

  it('renders status badge', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const badge = await screen.findByTestId('trip-status-badge')
    expect(badge).toHaveTextContent('Planning')
  })

  it('renders type badge', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const badge = await screen.findByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Vacation')
  })

  it('renders real initials from member_previews', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const memberSection = await screen.findByTestId('member-count')
    expect(memberSection).toBeInTheDocument()
    expect(memberSection).toHaveTextContent('AS')
    expect(memberSection).toHaveTextContent('BJ')
    expect(memberSection).toHaveTextContent('CK')
  })

  it('renders all member avatars when more than 3 members', async () => {
    const tripWith5Members = {
      ...mockTrip,
      member_count: 5,
      member_previews: [
        { initials: 'AS', color: '#6366f1' },
        { initials: 'BJ', color: '#22c55e' },
        { initials: 'CK', color: '#f59e0b' },
        { initials: 'DL', color: '#a855f7' },
        { initials: 'EM', color: '#ec4899' },
      ],
    }
    renderWithProviders(<TripCard trip={tripWith5Members} />)
    const memberSection = await screen.findByTestId('member-count')
    expect(memberSection).toHaveTextContent('AS')
    expect(memberSection).toHaveTextContent('BJ')
    expect(memberSection).toHaveTextContent('CK')
    expect(memberSection).toHaveTextContent('DL')
    expect(memberSection).toHaveTextContent('EM')
  })

  it('shows dash avatar when no members', async () => {
    const soloTrip = { ...mockTrip, member_count: 0, member_previews: [] }
    renderWithProviders(<TripCard trip={soloTrip} />)
    const memberSection = await screen.findByTestId('member-count')
    expect(memberSection).toHaveTextContent('—')
  })

  it('shows progress bar when itinerary_day_count > 0', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const bar = await screen.findByTestId('itinerary-progress')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveTextContent('3 / 7 days planned')
  })

  it('hides progress bar when itinerary_day_count is 0', async () => {
    const noItinerary = { ...mockTrip, itinerary_day_count: 0, days_with_activities: 0 }
    renderWithProviders(<TripCard trip={noItinerary} />)
    await screen.findByText('Paris, France')
    expect(screen.queryByTestId('itinerary-progress')).not.toBeInTheDocument()
  })

  it('shows "All days planned" when all days have activities', async () => {
    const allPlanned = { ...mockTrip, itinerary_day_count: 7, days_with_activities: 7 }
    renderWithProviders(<TripCard trip={allPlanned} />)
    const bar = await screen.findByTestId('itinerary-progress')
    expect(bar).toHaveTextContent('All days planned')
  })
})

describe('TripCard booking chips', () => {
  it('always renders all 3 booking chips even when totals are 0', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const chipRow = await screen.findByTestId('booking-chips')
    expect(chipRow).toBeInTheDocument()
    expect(chipRow.children.length).toBe(3)
  })

  it('renders amber chip for partially confirmed bookings', async () => {
    const trip = {
      ...mockTrip,
      transport_total: 2,
      transport_confirmed: 1,
    }
    renderWithProviders(<TripCard trip={trip} />)
    const chipRow = await screen.findByTestId('booking-chips')
    const flightChip = chipRow.children[0]
    expect(flightChip.className).toContain('bg-amber-50')
    expect(flightChip.textContent).toContain('1/2')
  })

  it('renders green chip for fully confirmed bookings', async () => {
    const trip = {
      ...mockTrip,
      lodging_total: 3,
      lodging_confirmed: 3,
    }
    renderWithProviders(<TripCard trip={trip} />)
    const chipRow = await screen.findByTestId('booking-chips')
    const hotelChip = chipRow.children[1]
    expect(hotelChip.className).toContain('bg-emerald-50')
    expect(hotelChip.textContent).toContain('3/3')
  })

  it('renders muted chip for empty bookings (total 0)', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const chipRow = await screen.findByTestId('booking-chips')
    const activityChip = chipRow.children[2]
    expect(activityChip.className).toContain('bg-cloud-50')
    expect(activityChip.textContent).not.toContain('/')
  })
})
