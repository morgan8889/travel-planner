import { render } from '@testing-library/react'
import { QuarterView } from '../components/planning/QuarterView'

const baseProps = {
  year: 2026,
  quarter: 0, // Q1: Jan, Feb, Mar
  trips: [],
  holidays: [],
  customDays: [],
  selectedDate: null,
  onMonthClick: () => {},
  onDayClick: () => {},
  onTripClick: () => {},
}

describe('QuarterView grid lines', () => {
  it('renders week-row day grid with border-t border-l border-cloud-100', () => {
    const { container } = render(<QuarterView {...baseProps} />)
    const dayGrids = container.querySelectorAll('.grid.grid-cols-7.border-t.border-l')
    expect(dayGrids.length).toBeGreaterThan(0)
  })

  it('renders padding cells with border-b border-r border-cloud-100', () => {
    // Jan 2026: starts on Thursday — cells 0-3 (Sun-Wed) are empty padding
    const { container } = render(<QuarterView {...baseProps} />)
    const borderCells = container.querySelectorAll('.border-b.border-r.border-cloud-100')
    expect(borderCells.length).toBeGreaterThan(0)
  })

  it('renders day-header row with border-b border-cloud-200', () => {
    const { container } = render(<QuarterView {...baseProps} />)
    const headers = container.querySelectorAll('.border-b.border-cloud-200')
    expect(headers.length).toBeGreaterThan(0)
  })

  it('week container has paddingBottom 48px to fit 3 trip bars', () => {
    const { container } = render(<QuarterView {...baseProps} />)
    const weekContainer = container.querySelector('[style*="padding-bottom"]') as HTMLElement
    expect(weekContainer).not.toBeNull()
    expect(weekContainer.style.paddingBottom).toBe('48px')
  })
})
