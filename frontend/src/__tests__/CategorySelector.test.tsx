import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CategorySelector } from '../components/itinerary/CategorySelector'

describe('CategorySelector', () => {
  it('renders all four category options', () => {
    render(<CategorySelector value="activity" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /transport/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /food/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lodging/i })).toBeInTheDocument()
  })

  it('has a group role with label', () => {
    render(<CategorySelector value="activity" onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: /category/i })).toBeInTheDocument()
  })

  it('highlights the currently selected category', () => {
    render(<CategorySelector value="food" onChange={vi.fn()} />)
    const foodBtn = screen.getByRole('button', { name: /food/i })
    expect(foodBtn).toHaveClass('bg-indigo-50')
  })

  it('calls onChange with the clicked category', () => {
    const onChange = vi.fn()
    render(<CategorySelector value="activity" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /transport/i }))
    expect(onChange).toHaveBeenCalledWith('transport')
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<CategorySelector value="activity" onChange={vi.fn()} disabled />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => expect(btn).toBeDisabled())
  })
})
