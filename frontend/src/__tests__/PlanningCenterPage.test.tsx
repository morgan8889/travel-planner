import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { PlanningCenterPage } from '../pages/PlanningCenterPage'

const mockGet = vi.fn()
const mockEnableCountry = vi.fn()

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
    enableCountry: (...args: unknown[]) => mockEnableCountry(...args),
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

const now = new Date()
const testYear = now.getFullYear()
const testMonth = String(now.getMonth() + 1).padStart(2, '0')

const mockTrip = {
  id: 'trip-1',
  destination: 'Paris',
  start_date: `${testYear}-${testMonth}-10`,
  end_date: `${testYear}-${testMonth}-15`,
  status: 'planning',
  type: 'vacation',
  member_count: 2,
  destination_latitude: 48.8566,
  destination_longitude: 2.3522,
  notes: null,
  parent_trip_id: null,
  created_at: '2026-01-01',
}

describe('PlanningCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnableCountry.mockResolvedValue({ data: {} })
    mockGet.mockImplementation((url: string) => {
      if (url.includes('holidays')) {
        return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: ['US'] } })
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
        return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: ['US'] } })
      }
      if (url.includes('supported-countries')) {
        return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
      }
      return Promise.resolve({ data: [mockTrip] })
    })

    renderWithRouter()
    await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Quarter'))

    // TripSpan renders destination text as label in quarter view
    await waitFor(() => {
      expect(screen.getAllByText('Paris')[0]).toBeInTheDocument()
    })
  })

  it('shows TripSummaryBar when trips exist', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('holidays')) {
        return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: ['US'] } })
      }
      if (url.includes('supported-countries')) {
        return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
      }
      return Promise.resolve({ data: [mockTrip] })
    })

    renderWithRouter()
    // TripSummaryBar shows destination and date range
    await waitFor(() => {
      expect(screen.getAllByText(/Paris/)[0]).toBeInTheDocument()
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

  it('auto-enables US holidays when no countries are enabled', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('holidays')) {
        return Promise.resolve({ data: { holidays: [], custom_days: [], enabled_countries: [] } })
      }
      if (url.includes('supported-countries')) {
        return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithRouter()

    await waitFor(() => {
      expect(mockEnableCountry).toHaveBeenCalledWith(
        expect.objectContaining({ country_code: 'US' })
      )
    })
  })

  it('shows editable date fields in trip create sidebar', async () => {
    renderWithRouter()
    await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Quarter'))

    await waitFor(() => {
      expect(screen.getAllByText('15')[0]).toBeInTheDocument()
    })
    await userEvent.click(screen.getAllByText('15')[0])

    await waitFor(() => {
      expect(screen.getByText('New Trip')).toBeInTheDocument()
    })
    // Should have editable date inputs
    expect(screen.getByLabelText('Start')).toBeInTheDocument()
    expect(screen.getByLabelText('End')).toBeInTheDocument()
  })

  it('highlights selected day when trip create sidebar is open', async () => {
    renderWithRouter()
    await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Quarter'))

    await waitFor(() => {
      expect(screen.getAllByText('15')[0]).toBeInTheDocument()
    })
    await userEvent.click(screen.getAllByText('15')[0])

    await waitFor(() => {
      expect(screen.getByText('New Trip')).toBeInTheDocument()
    })
    // The clicked day should have the indigo ring indicator
    const dayCell = screen.getAllByText('15')[0].closest('div')
    expect(dayCell?.className).toContain('ring-indigo-500')
  })

  it('clicking a holiday day opens holiday detail sidebar', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('holidays')) {
        return Promise.resolve({
          data: {
            holidays: [{ date: `${testYear}-${testMonth}-15`, name: 'Test Holiday', country_code: 'US' }],
            custom_days: [],
            enabled_countries: ['US'],
          },
        })
      }
      if (url.includes('supported-countries')) {
        return Promise.resolve({ data: [{ code: 'US', name: 'United States' }] })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithRouter()
    await waitFor(() => expect(screen.getByText('Quarter')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Quarter'))

    // Wait for the holiday label to appear in the quarter view calendar
    await waitFor(() => {
      expect(screen.getByText('Test Holiday')).toBeInTheDocument()
    })
    // Click the holiday label in the DayCell — triggers onHolidayClick
    await userEvent.click(screen.getByText('Test Holiday'))

    // Sidebar should open with holiday detail including "Federal Holiday (US)"
    await waitFor(() => {
      expect(screen.getByText(/Federal Holiday/)).toBeInTheDocument()
    })
  })
})
