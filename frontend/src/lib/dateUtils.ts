export function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getDaysUntil(dateStr: string): string {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff > 1) return `in ${diff} days`
  if (diff === -1) return 'yesterday'
  return `${Math.abs(diff)} days ago`
}
