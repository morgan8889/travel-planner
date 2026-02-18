import { test, expect } from '@playwright/test'
import { injectAuth, mockTripsRoute, MOCK_TRIPS } from './helpers'
import type { TripSummary } from '../src/lib/types'

test.describe('Dashboard page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page)
  })

  test('shows welcome message with username', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/')
    await expect(page.getByText(/welcome back,\s*test/i)).toBeVisible()
  })

  test('shows navigation links', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Trips' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Calendar', exact: true }).first()).toBeVisible()
  })

  test('shows Sign Out button', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  test('shows upcoming trips section with trip cards', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/')
    await expect(page.getByText('Upcoming Trips')).toBeVisible()
    await expect(page.getByText('Paris, France')).toBeVisible()
  })

  test('shows empty state when no upcoming trips', async ({ page }) => {
    const completedTrips: TripSummary[] = [
      {
        ...MOCK_TRIPS[0],
        status: 'completed',
      },
    ]
    await mockTripsRoute(page, completedTrips)
    await page.goto('/')
    await expect(page.getByText('No upcoming trips yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Plan a Trip' })).toBeVisible()
  })

  test('shows quick actions section', async ({ page }) => {
    await mockTripsRoute(page, MOCK_TRIPS)
    await page.goto('/')
    await expect(page.getByText('Quick Actions')).toBeVisible()
    await expect(page.getByRole('link', { name: 'New Trip' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View Calendar' })).toBeVisible()
  })

  test('shows map placeholder message when no trips have coordinates', async ({
    page,
  }) => {
    await mockTripsRoute(page, MOCK_TRIPS) // MOCK_TRIPS have no coordinates
    await page.goto('/')
    await expect(
      page.getByText('Create trips with locations to see them on the map.')
    ).toBeVisible()
  })
})
