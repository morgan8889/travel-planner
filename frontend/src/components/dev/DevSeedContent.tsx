import { useState, useRef, useCallback } from 'react'
import { api, itineraryApi, checklistApi, calendarApi } from '../../lib/api'
import type { TripCreate, TripSummary, CreateActivity } from '../../lib/types'

// ─── Trip Definitions ────────────────────────────────────────────────

const TRIPS: TripCreate[] = [
  // 0 — 3M Half Marathon (Austin local)
  {
    destination: 'Austin, TX',
    type: 'event',
    start_date: '2026-01-18',
    end_date: '2026-01-18',
    status: 'booked',
    notes: '3M Half Marathon — local Austin race',
    destination_latitude: 30.2672,
    destination_longitude: -97.7431,
  },
  // 1 — Come and Grind It (Austin local)
  {
    destination: 'Austin, TX',
    type: 'event',
    start_date: '2026-03-07',
    end_date: '2026-03-07',
    status: 'planning',
    notes: 'Come and Grind It race — local Austin event',
    destination_latitude: 30.2672,
    destination_longitude: -97.7431,
  },
  // 2 — Nick: Florida
  {
    destination: 'Florida',
    type: 'vacation',
    start_date: '2026-03-12',
    end_date: '2026-03-15',
    status: 'booked',
    notes: 'Confirmation: KML3TW (Spirit)',
    destination_latitude: 27.9944,
    destination_longitude: -81.7603,
  },
  // 3 — Victoria: Florida
  {
    destination: 'Florida',
    type: 'vacation',
    start_date: '2026-03-11',
    end_date: '2026-03-22',
    status: 'booked',
    notes: 'SW + Delta bookings',
    destination_latitude: 27.9944,
    destination_longitude: -81.7603,
  },
  // 4 — Remote #1: South Padre
  {
    destination: 'South Padre Island, TX',
    type: 'remote_week',
    start_date: '2026-03-29',
    end_date: '2026-04-04',
    status: 'planning',
    notes: 'Remote work week — South Padre Island',
    destination_latitude: 26.1173,
    destination_longitude: -97.1686,
  },
  // 5 — Cap10k (Austin local)
  {
    destination: 'Austin, TX',
    type: 'event',
    start_date: '2026-04-12',
    end_date: '2026-04-12',
    status: 'booked',
    notes: 'Cap10k — local Austin race',
    destination_latitude: 30.2672,
    destination_longitude: -97.7431,
  },
  // 6 — Jailbreak 100
  {
    destination: 'Bryan, TX',
    type: 'event',
    start_date: '2026-04-17',
    end_date: '2026-04-19',
    status: 'booked',
    notes: 'Jailbreak 100 gravel race',
    destination_latitude: 30.6744,
    destination_longitude: -96.3698,
  },
  // 7 — Garner State Park
  {
    destination: 'Garner State Park, TX',
    type: 'vacation',
    start_date: '2026-04-24',
    end_date: '2026-04-26',
    status: 'planning',
    notes: 'CONFLICT: Wire Donkey is same weekend — pick one',
    destination_latitude: 29.5957,
    destination_longitude: -99.7468,
  },
  // 8 — Wire Donkey
  {
    destination: 'Bandera, TX',
    type: 'event',
    start_date: '2026-04-24',
    end_date: '2026-04-26',
    status: 'planning',
    notes: 'CONFLICT: Garner State Park is same weekend — pick one',
    destination_latitude: 29.7274,
    destination_longitude: -99.0742,
  },
  // 9 — Remote #2: San Diego
  {
    destination: 'San Diego, CA',
    type: 'remote_week',
    start_date: '2026-04-30',
    end_date: '2026-05-10',
    status: 'planning',
    notes: 'Remote work week + BWR race',
    destination_latitude: 32.7157,
    destination_longitude: -117.1611,
  },
  // 10 — BWR San Diego
  {
    destination: 'Oceanside, CA',
    type: 'event',
    start_date: '2026-05-02',
    end_date: '2026-05-02',
    status: 'planning',
    notes: 'Belgian Waffle Ride San Diego',
    destination_latitude: 33.1959,
    destination_longitude: -117.3795,
  },
  // 11 — Unbound 200
  {
    destination: 'Emporia, KS',
    type: 'event',
    start_date: '2026-05-28',
    end_date: '2026-05-31',
    status: 'booked',
    notes: 'Unbound Gravel 200',
    destination_latitude: 38.4036,
    destination_longitude: -96.1817,
  },
  // 12 — World Cup: Houston
  {
    destination: 'Houston, TX',
    type: 'event',
    start_date: '2026-06-20',
    end_date: '2026-06-20',
    status: 'booked',
    notes: 'FIFA World Cup match',
    destination_latitude: 29.7604,
    destination_longitude: -95.3698,
  },
  // 13 — Remote #3: Colorado
  {
    destination: 'Colorado',
    type: 'remote_week',
    start_date: '2026-06-26',
    end_date: '2026-07-03',
    status: 'planning',
    notes: 'Remote work week — Colorado',
    destination_latitude: 39.5501,
    destination_longitude: -105.7821,
  },
  // 14 — Hotter n Hell
  {
    destination: 'Wichita Falls, TX',
    type: 'event',
    start_date: '2026-08-28',
    end_date: '2026-08-30',
    status: 'planning',
    notes: 'Hotter n Hell Hundred ride',
    destination_latitude: 33.9137,
    destination_longitude: -98.4934,
  },
  // 15 — Tor Sabbatical (PARENT of Berlin + Sardinia)
  {
    destination: 'Europe',
    type: 'sabbatical',
    start_date: '2026-08-27',
    end_date: '2026-10-02',
    status: 'planning',
    notes: 'Tor des Geants + sabbatical travel. Sub-trips: Berlin, Sardinia.',
    destination_latitude: 45.7503,
    destination_longitude: 7.3357,
  },
  // 16 — Berlin (sub of Tor Sabbatical, idx 15)
  {
    destination: 'Berlin, Germany',
    type: 'vacation',
    start_date: '2026-09-24',
    end_date: '2026-09-28',
    status: 'booked',
    notes: 'Sub-trip of Tor Sabbatical',
    destination_latitude: 52.52,
    destination_longitude: 13.405,
  },
  // 17 — Sardinia (sub of Tor Sabbatical, idx 15)
  {
    destination: 'Sardinia, Italy',
    type: 'vacation',
    start_date: '2026-09-28',
    end_date: '2026-10-02',
    status: 'planning',
    notes: 'Sub-trip of Tor Sabbatical — Tor des Geants finish area',
    destination_latitude: 40.1209,
    destination_longitude: 9.0129,
  },
  // 18 — Remote #4: TBD
  {
    destination: 'TBD',
    type: 'remote_week',
    start_date: '2026-10-05',
    end_date: '2026-10-09',
    status: 'dreaming',
    notes: 'Remote work week — location TBD',
  },
  // 19 — Hong Kong / Taiwan
  {
    destination: 'Hong Kong / Taiwan',
    type: 'vacation',
    start_date: '2026-11-20',
    end_date: '2026-12-06',
    status: 'dreaming',
    notes: 'Asia trip — Hong Kong and Taiwan',
    destination_latitude: 22.3193,
    destination_longitude: 114.1694,
  },
]

interface ActivityDef extends CreateActivity {
  dayOffset: number
}

const ACTIVITIES: Record<number, ActivityDef[]> = {
  // 2 — Nick: Florida
  2: [
    { dayOffset: 0, title: 'Fly to Florida', category: 'transport', confirmation_number: 'KML3TW', notes: 'Spirit Airlines' },
    { dayOffset: 3, title: 'Fly home', category: 'transport', notes: 'Spirit Airlines return' },
  ],
  // 3 — Victoria: Florida
  3: [
    { dayOffset: 0, title: 'Fly to Florida', category: 'transport', notes: 'Southwest outbound' },
    { dayOffset: 11, title: 'Fly home', category: 'transport', notes: 'Delta return' },
  ],
  // 6 — Jailbreak 100
  6: [
    { dayOffset: 0, title: 'Drive to Bryan', category: 'transport' },
    { dayOffset: 1, title: 'Jailbreak 100 race day', category: 'activity', notes: '100-mile gravel race' },
    { dayOffset: 2, title: 'Drive home', category: 'transport' },
  ],
  // 9 — Remote #2: San Diego
  9: [
    { dayOffset: 0, title: 'Fly to San Diego', category: 'transport' },
    { dayOffset: 10, title: 'Fly home', category: 'transport' },
  ],
  // 10 — BWR San Diego
  10: [
    { dayOffset: 0, title: 'Belgian Waffle Ride San Diego', category: 'activity', notes: 'BWR race day — Oceanside start' },
  ],
  // 11 — Unbound 200
  11: [
    { dayOffset: 0, title: 'Fly to Kansas City', category: 'transport' },
    { dayOffset: 1, title: 'Arrive Emporia, bike check-in', category: 'activity' },
    { dayOffset: 2, title: 'Unbound 200 race day', category: 'activity', notes: '200-mile gravel race' },
    { dayOffset: 3, title: 'Fly home', category: 'transport' },
  ],
  // 12 — World Cup: Houston
  12: [
    { dayOffset: 0, title: 'Drive to Houston', category: 'transport' },
    { dayOffset: 0, title: 'FIFA World Cup match', category: 'activity' },
  ],
  // 14 — Hotter n Hell
  14: [
    { dayOffset: 0, title: 'Drive to Wichita Falls', category: 'transport' },
    { dayOffset: 1, title: 'Hotter n Hell Hundred', category: 'activity', notes: '100-mile ride in August heat' },
    { dayOffset: 2, title: 'Drive home', category: 'transport' },
  ],
  // 16 — Berlin
  16: [
    { dayOffset: 0, title: 'Fly to Berlin', category: 'transport', notes: 'Booked' },
    { dayOffset: 1, title: 'Explore Berlin', category: 'activity' },
    { dayOffset: 2, title: 'Explore Berlin', category: 'activity' },
    { dayOffset: 3, title: 'Explore Berlin', category: 'activity' },
    { dayOffset: 4, title: 'Train to Sardinia connection', category: 'transport' },
  ],
  // 17 — Sardinia
  17: [
    { dayOffset: 0, title: 'Arrive Sardinia', category: 'transport' },
    { dayOffset: 1, title: 'Tor des Geants area — explore Courmayeur', category: 'activity' },
    { dayOffset: 2, title: 'Rest day', category: 'activity' },
    { dayOffset: 3, title: 'Explore Sardinia', category: 'activity' },
    { dayOffset: 4, title: 'Fly home', category: 'transport' },
  ],
  // 19 — Hong Kong / Taiwan
  19: [
    { dayOffset: 0, title: 'Fly to Hong Kong', category: 'transport' },
    { dayOffset: 5, title: 'Travel to Taiwan', category: 'transport' },
    { dayOffset: 11, title: 'Explore Taiwan', category: 'activity' },
    { dayOffset: 16, title: 'Fly home from Taipei', category: 'transport' },
  ],
}

interface ChecklistDef {
  title: string
  items: string[]
  checkedIndices?: number[]
}

const CHECKLISTS: Record<number, ChecklistDef[]> = {
  // 2 — Nick: Florida
  2: [
    {
      title: 'Packing',
      items: ['Passport / ID', 'Sunscreen', 'Swimsuit', 'Bike kit', 'Casual clothes'],
    },
  ],
  // 6 — Jailbreak 100
  6: [
    {
      title: 'Race Prep',
      items: ['Register', 'Pack nutrition (gels, bars)', 'Load bike on car', 'Chamois cream', 'Emergency contact info'],
      checkedIndices: [0],
    },
  ],
  // 11 — Unbound 200
  11: [
    {
      title: 'Race Prep',
      items: [
        'Register',
        'Book flights',
        'Book hotel Emporia',
        'Ship bike or rent',
        'Pack 200-mile nutrition',
        'Gravel-specific gear check',
        'Crew plan',
      ],
      checkedIndices: [0, 1],
    },
  ],
  // 15 — Tor Sabbatical
  15: [
    {
      title: 'Planning',
      items: [
        'Book flights outbound',
        'Book flights home',
        'Tor accommodation Courmayeur',
        'Berlin accommodation',
        'Sardinia accommodation',
        'Travel insurance',
        'Notify bank',
      ],
    },
  ],
  // 19 — Hong Kong / Taiwan
  19: [
    {
      title: 'Pre-Trip',
      items: [
        'Book flights',
        'Check visa requirements',
        'Travel insurance',
        'Accommodation HK',
        'Accommodation Taiwan',
        'Notify bank',
        'Pack',
      ],
    },
  ],
}

const CUSTOM_DAYS: Array<{ name: string; date: string; recurring: boolean }> = [
  { name: 'New Year', date: '2026-01-01', recurring: true },
  { name: 'Birthday', date: '2026-02-14', recurring: true },
  { name: "Victoria's Birthday", date: '2026-03-20', recurring: true },
  { name: 'Anniversary', date: '2026-05-15', recurring: true },
  { name: 'Christmas Eve', date: '2026-12-24', recurring: true },
  { name: 'New Year Eve', date: '2026-12-31', recurring: true },
]

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DevSeedContent() {
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

  const seedTrips = useCallback(async () => {
    log('--- Seeding Trips ---')
    tripIdsRef.current.clear()

    for (let i = 0; i < TRIPS.length; i++) {
      const tripDef = { ...TRIPS[i] }

      if (i === 16 || i === 17) {
        const parentId = tripIdsRef.current.get(15)
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

  const seedItineraries = useCallback(async () => {
    log('--- Seeding Itineraries ---')

    for (const [tripIdxStr, activities] of Object.entries(ACTIVITIES)) {
      const tripIdx = Number(tripIdxStr)
      const tripId = tripIdsRef.current.get(tripIdx)
      if (!tripId) {
        log(`  Skipping trip index ${tripIdx}: no trip ID (seed trips first)`)
        continue
      }

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

  const seedCalendar = useCallback(async () => {
    log('--- Seeding Calendar ---')

    const countries = ['US', 'UK']
    for (const code of countries) {
      try {
        await calendarApi.enableCountry({ country_code: code, year: 2026 })
        log(`  Enabled ${code} holidays for 2026`)
      } catch {
        log(`  ${code} holidays already enabled for 2026`)
      }
    }

    for (const day of CUSTOM_DAYS) {
      await calendarApi.createCustomDay(day)
      log(`  Custom day: ${day.name} (${day.date}${day.recurring ? ', recurring' : ''})`)
    }

    log(`Done: calendar seeded (${countries.join(' + ')} holidays + ${CUSTOM_DAYS.length} custom days)`)
  }, [log])

  const clearAllData = useCallback(async () => {
    setRunning(true)
    setLogs([])
    try {
      log('--- Clearing All Data ---')

      const tripsRes = await api.get<TripSummary[]>('/trips')
      const trips = tripsRes.data
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
    <>
      <h1 className="text-xl font-semibold text-cloud-900 mb-1">Test Data Generator</h1>
      <p className="text-sm text-cloud-500 mb-6">
        Seeds 20 real 2026 trips: races, remote work weeks, Unbound 200, World Cup,
        Tor Sabbatical (Berlin + Sardinia sub-trips), and Hong Kong/Taiwan. Includes{' '}
        {Object.values(ACTIVITIES).flat().length} activities,{' '}
        {Object.values(CHECKLISTS).flat().reduce((sum, cl) => sum + cl.items.length, 0)} checklist
        items, and calendar data.
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
            <div
              key={i}
              className={
                line.startsWith('ERROR')
                  ? 'text-red-600 font-semibold'
                  : line.startsWith('Done') || line.startsWith('===')
                    ? 'text-emerald-600 font-semibold'
                    : ''
              }
            >
              {line}
            </div>
          ))
        )}
      </div>
    </>
  )
}
