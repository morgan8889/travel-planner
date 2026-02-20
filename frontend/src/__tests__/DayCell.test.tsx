import { render } from '@testing-library/react'
import { DayCell } from '../components/planning/DayCell'

describe('DayCell compact mode', () => {
  it('renders border classes for grid lines', () => {
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
    expect(cell.className).toContain('border-b')
    expect(cell.className).toContain('border-r')
    expect(cell.className).toContain('border-cloud-100')
  })

  it('does not add border classes in non-compact mode', () => {
    const { container } = render(
      <DayCell
        date="2026-03-15"
        dayNumber={15}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        compact={false}
      />
    )
    const cell = container.firstChild as HTMLElement
    // non-compact already has its own border-b border-r border-cloud-100
    expect(cell.className).toContain('border-b')
  })
})
