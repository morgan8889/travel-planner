import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { TripMember, MemberRole, TripInvitation } from '../lib/types'
import { tripKeys } from './useTrips'

export function useInvitations(tripId: string, isOwner: boolean) {
  return useQuery({
    queryKey: tripKeys.invitations(tripId),
    queryFn: async () => {
      const { data } = await api.get<TripInvitation[]>(`/trips/${tripId}/invitations`)
      return data
    },
    enabled: isOwner,
  })
}

export function useAddMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post<TripMember>(`/trips/${tripId}/members`, { email })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      queryClient.invalidateQueries({ queryKey: tripKeys.invitations(tripId) })
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
