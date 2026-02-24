import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { GmailImportSection } from '../components/trips/GmailImportSection'

const mockUseGmailStatus = vi.fn()
const mockUsePendingImportCount = vi.fn()

vi.mock('../hooks/useGmail', () => ({
  useGmailStatus: () => mockUseGmailStatus(),
  usePendingImportCount: (_tripId: string) => mockUsePendingImportCount(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    createElement('a', { href: to }, children),
}))

function createWrapper() {
  const queryClient = new QueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  mockUseGmailStatus.mockReturnValue({ data: { connected: false }, isLoading: false })
  mockUsePendingImportCount.mockReturnValue(0)
})

describe('GmailImportSection', () => {
  it('renders nothing when gmail is not connected', () => {
    mockUseGmailStatus.mockReturnValue({ data: { connected: false } })
    const { container } = render(createElement(GmailImportSection, { tripId: 'trip-1' }), {
      wrapper: createWrapper(),
    })
    expect(container.firstChild).toBeNull()
  })

  it('shows scan link when connected with no pending imports', () => {
    mockUseGmailStatus.mockReturnValue({ data: { connected: true } })
    mockUsePendingImportCount.mockReturnValue(0)
    render(createElement(GmailImportSection, { tripId: 'trip-1' }), { wrapper: createWrapper() })
    expect(screen.getByText(/scan all trips in settings/i)).toBeInTheDocument()
  })

  it('shows pending count link when there are pending imports', () => {
    mockUseGmailStatus.mockReturnValue({ data: { connected: true } })
    mockUsePendingImportCount.mockReturnValue(3)
    render(createElement(GmailImportSection, { tripId: 'trip-1' }), { wrapper: createWrapper() })
    expect(screen.getByText(/3 pending gmail imports/i)).toBeInTheDocument()
    expect(screen.getByText(/review in settings/i)).toBeInTheDocument()
  })

  it('link points to /settings', () => {
    mockUseGmailStatus.mockReturnValue({ data: { connected: true } })
    render(createElement(GmailImportSection, { tripId: 'trip-1' }), { wrapper: createWrapper() })
    expect(screen.getByRole('link')).toHaveAttribute('href', '/settings')
  })
})
