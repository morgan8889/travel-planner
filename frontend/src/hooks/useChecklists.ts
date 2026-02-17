import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { checklistApi } from '../lib/api'
import type { CreateChecklist, CreateChecklistItem } from '../lib/types'

export const checklistKeys = {
  all: ['checklists'] as const,
  lists: (tripId: string) => [...checklistKeys.all, 'list', tripId] as const,
}

export function useChecklists(tripId: string) {
  return useQuery({
    queryKey: checklistKeys.lists(tripId),
    queryFn: async () => {
      const { data } = await checklistApi.list(tripId)
      return data
    },
    enabled: !!tripId,
  })
}

export function useCreateChecklist(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateChecklist) => {
      const { data: checklist } = await checklistApi.create(tripId, data)
      return checklist
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.lists(tripId) })
    },
  })
}

export function useAddChecklistItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ checklistId, data }: { checklistId: string; data: CreateChecklistItem }) => {
      const { data: item } = await checklistApi.addItem(checklistId, data)
      return item
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.lists(tripId) })
    },
  })
}

export function useToggleChecklistItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data: item } = await checklistApi.toggleItem(itemId)
      return item
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.lists(tripId) })
    },
  })
}
