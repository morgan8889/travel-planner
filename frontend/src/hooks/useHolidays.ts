import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../lib/api'
import type { CreateCustomDay } from '../lib/types'

export const holidayKeys = {
  all: ['holidays'] as const,
  year: (year: number) => [...holidayKeys.all, 'year', year] as const,
  countries: ['holidays', 'countries'] as const,
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: holidayKeys.year(year),
    queryFn: async () => {
      const { data } = await calendarApi.getHolidays(year)
      return data
    },
    enabled: !!year,
  })
}

export function useSupportedCountries() {
  return useQuery({
    queryKey: holidayKeys.countries,
    queryFn: async () => {
      const { data } = await calendarApi.getSupportedCountries()
      return data
    },
    staleTime: Infinity,
  })
}

export function useEnableCountry(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (countryCode: string) => {
      const { data } = await calendarApi.enableCountry({ country_code: countryCode, year })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}

export function useDisableCountry(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (countryCode: string) => {
      await calendarApi.disableCountry(countryCode, year)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}

export function useCreateCustomDay(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCustomDay) => {
      const { data: result } = await calendarApi.createCustomDay(data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}

export function useDeleteCustomDay(year: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await calendarApi.deleteCustomDay(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.year(year) })
    },
  })
}
