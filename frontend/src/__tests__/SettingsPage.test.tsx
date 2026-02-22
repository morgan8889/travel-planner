import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { SettingsPage } from '../pages/SettingsPage'

const mockUseGmailStatus = vi.fn()
const mockUseDisconnectGmail = vi.fn()
const mockUseDeleteAccount = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../hooks/useGmail', () => ({
  useGmailStatus: () => mockUseGmailStatus(),
  useDisconnectGmail: () => mockUseDisconnectGmail(),
}))

vi.mock('../hooks/useAuth', () => ({
  useDeleteAccount: () => mockUseDeleteAccount(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' }, signOut: mockSignOut }),
}))

vi.mock('../lib/api', () => ({
  gmailApi: {
    getAuthUrl: vi.fn().mockResolvedValue({ url: 'https://accounts.google.com' }),
  },
  authApi: { deleteAccount: vi.fn().mockResolvedValue({}) },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    createElement('a', { href: to }, children),
  useNavigate: () => vi.fn(),
}))

// DevSeedContent is only rendered in DEV — mock it out in tests
vi.mock('../components/dev/DevSeedContent', () => ({
  DevSeedContent: () => createElement('div', { 'data-testid': 'dev-seed-content' }),
}))

function createWrapper() {
  const queryClient = new QueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseGmailStatus.mockReturnValue({ data: { connected: false }, isLoading: false })
  mockUseDisconnectGmail.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseDeleteAccount.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null,
  })
})

describe('SettingsPage', () => {
  it('renders Integrations section with Connect Gmail when not connected', () => {
    render(createElement(SettingsPage), { wrapper: createWrapper() })
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument()
  })

  it('shows Disconnect button when Gmail is connected', () => {
    mockUseGmailStatus.mockReturnValue({ data: { connected: true }, isLoading: false })
    render(createElement(SettingsPage), { wrapper: createWrapper() })
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect gmail/i })).not.toBeInTheDocument()
  })

  it('renders Account section with user email', () => {
    render(createElement(SettingsPage), { wrapper: createWrapper() })
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('shows Delete Account button', () => {
    render(createElement(SettingsPage), { wrapper: createWrapper() })
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
  })

  it('opens confirm dialog when Delete Account is clicked', async () => {
    const user = userEvent.setup()
    render(createElement(SettingsPage), { wrapper: createWrapper() })
    await user.click(screen.getByRole('button', { name: /delete account/i }))
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('calls deleteAccount mutation and signOut on confirm', async () => {
    const deleteAccountMutateAsync = vi.fn().mockResolvedValue({})
    mockUseDeleteAccount.mockReturnValue({
      mutateAsync: deleteAccountMutateAsync,
      isPending: false,
      error: null,
    })
    const user = userEvent.setup()
    render(createElement(SettingsPage), { wrapper: createWrapper() })
    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(deleteAccountMutateAsync).toHaveBeenCalled()
  })
})
