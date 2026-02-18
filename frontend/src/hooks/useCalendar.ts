import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../lib/api'
import type { CreateAnnualPlan, CreateCalendarBlock, UpdateCalendarBlock } from '../lib/types'

export const calendarKeys = {
  all: ['calendar'] as const,
  year: (year: number) => [...calendarKeys.all, 'year', year] as const,
}

export function useCalendarYear(year: number) {
  return useQuery({
    queryKey: calendarKeys.year(year),
    queryFn: async () => {
      const { data } = await calendarApi.getYear(year)
      return data
    },
    enabled: !!year,
  })
}

export function useCreatePlan(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateAnnualPlan) => {
      const { data: plan } = await calendarApi.createPlan(data)
      return plan
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}

export function useCreateBlock(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCalendarBlock) => {
      const { data: block } = await calendarApi.createBlock(data)
      return block
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}

export function useUpdateBlock(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ blockId, data }: { blockId: string; data: UpdateCalendarBlock }) => {
      const { data: block } = await calendarApi.updateBlock(blockId, data)
      return block
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}

export function useDeleteBlock(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (blockId: string) => {
      await calendarApi.deleteBlock(blockId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.year(year) })
    },
  })
}
