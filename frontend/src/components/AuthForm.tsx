import { useState, type FormEvent } from 'react'
import { Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type Status = 'idle' | 'submitting' | 'sent' | 'error'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const { signInWithMagicLink } = useAuth()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setError('')

    try {
      await signInWithMagicLink(email)
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setEmail('')
    setError('')
  }

  if (status === 'sent') {
    return (
      <div className="min-h-screen bg-cloud-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8">
          <div className="text-center">
            <div className="mb-4">
              <Mail className="mx-auto h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-cloud-900 mb-2">
              Check your email
            </h2>
            <p className="text-cloud-600 mb-6">
              We sent a magic link to <strong>{email}</strong>. Click the link
              in the email to sign in.
            </p>
            <button
              onClick={handleReset}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cloud-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-cloud-900 mb-2">
            Welcome to Travel Planner
          </h2>
          <p className="text-cloud-600">Sign in with your email</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-cloud-700 mb-2"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-cloud-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@example.com"
              disabled={status === 'submitting'}
            />
          </div>

          {status === 'error' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-lg active:scale-[0.99] disabled:bg-cloud-400 disabled:cursor-not-allowed font-medium transition-all duration-200"
          >
            {status === 'submitting' ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
