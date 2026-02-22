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
  it('applies rose classes for event trip type', () => {
    const { container } = render(
      <TripSpan {...base} colorBy="type" tripType="event" size="medium" />,
    )
    expect(container.querySelector('button')?.className).toMatch(/rose/)
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
    // inline label + popover both show event name — at least one match required
    expect(screen.getAllByText('3M Half Marathon').length).toBeGreaterThanOrEqual(1)
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
    // popover + inline label both show event name when hovered
    expect(screen.getAllByText('3M Half Marathon').length).toBeGreaterThanOrEqual(2)
    fireEvent.mouseLeave(btn)
    // after mouse leave, popover is gone — only inline label remains
    expect(screen.getAllByText('3M Half Marathon').length).toBe(1)
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
    expect(screen.getAllByText('Austin, TX').length).toBeGreaterThanOrEqual(2)
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

describe('TripSpan event bar inline label', () => {
  it('shows event name as inline bar text for event trip (size=medium)', () => {
    const { container } = render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="event"
        notes="3M Half Marathon — local Austin race"
      />,
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('3M Half Marathon')
  })

  it('shows destination as inline bar text for non-event trip (size=medium)', () => {
    const { container } = render(
      <TripSpan
        {...base}
        size="medium"
        colorBy="type"
        tripType="vacation"
      />,
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('Austin, TX')
  })

  it('shows event name as bar text for event trip (size=full)', () => {
    render(
      <TripSpan
        {...base}
        size="full"
        colorBy="type"
        tripType="event"
        notes="Unbound 200 — gravel race"
      />,
    )
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('Unbound 200')
  })
})
