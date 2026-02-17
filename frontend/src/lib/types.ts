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
