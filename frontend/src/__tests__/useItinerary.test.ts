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
  itineraryApi: {
    listDays: (tripId: string) => mockGet(`/itinerary/trips/${tripId}/days`),
    createDay: (tripId: string, data: unknown) => mockPost(`/itinerary/trips/${tripId}/days`, data),
    listActivities: (dayId: string) => mockGet(`/itinerary/days/${dayId}/activities`),
    createActivity: (dayId: string, data: unknown) => mockPost(`/itinerary/days/${dayId}/activities`, data),
    updateActivity: (activityId: string, data: unknown) => mockPatch(`/itinerary/activities/${activityId}`, data),
    deleteActivity: (activityId: string) => mockDelete(`/itinerary/activities/${activityId}`),
    reorderActivities: (dayId: string, activityIds: string[]) => mockPatch(`/itinerary/days/${dayId}/reorder`, { activity_ids: activityIds }),
    deleteDay: (dayId: string) => mockDelete(`/itinerary/days/${dayId}`),
    generateDays: (tripId: string) => mockPost(`/itinerary/trips/${tripId}/days/generate`),
  },
}))

import {
  useItineraryDays,
  useActivities,
  useCreateDay,
  useCreateActivity,
  useDeleteActivity,
  useReorderActivities,
  useDeleteDay,
  useGenerateDays,
} from '../hooks/useItinerary'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useItineraryDays', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches itinerary days for a trip', async () => {
    const days = [
      { id: 'day-1', trip_id: 'trip-1', date: '2026-03-01', notes: null, activity_count: 2 },
      { id: 'day-2', trip_id: 'trip-1', date: '2026-03-02', notes: null, activity_count: 0 },
    ]
    mockGet.mockResolvedValue({ data: days })

    const { result } = renderHook(() => useItineraryDays('trip-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(days)
    expect(mockGet).toHaveBeenCalledWith('/itinerary/trips/trip-1/days')
  })
})

describe('useActivities', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches activities for a day', async () => {
    const activities = [
      { id: 'act-1', itinerary_day_id: 'day-1', title: 'Visit Museum', category: 'activity', sort_order: 0 },
      { id: 'act-2', itinerary_day_id: 'day-1', title: 'Lunch', category: 'food', sort_order: 1 },
    ]
    mockGet.mockResolvedValue({ data: activities })

    const { result } = renderHook(() => useActivities('day-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(activities)
    expect(mockGet).toHaveBeenCalledWith('/itinerary/days/day-1/activities')
  })
})

describe('useCreateDay', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates an itinerary day', async () => {
    const newDay = { id: 'day-1', trip_id: 'trip-1', date: '2026-03-01', notes: null, activity_count: 0 }
    mockPost.mockResolvedValue({ data: newDay })

    const { result } = renderHook(() => useCreateDay('trip-1'), { wrapper: createWrapper() })
    result.current.mutate({ date: '2026-03-01' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(newDay)
    expect(mockPost).toHaveBeenCalledWith('/itinerary/trips/trip-1/days', { date: '2026-03-01' })
  })
})

describe('useCreateActivity', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates an activity', async () => {
    const newActivity = { id: 'act-1', itinerary_day_id: 'day-1', title: 'Visit Museum', category: 'activity', sort_order: 0 }
    mockPost.mockResolvedValue({ data: newActivity })

    const { result } = renderHook(() => useCreateActivity('day-1', 'trip-1'), { wrapper: createWrapper() })
    result.current.mutate({ title: 'Visit Museum', category: 'activity' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(newActivity)
    expect(mockPost).toHaveBeenCalledWith('/itinerary/days/day-1/activities', { title: 'Visit Museum', category: 'activity' })
  })
})

describe('useDeleteActivity', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes an activity', async () => {
    mockDelete.mockResolvedValue({})

    const { result } = renderHook(() => useDeleteActivity('trip-1'), { wrapper: createWrapper() })
    result.current.mutate({ activityId: 'act-1', dayId: 'day-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/itinerary/activities/act-1')
  })
})

describe('useReorderActivities', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('reorders activities', async () => {
    const reordered = [
      { id: 'act-2', sort_order: 0 },
      { id: 'act-1', sort_order: 1 },
    ]
    mockPatch.mockResolvedValue({ data: reordered })

    const { result } = renderHook(() => useReorderActivities('day-1'), { wrapper: createWrapper() })
    result.current.mutate(['act-2', 'act-1'])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(reordered)
    expect(mockPatch).toHaveBeenCalledWith('/itinerary/days/day-1/reorder', { activity_ids: ['act-2', 'act-1'] })
  })
})

describe('useDeleteDay', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes an itinerary day', async () => {
    mockDelete.mockResolvedValue({})

    const { result } = renderHook(() => useDeleteDay('trip-1'), { wrapper: createWrapper() })
    result.current.mutate('day-1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/itinerary/days/day-1')
  })
})

describe('useGenerateDays', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('generates days from trip dates', async () => {
    const days = [
      { id: 'day-1', trip_id: 'trip-1', date: '2026-03-01', notes: null, activity_count: 0 },
      { id: 'day-2', trip_id: 'trip-1', date: '2026-03-02', notes: null, activity_count: 0 },
      { id: 'day-3', trip_id: 'trip-1', date: '2026-03-03', notes: null, activity_count: 0 },
    ]
    mockPost.mockResolvedValue({ data: days })

    const { result } = renderHook(() => useGenerateDays('trip-1'), { wrapper: createWrapper() })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(days)
    expect(mockPost).toHaveBeenCalledWith('/itinerary/trips/trip-1/days/generate')
  })
})
