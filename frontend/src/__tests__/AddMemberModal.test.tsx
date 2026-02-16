import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddMemberModal } from '../components/trips/AddMemberModal'

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('AddMemberModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onAdd: vi.fn(),
    isLoading: false,
    error: null as string | null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email input and submit button when open', () => {
    render(<AddMemberModal {...defaultProps} />)

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Member' })).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(<AddMemberModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByRole('button', { name: 'Add Member' })).not.toBeInTheDocument()
  })

  it('submit button is disabled when email is empty', () => {
    render(<AddMemberModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: 'Add Member' })
    expect(submitButton).toBeDisabled()
  })

  it('calls onAdd with email on form submit', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<AddMemberModal {...defaultProps} onAdd={onAdd} />)

    const emailInput = screen.getByLabelText('Email Address')
    await user.type(emailInput, 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Add Member' }))

    expect(onAdd).toHaveBeenCalledWith('new@example.com')
  })

  it('displays error message from API', () => {
    render(<AddMemberModal {...defaultProps} error="User not found" />)

    expect(screen.getByText('User not found')).toBeInTheDocument()
  })

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<AddMemberModal {...defaultProps} onClose={onClose} />)

    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<AddMemberModal {...defaultProps} onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
