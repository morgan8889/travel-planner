import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRootRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'
import { TripsPage } from '../pages/TripsPage'
import type { TripSummary } from '../lib/types'

const mockTrips: TripSummary[] = [
  {
    id: 'trip-1',
    type: 'vacation',
    destination: 'Paris, France',
    start_date: '2026-06-15',
    end_date: '2026-06-22',
    status: 'planning',
    notes: null,
    parent_trip_id: null,
    created_at: '2026-01-01T00:00:00Z',
    member_count: 2,
    destination_latitude: null,
    destination_longitude: null,
    member_previews: [
      { initials: 'AS', color: '#6366f1' },
      { initials: 'BJ', color: '#22c55e' },
    ],
    itinerary_day_count: 5,
    days_with_activities: 2,
  },
  {
    id: 'trip-2',
    type: 'remote_week',
    destination: 'Lisbon, Portugal',
    start_date: '2026-07-01',
    end_date: '2026-07-07',
    status: 'dreaming',
    notes: null,
    parent_trip_id: null,
    created_at: '2026-01-02T00:00:00Z',
    member_count: 1,
    destination_latitude: null,
    destination_longitude: null,
    member_previews: [{ initials: 'AS', color: '#6366f1' }],
    itinerary_day_count: 0,
    days_with_activities: 0,
  },
]

const mockGet = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const TestComponent = () => ui
  const rootRoute = createRootRoute({ component: TestComponent })
  const routeTree = rootRoute.addChildren([])
  const memoryHistory = createMemoryHistory({ initialEntries: ['/trips'] })
  const router = createRouter({ routeTree, history: memoryHistory })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('TripsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeletons while fetching', async () => {
    // Never resolve to keep loading state
    mockGet.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<TripsPage />)
    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  it('renders trip cards when data loads', async () => {
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    expect(await screen.findByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()
  })

  it('renders empty state when no trips', async () => {
    mockGet.mockResolvedValue({ data: [] })
    renderWithProviders(<TripsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Paris, France')).not.toBeInTheDocument()
    })
    // EmptyTripsState should render
    expect(await screen.findByText(/start planning/i)).toBeInTheDocument()
  })

  it('renders New Trip button', async () => {
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    expect(await screen.findByText('New Trip')).toBeInTheDocument()
  })

  it('renders status filter pills', async () => {
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    expect(await screen.findByText('All')).toBeInTheDocument()
    expect(screen.getByText('Dreaming')).toBeInTheDocument()
    expect(screen.getByText('Planning')).toBeInTheDocument()
    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('clicking a status filter pill filters trips client-side', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    // Both trips visible initially
    expect(await screen.findByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()

    // Click "Planning" filter — only Paris (planning) shown
    const filterButtons = screen.getAllByText('Planning')
    const filterPill = filterButtons.find(
      (el) => el.tagName === 'BUTTON' && !el.closest('[data-testid]')
    )!
    await user.click(filterPill)

    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()
  })

  it('allows selecting multiple status filters simultaneously', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    await screen.findByText('Paris, France')

    // Select "Planning"
    const allPlanningText = screen.getAllByText('Planning')
    const planningPill = allPlanningText.find((el) => el.tagName === 'BUTTON' && !el.closest('[data-testid]'))!
    await user.click(planningPill)

    // Only Paris visible
    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()

    // Also select "Dreaming"
    await user.click(screen.getByRole('button', { name: 'Dreaming' }))

    // Both visible now
    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()
  })

  it('clicking All clears active status filters', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue({ data: mockTrips })
    renderWithProviders(<TripsPage />)

    await screen.findByText('Paris, France')

    // Select "Planning" to filter
    const allPlanningText = screen.getAllByText('Planning')
    const planningPill = allPlanningText.find((el) => el.tagName === 'BUTTON' && !el.closest('[data-testid]'))!
    await user.click(planningPill)
    expect(screen.queryByText('Lisbon, Portugal')).not.toBeInTheDocument()

    // Click All to clear
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument()
  })

  it('renders error state with retry button on fetch failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))
    renderWithProviders(<TripsPage />)

    expect(await screen.findByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})
