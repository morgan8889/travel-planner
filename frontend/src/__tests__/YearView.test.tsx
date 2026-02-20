import { render } from '@testing-library/react'
import { YearView } from '../components/planning/YearView'

const baseProps = {
  year: 2026,
  trips: [],
  holidays: [],
  customDays: [],
  selectedDate: null,
  onMonthClick: () => {},
  onDayClick: () => {},
  onTripClick: () => {},
}

describe('YearView grid lines', () => {
  it('renders day grids with border-t border-l border-cloud-100', () => {
    const { container } = render(<YearView {...baseProps} />)
    const dayGrids = container.querySelectorAll('.grid.grid-cols-7.border-t.border-l')
    expect(dayGrids.length).toBeGreaterThan(0)
  })

  it('does not use gap-px', () => {
    const { container } = render(<YearView {...baseProps} />)
    const gapGrids = container.querySelectorAll('.gap-px')
    expect(gapGrids.length).toBe(0)
  })

  it('renders padding cells with border-b border-r border-cloud-100', () => {
    // Jan 2026 starts on Thursday — first week has 4 padding cells
    const { container } = render(<YearView {...baseProps} />)
    const paddingCells = container.querySelectorAll('.aspect-square.border-b.border-r.border-cloud-100:not(.cursor-pointer)')
    expect(paddingCells.length).toBeGreaterThan(0)
  })
})

describe('YearView week container layout', () => {
  it('week container uses flex flex-col', () => {
    const { container } = render(<YearView {...baseProps} />)
    const flexContainers = container.querySelectorAll('.flex.flex-col')
    expect(flexContainers.length).toBeGreaterThan(0)
  })

  it('renders a relative h-4 trip bar strip below the day grid', () => {
    const { container } = render(<YearView {...baseProps} />)
    const strips = container.querySelectorAll('.relative.h-4')
    expect(strips.length).toBeGreaterThan(0)
  })
})
