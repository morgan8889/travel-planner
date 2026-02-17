import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  createRouter,
  createRootRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router'
import { EmptyTripsState } from '../components/trips/EmptyTripsState'

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

function renderWithRouter(component: () => React.JSX.Element) {
  const rootRoute = createRootRoute({ component })
  const routeTree = rootRoute.addChildren([])
  const memoryHistory = createMemoryHistory({ initialEntries: ['/'] })
  const router = createRouter({ routeTree, history: memoryHistory })

  return render(<RouterProvider router={router} />)
}

describe('EmptyTripsState', () => {
  it('renders heading text', async () => {
    renderWithRouter(EmptyTripsState)
    expect(await screen.findByText('No trips yet')).toBeInTheDocument()
  })

  it('renders encouraging subtext', async () => {
    renderWithRouter(EmptyTripsState)
    expect(
      await screen.findByText(/your next adventure is just a click away/i)
    ).toBeInTheDocument()
  })

  it('renders CTA button', async () => {
    renderWithRouter(EmptyTripsState)
    expect(await screen.findByText('Plan Your First Trip')).toBeInTheDocument()
  })

  it('CTA links to new trip page', async () => {
    renderWithRouter(EmptyTripsState)
    const link = (await screen.findByText('Plan Your First Trip')).closest('a')
    expect(link).toHaveAttribute('href', '/trips/new')
  })
})
