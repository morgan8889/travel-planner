import { useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { api, itineraryApi, checklistApi, calendarApi } from '../lib/api'
import type { TripCreate, TripSummary, CreateActivity, BlockType } from '../lib/types'

// ─── Trip Definitions ────────────────────────────────────────────────

const TRIPS: TripCreate[] = [
  {
    destination: 'Tokyo, Japan',
    type: 'vacation',
    start_date: '2026-04-10',
    end_date: '2026-04-18',
    status: 'planning',
    destination_latitude: 35.68,
    destination_longitude: 139.65,
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
]

// ─── Activity Definitions (keyed by trip index) ──────────────────────

interface ActivityDef extends CreateActivity {
  dayOffset: number // 0-indexed offset from trip start_date
}

const ACTIVITIES: Record<number, ActivityDef[]> = {
  // Tokyo (#0)
  0: [
    { dayOffset: 0, title: 'Flight to NRT', category: 'transport', confirmation_number: 'JAL-8472-XK', notes: 'Narita Terminal 2' },
    { dayOffset: 0, title: 'Hotel Shinjuku Check-in', category: 'lodging', location: 'Shinjuku, Tokyo', latitude: 35.6938, longitude: 139.7034 },
    { dayOffset: 1, title: 'Tsukiji Market Breakfast', category: 'food', start_time: '06:00', end_time: '07:30', location: 'Tsukiji Outer Market', latitude: 35.6654, longitude: 139.7707 },
    { dayOffset: 2, title: 'Meiji Shrine Visit', category: 'activity', location: 'Meiji Shrine', latitude: 35.6764, longitude: 139.6993 },
    { dayOffset: 3, title: 'Shibuya Crossing', category: 'activity', location: 'Shibuya, Tokyo' },
    { dayOffset: 4, title: 'Ramen Dinner at Fuunji', category: 'food', start_time: '20:00', end_time: '21:00', location: 'Shinjuku, Tokyo', latitude: 35.6896, longitude: 139.6982 },
    { dayOffset: 5, title: 'Shinkansen to Kyoto', category: 'transport', confirmation_number: 'JR-PASS-2026-1847', start_time: '10:00', end_time: '12:15' },
  ],
  // Lisbon (#1)
  1: [
    { dayOffset: 0, title: 'Co-working at Second Home', category: 'activity', start_time: '09:00', end_time: '17:00', location: 'Second Home Lisboa', latitude: 38.7069, longitude: -9.1427 },
    { dayOffset: 1, title: 'Pasteis de Belem', category: 'food', location: 'Belem, Lisbon', latitude: 38.6976, longitude: -9.2033 },
    { dayOffset: 2, title: 'Tram 28 Ride', category: 'transport', notes: 'Historic tram through Alfama' },
    { dayOffset: 3, title: 'Fado Show', category: 'activity', start_time: '21:00', end_time: '23:30', location: 'Alfama, Lisbon', latitude: 38.7114, longitude: -9.1302 },
  ],
  // Reykjavik (#5)
  5: [
    { dayOffset: 0, title: 'Blue Lagoon', category: 'activity', location: 'Blue Lagoon', latitude: 63.8803, longitude: -22.4495 },
    { dayOffset: 1, title: 'Golden Circle Tour', category: 'activity', start_time: '08:00', notes: 'Full day tour - no fixed end time' },
    { dayOffset: 3, title: 'Northern Lights Excursion', category: 'activity', start_time: '22:00', notes: 'Overnight activity - no end time since it crosses midnight' },
  ],
  // New York (#6)
  6: [
    { dayOffset: 3, title: 'Times Square NYE', category: 'activity', start_time: '20:00', end_time: '23:59', location: 'Times Square', latitude: 40.758, longitude: -73.9855, notes: 'NYE celebration until midnight' },
    { dayOffset: 4, title: 'Brooklyn Bridge Walk', category: 'activity', location: 'Brooklyn Bridge', latitude: 40.7061, longitude: -73.9969 },
    { dayOffset: 5, title: 'Brunch at Balthazar', category: 'food', start_time: '11:00', end_time: '13:00', location: 'Balthazar, SoHo', latitude: 40.7231, longitude: -73.9985 },
  ],
}

// ─── Checklist Definitions (keyed by trip index) ─────────────────────

interface ChecklistDef {
  title: string
  items: string[]
}

const CHECKLISTS: Record<number, ChecklistDef[]> = {
  0: [
    {
      title: 'Packing',
      items: ['Passport', 'Power adaptor (Type A)', 'Umbrella', 'JR Pass', 'Yen cash', 'Pocket WiFi', 'Comfortable shoes', 'Medication'],
    },
    {
      title: 'Pre-departure',
      items: ['Travel insurance', 'Notify bank', 'Airport transfer', 'Pet sitter', 'Mail hold'],
    },
  ],
  1: [
    {
      title: 'Work Setup',
      items: ['VPN configured', 'Timezone notification sent', 'Backup charger', 'Noise-cancelling headphones'],
    },
  ],
  2: [
    {
      title: 'Visa Requirements',
      items: ['Thailand visa', 'Indonesia visa', 'Vaccinations', 'Travel insurance', 'Document copies', 'Emergency contacts'],
    },
  ],
  5: [
    {
      title: 'Gear',
      items: ['Thermal base layers', 'Waterproof jacket', 'Hiking boots', 'Camera gear', 'Swimsuit for hot springs'],
    },
  ],
  6: [
    {
      title: 'NYE Prep',
      items: ['Restaurant reservation', 'Warm layers', 'Times Square tickets'],
    },
  ],
}

// ─── Calendar Definitions ────────────────────────────────────────────

interface CalendarBlockDef {
  type: BlockType
  start_date: string
  end_date: string
  destination?: string
  notes?: string
}

const CALENDAR_BLOCKS: CalendarBlockDef[] = [
  // US Federal Holidays
  { type: 'holiday', start_date: '2026-01-01', end_date: '2026-01-01', notes: "New Year's Day" },
  { type: 'holiday', start_date: '2026-01-19', end_date: '2026-01-19', notes: 'Martin Luther King Jr. Day' },
  { type: 'holiday', start_date: '2026-02-16', end_date: '2026-02-16', notes: "Presidents' Day" },
  { type: 'holiday', start_date: '2026-05-25', end_date: '2026-05-25', notes: 'Memorial Day' },
  { type: 'holiday', start_date: '2026-06-19', end_date: '2026-06-19', notes: 'Juneteenth' },
  { type: 'holiday', start_date: '2026-07-03', end_date: '2026-07-03', notes: 'Independence Day (observed)' },
  { type: 'holiday', start_date: '2026-09-07', end_date: '2026-09-07', notes: 'Labor Day' },
  { type: 'holiday', start_date: '2026-10-12', end_date: '2026-10-12', notes: 'Columbus Day' },
  { type: 'holiday', start_date: '2026-11-26', end_date: '2026-11-27', notes: 'Thanksgiving (Thu-Fri)' },
  { type: 'holiday', start_date: '2026-12-25', end_date: '2026-12-25', notes: 'Christmas Day' },
  // PTO Blocks
  { type: 'pto', start_date: '2026-01-05', end_date: '2026-01-09', notes: 'Post-holiday recovery' },
  { type: 'pto', start_date: '2026-02-16', end_date: '2026-02-20', notes: 'Winter ski break', destination: 'Park City, UT' },
  { type: 'pto', start_date: '2026-03-30', end_date: '2026-04-03', notes: 'Spring break' },
  { type: 'pto', start_date: '2026-04-10', end_date: '2026-04-18', notes: 'Tokyo trip', destination: 'Tokyo, Japan' },
  { type: 'pto', start_date: '2026-05-02', end_date: '2026-05-10', notes: 'Lisbon trip (weekend buffer)', destination: 'Lisbon, Portugal' },
  { type: 'pto', start_date: '2026-06-19', end_date: '2026-06-27', notes: 'Iceland trip', destination: 'Reykjavik, Iceland' },
  { type: 'pto', start_date: '2026-07-02', end_date: '2026-07-06', notes: 'Summer long weekend' },
  { type: 'pto', start_date: '2026-08-10', end_date: '2026-08-14', notes: 'Beach week', destination: 'Outer Banks, NC' },
  { type: 'pto', start_date: '2026-09-01', end_date: '2026-09-05', notes: 'SE Asia start', destination: 'Bangkok, Thailand' },
  { type: 'pto', start_date: '2026-10-13', end_date: '2026-10-17', notes: 'Fall break' },
  { type: 'pto', start_date: '2026-11-23', end_date: '2026-11-27', notes: 'Thanksgiving week' },
  { type: 'pto', start_date: '2026-12-22', end_date: '2026-12-31', notes: 'Holiday break' },
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

        for (const itemText of clDef.items) {
          await checklistApi.addItem(checklistId, { text: itemText })
        }

        log(`  ${TRIPS[tripIdx].destination}: "${clDef.title}" (${clDef.items.length} items)`)
      }
    }

    log('Done: checklists seeded')
  }, [log])

  // ─── Seed Calendar ───────────────────────────────────────────────

  const seedCalendar = useCallback(async () => {
    log('--- Seeding Calendar ---')

    let planId: string
    try {
      const planRes = await calendarApi.createPlan({ year: 2026, notes: 'Heavy travel year - seed data' })
      planId = planRes.data.id
      log('  Created 2026 annual plan')
    } catch (err) {
      // 409 = plan already exists, reuse it
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const existing = await calendarApi.getYear(2026)
        if (!existing.data.plan) throw new Error('2026 plan not found after 409')
        planId = existing.data.plan.id
        // Clear existing blocks before re-seeding
        for (const block of existing.data.blocks) {
          await calendarApi.deleteBlock(block.id)
        }
        log(`  Reusing existing 2026 plan (cleared ${existing.data.blocks.length} old blocks)`)
      } else {
        throw err
      }
    }

    for (const block of CALENDAR_BLOCKS) {
      await calendarApi.createBlock({
        annual_plan_id: planId,
        type: block.type,
        start_date: block.start_date,
        end_date: block.end_date,
        destination: block.destination ?? null,
        notes: block.notes ?? null,
      })
    }

    log(`  Created ${CALENDAR_BLOCKS.length} calendar blocks (${CALENDAR_BLOCKS.filter((b) => b.type === 'holiday').length} holidays, ${CALENDAR_BLOCKS.filter((b) => b.type === 'pto').length} PTO)`)
    log('Done: calendar seeded')
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

      // Delete calendar blocks for 2026
      try {
        const calRes = await calendarApi.getYear(2026)
        if (calRes.data.blocks.length > 0) {
          for (const block of calRes.data.blocks) {
            await calendarApi.deleteBlock(block.id)
          }
          log(`  Removed ${calRes.data.blocks.length} calendar blocks`)
        }
      } catch {
        log('  No 2026 calendar plan found')
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
        Creates real data in the database using your current session. Trips, itineraries, checklists, and calendar blocks.
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
