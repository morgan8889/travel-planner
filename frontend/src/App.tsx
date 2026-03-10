import { Component, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import axios from 'axios'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AuthForm } from './components/AuthForm'
import { router } from './router'

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; showError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, showError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App error boundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '.5rem', maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <strong style={{ fontSize: '1rem' }}>Something went wrong!</strong>
            <button
              style={{
                appearance: 'none',
                fontSize: '.6em',
                border: '1px solid currentColor',
                padding: '.1rem .2rem',
                fontWeight: 'bold',
                borderRadius: '.25rem',
              }}
              onClick={() => this.setState(s => ({ showError: !s.showError }))}
            >
              {this.state.showError ? 'Hide Error' : 'Show Error'}
            </button>
          </div>
          {this.state.showError && (
            <pre style={{ fontSize: '.75rem', marginTop: '.5rem', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

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
