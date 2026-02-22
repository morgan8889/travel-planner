import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ItineraryTimeline } from '../components/itinerary/ItineraryTimeline'
import type { ItineraryDay, Activity } from '../lib/types'

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
}

const baseDay: ItineraryDay = {
  id: 'day-1',
  trip_id: 'trip-1',
  date: '2026-06-01',
  notes: null,
  activity_count: 0,
}

const makeActivity = (id: string, sort_order: number): Activity => ({
  id,
  itinerary_day_id: 'day-1',
  title: `Activity ${id}`,
  category: 'activity',
  start_time: null,
  end_time: null,
  location: null,
  latitude: null,
  longitude: null,
  notes: null,
  confirmation_number: null,
  sort_order,
  check_out_date: null,
})

describe('ItineraryTimeline drag indicator', () => {
  it('renders activities for a day', () => {
    render(
      <Wrapper>
        <ItineraryTimeline
          days={[baseDay]}
          allActivities={[makeActivity('a1', 0), makeActivity('a2', 1)]}
          tripId="trip-1"
        />
      </Wrapper>
    )
    expect(screen.getByText('Activity a1')).toBeInTheDocument()
    expect(screen.getByText('Activity a2')).toBeInTheDocument()
  })

  it('renders empty drop zone when day has no activities', () => {
    const { container } = render(
      <Wrapper>
        <ItineraryTimeline
          days={[baseDay]}
          allActivities={[]}
          tripId="trip-1"
        />
      </Wrapper>
    )
    // EmptyDayDropZone renders a dashed border element
    const dropZone = container.querySelector('.border-dashed')
    expect(dropZone).toBeInTheDocument()
  })
})
