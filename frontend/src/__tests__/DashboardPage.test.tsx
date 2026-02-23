import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRootRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'
import { DashboardPage } from '../pages/DashboardPage'
import type { TripSummary } from '../lib/types'

// Mock map components — react-map-gl requires WebGL unavailable in jsdom
vi.mock('../components/map/MapView', () => ({
  MapView: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-view">{children}</div>
  ),
}))
vi.mock('../components/map/TripMarker', () => ({
  TripMarker: ({ destination }: { destination: string }) => (
    <div data-testid="trip-marker">{destination}</div>
  ),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'alice@example.com' } }),
}))

const mockUseTrips = vi.fn()
vi.mock('../hooks/useTrips', () => ({
  useTrips: () => mockUseTrips(),
}))

const FUTURE_TRIP: TripSummary = {
  id: 'trip-1',
  type: 'vacation',
  destination: 'Paris, France',
  start_date: '2030-06-15',
  end_date: '2030-06-22',
  status: 'planning',
  notes: null,
  parent_trip_id: null,
  created_at: '2026-01-01T00:00:00Z',
  member_count: 1,
  destination_latitude: 48.8566,
  destination_longitude: 2.3522,
}

// Completed trip without coordinates so it won't appear in map markers either
const COMPLETED_TRIP_NO_COORDS: TripSummary = {
  id: 'trip-2',
  type: 'vacation',
  destination: 'Tokyo, Japan',
  start_date: '2025-03-01',
  end_date: '2025-03-07',
  status: 'completed',
  notes: null,
  parent_trip_id: null,
  created_at: '2025-01-01T00:00:00Z',
  member_count: 1,
  destination_latitude: null,
  destination_longitude: null,
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const TestComponent = () => <DashboardPage />
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

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders welcome heading with user display name', async () => {
    mockUseTrips.mockReturnValue({ data: [], isLoading: false })
    renderDashboard()
    expect(await screen.findByText(/welcome back, alice/i)).toBeInTheDocument()
  })

  it('renders upcoming non-completed trips', async () => {
    mockUseTrips.mockReturnValue({
      data: [FUTURE_TRIP, COMPLETED_TRIP_NO_COORDS],
      isLoading: false,
    })
    renderDashboard()

    // Use getAllByText to handle both trip card and TripMarker rendering the same destination text
    expect((await screen.findAllByText('Paris, France'))[0]).toBeInTheDocument()
    // Completed trip should not appear in upcoming list (it has no coords so no marker either)
    expect(screen.queryByText('Tokyo, Japan')).not.toBeInTheDocument()
  })

  it('shows empty state when no upcoming trips', async () => {
    mockUseTrips.mockReturnValue({
      data: [COMPLETED_TRIP_NO_COORDS],
      isLoading: false,
    })
    renderDashboard()

    expect(await screen.findByText('No upcoming trips yet.')).toBeInTheDocument()
    expect(screen.getByText('Plan a Trip')).toBeInTheDocument()
  })

  it('renders map markers for trips with coordinates', async () => {
    mockUseTrips.mockReturnValue({
      data: [FUTURE_TRIP],
      isLoading: false,
    })
    renderDashboard()

    await waitFor(() => {
      const markers = screen.queryAllByTestId('trip-marker')
      expect(markers).toHaveLength(1)
    })
  })

  it('renders Next Up overlay for nearest upcoming planning trip', async () => {
    mockUseTrips.mockReturnValue({
      data: [FUTURE_TRIP],
      isLoading: false,
    })
    renderDashboard()
    // The overlay card should show destination and a countdown
    expect(await screen.findByTestId('next-up-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('next-up-overlay')).toHaveTextContent('Paris, France')
  })

  it('does not render Next Up overlay when no upcoming trips', async () => {
    mockUseTrips.mockReturnValue({
      data: [COMPLETED_TRIP_NO_COORDS],
      isLoading: false,
    })
    renderDashboard()

    await screen.findByText(/welcome back/i)
    expect(screen.queryByTestId('next-up-overlay')).not.toBeInTheDocument()
  })

  it('shows up to 5 upcoming trips and no more', async () => {
    const sixTrips = Array.from({ length: 6 }, (_, i) => ({
      ...FUTURE_TRIP,
      id: `trip-${i + 1}`,
      destination: `City ${i + 1}`,
      start_date: `203${i}-06-15`,
      // No coordinates so trips won't appear as map markers
      destination_latitude: null,
      destination_longitude: null,
    }))
    mockUseTrips.mockReturnValue({ data: sixTrips, isLoading: false })
    renderDashboard()

    // Should show exactly 5 trip names in the upcoming panel, not 6
    for (let i = 1; i <= 5; i++) {
      expect((await screen.findAllByText(`City ${i}`))[0]).toBeInTheDocument()
    }
    expect(screen.queryByText('City 6')).not.toBeInTheDocument()
  })
})

function makeTrip(overrides: Partial<TripSummary>): TripSummary {
  return {
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
    itinerary_day_count: 5,
    days_with_activities: 5,
    transport_total: 0,
    transport_confirmed: 0,
    lodging_total: 0,
    lodging_confirmed: 0,
    activity_total: 0,
    activity_confirmed: 0,
    restaurant_total: 0,
    restaurant_confirmed: 0,
    ...overrides,
  }
}

describe('DashboardPage Needs Attention', () => {
  it('shows Needs Attention heading', async () => {
    mockUseTrips.mockReturnValue({ data: [], isLoading: false })
    renderDashboard()
    expect(await screen.findByText(/needs attention/i)).toBeInTheDocument()
  })

  it('shows all caught up when no action items', async () => {
    mockUseTrips.mockReturnValue({
      data: [makeTrip({
        status: 'planning',
        transport_total: 2,
        transport_confirmed: 2,
        lodging_total: 1,
        lodging_confirmed: 1,
        itinerary_day_count: 5,
        days_with_activities: 5,
      })],
      isLoading: false,
    })
    renderDashboard()
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
  })

  it('shows flight action item for unconfirmed transport', async () => {
    mockUseTrips.mockReturnValue({
      data: [makeTrip({ destination: 'Rome', status: 'booked', transport_total: 2, transport_confirmed: 1 })],
      isLoading: false,
    })
    renderDashboard()
    expect((await screen.findAllByText(/rome/i))[0]).toBeInTheDocument()
    expect(await screen.findByText(/1 flight/i)).toBeInTheDocument()
  })

  it('shows hotel action item for unconfirmed lodging', async () => {
    mockUseTrips.mockReturnValue({
      data: [makeTrip({ destination: 'Tokyo', status: 'planning', lodging_total: 3, lodging_confirmed: 1 })],
      isLoading: false,
    })
    renderDashboard()
    expect(await screen.findByText(/2 hotel/i)).toBeInTheDocument()
  })

  it('shows itinerary action item for unplanned days', async () => {
    mockUseTrips.mockReturnValue({
      data: [makeTrip({ destination: 'Lisbon', status: 'booked', itinerary_day_count: 7, days_with_activities: 3 })],
      isLoading: false,
    })
    renderDashboard()
    expect(await screen.findByText(/4 day/i)).toBeInTheDocument()
  })

  it('does not show action items for completed trips', async () => {
    mockUseTrips.mockReturnValue({
      data: [makeTrip({ destination: 'Berlin', status: 'completed', transport_total: 2, transport_confirmed: 0 })],
      isLoading: false,
    })
    renderDashboard()
    await screen.findByText(/all caught up/i)
    expect(screen.queryByText(/berlin/i)).not.toBeInTheDocument()
  })

  it('shows restaurant action item for unconfirmed restaurant bookings', async () => {
    mockUseTrips.mockReturnValue({
      data: [makeTrip({
        destination: 'Kyoto',
        status: 'booked',
        restaurant_total: 3,
        restaurant_confirmed: 1,
      })],
      isLoading: false,
    })
    renderDashboard()
    expect(await screen.findByText(/2 restaurant booking/i)).toBeInTheDocument()
  })

  it('groups action items under their trip header', async () => {
    mockUseTrips.mockReturnValue({
      data: [
        makeTrip({ id: 'trip-a', destination: 'Rome', status: 'booked', transport_total: 2, transport_confirmed: 0 }),
        makeTrip({ id: 'trip-b', destination: 'Athens', status: 'planning', lodging_total: 1, lodging_confirmed: 0 }),
      ],
      isLoading: false,
    })
    renderDashboard()

    // Both trip headers shown (use getAllByText since destination appears in multiple places)
    expect((await screen.findAllByText('Rome'))[0]).toBeInTheDocument()
    expect(screen.getAllByText('Athens')[0]).toBeInTheDocument()

    // Each has its own action item
    expect(screen.getByText(/2 flight/i)).toBeInTheDocument()
    expect(screen.getByText(/1 hotel/i)).toBeInTheDocument()

    // Each header has a "View trip" link
    const viewLinks = screen.getAllByText(/view trip/i)
    expect(viewLinks).toHaveLength(2)
  })

  it('does not show quick link buttons', async () => {
    mockUseTrips.mockReturnValue({ data: [], isLoading: false })
    renderDashboard()
    await screen.findByText(/welcome back/i)
    expect(screen.queryByText('View Calendar')).not.toBeInTheDocument()
  })
})
