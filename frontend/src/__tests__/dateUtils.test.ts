import { describe, expect, it, vi } from 'vitest'

import { formatDate, formatShortDate, getDaysUntil } from '../lib/dateUtils'

describe('formatShortDate', () => {
  it('formats a date as short month and day', () => {
    expect(formatShortDate('2026-06-15')).toBe('Jun 15')
  })

  it('handles single-digit days without zero-padding', () => {
    expect(formatShortDate('2026-06-01')).toBe('Jun 1')
  })

  it('handles different months', () => {
    expect(formatShortDate('2026-01-20')).toBe('Jan 20')
    expect(formatShortDate('2026-12-31')).toBe('Dec 31')
  })
})

describe('formatDate', () => {
  it('converts year + 0-based month + day to YYYY-MM-DD', () => {
    expect(formatDate(2026, 5, 1)).toBe('2026-06-01') // June = month 5
    expect(formatDate(2026, 0, 15)).toBe('2026-01-15') // January = month 0
  })

  it('zero-pads single-digit months and days', () => {
    expect(formatDate(2026, 2, 5)).toBe('2026-03-05') // March 5
  })
})

describe('getDaysUntil', () => {
  it('returns "today" when the date is today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    expect(getDaysUntil('2026-06-15')).toBe('today')
    vi.useRealTimers()
  })

  it('returns "tomorrow" for the next day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    expect(getDaysUntil('2026-06-16')).toBe('tomorrow')
    vi.useRealTimers()
  })

  it('returns "in N days" for future dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    expect(getDaysUntil('2026-06-20')).toBe('in 5 days')
    vi.useRealTimers()
  })

  it('returns "yesterday" for the previous day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    expect(getDaysUntil('2026-06-14')).toBe('yesterday')
    vi.useRealTimers()
  })

  it('returns "N days ago" for past dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    expect(getDaysUntil('2026-06-10')).toBe('5 days ago')
    vi.useRealTimers()
  })
})
