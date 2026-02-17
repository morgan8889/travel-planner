import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripMembersList } from '../components/trips/TripMembersList'
import type { TripMember } from '../lib/types'

const mockMembers: TripMember[] = [
  {
    id: 'member-1',
    user_id: 'user-1',
    role: 'owner',
    display_name: 'Alice Owner',
    email: 'alice@example.com',
  },
  {
    id: 'member-2',
    user_id: 'user-2',
    role: 'member',
    display_name: 'Bob Member',
    email: 'bob@example.com',
  },
]

describe('TripMembersList', () => {
  const defaultProps = {
    members: mockMembers,
    isOwner: true,
    onRemove: vi.fn(),
    onUpdateRole: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all members with names and roles', () => {
    render(<TripMembersList {...defaultProps} />)

    expect(screen.getByText('Alice Owner')).toBeInTheDocument()
    expect(screen.getByText('Bob Member')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Member')).toBeInTheDocument()
  })

  it('renders member emails', () => {
    render(<TripMembersList {...defaultProps} />)

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  it('owner sees remove button for non-owner members', () => {
    render(<TripMembersList {...defaultProps} />)

    const removeButton = screen.getByLabelText('Remove Bob Member')
    expect(removeButton).toBeInTheDocument()
  })

  it('owner does not see remove button for themselves', () => {
    render(<TripMembersList {...defaultProps} />)

    expect(screen.queryByLabelText('Remove Alice Owner')).not.toBeInTheDocument()
  })

  it('non-owner does not see remove buttons', () => {
    render(<TripMembersList {...defaultProps} isOwner={false} />)

    expect(screen.queryByLabelText('Remove Bob Member')).not.toBeInTheDocument()
  })

  it('clicking remove button calls onRemove with member id', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<TripMembersList {...defaultProps} onRemove={onRemove} />)

    await user.click(screen.getByLabelText('Remove Bob Member'))
    expect(onRemove).toHaveBeenCalledWith('member-2')
  })

  it('clicking role badge calls onUpdateRole for owner viewing a member', async () => {
    const user = userEvent.setup()
    const onUpdateRole = vi.fn()
    render(<TripMembersList {...defaultProps} onUpdateRole={onUpdateRole} />)

    // The "Member" text is a clickable button for owners
    await user.click(screen.getByText('Member'))
    expect(onUpdateRole).toHaveBeenCalledWith('member-2', 'owner')
  })
})
