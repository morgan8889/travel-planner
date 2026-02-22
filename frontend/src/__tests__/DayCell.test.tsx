import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DayCell } from '../components/planning/DayCell'

describe('DayCell full mode holiday label', () => {
  it('renders holiday label on same row as date number', () => {
    render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
      />
    )
    const label = screen.getByText('Christmas')
    const dateNumber = screen.getByText('25')
    expect(label.parentElement).toBe(dateNumber.parentElement)
    expect(label.tagName).not.toBe('P')
  })
})

describe('DayCell compact mode', () => {
  it('renders border classes and full-cell layout in compact mode', () => {
    const { container } = render(
      <DayCell
        date="2026-03-15"
        dayNumber={15}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        compact={true}
        showLabel={true}
      />
    )
    const cell = container.firstChild as HTMLElement
    expect(cell.className).toContain('border-b')
    expect(cell.className).toContain('border-r')
    expect(cell.className).toContain('border-cloud-100')
    expect(cell.className).toContain('h-full')
    expect(cell.className).toContain('items-start')
    expect(cell.className).not.toContain('rounded-sm')
    expect(cell.className).not.toContain('items-center')
  })

  it('showLabel branch uses h-full min-h-[2.5rem], non-compact uses min-h-[5rem]', () => {
    const { container: compactContainer } = render(
      <DayCell
        date="2026-03-15"
        dayNumber={15}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        compact={true}
        showLabel={true}
      />
    )
    const { container: fullContainer } = render(
      <DayCell
        date="2026-03-15"
        dayNumber={15}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        compact={false}
      />
    )
    const compactCell = compactContainer.firstChild as HTMLElement
    const fullCell = fullContainer.firstChild as HTMLElement
    expect(compactCell.className).toContain('min-h-[2.5rem]')
    expect(fullCell.className).toContain('min-h-[5rem]')
  })

  it('compact mode without showLabel uses aspect-square, not h-full', () => {
    const { container } = render(
      <DayCell
        date="2026-03-15"
        dayNumber={15}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        compact={true}
      />
    )
    const cell = container.firstChild as HTMLElement
    expect(cell.className).toContain('aspect-square')
    expect(cell.className).not.toContain('h-full')
  })
})

describe('DayCell full mode custom day dot', () => {
  it('renders amber dot (not SVG) when customDayName is present in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
      />
    )
    // No SVG — no Star icon
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    // Amber dot present
    const dot = container.querySelector('.rounded-full.bg-amber-400')
    expect(dot).toBeInTheDocument()
  })

  it('does NOT render amber dot when holidayLabel takes precedence in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
        customDayName="My Event"
      />
    )
    expect(screen.getByText('Christmas')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    expect(container.querySelector('.rounded-full.bg-amber-400')).not.toBeInTheDocument()
  })

  it('shows hover popover with name and date in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
      />
    )
    const dot = container.querySelector('.rounded-full.bg-amber-400') as HTMLElement
    fireEvent.mouseEnter(dot)
    expect(screen.getByText('Ironman')).toBeInTheDocument()
    expect(screen.getByText('Jul 14')).toBeInTheDocument()
    fireEvent.mouseLeave(dot)
    expect(screen.queryByText('Ironman')).not.toBeInTheDocument()
  })

  it('renders corner dot in compact mode (not SVG)', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
        compact={true}
      />
    )
    expect(container.querySelector('svg')).not.toBeInTheDocument()
    // Corner dot: bottom-0.5 left-0.5 w-1.5 h-1.5
    const cornerDot = container.querySelector('.w-1\\.5.h-1\\.5.rounded-full.bg-amber-400')
    expect(cornerDot).toBeInTheDocument()
  })

  it('shows hover popover from corner dot in compact mode', () => {
    const { container } = render(
      <DayCell
        date="2026-07-14"
        dayNumber={14}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        customDayName="Ironman"
        compact={true}
      />
    )
    const cornerDot = container.querySelector('.w-1\\.5.h-1\\.5.rounded-full.bg-amber-400') as HTMLElement
    fireEvent.mouseEnter(cornerDot)
    expect(screen.getByText('Ironman')).toBeInTheDocument()
    fireEvent.mouseLeave(cornerDot)
    expect(screen.queryByText('Ironman')).not.toBeInTheDocument()
  })
})
