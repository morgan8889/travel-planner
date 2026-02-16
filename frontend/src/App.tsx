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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-600">Loading...</p>
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
