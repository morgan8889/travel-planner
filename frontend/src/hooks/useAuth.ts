import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/api'

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.deleteAccount,
    onSuccess: () => {
      queryClient.clear()
    },
  })
}
