import { Plane, Utensils, MapPin, Hotel, type LucideIcon } from 'lucide-react'
import type { ActivityCategory } from './types'

export const CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = {
  transport: Plane,
  food: Utensils,
  activity: MapPin,
  lodging: Hotel,
}
