import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  calendarApi: {
    getHolidays: (year: number) => mockGet('/calendar/holidays', { params: { year } }),
    getSupportedCountries: () => mockGet('/calendar/supported-countries'),
    enableCountry: (data: unknown) => mockPost('/calendar/holidays/country', data),
    disableCountry: (code: string, year: number) => mockDelete(`/calendar/holidays/country/${code}`, { params: { year } }),
    createCustomDay: (data: unknown) => mockPost('/calendar/custom-days', data),
    deleteCustomDay: (id: string) => mockDelete(`/calendar/custom-days/${id}`),
  },
}))

import { useHolidays, useEnableCountry, useCreateCustomDay } from '../hooks/useHolidays'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useHolidays', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches holidays for a year', async () => {
    const holidayData = {
      holidays: [{ date: '2026-01-01', name: "New Year's Day", country_code: 'US' }],
      custom_days: [],
      enabled_countries: [{ id: 'cal-1', country_code: 'US', year: 2026 }],
    }
    mockGet.mockResolvedValue({ data: holidayData })

    const { result } = renderHook(() => useHolidays(2026), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.holidays).toHaveLength(1)
  })
})

describe('useEnableCountry', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('enables a country calendar', async () => {
    mockPost.mockResolvedValue({ data: { id: 'cal-1', country_code: 'US', year: 2026 } })

    const { result } = renderHook(() => useEnableCountry(2026), { wrapper: createWrapper() })
    result.current.mutate('US')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/calendar/holidays/country', { country_code: 'US', year: 2026 })
  })
})

describe('useCreateCustomDay', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a custom day', async () => {
    mockPost.mockResolvedValue({ data: { id: 'cd-1', name: 'Birthday', date: '2026-05-15', recurring: true } })

    const { result } = renderHook(() => useCreateCustomDay(2026), { wrapper: createWrapper() })
    result.current.mutate({ name: 'Birthday', date: '2026-05-15', recurring: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
