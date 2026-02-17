import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { CalendarPage } from '../pages/CalendarPage'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  calendarApi: {
    getYear: (year: number) => mockGet(`/calendar/plans/${year}`),
    createPlan: (data: unknown) => mockPost('/calendar/plans', data),
    createBlock: (data: unknown) => mockPost('/calendar/blocks', data),
    updateBlock: (blockId: string, data: unknown) => mockPatch(`/calendar/blocks/${blockId}`, data),
    deleteBlock: (blockId: string) => mockDelete(`/calendar/blocks/${blockId}`),
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  const rootRoute = createRootRoute()
  const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/calendar',
    component: CalendarPage,
  })
  const routeTree = rootRoute.addChildren([calendarRoute])
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

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders year heading and 12 months', async () => {
    const currentYear = new Date().getFullYear()
    mockGet.mockResolvedValue({
      data: { plan: null, blocks: [], trips: [] },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText(String(currentYear))).toBeInTheDocument()
    })

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    for (const month of months) {
      expect(screen.getByText(month)).toBeInTheDocument()
    }
  })

  it('shows trips in the trip list', async () => {
    mockGet.mockResolvedValue({
      data: {
        plan: null,
        blocks: [],
        trips: [{
          id: 'trip-1',
          type: 'vacation',
          destination: 'Paris',
          start_date: '2026-08-10',
          end_date: '2026-08-20',
          status: 'booked',
        }],
      },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })
  })

  it('shows blocks in the block list', async () => {
    mockGet.mockResolvedValue({
      data: {
        plan: { id: 'plan-1', year: 2026, user_id: 'user-1', notes: null, created_at: '2026-01-01' },
        blocks: [{
          id: 'block-1',
          annual_plan_id: 'plan-1',
          type: 'pto',
          start_date: '2026-07-01',
          end_date: '2026-07-05',
          destination: 'Beach',
          notes: null,
        }],
        trips: [],
      },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Beach')).toBeInTheDocument()
    })
  })

  it('opens create block modal on Add Block click', async () => {
    mockGet.mockResolvedValue({
      data: { plan: null, blocks: [], trips: [] },
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('Add Block')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Add Block'))

    expect(screen.getByText('Add Calendar Block')).toBeInTheDocument()
  })
})
