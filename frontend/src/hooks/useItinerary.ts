import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { itineraryApi } from '../lib/api'
import type { Activity, CreateItineraryDay, CreateActivity, UpdateActivity } from '../lib/types'

export const itineraryKeys = {
  all: ['itinerary'] as const,
  days: (tripId: string) => [...itineraryKeys.all, 'days', tripId] as const,
  activities: (dayId: string) => [...itineraryKeys.all, 'activities', dayId] as const,
  tripActivities: (tripId: string, hasLocation = false) =>
    [...itineraryKeys.all, 'trip-activities', tripId, { hasLocation }] as const,
}

export function useTripActivities(tripId: string, hasLocation = false) {
  return useQuery({
    queryKey: itineraryKeys.tripActivities(tripId, hasLocation),
    queryFn: async () => {
      const { data } = await itineraryApi.listTripActivities(tripId, hasLocation)
      return data
    },
    enabled: !!tripId,
  })
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

export function useReorderActivities(dayId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (activityIds: string[]) => {
      const { data } = await itineraryApi.reorderActivities(dayId, activityIds)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
    },
  })
}

export function useDeleteDay(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dayId: string) => {
      await itineraryApi.deleteDay(dayId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
    },
  })
}

export function useGenerateDays(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await itineraryApi.generateDays(tripId)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
    },
  })
}

export function useMoveActivity(tripId: string) {
  const queryClient = useQueryClient()
  // Exact key for the hasLocation=false cache entry used by ItineraryTimeline (optimistic update target)
  const tripActivitiesKey = itineraryKeys.tripActivities(tripId)

  return useMutation({
    mutationFn: async ({ activityId, targetDayId }: { activityId: string; targetDayId: string }) => {
      const { data: activity } = await itineraryApi.updateActivity(activityId, { itinerary_day_id: targetDayId })
      return activity
    },
    onMutate: async ({ activityId, targetDayId }) => {
      await queryClient.cancelQueries({ queryKey: tripActivitiesKey })
      const previous = queryClient.getQueryData(tripActivitiesKey)
      queryClient.setQueryData<Activity[]>(tripActivitiesKey, (old) =>
        old?.map((a) => a.id === activityId ? { ...a, itinerary_day_id: targetDayId } : a) ?? []
      )
      return { previous }
    },
    onError: (err, vars, context) => {
      void err
      void vars
      if (context?.previous !== undefined) {
        queryClient.setQueryData(tripActivitiesKey, context.previous)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
      // Use the prefix (no hasLocation) to invalidate both hasLocation variants
      queryClient.invalidateQueries({ queryKey: [...itineraryKeys.all, 'trip-activities', tripId] })
    },
  })
}

export function useCreateActivityInDay(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dayId, data }: { dayId: string; data: CreateActivity }) => {
      const { data: activity } = await itineraryApi.createActivity(dayId, data)
      return activity
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.days(tripId) })
      // Use the prefix (no hasLocation) to invalidate both hasLocation variants
      queryClient.invalidateQueries({ queryKey: [...itineraryKeys.all, 'trip-activities', tripId] })
    },
  })
}

export function useReorderActivitiesForDay(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dayId, activityIds }: { dayId: string; activityIds: string[] }) => {
      const { data } = await itineraryApi.reorderActivities(dayId, activityIds)
      return data
    },
    onSuccess: (_data, { dayId }) => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.activities(dayId) })
      // Use the prefix (no hasLocation) to invalidate both hasLocation variants
      queryClient.invalidateQueries({ queryKey: [...itineraryKeys.all, 'trip-activities', tripId] })
    },
  })
}
