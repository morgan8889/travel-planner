import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { itineraryApi } from '../lib/api'
import type { CreateItineraryDay, CreateActivity, UpdateActivity } from '../lib/types'

export const itineraryKeys = {
  all: ['itinerary'] as const,
  days: (tripId: string) => [...itineraryKeys.all, 'days', tripId] as const,
  activities: (dayId: string) => [...itineraryKeys.all, 'activities', dayId] as const,
}

export function useItineraryDays(tripId: string) {
  return useQuery({
    queryKey: itineraryKeys.days(tripId),
    queryFn: async () => {
      const { data } = await itineraryApi.listDays(tripId)
      return data
    },
    enabled: !!tripId,
  })
}

export function useActivities(dayId: string) {
  return useQuery({
    queryKey: itineraryKeys.activities(dayId),
    queryFn: async () => {
      const { data } = await itineraryApi.listActivities(dayId)
      return data
    },
    enabled: !!dayId,
  })
}

export function useCreateDay(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateItineraryDay) => {
      const { data: day } = await itineraryApi.createDay(tripId, data)
      return day
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
    },
  })
}

export function useCreateActivity(dayId: string, tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateActivity) => {
      const { data: activity } = await itineraryApi.createActivity(dayId, data)
      return activity
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
    },
  })
}

export function useUpdateActivity(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ activityId, data }: { activityId: string; dayId: string; data: UpdateActivity }) => {
      const { data: activity } = await itineraryApi.updateActivity(activityId, data)
      return activity
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
    },
  })
}

export function useDeleteActivity(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ activityId }: { activityId: string; dayId: string }) => {
      await itineraryApi.deleteActivity(activityId)
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
    },
  })
}
