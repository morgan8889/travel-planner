import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gmailApi, itineraryApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { GmailInbox, ScanProgressEvent, ScanRun } from '../lib/types'
import { itineraryKeys } from './useItinerary'

export const gmailKeys = {
  status: ['gmail', 'status'] as const,
  latestScan: ['gmail', 'latestScan'] as const,
  inbox: ['gmail', 'inbox'] as const,
}

export function useGmailStatus() {
  return useQuery({
    queryKey: gmailKeys.status,
    queryFn: gmailApi.getStatus,
  })
}

export function useLatestScan() {
  return useQuery({
    queryKey: gmailKeys.latestScan,
    queryFn: gmailApi.getLatestScan,
  })
}

export function useGmailInbox() {
  return useQuery({
    queryKey: gmailKeys.inbox,
    queryFn: gmailApi.getInbox,
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

export function useConfirmImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (activityId: string) =>
      itineraryApi.updateActivity(activityId, { import_status: 'confirmed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useRejectImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (activityId: string) => itineraryApi.deleteActivity(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useAssignUnmatched() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ unmatchedId, tripId }: { unmatchedId: string; tripId: string }) =>
      gmailApi.assignUnmatched(unmatchedId, tripId),
    onMutate: async ({ unmatchedId }) => {
      await queryClient.cancelQueries({ queryKey: gmailKeys.inbox })
      const previous = queryClient.getQueryData<GmailInbox>(gmailKeys.inbox)
      if (previous) {
        queryClient.setQueryData<GmailInbox>(gmailKeys.inbox, {
          ...previous,
          unmatched: previous.unmatched.filter((u) => u.id !== unmatchedId),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(gmailKeys.inbox, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useDismissUnmatched() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (unmatchedId: string) => gmailApi.dismissUnmatched(unmatchedId),
    onMutate: async (unmatchedId) => {
      await queryClient.cancelQueries({ queryKey: gmailKeys.inbox })
      const previous = queryClient.getQueryData<GmailInbox>(gmailKeys.inbox)
      if (previous) {
        queryClient.setQueryData<GmailInbox>(gmailKeys.inbox, {
          ...previous,
          unmatched: previous.unmatched.filter((u) => u.id !== unmatchedId),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(gmailKeys.inbox, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
    },
  })
}

export function useDismissAllUnmatched() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => gmailApi.dismissAllUnmatched(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: gmailKeys.inbox })
      const previous = queryClient.getQueryData<GmailInbox>(gmailKeys.inbox)
      if (previous) {
        queryClient.setQueryData<GmailInbox>(gmailKeys.inbox, {
          ...previous,
          unmatched: [],
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(gmailKeys.inbox, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
    },
  })
}

// SSE-based scan hook
export interface ScanState {
  scanId: string | null
  isRunning: boolean
  events: ScanProgressEvent[]
  summary: { imported: number; skipped: number; unmatched: number } | null
  error: string | null
  emailsFound: number
}

export function useGmailScan() {
  const queryClient = useQueryClient()
  const abortRef = useRef<AbortController | null>(null)
  const scanIdRef = useRef<string | null>(null)
  const [state, setState] = useState<ScanState>({
    scanId: null,
    isRunning: false,
    events: [],
    summary: null,
    error: null,
    emailsFound: 0,
  })

  const startScan = useCallback(
    async (rescanRejected = false): Promise<boolean> => {
      setState({
        scanId: null,
        isRunning: true,
        events: [],
        summary: null,
        error: null,
        emailsFound: 0,
      })

      let success = false

      try {
        // Start scan, or resume the already-running one on 409
        let scan_id: string
        try {
          scan_id = (await gmailApi.startScan(rescanRejected)).scan_id
        } catch (startErr: unknown) {
          const axiosErr = startErr as {
            response?: { status?: number; data?: { detail?: { scan_id?: string } } }
          }
          if (
            axiosErr?.response?.status === 409 &&
            axiosErr.response?.data?.detail?.scan_id
          ) {
            scan_id = axiosErr.response.data.detail.scan_id
          } else {
            throw startErr
          }
        }

        scanIdRef.current = scan_id
        setState((s) => ({ ...s, scanId: scan_id }))

        const {
          data: { session },
        } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('Not authenticated')

        abortRef.current = new AbortController()
        const response = await fetch(`/api/gmail/scan/${scan_id}/stream`, {
          signal: abortRef.current.signal,
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          const errorCode = response.status === 401 ? 'gmail_auth_failed' : 'scan_failed'
          setState((s) => ({ ...s, isRunning: false, error: errorCode }))
          return false
        }
        if (!response.body) throw new Error('No response body')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let receivedTerminalEvent = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          let eventType = ''
          let dataLine = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              dataLine = line.slice(6).trim()
            } else if ((line === '' || line === '\r') && dataLine) {
              try {
                const payload = JSON.parse(dataLine) as Record<string, unknown>
                if (eventType === 'progress') {
                  setState((s) => ({
                    ...s,
                    events: [...s.events, payload as unknown as ScanProgressEvent],
                  }))
                } else if (eventType === 'done') {
                  receivedTerminalEvent = true
                  success = true
                  setState((s) => ({
                    ...s,
                    isRunning: false,
                    summary: payload as unknown as ScanState['summary'],
                  }))
                  queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
                  queryClient.invalidateQueries({ queryKey: gmailKeys.latestScan })
                } else if (eventType === 'error') {
                  receivedTerminalEvent = true
                  setState((s) => ({
                    ...s,
                    isRunning: false,
                    error: (payload.code as string) ?? 'scan_failed',
                  }))
                }
              } catch (parseErr) {
                console.error('[GmailScan] Failed to parse SSE event:', eventType, dataLine, parseErr)
                if (eventType === 'done') {
                  receivedTerminalEvent = true
                  setState((s) => ({ ...s, isRunning: false, error: 'scan_failed' }))
                }
              }
              eventType = ''
              dataLine = ''
            }
          }
        }

        // Stream ended — clean up if we never got a terminal event
        if (!receivedTerminalEvent) {
          setState((s) => {
            if (s.isRunning) {
              return { ...s, isRunning: false, error: 'scan_failed' }
            }
            return s
          })
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return false
        setState((s) => ({ ...s, isRunning: false, error: 'scan_failed' }))
      }

      return success
    },
    [queryClient],
  )

  const cancelScan = useCallback(() => {
    abortRef.current?.abort()
    const scanId = scanIdRef.current
    if (scanId) {
      gmailApi.cancelScan(scanId).catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status !== 404 && status !== 409) {
          console.error('[GmailScan] Failed to cancel scan on server:', err)
        }
      })
    }
    setState((s) => ({ ...s, isRunning: false }))
  }, [])

  return { state, startScan, cancelScan }
}

// Legacy — kept for trip detail banner (pending count only)
export function usePendingImportCount(tripId: string) {
  const { data: inbox } = useGmailInbox()
  const group = inbox?.pending.find((g) => g.trip_id === tripId)
  return group?.activities.length ?? 0
}

// Legacy alias kept for backward compat with GmailImportSection
export { useGmailStatus as useGmailConnection }

// Re-export ScanRun type for consumers
export type { ScanRun }
