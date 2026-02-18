import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocationAutocomplete } from '../components/form/LocationAutocomplete'
import type { GeocodeSuggestion } from '../lib/types'

const mockSearch = vi.fn()

vi.mock('../lib/api', () => ({
  geocodeApi: {
    search: (...args: unknown[]) => mockSearch(...args),
  },
}))

const PARIS: GeocodeSuggestion = {
  place_name: 'Paris, France',
  latitude: 48.8566,
  longitude: 2.3522,
  place_type: 'place',
  context: 'Ile-de-France, France',
}

// Stateful wrapper so the controlled input actually tracks typed values
function ControlledAutocomplete({
  onSelect,
  initialValue = '',
}: {
  onSelect?: (s: GeocodeSuggestion) => void
  initialValue?: string
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <LocationAutocomplete
      id="destination"
      value={value}
      onChange={setValue}
      onSelect={onSelect ?? vi.fn()}
    />
  )
}

describe('LocationAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders input with placeholder', () => {
    render(
      <LocationAutocomplete
        id="loc"
        value=""
        onChange={vi.fn()}
        onSelect={vi.fn()}
        placeholder="Search locations"
      />
    )
    expect(screen.getByPlaceholderText('Search locations')).toBeInTheDocument()
  })

  it('does not call geocodeApi when query is less than 2 chars', async () => {
    const user = userEvent.setup()
    render(<ControlledAutocomplete />)

    await user.type(screen.getByRole('textbox'), 'P')

    // Wait beyond the 300ms debounce
    await new Promise((r) => setTimeout(r, 400))

    expect(mockSearch).not.toHaveBeenCalled()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('calls geocodeApi.search after debounce when query >= 2 chars', async () => {
    mockSearch.mockResolvedValue({ data: [] })
    const user = userEvent.setup()
    render(<ControlledAutocomplete />)

    await user.type(screen.getByRole('textbox'), 'Pa')

    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('Pa'), {
      timeout: 1000,
    })
  })

  it('shows suggestions when API returns results', async () => {
    mockSearch.mockResolvedValue({ data: [PARIS] })
    const user = userEvent.setup()
    render(<ControlledAutocomplete />)

    await user.type(screen.getByRole('textbox'), 'Paris')

    // Suggestion renders place_name split on comma: "Paris" as primary, context as secondary
    expect(await screen.findByText('Paris', {}, { timeout: 1000 })).toBeInTheDocument()
    expect(await screen.findByText('Ile-de-France, France')).toBeInTheDocument()
  })

  it('calls onSelect and updates value when suggestion is clicked', async () => {
    mockSearch.mockResolvedValue({ data: [PARIS] })
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<ControlledAutocomplete onSelect={onSelect} />)

    await user.type(screen.getByRole('textbox'), 'Paris')

    const suggestion = await screen.findByText('Paris', {}, { timeout: 1000 })
    await user.click(suggestion)

    expect(onSelect).toHaveBeenCalledWith(PARIS)
    // Input now shows full place name
    expect(screen.getByRole('textbox')).toHaveValue('Paris, France')
    // Dropdown closes
    await waitFor(() => {
      expect(screen.queryByText('Ile-de-France, France')).not.toBeInTheDocument()
    })
  })

  it('does not show dropdown when API returns empty', async () => {
    mockSearch.mockResolvedValue({ data: [] })
    const user = userEvent.setup()
    render(<ControlledAutocomplete />)

    await user.type(screen.getByRole('textbox'), 'xyz')

    await waitFor(() => expect(mockSearch).toHaveBeenCalled(), { timeout: 1000 })

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('does not crash when API throws', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<ControlledAutocomplete />)

    await user.type(screen.getByRole('textbox'), 'Paris')

    await waitFor(() => expect(mockSearch).toHaveBeenCalled(), { timeout: 1000 })

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
