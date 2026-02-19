import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import { RootLayout } from './components/layout/RootLayout'
import { DashboardPage } from './pages/DashboardPage'
import { TripsPage } from './pages/TripsPage'
import { NewTripPage } from './pages/NewTripPage'
import { TripDetailPage } from './pages/TripDetailPage'
import { CalendarPage } from './pages/CalendarPage'
import { DevSeedPage } from './pages/DevSeedPage'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const tripsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trips',
  component: TripsPage,
})

const newTripRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trips/new',
  component: NewTripPage,
})

export const tripDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trips/$tripId',
  component: TripDetailPage,
})

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
})

const devSeedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/seed',
  component: DevSeedPage,
})

const routeTree = rootRoute.addChildren([indexRoute, tripsRoute, newTripRoute, tripDetailRoute, calendarRoute, devSeedRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
