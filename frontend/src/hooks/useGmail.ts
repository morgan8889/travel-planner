import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gmailApi, itineraryApi } from '../lib/api'
import { itineraryKeys } from './useItinerary'

export const gmailKeys = {
  status: ['gmail', 'status'] as const,
}

export function useGmailStatus() {
  return useQuery({
    queryKey: gmailKeys.status,
    queryFn: gmailApi.getStatus,
  })
}

export function usePendingImports(tripId: string) {
  return useQuery({
    queryKey: itineraryKeys.pendingImports(tripId),
    queryFn: () => itineraryApi.listTripPendingImports(tripId),
  })
}

export function useScanGmail(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => gmailApi.scan(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.pendingImports(tripId) })
      queryClient.invalidateQueries({ queryKey: gmailKeys.status })
    },
  })
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: gmailApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.status })
    },
  })
}

export function useConfirmImport(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (activityId: string) =>
      itineraryApi.updateActivity(activityId, { import_status: 'confirmed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.pendingImports(tripId) })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useRejectImport(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // Hard delete — ImportRecord stays so email won't be re-imported on next scan
    mutationFn: (activityId: string) => itineraryApi.deleteActivity(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.pendingImports(tripId) })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}
