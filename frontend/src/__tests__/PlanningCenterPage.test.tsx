import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { PlanningCenterPage } from '../pages/PlanningCenterPage'

const mockGet = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  calendarApi: {
    getHolidays: () => mockGet('/calendar/holidays'),
    getSupportedCountries: () => mockGet('/calendar/supported-countries'),
    enableCountry: vi.fn(),
    disableCountry: vi.fn(),
    createCustomDay: vi.fn(),
    deleteCustomDay: vi.fn(),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    signOut: vi.fn(),
  }),
}))

function renderWithRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute()
  const calRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/calendar',
    component: PlanningCenterPage,
  })
  const newTripRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/trips/new',
    component: () => null,
  })
  const routeTree = rootRoute.addChildren([calRoute, newTripRoute])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/calendar'] }),
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('PlanningCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockImplementation((url: string) => {
      if (url.includes('holidays')) {
        return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: [] } })
      }
      if (url.includes('supported-countries')) {
        return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
      }
      // trips
      return Promise.resolve({ data: [] })
    })
  })

  it('renders zoom toggle with Month, Quarter, Year', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('Month')).toBeInTheDocument()
      expect(screen.getByText('Quarter')).toBeInTheDocument()
      expect(screen.getByText('Year')).toBeInTheDocument()
    })
  })

  it('shows day headers in month view', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument()
      expect(screen.getByText('Mon')).toBeInTheDocument()
    })
  })

  it('switches to year view on Year click', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('Month')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Year'))

    // Year view shows all 12 month names
    await waitFor(() => {
      expect(screen.getByText('January')).toBeInTheDocument()
      expect(screen.getByText('December')).toBeInTheDocument()
    })
  })

  it('shows trip bars in quarter view', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('holidays')) {
        return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: [] } })
      }
      if (url.includes('supported-countries')) {
        return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
      }
      // trips
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      return Promise.resolve({
        data: [{
          id: 'trip-1',
          destination: 'Paris',
          start_date: `${year}-${month}-10`,
          end_date: `${year}-${month}-15`,
          status: 'planning',
          type: 'vacation',
          member_count: 2,
          destination_latitude: 48.8566,
          destination_longitude: 2.3522,
          notes: null,
          parent_trip_id: null,
          created_at: '2026-01-01',
        }],
      })
    })

    renderWithRouter()
    await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Quarter'))

    await waitFor(() => {
      expect(screen.getAllByTitle('Paris')[0]).toBeInTheDocument()
    })
  })

  it('clicking a day in quarter view opens trip create sidebar without zooming', async () => {
    renderWithRouter()
    await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Quarter'))

    // Click a day number in the quarter view
    await waitFor(() => {
      expect(screen.getAllByText('15')[0]).toBeInTheDocument()
    })
    await userEvent.click(screen.getAllByText('15')[0])

    // Should open sidebar with trip create form, NOT zoom to month view
    await waitFor(() => {
      expect(screen.getByText('New Trip')).toBeInTheDocument()
    })
    // Quarter buttons should still be visible (not zoomed to month)
    expect(screen.queryByText('Sun')).not.toBeInTheDocument()
  })

  it('shows holiday country dropdown', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('Holidays:')).toBeInTheDocument()
    })

    // Click the trigger button that contains "Holidays:"
    const holidaysLabel = screen.getByText('Holidays:')
    const triggerButton = holidaysLabel.closest('button')!
    await userEvent.click(triggerButton)

    await waitFor(() => {
      expect(screen.getByText('United States')).toBeInTheDocument()
    })
  })
})
