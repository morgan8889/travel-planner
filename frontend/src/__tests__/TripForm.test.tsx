import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRouter,
  createRootRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'
import { TripForm } from '../components/trips/TripForm'
import { geocodeApi } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  geocodeApi: {
    search: vi.fn().mockResolvedValue({ data: [] }),
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

describe('TripForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
    submitLabel: 'Create Trip',
  }

  it('renders all form fields', async () => {
    renderWithProviders(<TripForm {...defaultProps} />)

    // Trip type cards
    expect(await screen.findByText('Vacation')).toBeInTheDocument()
    expect(screen.getByText('Remote Week')).toBeInTheDocument()
    expect(screen.getByText('Sabbatical')).toBeInTheDocument()

    // Inputs
    expect(screen.getByLabelText('Destination')).toBeInTheDocument()
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument()
    expect(screen.getByLabelText('End Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument()

    // Buttons
    expect(screen.getByText('Create Trip')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows validation error when submitting without destination', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TripForm {...defaultProps} />)

    const submitButton = await screen.findByText('Create Trip')
    await user.click(submitButton)

    expect(await screen.findByText('Destination is required')).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('shows date error when end_date < start_date', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TripForm {...defaultProps} />)

    const destination = await screen.findByLabelText('Destination')
    const startDate = screen.getByLabelText('Start Date')
    const endDate = screen.getByLabelText('End Date')

    await user.type(destination, 'Tokyo')
    await user.type(startDate, '2026-06-20')
    await user.type(endDate, '2026-06-15')

    const submitButton = screen.getByText('Create Trip')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('End date must be on or after start date')).toBeInTheDocument()
    })
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with valid data', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<TripForm {...defaultProps} onSubmit={onSubmit} />)

    const destination = await screen.findByLabelText('Destination')
    const startDate = screen.getByLabelText('Start Date')
    const endDate = screen.getByLabelText('End Date')

    await user.type(destination, 'Tokyo')
    await user.type(startDate, '2026-06-15')
    await user.type(endDate, '2026-06-22')

    const submitButton = screen.getByText('Create Trip')
    await user.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vacation',
          destination: 'Tokyo',
          start_date: '2026-06-15',
          end_date: '2026-06-22',
          status: 'dreaming',
        })
      )
    })
  })

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<TripForm {...defaultProps} onCancel={onCancel} />)

    await user.click(await screen.findByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('renders with default values when editing', async () => {
    renderWithProviders(
      <TripForm
        {...defaultProps}
        defaultValues={{
          type: 'remote_week',
          destination: 'Lisbon',
          start_date: '2026-07-01',
          end_date: '2026-07-07',
          status: 'booked',
          notes: 'Work from a cafe',
        }}
        submitLabel="Save Changes"
      />
    )

    expect(await screen.findByLabelText('Destination')).toHaveValue('Lisbon')
    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('End Date')).toHaveValue('2026-07-07')
    expect(screen.getByLabelText('Status')).toHaveValue('booked')
    expect(screen.getByLabelText(/Notes/)).toHaveValue('Work from a cafe')
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })

  it('submits with null coordinates when destination is typed freeform', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<TripForm {...defaultProps} onSubmit={onSubmit} />)

    const destination = await screen.findByLabelText('Destination')
    await user.type(destination, 'Anywhere')
    await user.type(screen.getByLabelText('Start Date'), '2026-08-01')
    await user.type(screen.getByLabelText('End Date'), '2026-08-07')
    await user.click(screen.getByText('Create Trip'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: 'Anywhere',
          destination_latitude: null,
          destination_longitude: null,
        })
      )
    })
  })

  it('submits with coordinates when geocode suggestion is selected', async () => {
    vi.mocked(geocodeApi.search).mockResolvedValue({
      data: [
        {
          place_name: 'Tokyo, Japan',
          latitude: 35.6762,
          longitude: 139.6503,
          place_type: 'place',
          context: 'Japan',
        },
      ],
    } as Awaited<ReturnType<typeof geocodeApi.search>>)

    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<TripForm {...defaultProps} onSubmit={onSubmit} />)

    const destination = await screen.findByLabelText('Destination')
    await user.type(destination, 'Tokyo')

    // Wait for debounce and suggestion to appear
    const suggestion = await screen.findByText('Tokyo', {}, { timeout: 1000 })
    await user.click(suggestion)

    await user.type(screen.getByLabelText('Start Date'), '2026-09-01')
    await user.type(screen.getByLabelText('End Date'), '2026-09-10')
    await user.click(screen.getByText('Create Trip'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: 'Tokyo, Japan',
          destination_latitude: 35.6762,
          destination_longitude: 139.6503,
        })
      )
    })
  })
})
