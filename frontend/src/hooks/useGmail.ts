import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gmailApi, itineraryApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { ScanProgressEvent, ScanRun } from '../lib/types'
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all })
    },
  })
}

export function useDismissUnmatched() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (unmatchedId: string) => gmailApi.dismissUnmatched(unmatchedId),
    onSuccess: () => {
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
  const [state, setState] = useState<ScanState>({
    scanId: null,
    isRunning: false,
    events: [],
    summary: null,
    error: null,
    emailsFound: 0,
  })

  const startScan = useCallback(
    async (rescanRejected = false) => {
      setState({
        scanId: null,
        isRunning: true,
        events: [],
        summary: null,
        error: null,
        emailsFound: 0,
      })

      try {
        const { scan_id } = await gmailApi.startScan(rescanRejected)
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

        if (!response.body) throw new Error('No response body')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

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
            } else if (line === '' && dataLine) {
              try {
                const payload = JSON.parse(dataLine) as Record<string, unknown>
                if (eventType === 'progress') {
                  setState((s) => ({
                    ...s,
                    events: [...s.events, payload as unknown as ScanProgressEvent],
                  }))
                } else if (eventType === 'done') {
                  setState((s) => ({
                    ...s,
                    isRunning: false,
                    summary: payload as unknown as ScanState['summary'],
                  }))
                  queryClient.invalidateQueries({ queryKey: gmailKeys.inbox })
                  queryClient.invalidateQueries({ queryKey: gmailKeys.latestScan })
                } else if (eventType === 'error') {
                  setState((s) => ({
                    ...s,
                    isRunning: false,
                    error: (payload.code as string) ?? 'scan_failed',
                  }))
                }
              } catch {
                // ignore parse errors
              }
              eventType = ''
              dataLine = ''
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        setState((s) => ({ ...s, isRunning: false, error: 'scan_failed' }))
      }
    },
    [queryClient],
  )

  const cancelScan = useCallback(() => {
    abortRef.current?.abort()
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
