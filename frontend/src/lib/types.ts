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
  parent_trip_id?: string | null
}

export interface TripUpdate {
  type?: TripType
  destination?: string
  start_date?: string
  end_date?: string
  status?: TripStatus
  notes?: string | null
  parent_trip_id?: string | null
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
  notes?: string | null
  confirmation_number?: string | null
}

export interface UpdateActivity {
  title?: string
  category?: ActivityCategory
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  notes?: string | null
  confirmation_number?: string | null
  sort_order?: number
}
