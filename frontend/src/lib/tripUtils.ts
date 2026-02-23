/**
 * Parse event name from trip notes.
 * Convention: notes begin with "Event Name — details" (em-dash separator).
 * Returns the text before the em-dash, or the first 60 chars if no dash.
 */
export function getEventName(notes: string | null | undefined): string | null {
  if (!notes) return null
  const dashIdx = notes.indexOf(' — ')
  return dashIdx !== -1 ? notes.slice(0, dashIdx) : notes.slice(0, 60)
}
