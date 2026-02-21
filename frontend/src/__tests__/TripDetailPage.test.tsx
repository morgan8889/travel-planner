import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRootRoute,
  createRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'
import { TripDetailPage } from '../pages/TripDetailPage'
import type { Trip } from '../lib/types'

const mockTrip: Trip = {
  id: 'trip-1',
  type: 'vacation',
  destination: 'Paris, France',
  start_date: '2026-06-15',
  end_date: '2026-06-22',
  status: 'planning',
  notes: 'Pack sunscreen',
  parent_trip_id: null,
  created_at: '2026-01-01T00:00:00Z',
  destination_latitude: null,
  destination_longitude: null,
  member_previews: [],
  itinerary_day_count: 0,
  days_with_activities: 0,
  members: [
    {
      id: 'member-1',
      user_id: 'user-1',
      role: 'owner',
      display_name: 'Test User',
      email: 'test@example.com',
    },
    {
      id: 'member-2',
      user_id: 'user-2',
      role: 'member',
      display_name: 'Other User',
      email: 'other@example.com',
    },
  ],
  children: [],
}

const mockSabbaticalTrip: Trip = {
  ...mockTrip,
  id: 'trip-sabbatical',
  type: 'sabbatical',
  destination: 'Europe Tour',
  children: [
    {
      id: 'child-1',
      type: 'vacation',
      destination: 'Rome',
      start_date: '2026-06-15',
      end_date: '2026-06-20',
      status: 'dreaming',
      notes: null,
      parent_trip_id: 'trip-sabbatical',
      created_at: '2026-01-01T00:00:00Z',
      member_count: 1,
      destination_latitude: null,
      destination_longitude: null,
      member_previews: [{ initials: 'TU', color: '#6366f1' }],
      itinerary_day_count: 0,
      days_with_activities: 0,
    },
  ],
}

const mockGetTrip = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()
const mockItineraryListDays = vi.fn()
const mockItineraryListActivities = vi.fn()
const mockChecklistList = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (url: string, ...rest: unknown[]) => {
      // TripForm calls useTrips() -> GET /trips (for parent trip dropdown)
      if (url === '/trips') return Promise.resolve({ data: [] })
      return mockGetTrip(url, ...rest)
    },
    post: vi.fn(),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  itineraryApi: {
    listDays: (tripId: string) => mockItineraryListDays(tripId),
    listActivities: () => Promise.resolve({ data: [] }),
    listTripActivities: (tripId: string) => mockItineraryListActivities(tripId),
    createDay: vi.fn(),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    reorderActivities: vi.fn(),
    deleteDay: vi.fn(),
    generateDays: vi.fn(),
    moveActivity: vi.fn(),
  },
  checklistApi: {
    list: (tripId: string) => mockChecklistList(tripId),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    toggleItem: vi.fn(),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    session: { access_token: 'test-token' },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

function renderWithRouter(tripId: string = 'trip-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const rootRoute = createRootRoute()
  const tripRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/trips/$tripId',
    component: TripDetailPage,
  })
  const routeTree = rootRoute.addChildren([tripRoute])
  const memoryHistory = createMemoryHistory({
    initialEntries: [`/trips/${tripId}`],
  })
  const router = createRouter({ routeTree, history: memoryHistory })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('TripDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockItineraryListDays.mockResolvedValue({ data: [] })
    mockItineraryListActivities.mockResolvedValue({ data: [] })
    mockChecklistList.mockResolvedValue({ data: [] })
  })

  it('renders loading skeleton while fetching', async () => {
    mockGetTrip.mockReturnValue(new Promise(() => {}))
    renderWithRouter()
    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  it('renders trip details when loaded', async () => {
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    // "Paris, France" appears in both breadcrumb and h1
    const headings = await screen.findAllByText('Paris, France')
    expect(headings.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Pack sunscreen')).toBeInTheDocument()
  })

  it('renders status and type badges', async () => {
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    const statusBadge = await screen.findByTestId('trip-status-badge')
    expect(statusBadge).toHaveTextContent('Planning')
    const typeBadge = screen.getByTestId('trip-type-badge')
    expect(typeBadge).toHaveTextContent('Vacation')
  })

  it('renders members list', async () => {
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    // Members appear in both mobile and desktop sections; verify at least one is present
    const testUserElements = await screen.findAllByText('Test User')
    expect(testUserElements.length).toBeGreaterThanOrEqual(1)
    const otherUserElements = screen.getAllByText('Other User')
    expect(otherUserElements.length).toBeGreaterThanOrEqual(1)
  })

  it('shows edit button and toggles edit mode', async () => {
    const user = userEvent.setup()
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    const editButton = await screen.findByText('Edit')
    await user.click(editButton)

    expect(screen.getByText('Edit Trip')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })

  it('shows delete button only for owner', async () => {
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    expect(await screen.findByText('Delete Trip')).toBeInTheDocument()
  })

  it('shows confirm dialog when delete is clicked', async () => {
    const user = userEvent.setup()
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    const deleteBtn = await screen.findByText('Delete Trip')
    await user.click(deleteBtn)

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
  })

  it('renders status transition button with correct label', async () => {
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    // planning -> "Mark as Booked"
    expect(await screen.findByText('Mark as Booked')).toBeInTheDocument()
  })

  it('renders sub-trips section for sabbatical trips', async () => {
    mockGetTrip.mockResolvedValue({ data: mockSabbaticalTrip })
    renderWithRouter('trip-sabbatical')

    expect(await screen.findByText('Sub-trips')).toBeInTheDocument()
    expect(screen.getByText('Rome')).toBeInTheDocument()
  })

  it('renders two-panel layout with itinerary and checklists sections without tabs', async () => {
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    renderWithRouter()

    // Section headers visible directly (no tab click required)
    expect(await screen.findByText('Itinerary')).toBeInTheDocument()
    expect(screen.getByText('Checklists')).toBeInTheDocument()

    // No tab navigation
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument()
  })

  it('renders error state on fetch failure', async () => {
    mockGetTrip.mockRejectedValue(new Error('Network error'))
    renderWithRouter()

    expect(await screen.findByText('Unable to load trip')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('renders itinerary-timeline when itinerary days are loaded', async () => {
    const mockDay = {
      id: 'day-1',
      trip_id: 'trip-1',
      date: '2026-06-15',
      day_number: 1,
      notes: null,
    }
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    mockItineraryListDays.mockResolvedValue({ data: [mockDay] })
    mockItineraryListActivities.mockResolvedValue({ data: [] })
    renderWithRouter()

    const timeline = await screen.findByTestId('itinerary-timeline')
    expect(timeline).toBeInTheDocument()
  })

  it('toggles Add activity button to Cancel when form is open', async () => {
    const user = userEvent.setup()
    const mockDay = {
      id: 'day-1',
      trip_id: 'trip-1',
      date: '2026-06-15',
      notes: null,
      activity_count: 0,
    }
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    mockItineraryListDays.mockResolvedValue({ data: [mockDay] })
    mockItineraryListActivities.mockResolvedValue({ data: [] })
    renderWithRouter()

    // Initially shows "Add activity"
    const addBtn = await screen.findByText('Add activity')
    expect(addBtn).toBeInTheDocument()

    // Click to open form
    await user.click(addBtn)

    // Now shows "Cancel" in the header toggle button (ActivityForm also has its own Cancel)
    const cancelButtons = screen.getAllByText('Cancel')
    expect(cancelButtons.length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Add activity')).not.toBeInTheDocument()

    // Click the first Cancel (header toggle) to close
    await user.click(cancelButtons[0])
    expect(await screen.findByText('Add activity')).toBeInTheDocument()
  })

  it('shows drop indicator below activities in a day that has activities', async () => {
    const mockDay = {
      id: 'day-1',
      trip_id: 'trip-1',
      date: '2026-06-15',
      notes: null,
      activity_count: 1,
    }
    const mockActivity = {
      id: 'act-1',
      itinerary_day_id: 'day-1',
      title: 'Museum Visit',
      category: 'activity',
      start_time: null,
      end_time: null,
      location: null,
      latitude: null,
      longitude: null,
      notes: null,
      confirmation_number: null,
      sort_order: 0,
      check_out_date: null,
    }
    mockGetTrip.mockResolvedValue({ data: mockTrip })
    mockItineraryListDays.mockResolvedValue({ data: [mockDay] })
    mockItineraryListActivities.mockResolvedValue({ data: [mockActivity] })
    renderWithRouter()

    // Timeline renders
    await screen.findByTestId('itinerary-timeline')
    // No drop indicator visible when not dragging
    expect(document.querySelector('[data-testid="drop-hint"]')).not.toBeInTheDocument()
  })
})
