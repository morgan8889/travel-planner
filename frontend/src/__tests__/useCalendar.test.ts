import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

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

import { useCalendarYear, useCreatePlan, useCreateBlock, useDeleteBlock } from '../hooks/useCalendar'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useCalendarYear', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches calendar year data', async () => {
    const yearData = {
      plan: { id: 'plan-1', year: 2026, user_id: 'user-1', notes: null, created_at: '2026-01-01' },
      blocks: [],
      trips: [{ id: 'trip-1', destination: 'Paris', start_date: '2026-08-01', end_date: '2026-08-10', type: 'vacation', status: 'booked' }],
    }
    mockGet.mockResolvedValue({ data: yearData })

    const { result } = renderHook(() => useCalendarYear(2026), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(yearData)
  })
})

describe('useCreatePlan', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates annual plan', async () => {
    const newPlan = { id: 'plan-1', year: 2026, user_id: 'user-1', notes: null, created_at: '2026-01-01' }
    mockPost.mockResolvedValue({ data: newPlan })

    const { result } = renderHook(() => useCreatePlan(2026), { wrapper: createWrapper() })
    result.current.mutate({ year: 2026 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(newPlan)
  })
})

describe('useCreateBlock', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates calendar block', async () => {
    const newBlock = { id: 'block-1', annual_plan_id: 'plan-1', type: 'pto', start_date: '2026-07-01', end_date: '2026-07-05', destination: null, notes: null }
    mockPost.mockResolvedValue({ data: newBlock })

    const { result } = renderHook(() => useCreateBlock(2026), { wrapper: createWrapper() })
    result.current.mutate({ annual_plan_id: 'plan-1', type: 'pto', start_date: '2026-07-01', end_date: '2026-07-05' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(newBlock)
  })
})

describe('useDeleteBlock', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes calendar block', async () => {
    mockDelete.mockResolvedValue({})

    const { result } = renderHook(() => useDeleteBlock(2026), { wrapper: createWrapper() })
    result.current.mutate('block-1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/calendar/blocks/block-1')
  })
})
