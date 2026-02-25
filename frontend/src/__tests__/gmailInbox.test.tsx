import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { GmailInbox } from '../components/gmail/GmailInbox'

const mockUseGmailInbox = vi.fn()
const mockUseConfirmImport = vi.fn()
const mockUseRejectImport = vi.fn()
const mockUseAssignUnmatched = vi.fn()
const mockUseDismissUnmatched = vi.fn()
const mockUseDismissAllUnmatched = vi.fn()
const mockUseTrips = vi.fn()

vi.mock('../hooks/useGmail', () => ({
  useGmailInbox: () => mockUseGmailInbox(),
  useConfirmImport: () => mockUseConfirmImport(),
  useRejectImport: () => mockUseRejectImport(),
  useAssignUnmatched: () => mockUseAssignUnmatched(),
  useDismissUnmatched: () => mockUseDismissUnmatched(),
  useDismissAllUnmatched: () => mockUseDismissAllUnmatched(),
}))

vi.mock('../hooks/useTrips', () => ({
  useTrips: () => mockUseTrips(),
}))

function createWrapper() {
  const queryClient = new QueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  mockUseTrips.mockReturnValue({ data: [], isLoading: false })
  mockUseConfirmImport.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseRejectImport.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseAssignUnmatched.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseDismissUnmatched.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseDismissAllUnmatched.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe('GmailInbox', () => {
  it('shows empty state when no pending or unmatched', () => {
    mockUseGmailInbox.mockReturnValue({
      data: { pending: [], unmatched: [] },
      isLoading: false,
    })

    render(createElement(GmailInbox, {}), { wrapper: createWrapper() })
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
  })

  it('renders pending activities grouped by trip', () => {
    mockUseGmailInbox.mockReturnValue({
      data: {
        pending: [
          {
            trip_id: 't1',
            trip_destination: 'Florida',
            activities: [
              {
                id: 'a1',
                title: 'Flight AA123',
                category: 'transport',
                itinerary_day_id: 'd1',
                start_time: null,
                end_time: null,
                location: null,
                latitude: null,
                longitude: null,
                notes: null,
                confirmation_number: null,
                sort_order: 999,
                check_out_date: null,
                source: 'gmail_import',
                source_ref: 'e1',
                import_status: 'pending_review',
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
          },
        ],
        unmatched: [],
      },
      isLoading: false,
    })

    render(createElement(GmailInbox, {}), { wrapper: createWrapper() })
    expect(screen.getByText('Flight AA123')).toBeInTheDocument()
    expect(screen.getByText('Florida')).toBeInTheDocument()
    expect(screen.getByText('Accept')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('renders unmatched imports with assign and dismiss buttons', () => {
    mockUseGmailInbox.mockReturnValue({
      data: {
        pending: [],
        unmatched: [
          {
            id: 'um1',
            email_id: 'e2',
            parsed_data: {
              title: 'Marriott Boston',
              category: 'lodging',
              date: '2026-04-10',
              location: 'Boston',
            },
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
      isLoading: false,
    })

    render(createElement(GmailInbox, {}), { wrapper: createWrapper() })
    expect(screen.getByText('Marriott Boston')).toBeInTheDocument()
    expect(screen.getByText('Assign')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })
})
