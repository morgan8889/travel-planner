import { useState, useRef, useCallback } from 'react'
import { api, itineraryApi, checklistApi, calendarApi } from '../lib/api'
import type { TripCreate, TripSummary, CreateActivity } from '../lib/types'

// ─── Trip Definitions ────────────────────────────────────────────────
// Covers all 5 statuses (dreaming, planning, booked, active, completed),
// all 3 types (vacation, remote_week, sabbatical), parent/child trips,
// trips with/without coordinates, trips with notes, overlapping trips
// for 3-bar quarter view testing, and cross-year date ranges.

const TRIPS: TripCreate[] = [
  {
    destination: 'Tokyo, Japan',
    type: 'vacation',
    start_date: '2026-04-10',
    end_date: '2026-04-18',
    status: 'planning',
    destination_latitude: 35.68,
    destination_longitude: 139.65,
    notes: 'First trip to Japan! Focus on food and temples. Check cherry blossom forecast.',
  },
  {
    destination: 'Lisbon, Portugal',
    type: 'remote_week',
    start_date: '2026-05-04',
    end_date: '2026-05-10',
    status: 'booked',
    destination_latitude: 38.72,
    destination_longitude: -9.14,
  },
  {
    destination: 'Southeast Asia',
    type: 'sabbatical',
    start_date: '2026-09-01',
    end_date: '2026-11-30',
    status: 'dreaming',
    destination_latitude: 13.76,
    destination_longitude: 100.5,
    notes: 'Three month sabbatical. Sub-trips for Bangkok and Bali. Need to research visa requirements.',
  },
  {
    destination: 'Bangkok, Thailand',
    type: 'vacation',
    start_date: '2026-09-01',
    end_date: '2026-09-14',
    status: 'dreaming',
    destination_latitude: 13.76,
    destination_longitude: 100.5,
    // parent_trip_id set dynamically
  },
  {
    destination: 'Ubud, Bali',
    type: 'remote_week',
    start_date: '2026-10-15',
    end_date: '2026-10-28',
    status: 'dreaming',
    destination_latitude: -8.51,
    destination_longitude: 115.26,
    // parent_trip_id set dynamically
  },
  {
    destination: 'Reykjavik, Iceland',
    type: 'vacation',
    start_date: '2026-06-20',
    end_date: '2026-06-27',
    status: 'booked',
    destination_latitude: 64.15,
    destination_longitude: -21.94,
  },
  {
    destination: 'New York, USA',
    type: 'vacation',
    start_date: '2025-12-28',
    end_date: '2026-01-03',
    status: 'completed',
    destination_latitude: 40.71,
    destination_longitude: -74.01,
  },
  {
    destination: 'Patagonia, Argentina',
    type: 'sabbatical',
    start_date: '2027-02-01',
    end_date: '2027-02-28',
    status: 'dreaming',
    destination_latitude: -50.34,
    destination_longitude: -72.26,
  },
  // #8 — Active trip (tests active status color, status transitions, current-trip UX)
  {
    destination: 'Barcelona, Spain',
    type: 'vacation',
    start_date: '2026-02-15',
    end_date: '2026-02-22',
    status: 'active',
    destination_latitude: 41.39,
    destination_longitude: 2.17,
    notes: 'Currently on this trip! Testing inline editing and map markers.',
  },
  // #9 — Overlaps with Reykjavik (#5) for 3-bar quarter view testing
  {
    destination: 'Copenhagen, Denmark',
    type: 'vacation',
    start_date: '2026-06-18',
    end_date: '2026-06-25',
    status: 'planning',
    destination_latitude: 55.68,
    destination_longitude: 12.57,
  },
  // #10 — Overlaps with Reykjavik (#5) and Copenhagen (#9), NO coordinates (tests no-map state)
  {
    destination: 'Oslo, Norway',
    type: 'vacation',
    start_date: '2026-06-22',
    end_date: '2026-06-29',
    status: 'dreaming',
    destination_latitude: null,
    destination_longitude: null,
  },
]

// ─── Activity Definitions (keyed by trip index) ──────────────────────
// Covers all 4 categories (transport, food, activity, lodging),
// activities with/without coordinates, with/without times,
// with/without confirmation numbers, with/without notes,
// location text without coordinates (tests autocomplete edit),
// and multiple activities per day (tests drag reorder).

interface ActivityDef extends CreateActivity {
  dayOffset: number // 0-indexed offset from trip start_date
}

const ACTIVITIES: Record<number, ActivityDef[]> = {
  // Tokyo (#0) — 7 activities across 6 days, all 4 categories
  0: [
    { dayOffset: 0, title: 'Flight to NRT', category: 'transport', confirmation_number: 'JAL-8472-XK', notes: 'Narita Terminal 2' },
    { dayOffset: 0, title: 'Hotel Shinjuku Check-in', category: 'lodging', location: 'Shinjuku, Tokyo', latitude: 35.6938, longitude: 139.7034 },
    { dayOffset: 1, title: 'Tsukiji Market Breakfast', category: 'food', start_time: '06:00', end_time: '07:30', location: 'Tsukiji Outer Market', latitude: 35.6654, longitude: 139.7707 },
    { dayOffset: 2, title: 'Meiji Shrine Visit', category: 'activity', location: 'Meiji Shrine', latitude: 35.6764, longitude: 139.6993 },
    { dayOffset: 3, title: 'Shibuya Crossing', category: 'activity', location: 'Shibuya, Tokyo' },
    { dayOffset: 4, title: 'Ramen Dinner at Fuunji', category: 'food', start_time: '20:00', end_time: '21:00', location: 'Shinjuku, Tokyo', latitude: 35.6896, longitude: 139.6982 },
    { dayOffset: 5, title: 'Shinkansen to Kyoto', category: 'transport', confirmation_number: 'JR-PASS-2026-1847', start_time: '10:00', end_time: '12:15' },
  ],
  // Lisbon (#1) — 4 activities, remote work + sightseeing mix
  1: [
    { dayOffset: 0, title: 'Co-working at Second Home', category: 'activity', start_time: '09:00', end_time: '17:00', location: 'Second Home Lisboa', latitude: 38.7069, longitude: -9.1427 },
    { dayOffset: 1, title: 'Pasteis de Belem', category: 'food', location: 'Belem, Lisbon', latitude: 38.6976, longitude: -9.2033 },
    { dayOffset: 2, title: 'Tram 28 Ride', category: 'transport', notes: 'Historic tram through Alfama' },
    { dayOffset: 3, title: 'Fado Show', category: 'activity', start_time: '21:00', end_time: '23:30', location: 'Alfama, Lisbon', latitude: 38.7114, longitude: -9.1302 },
  ],
  // Reykjavik (#5) — activities with start_time only (no end_time) for overnight/open-ended
  5: [
    { dayOffset: 0, title: 'Blue Lagoon', category: 'activity', location: 'Blue Lagoon', latitude: 63.8803, longitude: -22.4495 },
    { dayOffset: 1, title: 'Golden Circle Tour', category: 'activity', start_time: '08:00', notes: 'Full day tour - no fixed end time' },
    { dayOffset: 3, title: 'Northern Lights Excursion', category: 'activity', start_time: '22:00', notes: 'Overnight activity - no end time since it crosses midnight' },
  ],
  // New York (#6) — completed trip activities
  6: [
    { dayOffset: 3, title: 'Times Square NYE', category: 'activity', start_time: '20:00', end_time: '23:59', location: 'Times Square', latitude: 40.758, longitude: -73.9855, notes: 'NYE celebration until midnight' },
    { dayOffset: 4, title: 'Brooklyn Bridge Walk', category: 'activity', location: 'Brooklyn Bridge', latitude: 40.7061, longitude: -73.9969 },
    { dayOffset: 5, title: 'Brunch at Balthazar', category: 'food', start_time: '11:00', end_time: '13:00', location: 'Balthazar, SoHo', latitude: 40.7231, longitude: -73.9985 },
  ],
  // Barcelona (#8) — active trip, tests inline editing on live trip
  8: [
    { dayOffset: 0, title: 'Sagrada Familia Tour', category: 'activity', start_time: '10:00', end_time: '12:00', location: 'Sagrada Familia', latitude: 41.4036, longitude: 2.1744, confirmation_number: 'SGF-2026-0215' },
    { dayOffset: 0, title: 'Hotel Arts Check-in', category: 'lodging', location: 'Hotel Arts Barcelona', latitude: 41.3875, longitude: 2.1924 },
    { dayOffset: 1, title: 'La Boqueria Market', category: 'food', start_time: '09:00', end_time: '10:30', location: 'La Boqueria', latitude: 41.3816, longitude: 2.1719 },
    { dayOffset: 2, title: 'Park Guell', category: 'activity', location: 'Park Guell, Barcelona', latitude: 41.4145, longitude: 2.1527 },
    { dayOffset: 3, title: 'Gothic Quarter Walking Tour', category: 'activity', start_time: '14:00', location: 'Gothic Quarter' },
    { dayOffset: 4, title: 'Beach Day at Barceloneta', category: 'activity', location: 'Barceloneta Beach' },
    { dayOffset: 5, title: 'Flamenco Show', category: 'activity', start_time: '21:00', end_time: '23:00', notes: 'Tablao Cordobes - tickets booked' },
    { dayOffset: 6, title: 'Flight Home', category: 'transport', start_time: '14:00', confirmation_number: 'VY-3847-BCN' },
  ],
  // Copenhagen (#9) — overlapping trip, tests quarter view with 3 bars
  9: [
    { dayOffset: 0, title: 'Tivoli Gardens', category: 'activity', location: 'Tivoli Gardens', latitude: 55.6737, longitude: 12.5681 },
    { dayOffset: 1, title: 'Nyhavn Canal Tour', category: 'activity', start_time: '11:00', end_time: '12:30', location: 'Nyhavn', latitude: 55.6797, longitude: 12.5907 },
    { dayOffset: 2, title: 'Smorrebrod Lunch', category: 'food', start_time: '12:00', end_time: '13:30', location: 'Aamanns, Copenhagen', latitude: 55.6838, longitude: 12.5717 },
  ],
}

// ─── Checklist Definitions (keyed by trip index) ─────────────────────
// Tests progress bar (partial completion), checklist delete, item delete,
// toggle, and various item counts. checkedIndices marks items to pre-check.

interface ChecklistDef {
  title: string
  items: string[]
  checkedIndices?: number[] // item indices to pre-check for progress bar testing
}

const CHECKLISTS: Record<number, ChecklistDef[]> = {
  // Tokyo (#0) — partial progress on packing, nothing checked on pre-departure
  0: [
    {
      title: 'Packing',
      items: ['Passport', 'Power adaptor (Type A)', 'Umbrella', 'JR Pass', 'Yen cash', 'Pocket WiFi', 'Comfortable shoes', 'Medication'],
      checkedIndices: [0, 1, 3],
    },
    {
      title: 'Pre-departure',
      items: ['Travel insurance', 'Notify bank', 'Airport transfer', 'Pet sitter', 'Mail hold'],
    },
  ],
  // Lisbon (#1) — mostly done
  1: [
    {
      title: 'Work Setup',
      items: ['VPN configured', 'Timezone notification sent', 'Backup charger', 'Noise-cancelling headphones'],
      checkedIndices: [0, 1, 2],
    },
  ],
  // SE Asia (#2) — early stage, nothing checked
  2: [
    {
      title: 'Visa Requirements',
      items: ['Thailand visa', 'Indonesia visa', 'Vaccinations', 'Travel insurance', 'Document copies', 'Emergency contacts'],
    },
  ],
  // Reykjavik (#5) — half done
  5: [
    {
      title: 'Gear',
      items: ['Thermal base layers', 'Waterproof jacket', 'Hiking boots', 'Camera gear', 'Swimsuit for hot springs'],
      checkedIndices: [0, 2],
    },
  ],
  // New York (#6) — completed trip, all items checked
  6: [
    {
      title: 'NYE Prep',
      items: ['Restaurant reservation', 'Warm layers', 'Times Square tickets'],
      checkedIndices: [0, 1, 2],
    },
  ],
  // Barcelona (#8) — active trip, in-progress checklist
  8: [
    {
      title: 'Packing',
      items: ['Passport', 'Euros', 'Sunscreen', 'Guidebook', 'Camera', 'Comfortable walking shoes'],
      checkedIndices: [0, 1, 5],
    },
    {
      title: 'Bookings',
      items: ['Sagrada Familia tickets', 'Hotel confirmation', 'Flamenco show tickets', 'Airport transfer'],
      checkedIndices: [0, 1, 2],
    },
  ],
}

// ─── Custom Day Definitions ──────────────────────────────────────────

const CUSTOM_DAYS = [
  { name: "Mom's Birthday", date: '2026-05-15', recurring: true },
  { name: 'Company Retreat', date: '2026-09-20', recurring: false },
  { name: 'Wedding Anniversary', date: '2026-08-01', recurring: true },
  { name: 'Vet Appointment', date: '2026-03-10', recurring: false },
]

// ─── Helper: add days to a date string ───────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── Component ───────────────────────────────────────────────────────

export function DevSeedPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const tripIdsRef = useRef<Map<number, string>>(new Map())

  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg])
    setTimeout(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }, [])

  // ─── Seed Trips ──────────────────────────────────────────────────

  const seedTrips = useCallback(async () => {
    log('--- Seeding Trips ---')
    tripIdsRef.current.clear()

    for (let i = 0; i < TRIPS.length; i++) {
      const tripDef = { ...TRIPS[i] }

      // Sub-trips: Bangkok (#3) and Ubud (#4) are children of SE Asia (#2)
      if (i === 3 || i === 4) {
        const parentId = tripIdsRef.current.get(2)
        if (parentId) {
          tripDef.parent_trip_id = parentId
        }
      }

      const res = await api.post('/trips', tripDef)
      const tripId = res.data.id as string
      tripIdsRef.current.set(i, tripId)
      log(`  Created trip: ${tripDef.destination} (${tripDef.type}, ${tripDef.status})`)
    }

    log(`Done: ${TRIPS.length} trips created`)
  }, [log])

  // ─── Seed Itineraries ────────────────────────────────────────────

  const seedItineraries = useCallback(async () => {
    log('--- Seeding Itineraries ---')

    for (const [tripIdxStr, activities] of Object.entries(ACTIVITIES)) {
      const tripIdx = Number(tripIdxStr)
      const tripId = tripIdsRef.current.get(tripIdx)
      if (!tripId) {
        log(`  Skipping trip index ${tripIdx}: no trip ID (seed trips first)`)
        continue
      }

      // Generate itinerary days from trip date range
      const daysRes = await itineraryApi.generateDays(tripId)
      const days = daysRes.data
      log(`  Generated ${days.length} days for ${TRIPS[tripIdx].destination}`)

      for (const actDef of activities) {
        const targetDate = addDays(TRIPS[tripIdx].start_date, actDef.dayOffset)
        const day = days.find((d) => d.date === targetDate)
        if (!day) {
          log(`    Warning: no day found for ${targetDate}, skipping ${actDef.title}`)
          continue
        }

        const actPayload: CreateActivity = {
          title: actDef.title,
          category: actDef.category,
          start_time: actDef.start_time,
          end_time: actDef.end_time,
          location: actDef.location,
          latitude: actDef.latitude,
          longitude: actDef.longitude,
          notes: actDef.notes,
          confirmation_number: actDef.confirmation_number,
        }
        await itineraryApi.createActivity(day.id, actPayload)
        log(`    Activity: ${actDef.title} (${actDef.category}, day ${actDef.dayOffset})`)
      }
    }

    log('Done: itineraries seeded')
  }, [log])

  // ─── Seed Checklists ─────────────────────────────────────────────

  const seedChecklists = useCallback(async () => {
    log('--- Seeding Checklists ---')

    for (const [tripIdxStr, checklists] of Object.entries(CHECKLISTS)) {
      const tripIdx = Number(tripIdxStr)
      const tripId = tripIdsRef.current.get(tripIdx)
      if (!tripId) {
        log(`  Skipping trip index ${tripIdx}: no trip ID (seed trips first)`)
        continue
      }

      for (const clDef of checklists) {
        const clRes = await checklistApi.create(tripId, { title: clDef.title })
        const checklistId = clRes.data.id

        const itemIds: string[] = []
        for (const itemText of clDef.items) {
          const itemRes = await checklistApi.addItem(checklistId, { text: itemText })
          itemIds.push(itemRes.data.id)
        }

        // Pre-check items for progress bar testing
        if (clDef.checkedIndices) {
          for (const idx of clDef.checkedIndices) {
            if (idx < itemIds.length) {
              await checklistApi.toggleItem(itemIds[idx])
            }
          }
          log(`  ${TRIPS[tripIdx].destination}: "${clDef.title}" (${clDef.items.length} items, ${clDef.checkedIndices.length} checked)`)
        } else {
          log(`  ${TRIPS[tripIdx].destination}: "${clDef.title}" (${clDef.items.length} items)`)
        }
      }
    }

    log('Done: checklists seeded')
  }, [log])

  // ─── Seed Calendar ───────────────────────────────────────────────

  const seedCalendar = useCallback(async () => {
    log('--- Seeding Calendar ---')

    // Enable US and UK holidays for 2026
    const countries = ['US', 'UK']
    for (const code of countries) {
      try {
        await calendarApi.enableCountry({ country_code: code, year: 2026 })
        log(`  Enabled ${code} holidays for 2026`)
      } catch {
        log(`  ${code} holidays already enabled for 2026`)
      }
    }

    // Add custom days
    for (const day of CUSTOM_DAYS) {
      await calendarApi.createCustomDay(day)
      log(`  Custom day: ${day.name} (${day.date}${day.recurring ? ', recurring' : ''})`)
    }

    log(`Done: calendar seeded (${countries.join(' + ')} holidays + ${CUSTOM_DAYS.length} custom days)`)
  }, [log])

  // ─── Clear All Data ──────────────────────────────────────────────

  const clearAllData = useCallback(async () => {
    setRunning(true)
    setLogs([])
    try {
      log('--- Clearing All Data ---')

      // Delete all trips (cascades to itineraries, checklists)
      const tripsRes = await api.get<TripSummary[]>('/trips')
      const trips = tripsRes.data
      // Delete children first, then parents
      const parents = trips.filter((t) => !t.parent_trip_id)
      const children = trips.filter((t) => t.parent_trip_id)
      for (const trip of children) {
        await api.delete(`/trips/${trip.id}`)
        log(`  Deleted trip: ${trip.destination}`)
      }
      for (const trip of parents) {
        await api.delete(`/trips/${trip.id}`)
        log(`  Deleted trip: ${trip.destination}`)
      }
      log(`  Removed ${trips.length} trips (with itineraries + checklists)`)

      // Clear calendar: disable all country holidays and delete custom days
      try {
        const calRes = await calendarApi.getHolidays(2026)
        for (const entry of calRes.data.enabled_countries) {
          await calendarApi.disableCountry(entry.country_code, 2026)
          log(`  Disabled ${entry.country_code} holidays for 2026`)
        }
        for (const day of calRes.data.custom_days) {
          await calendarApi.deleteCustomDay(day.id)
        }
        if (calRes.data.custom_days.length > 0) {
          log(`  Removed ${calRes.data.custom_days.length} custom days`)
        }
      } catch {
        log('  No calendar data found to clear')
      }

      tripIdsRef.current.clear()
      log('=== All data cleared ===')
    } catch (err) {
      log(`ERROR: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }, [log])

  // ─── Seed Everything ─────────────────────────────────────────────

  const seedEverything = useCallback(async () => {
    setRunning(true)
    setLogs([])
    try {
      await seedTrips()
      await seedItineraries()
      await seedChecklists()
      await seedCalendar()
      log('=== All seed data created ===')
    } catch (err) {
      log(`ERROR: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }, [seedTrips, seedItineraries, seedChecklists, seedCalendar, log])

  const runSingle = useCallback(
    async (fn: () => Promise<void>, label: string) => {
      setRunning(true)
      setLogs([])
      try {
        await fn()
      } catch (err) {
        log(`ERROR seeding ${label}: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setRunning(false)
      }
    },
    [log],
  )

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-cloud-900 mb-1">Test Data Generator</h1>
      <p className="text-sm text-cloud-500 mb-6">
        Seeds comprehensive test data: {TRIPS.length} trips (all statuses/types), {Object.values(ACTIVITIES).flat().length} activities,{' '}
        {Object.values(CHECKLISTS).flat().reduce((sum, cl) => sum + cl.items.length, 0)} checklist items, and calendar data.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => runSingle(seedTrips, 'trips')}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-cloud-100 text-cloud-700 hover:bg-cloud-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Seed Trips
        </button>
        <button
          onClick={() => runSingle(seedItineraries, 'itineraries')}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-cloud-100 text-cloud-700 hover:bg-cloud-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Seed Itineraries
        </button>
        <button
          onClick={() => runSingle(seedChecklists, 'checklists')}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-cloud-100 text-cloud-700 hover:bg-cloud-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Seed Checklists
        </button>
        <button
          onClick={() => runSingle(seedCalendar, 'calendar')}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-cloud-100 text-cloud-700 hover:bg-cloud-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Seed Calendar
        </button>
        <button
          onClick={seedEverything}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? 'Running...' : 'Seed Everything'}
        </button>
        <button
          onClick={clearAllData}
          disabled={running}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear All Data
        </button>
      </div>

      <div
        ref={logRef}
        className="h-96 overflow-y-auto rounded-lg border border-cloud-200 bg-cloud-50 p-4 font-mono text-xs text-cloud-700 whitespace-pre-wrap"
      >
        {logs.length === 0 ? (
          <span className="text-cloud-400">Click a button to start seeding data...</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={line.startsWith('ERROR') ? 'text-red-600 font-semibold' : line.startsWith('Done') || line.startsWith('===') ? 'text-emerald-600 font-semibold' : ''}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
