import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { GmailImportSection } from '../components/trip/GmailImportSection'

const mockUseGmailStatus = vi.fn()
const mockUseScanGmail = vi.fn()
const mockUsePendingImports = vi.fn()
const mockUseConfirmImport = vi.fn()
const mockUseRejectImport = vi.fn()

vi.mock('../hooks/useGmail', () => ({
  useGmailStatus: () => mockUseGmailStatus(),
  useScanGmail: () => mockUseScanGmail(),
  usePendingImports: () => mockUsePendingImports(),
  useConfirmImport: () => mockUseConfirmImport(),
  useRejectImport: () => mockUseRejectImport(),
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
  mockUseScanGmail.mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined })
  mockUsePendingImports.mockReturnValue({ data: [], isLoading: false })
  mockUseConfirmImport.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseRejectImport.mockReturnValue({ mutate: vi.fn(), isPending: false })
})

describe('GmailImportSection', () => {
  it('shows "Connect in Settings" link when not connected', () => {
    render(createElement(GmailImportSection, { tripId: 'trip-1' }), { wrapper: createWrapper() })
    expect(screen.getByRole('link', { name: /connect in settings/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /connect in settings/i })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('shows scan button when connected', () => {
    mockUseGmailStatus.mockReturnValue({ data: { connected: true }, isLoading: false })
    render(createElement(GmailImportSection, { tripId: 'trip-1' }), { wrapper: createWrapper() })
    expect(screen.getByRole('button', { name: /scan emails/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument()
  })

  it('renders pending activity with confirm and reject buttons', () => {
    mockUseGmailStatus.mockReturnValue({ data: { connected: true }, isLoading: false })
    mockUsePendingImports.mockReturnValue({
      data: [
        {
          id: 'act-1',
          title: 'Flight AA123',
          category: 'transport',
          confirmation_number: 'XYZ789',
          import_status: 'pending_review',
          itinerary_day_id: 'd-1',
          start_time: null,
          end_time: null,
          location: null,
          latitude: null,
          longitude: null,
          notes: null,
          sort_order: 0,
          check_out_date: null,
          source: 'gmail_import',
          source_ref: 'msg-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      isLoading: false,
    })
    render(createElement(GmailImportSection, { tripId: 'trip-1' }), { wrapper: createWrapper() })
    expect(screen.getByText('Flight AA123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('calls confirm mutation on confirm click', async () => {
    const confirmMutate = vi.fn()
    mockUseGmailStatus.mockReturnValue({ data: { connected: true }, isLoading: false })
    mockUseConfirmImport.mockReturnValue({ mutate: confirmMutate, isPending: false })
    mockUsePendingImports.mockReturnValue({
      data: [
        {
          id: 'act-1',
          title: 'Hotel',
          category: 'lodging',
          confirmation_number: null,
          import_status: 'pending_review',
          itinerary_day_id: 'd-1',
          start_time: null,
          end_time: null,
          location: null,
          latitude: null,
          longitude: null,
          notes: null,
          sort_order: 0,
          check_out_date: null,
          source: 'gmail_import',
          source_ref: 'msg-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      isLoading: false,
    })
    const user = userEvent.setup()
    render(createElement(GmailImportSection, { tripId: 'trip-1' }), { wrapper: createWrapper() })
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(confirmMutate).toHaveBeenCalledWith('act-1')
  })
})
