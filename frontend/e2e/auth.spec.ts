import { test, expect } from '@playwright/test'

test.describe('Auth page (unauthenticated)', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Welcome to Travel Planner')).toBeVisible()
  })

  test('shows email input and Send Magic Link button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send Magic Link' })).toBeVisible()
  })

  test('shows success message after submitting email', async ({ page }) => {
    // Mock all Supabase auth calls (broad pattern catches OTP and any other auth requests)
    await page.route('https://placeholder.supabase.co/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.goto('/')
    await page.getByLabel('Email address').fill('user@example.com')
    await page.getByRole('button', { name: 'Send Magic Link' }).click()
    await expect(page.getByText(/check your email/i)).toBeVisible()
  })

  test('does not show app navigation when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Trips')).not.toBeVisible()
    await expect(page.getByText('Dashboard')).not.toBeVisible()
  })
})
