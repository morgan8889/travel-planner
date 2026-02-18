import { test, expect } from '@playwright/test'
import { injectAuth, mockTripsRoute, MOCK_TRIPS } from './helpers'

test.describe('Trips page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
  })

  test('shows trips page heading and New Trip button', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/trips')
    await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'New Trip' })).toBeVisible()
  })

  test('renders trip cards with destination names', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/trips')
    await expect(page.getByText('Paris, France')).toBeVisible()
    await expect(page.getByText('Lisbon, Portugal')).toBeVisible()
  })

  test('shows status filter pills', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/trips')
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dreaming' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Planning' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Booked' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Active' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible()
  })

  test('shows empty state when no trips', async ({ page }) => {
    await mockTripsRoute(page, [])
    await page.goto('/trips')
    await expect(page.getByText(/start planning/i)).toBeVisible()
    await expect(page.getByText('Paris, France')).not.toBeVisible()
  })

  test('clicking a status filter sends filtered request', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/trips')
    await expect(page.getByText('Paris, France')).toBeVisible()

    // Track filtered request
    const filteredRequest = page.waitForRequest(
      (req) => req.url().includes('/api/trips') && req.url().includes('status=planning')
    )
    await page.getByRole('button', { name: 'Planning' }).click()
    await filteredRequest
  })

  test('clicking New Trip navigates to create trip page', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    // Also mock trips for the new trip form (parent trip dropdown)
    await page.goto('/trips')
    await page.getByRole('link', { name: 'New Trip' }).click()
    await expect(page).toHaveURL(/\/trips\/new/)
  })

  test('shows error state with Try Again button on API failure', async ({ page }) => {
    // Use 403 to prevent React Query retries (App.tsx: retry: false for 401/403)
    await page.route('**/api/trips*', (route) => {
      route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
    })
    await page.goto('/trips')
    await expect(page.getByText(/something went wrong/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible()
  })
})
