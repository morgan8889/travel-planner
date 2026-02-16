import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

describe('Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.getByText('Modal content')).toBeInTheDocument()
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Content</p>
      </Modal>
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Content</p>
      </Modal>
    )

    await user.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmLabel: 'Delete',
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, message, and buttons', () => {
    render(<ConfirmDialog {...defaultProps} />)

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)

    await user.click(screen.getByText('Delete'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />)

    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('disables buttons when loading', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />)

    expect(screen.getByText('Delete').closest('button')).toBeDisabled()
    expect(screen.getByText('Cancel').closest('button')).toBeDisabled()
  })
})
