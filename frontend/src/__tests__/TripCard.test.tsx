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

  it('renders member avatars for member count', async () => {
    renderWithProviders(<TripCard trip={mockTrip} />)
    const memberSection = await screen.findByTestId('member-count')
    expect(memberSection).toBeInTheDocument()
    const avatars = memberSection.querySelectorAll('.rounded-full')
    expect(avatars.length).toBe(3)
  })

  it('shows overflow count when more than 3 members', async () => {
    const tripWith5Members = { ...mockTrip, member_count: 5 }
    renderWithProviders(<TripCard trip={tripWith5Members} />)
    expect(await screen.findByText('+2')).toBeInTheDocument()
  })
})
