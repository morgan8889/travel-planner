import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router'
import { RootLayout } from './components/layout/RootLayout'
import { TripsPage } from './pages/TripsPage'
import { NewTripPage } from './pages/NewTripPage'
import { TripDetailPage } from './pages/TripDetailPage'
import { CalendarPage } from './pages/CalendarPage'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/calendar' })
  },
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

const routeTree = rootRoute.addChildren([indexRoute, tripsRoute, newTripRoute, tripDetailRoute, calendarRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
