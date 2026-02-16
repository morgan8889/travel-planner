import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router'
import { RootLayout } from './components/layout/RootLayout'
import { TripsPage } from './pages/TripsPage'
import { NewTripPage } from './pages/NewTripPage'
import { TripDetailPage } from './pages/TripDetailPage'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/trips' })
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

const routeTree = rootRoute.addChildren([indexRoute, tripsRoute, newTripRoute, tripDetailRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
