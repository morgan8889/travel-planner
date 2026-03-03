import { Component, type ErrorInfo, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import axios from 'axios'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AuthForm } from './components/AuthForm'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          return false
        }
        return failureCount < 3
      },
    },
  },
})

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-cloud-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-cloud-200 border-t-indigo-600" />
        <p className="mt-4 text-cloud-600">Loading...</p>
      </div>
    </div>
  )
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cloud-50 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <h1 className="text-2xl font-semibold text-cloud-900 mb-2">Something went wrong</h1>
            <p className="text-cloud-600 mb-6">An unexpected error occurred. Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AuthGate() {
  const { isLoading, isAuthenticated } = useAuth()
  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <AuthForm />
  return <RouterProvider router={router} />
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}

export default App
