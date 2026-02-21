import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DayCell } from '../components/planning/DayCell'

describe('DayCell full mode holiday label', () => {
  it('renders holiday label on same row as date number (not below)', () => {
    const { container } = render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
      />
    )
    // The date number and holiday label should share a parent flex row
    const flexRow = container.querySelector('.flex.items-start.justify-between')
    expect(flexRow).toBeInTheDocument()
    // Holiday label is inside that flex row
    const label = container.querySelector('.flex.items-start.justify-between span:last-child')
    expect(label?.textContent).toBe('Christmas')
  })

  it('does not render holiday label below the date number in full mode', () => {
    const { container } = render(
      <DayCell
        date="2026-12-25"
        dayNumber={25}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        holidayLabel="Christmas"
      />
    )
    // No <p> tag with the label (old layout used <p>)
    const pTags = container.querySelectorAll('p')
    const labelP = Array.from(pTags).find((p) => p.textContent === 'Christmas')
    expect(labelP).toBeUndefined()
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
