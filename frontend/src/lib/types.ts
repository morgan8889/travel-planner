export type TripType = 'vacation' | 'remote_week' | 'sabbatical'
export type TripStatus = 'dreaming' | 'planning' | 'booked' | 'active' | 'completed'
export type MemberRole = 'owner' | 'member'

export interface TripMember {
  id: string
  user_id: string
  role: MemberRole
  display_name: string
  email: string
}

export interface TripSummary {
  id: string
  type: TripType
  destination: string
  start_date: string
  end_date: string
  status: TripStatus
  notes: string | null
  destination_latitude: number | null
  destination_longitude: number | null
  parent_trip_id: string | null
  created_at: string
  member_count: number
}

export interface Trip extends Omit<TripSummary, 'member_count'> {
  members: TripMember[]
  children: TripSummary[]
}

export interface TripCreate {
  type: TripType
  destination: string
  start_date: string
  end_date: string
  status?: TripStatus
  notes?: string | null
  destination_latitude?: number | null
  destination_longitude?: number | null
  parent_trip_id?: string | null
}

export interface TripUpdate {
  type?: TripType
  destination?: string
  start_date?: string
  end_date?: string
  status?: TripStatus
  notes?: string | null
  destination_latitude?: number | null
  destination_longitude?: number | null
  parent_trip_id?: string | null
}

export interface GeocodeSuggestion {
  place_name: string
  latitude: number
  longitude: number
  place_type: string
  context: string | null
}

export type ActivityCategory = 'transport' | 'food' | 'activity' | 'lodging'

export interface ItineraryDay {
  id: string
  trip_id: string
  date: string
  notes: string | null
  activity_count: number
}

export interface Activity {
  id: string
  itinerary_day_id: string
  title: string
  category: ActivityCategory
  start_time: string | null
  end_time: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  confirmation_number: string | null
  sort_order: number
}

export interface CreateItineraryDay {
  date: string
  notes?: string | null
}

export interface CreateActivity {
  title: string
  category: ActivityCategory
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  confirmation_number?: string | null
}

export interface UpdateActivity {
  title?: string
  category?: ActivityCategory
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  confirmation_number?: string | null
  sort_order?: number
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  text: string
  sort_order: number
  checked: boolean
}

export interface Checklist {
  id: string
  trip_id: string
  title: string
  items: ChecklistItem[]
}

export interface CreateChecklist {
  title: string
}

export interface CreateChecklistItem {
  text: string
}

export type BlockType = 'pto' | 'holiday'

export interface AnnualPlan {
  id: string
  user_id: string
  year: number
  notes: string | null
  created_at: string
}

export interface CalendarBlock {
  id: string
  annual_plan_id: string
  type: BlockType
  start_date: string
  end_date: string
  destination: string | null
  notes: string | null
}

export interface TripSummaryForCalendar {
  id: string
  type: string
  destination: string
  start_date: string
  end_date: string
  status: string
}

export interface CalendarYearResponse {
  plan: AnnualPlan | null
  blocks: CalendarBlock[]
  trips: TripSummaryForCalendar[]
}

export interface CreateAnnualPlan {
  year: number
  notes?: string | null
}

export interface CreateCalendarBlock {
  annual_plan_id: string
  type: BlockType
  start_date: string
  end_date: string
  destination?: string | null
  notes?: string | null
}

export interface UpdateCalendarBlock {
  type?: BlockType
  start_date?: string
  end_date?: string
  destination?: string | null
  notes?: string | null
}
