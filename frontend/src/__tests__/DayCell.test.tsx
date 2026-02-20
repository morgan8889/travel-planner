import { render } from '@testing-library/react'
import { DayCell } from '../components/planning/DayCell'

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

  it('compact mode renders compact-sized cell, not full-height', () => {
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
})
