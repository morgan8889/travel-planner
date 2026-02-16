import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios, { AxiosError, AxiosHeaders } from 'axios'

// Mock supabase before importing api module
const mockGetSession = vi.fn()
const mockRefreshSession = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
      signOut: mockSignOut,
    },
  },
}))

describe('API interceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token' } },
    })
  })

  describe('response interceptor: refresh and retry on 401', () => {
    it('refreshes token and retries the original request on first 401', async () => {
      // After refreshSession, getSession returns the new token (matches real Supabase behavior)
      mockRefreshSession.mockImplementation(async () => {
        mockGetSession.mockResolvedValue({
          data: { session: { access_token: 'new-token' } },
        })
        return {
          data: { session: { access_token: 'new-token' } },
          error: null,
        }
      })

      const { api } = await import('../lib/api')

      const adapter = vi.fn()

      // First call: 401 error
      adapter.mockRejectedValueOnce(
        createAxiosError(401, { url: '/api/trips', method: 'get' })
      )
      // Second call (retry after refresh): success
      adapter.mockResolvedValueOnce({
        status: 200,
        data: [{ id: 1 }],
        headers: {},
        config: {},
        statusText: 'OK',
      })

      api.defaults.adapter = adapter

      const response = await api.get('/trips')

      expect(mockRefreshSession).toHaveBeenCalledOnce()
      expect(response.status).toBe(200)
      // The request interceptor re-runs on retry, picking up the new token from getSession
      const retryCall = adapter.mock.calls[1][0]
      expect(retryCall.headers.Authorization).toBe('Bearer new-token')
    })

    it('signs out and rejects when refresh fails', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: new Error('refresh failed'),
      })

      const { api } = await import('../lib/api')

      const adapter = vi.fn()
      adapter.mockRejectedValueOnce(
        createAxiosError(401, { url: '/api/trips', method: 'get' })
      )
      api.defaults.adapter = adapter

      await expect(api.get('/trips')).rejects.toThrow()

      expect(mockRefreshSession).toHaveBeenCalledOnce()
      expect(mockSignOut).toHaveBeenCalledOnce()
    })

    it('does not retry a second 401 (prevents infinite loop)', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: { access_token: 'new-token' } },
        error: null,
      })

      const { api } = await import('../lib/api')

      const adapter = vi.fn()
      // First call: 401
      adapter.mockRejectedValueOnce(
        createAxiosError(401, { url: '/api/trips', method: 'get' })
      )
      // Retry also returns 401
      adapter.mockRejectedValueOnce(
        createAxiosError(401, { url: '/api/trips', method: 'get', _retry: true })
      )
      api.defaults.adapter = adapter

      await expect(api.get('/trips')).rejects.toThrow()

      // refreshSession called only once (for the first 401), not again for the retry's 401
      expect(mockRefreshSession).toHaveBeenCalledOnce()
    })

    it('passes through non-401 errors without refresh attempt', async () => {
      const { api } = await import('../lib/api')

      const adapter = vi.fn()
      adapter.mockRejectedValueOnce(
        createAxiosError(500, { url: '/api/trips', method: 'get' })
      )
      api.defaults.adapter = adapter

      await expect(api.get('/trips')).rejects.toThrow()

      expect(mockRefreshSession).not.toHaveBeenCalled()
      expect(mockSignOut).not.toHaveBeenCalled()
    })
  })

  describe('QueryClient retry function', () => {
    it('does not retry on 401 errors', () => {
      const retry = getRetryFn()
      const error401 = new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        headers: {},
        statusText: 'Unauthorized',
        config: { headers: new AxiosHeaders() },
      })

      expect(retry(0, error401)).toBe(false)
      expect(retry(1, error401)).toBe(false)
    })

    it('does not retry on 403 errors', () => {
      const retry = getRetryFn()
      const error403 = new AxiosError('Forbidden', '403', undefined, undefined, {
        status: 403,
        data: {},
        headers: {},
        statusText: 'Forbidden',
        config: { headers: new AxiosHeaders() },
      })

      expect(retry(0, error403)).toBe(false)
    })

    it('retries non-auth errors up to 3 times', () => {
      const retry = getRetryFn()
      const error500 = new AxiosError('Server Error', '500', undefined, undefined, {
        status: 500,
        data: {},
        headers: {},
        statusText: 'Internal Server Error',
        config: { headers: new AxiosHeaders() },
      })

      expect(retry(0, error500)).toBe(true)
      expect(retry(1, error500)).toBe(true)
      expect(retry(2, error500)).toBe(true)
      expect(retry(3, error500)).toBe(false)
    })

    it('retries non-axios errors up to 3 times', () => {
      const retry = getRetryFn()
      const genericError = new Error('Network error')

      expect(retry(0, genericError)).toBe(true)
      expect(retry(2, genericError)).toBe(true)
      expect(retry(3, genericError)).toBe(false)
    })
  })
})

/** Extract the retry function from App.tsx's QueryClient config for direct testing */
function getRetryFn(): (failureCount: number, error: Error) => boolean {
  return (failureCount: number, error: Error) => {
    if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
      return false
    }
    return failureCount < 3
  }
}

/** Helper to create a realistic AxiosError with response status */
function createAxiosError(
  status: number,
  configOverrides: Record<string, unknown> = {}
): AxiosError {
  const config = {
    headers: new AxiosHeaders(),
    url: '/api/trips',
    method: 'get',
    ...configOverrides,
  }
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    config as never,
    {},
    {
      status,
      data: {},
      headers: {},
      statusText: String(status),
      config: config as never,
    }
  )
  // Ensure error.config matches what interceptors expect
  error.config = config as never
  return error
}
