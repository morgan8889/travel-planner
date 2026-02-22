import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TripTypeBadge } from '../components/trips/TripTypeBadge'

describe('TripTypeBadge', () => {
  it('renders vacation with sun icon', () => {
    render(<TripTypeBadge type="vacation" />)
    const badge = screen.getByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Vacation')
    expect(badge.querySelector('svg')).toBeInTheDocument()
  })

  it('renders remote_week with laptop icon', () => {
    render(<TripTypeBadge type="remote_week" />)
    const badge = screen.getByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Remote Week')
    expect(badge.querySelector('svg')).toBeInTheDocument()
  })

  it('renders sabbatical with compass icon', () => {
    render(<TripTypeBadge type="sabbatical" />)
    const badge = screen.getByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Sabbatical')
    expect(badge.querySelector('svg')).toBeInTheDocument()
  })

  it('renders event with trophy icon', () => {
    render(<TripTypeBadge type="event" />)
    const badge = screen.getByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Event')
    expect(badge.querySelector('svg')).toBeInTheDocument()
  })
})
