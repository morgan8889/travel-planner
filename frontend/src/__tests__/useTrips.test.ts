import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useTrips, useCreateTrip, useDeleteTrip } from '../hooks/useTrips'
import { useAddMember, useRemoveMember } from '../hooks/useMembers'

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
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useTrips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches trips from /api/trips', async () => {
    const trips = [{ id: 'trip-1', destination: 'Paris' }]
    mockGet.mockResolvedValue({ data: trips })

    const { result } = renderHook(() => useTrips(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(trips)
    expect(mockGet).toHaveBeenCalledWith('/trips', expect.objectContaining({}))
  })

  it('passes status filter as query param', async () => {
    mockGet.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useTrips('planning'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/trips', { params: { status: 'planning' } })
  })
})

describe('useCreateTrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts to /trips and returns created trip', async () => {
    const newTrip = { id: 'trip-new', destination: 'Tokyo' }
    mockPost.mockResolvedValue({ data: newTrip })

    const { result } = renderHook(() => useCreateTrip(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      type: 'vacation',
      destination: 'Tokyo',
      start_date: '2026-07-01',
      end_date: '2026-07-10',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(newTrip)
    expect(mockPost).toHaveBeenCalledWith('/trips', expect.objectContaining({ destination: 'Tokyo' }))
  })
})

describe('useDeleteTrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes trip by id', async () => {
    mockDelete.mockResolvedValue({})

    const { result } = renderHook(() => useDeleteTrip(), {
      wrapper: createWrapper(),
    })

    result.current.mutate('trip-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/trips/trip-1')
  })
})

describe('useAddMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts email to members endpoint', async () => {
    const member = { id: 'member-new', email: 'new@example.com', role: 'member' }
    mockPost.mockResolvedValue({ data: member })

    const { result } = renderHook(() => useAddMember('trip-1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('new@example.com')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/trips/trip-1/members', { email: 'new@example.com' })
  })
})

describe('useRemoveMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes member and succeeds', async () => {
    mockDelete.mockResolvedValue({})

    const { result } = renderHook(() => useRemoveMember('trip-1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('member-2')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/trips/trip-1/members/member-2')
  })
})
