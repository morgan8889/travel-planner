import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StatusTransitionButton } from '../components/trips/StatusTransitionButton'

describe('StatusTransitionButton', () => {
  it('renders "Start Planning" for dreaming status', () => {
    render(
      <StatusTransitionButton currentStatus="dreaming" onTransition={vi.fn()} />
    )
    expect(screen.getByText('Start Planning')).toBeInTheDocument()
  })

  it('renders "Mark as Booked" for planning status', () => {
    render(
      <StatusTransitionButton currentStatus="planning" onTransition={vi.fn()} />
    )
    expect(screen.getByText('Mark as Booked')).toBeInTheDocument()
  })

  it('renders "Start Trip" for booked status', () => {
    render(
      <StatusTransitionButton currentStatus="booked" onTransition={vi.fn()} />
    )
    expect(screen.getByText('Start Trip')).toBeInTheDocument()
  })

  it('renders "Complete Trip" for active status', () => {
    render(
      <StatusTransitionButton currentStatus="active" onTransition={vi.fn()} />
    )
    expect(screen.getByText('Complete Trip')).toBeInTheDocument()
  })

  it('renders nothing for completed status', () => {
    const { container } = render(
      <StatusTransitionButton currentStatus="completed" onTransition={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('calls onTransition with next status on click', async () => {
    const user = userEvent.setup()
    const onTransition = vi.fn()
    render(
      <StatusTransitionButton currentStatus="dreaming" onTransition={onTransition} />
    )

    await user.click(screen.getByText('Start Planning'))
    expect(onTransition).toHaveBeenCalledWith('planning')
  })

  it('disables button when isLoading is true', () => {
    render(
      <StatusTransitionButton
        currentStatus="planning"
        onTransition={vi.fn()}
        isLoading={true}
      />
    )
    expect(screen.getByText('Mark as Booked').closest('button')).toBeDisabled()
  })
})
