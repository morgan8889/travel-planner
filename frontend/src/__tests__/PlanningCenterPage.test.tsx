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
  const routeTree = rootRoute.addChildren([calRoute])
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
        return Promise.resolve({ data: [{ code: 'US', name: 'US' }] })
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
})
