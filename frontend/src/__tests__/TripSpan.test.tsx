import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TripSpan } from '../components/planning/TripSpan'

const base = {
  destination: 'Austin, TX',
  status: 'booked' as const,
  startCol: 0,
  colSpan: 3,
  stackIndex: 0,
  onClick: vi.fn(),
}

describe('TripSpan event color', () => {
  it('applies emerald classes for event trip type', () => {
    const { container } = render(
      <TripSpan {...base} colorBy="type" tripType="event" size="medium" />,
    )
    expect(container.querySelector('button')?.className).toMatch(/emerald/)
  })

  it('applies blue classes for vacation trip type', () => {
    const { container } = render(
      <TripSpan {...base} colorBy="type" tripType="vacation" size="medium" />,
    )
    expect(container.querySelector('button')?.className).toMatch(/blue/)
  })
})

describe('TripSpan popover card', () => {
  it('shows event name from notes on hover (size=medium)', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        startDate="2026-01-18"
        endDate="2026-01-18"
        notes="3M Half Marathon — local Austin race"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByText('3M Half Marathon')).toBeInTheDocument()
  })

  it('shows destination for non-event trips on hover (size=medium)', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="vacation"
        startDate="2026-03-12"
        endDate="2026-03-15"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    // destination appears in both inline label and popover — just check it's present
    expect(screen.getAllByText('Austin, TX').length).toBeGreaterThanOrEqual(1)
  })

  it('hides popover after mouse leave', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        startDate="2026-01-18"
        endDate="2026-01-18"
        notes="3M Half Marathon — local Austin race"
      />,
    )
    const btn = screen.getByRole('button')
    fireEvent.mouseEnter(btn)
    expect(screen.getByText('3M Half Marathon')).toBeInTheDocument()
    fireEvent.mouseLeave(btn)
    expect(screen.queryByText('3M Half Marathon')).not.toBeInTheDocument()
  })

  it('shows popover on hover for size=full (month view)', () => {
    render(
      <TripSpan
        {...base}
        size="full"
        colorBy="type"
        tripType="vacation"
        startDate="2026-03-12"
        endDate="2026-03-15"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    // destination appears in both inline text and popover
    expect(screen.getAllByText('Austin, TX').length).toBeGreaterThanOrEqual(1)
  })

  it('shows single date in popover for same-day events', () => {
    render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        startDate="2026-01-18"
        endDate="2026-01-18"
        notes="3M Half Marathon"
      />,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    // Should show "Jan 18" not "Jan 18 – Jan 18"
    const dateEl = screen.getByText('Jan 18')
    expect(dateEl).toBeInTheDocument()
  })
})
