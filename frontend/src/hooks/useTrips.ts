import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Trip, TripSummary, TripCreate, TripUpdate, TripStatus } from '../lib/types'

export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (status?: TripStatus) => [...tripKeys.lists(), { status }] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripKeys.details(), id] as const,
}

export function useTrips(status?: TripStatus) {
  return useQuery({
    queryKey: tripKeys.list(status),
    queryFn: async () => {
      const params = status ? { status } : undefined
      const { data } = await api.get<TripSummary[]>('/trips', { params })
      return data
    },
  })
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: tripKeys.detail(tripId),
    queryFn: async () => {
      const { data } = await api.get<Trip>(`/trips/${tripId}`)
      return data
    },
    enabled: !!tripId,
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (trip: TripCreate) => {
      const { data } = await api.post<Trip>('/trips', trip)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}

export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (update: TripUpdate) => {
      const { data } = await api.patch<Trip>(`/trips/${tripId}`, update)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tripId: string) => {
      await api.delete(`/trips/${tripId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}
