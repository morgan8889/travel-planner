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

  it('renders Quick Actions links', async () => {
    mockUseTrips.mockReturnValue({ data: [], isLoading: false })
    renderDashboard()

    expect(await screen.findByText('New Trip')).toBeInTheDocument()
    expect(screen.getByText('View Calendar')).toBeInTheDocument()
  })
})
