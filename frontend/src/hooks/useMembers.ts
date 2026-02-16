import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { TripMember, MemberRole } from '../lib/types'
import { tripKeys } from './useTrips'

export function useAddMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post<TripMember>(`/trips/${tripId}/members`, { email })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}

export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (memberId: string) => {
      await api.delete(`/trips/${tripId}/members/${memberId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}

export function useUpdateMemberRole(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: MemberRole }) => {
      const { data } = await api.patch<TripMember>(`/trips/${tripId}/members/${memberId}`, { role })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}
