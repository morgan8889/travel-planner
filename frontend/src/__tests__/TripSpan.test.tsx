import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TripSpan } from '../components/planning/TripSpan'

const baseProps = {
  destination: 'Paris',
  status: 'planning' as const,
  startCol: 1,
  colSpan: 3,
  stackIndex: 0,
  onClick: vi.fn(),
  startDate: '2026-03-01',
  endDate: '2026-03-07',
}

describe('TripSpan', () => {
  describe('size="full" (default)', () => {
    it('renders destination text directly inside button', () => {
      render(<TripSpan {...baseProps} />)
      const btn = screen.getByRole('button', { name: 'Paris' })
      expect(btn).toBeInTheDocument()
      expect(btn.className).toContain('h-5')
    })

    it('defaults to size full when no size prop', () => {
      render(<TripSpan {...baseProps} />)
      const btn = screen.getByRole('button', { name: 'Paris' })
      expect(btn.className).toContain('h-5')
      expect(btn.className).toContain('rounded-sm')
    })
  })

  describe('size="small"', () => {
    it('renders thin bar with no visible text', () => {
      render(<TripSpan {...baseProps} size="small" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('h-1.5')
      // No destination text rendered inside or below the bar
      expect(btn.textContent).toBe('')
    })

    it('uses stackIndex * 8 for bottom offset', () => {
      render(<TripSpan {...baseProps} size="small" stackIndex={2} />)
      const btn = screen.getByRole('button')
      expect(btn.style.bottom).toBe(`${2 + 2 * 8}px`)
    })

    it('shows tooltip on hover', async () => {
      const user = userEvent.setup()
      render(<TripSpan {...baseProps} size="small" />)
      const btn = screen.getByRole('button')
      await user.hover(btn)
      expect(screen.getByText('Paris')).toBeInTheDocument()
      expect(screen.getByText('2026-03-01 to 2026-03-07')).toBeInTheDocument()
    })
  })

  describe('size="medium"', () => {
    it('renders bar with h-3 height', () => {
      render(<TripSpan {...baseProps} size="medium" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('h-3')
    })

    it('renders destination text inside the bar', () => {
      render(<TripSpan {...baseProps} size="medium" />)
      const btn = screen.getByRole('button')
      expect(btn.textContent).toContain('Paris')
    })

    it('uses stackIndex * 14 for bottom offset', () => {
      render(<TripSpan {...baseProps} size="medium" stackIndex={1} />)
      const btn = screen.getByRole('button')
      expect(btn.style.bottom).toBe(`${2 + 1 * 14}px`)
    })

    it('shows tooltip on hover', async () => {
      const user = userEvent.setup()
      render(<TripSpan {...baseProps} size="medium" />)
      const btn = screen.getByRole('button')
      await user.hover(btn)
      expect(screen.getByText('2026-03-01 to 2026-03-07')).toBeInTheDocument()
    })
  })

  describe('click behavior', () => {
    it('calls onClick for full size', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<TripSpan {...baseProps} onClick={onClick} />)
      await user.click(screen.getByRole('button', { name: 'Paris' }))
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('calls onClick for small size', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<TripSpan {...baseProps} size="small" onClick={onClick} />)
      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('calls onClick for medium size', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<TripSpan {...baseProps} size="medium" onClick={onClick} />)
      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledOnce()
    })
  })
})
