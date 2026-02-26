import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

vi.mock('../lib/api', () => ({
  gmailApi: {
    getStatus: vi.fn().mockResolvedValue({ connected: false, last_sync_at: null }),
    getAuthUrl: vi.fn(),
    disconnect: vi.fn().mockResolvedValue({}),
    startScan: vi.fn().mockResolvedValue({ scan_id: 'scan-1' }),
    getLatestScan: vi.fn().mockResolvedValue(null),
    getInbox: vi.fn().mockResolvedValue({ pending: [], unmatched: [] }),
    assignUnmatched: vi.fn().mockResolvedValue({}),
    dismissUnmatched: vi.fn().mockResolvedValue({}),
    cancelScan: vi.fn().mockResolvedValue({}),
  },
  itineraryApi: {
    updateActivity: vi.fn().mockResolvedValue({}),
    deleteActivity: vi.fn().mockResolvedValue({}),
  },
}))

import { useGmailStatus } from '../hooks/useGmail'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useGmailStatus', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns not-connected status', async () => {
    const { result } = renderHook(() => useGmailStatus(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.connected).toBe(false)
  })
})
