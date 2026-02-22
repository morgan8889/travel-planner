import { useMutation } from '@tanstack/react-query'
import { authApi } from '../lib/api'

export function useDeleteAccount() {
  return useMutation({
    mutationFn: authApi.deleteAccount,
  })
}
