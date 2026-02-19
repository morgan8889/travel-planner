import type { Page } from '@playwright/test'
import type { TripSummary } from '../src/lib/types'

function base64url(json: object): string {
  return Buffer.from(JSON.stringify(json))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function makeFakeJwt(
  userId: string = 'test-user-id',
  email: string = 'test@example.com'
): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url({ alg: 'HS256', typ: 'JWT' })
  const payload = base64url({
    sub: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    exp: now + 3600,
    iat: now,
  })
  return `${header}.${payload}.fake-signature`
}

export function makeSession(
  userId: string = 'test-user-id',
  email: string = 'test@example.com'
) {
  const accessToken = makeFakeJwt(userId, email)
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: accessToken,
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  }
}

/** Inject a fake Supabase session into localStorage before the page loads. */
export async function injectAuth(page: Page): Promise<void> {
  const session = makeSession()

  // addInitScript runs before any page JS on every navigation
  await page.addInitScript((sessionData) => {
    window.localStorage.setItem(
      'sb-placeholder-auth-token',
      JSON.stringify(sessionData)
    )
  }, session)

  // Mock all Supabase auth API calls so the client doesn't error out
  await page.route('https://placeholder.supabase.co/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  })
}

/** Mock the GET /api/trips endpoint. Call before page.goto(). */
export async function mockTripsRoute(
  page: Page,
  trips: TripSummary[] = []
): Promise<void> {
  await page.route('**/api/trips*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trips),
    })
  })
}

/** Mock any API route with a given response body. */
export async function mockApiRoute(
  page: Page,
  pattern: string,
  body: unknown,
  status: number = 200
): Promise<void> {
  await page.route(pattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

export const MOCK_TRIPS: TripSummary[] = [
  {
    id: 'trip-1',
    type: 'vacation',
    destination: 'Paris, France',
    start_date: '2026-06-15',
    end_date: '2026-06-22',
    status: 'planning',
    notes: null,
    parent_trip_id: null,
    created_at: '2026-01-01T00:00:00Z',
    member_count: 2,
    destination_latitude: null,
    destination_longitude: null,
  },
  {
    id: 'trip-2',
    type: 'remote_week',
    destination: 'Lisbon, Portugal',
    start_date: '2026-07-01',
    end_date: '2026-07-07',
    status: 'dreaming',
    notes: null,
    parent_trip_id: null,
    created_at: '2026-01-02T00:00:00Z',
    member_count: 1,
    destination_latitude: null,
    destination_longitude: null,
  },
]
