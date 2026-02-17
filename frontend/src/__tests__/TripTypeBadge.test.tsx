import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TripTypeBadge } from '../components/trips/TripTypeBadge'

describe('TripTypeBadge', () => {
  it('renders vacation with sun emoji', () => {
    render(<TripTypeBadge type="vacation" />)
    const badge = screen.getByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Vacation')
    expect(badge).toHaveTextContent('☀️')
  })

  it('renders remote_week with laptop emoji', () => {
    render(<TripTypeBadge type="remote_week" />)
    const badge = screen.getByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Remote Week')
    expect(badge).toHaveTextContent('💻')
  })

  it('renders sabbatical with compass emoji', () => {
    render(<TripTypeBadge type="sabbatical" />)
    const badge = screen.getByTestId('trip-type-badge')
    expect(badge).toHaveTextContent('Sabbatical')
    expect(badge).toHaveTextContent('🧭')
  })
})
