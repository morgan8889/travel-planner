import { useState } from 'react'
import { Marker } from 'react-map-gl'
import { Plane, Utensils, MapPin, Hotel } from 'lucide-react'
import type { ActivityCategory } from '../../lib/types'

const CATEGORY_CONFIG: Record<ActivityCategory, { color: string; Icon: typeof MapPin }> = {
  transport: { color: '#3B82F6', Icon: Plane },
  food: { color: '#F59E0B', Icon: Utensils },
  activity: { color: '#10B981', Icon: MapPin },
  lodging: { color: '#8B5CF6', Icon: Hotel },
}

interface ActivityMarkerProps {
  activityId: string
  longitude: number
  latitude: number
  title: string
  location: string | null
  category: ActivityCategory
  onClick?: (activityId: string) => void
}

export function ActivityMarker({
  activityId,
  longitude,
  latitude,
  title,
  location,
  category,
  onClick,
}: ActivityMarkerProps) {
  const [hovered, setHovered] = useState(false)
  const { color, Icon } = CATEGORY_CONFIG[category]

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center">
      <div
        className="relative cursor-pointer"
        onClick={() => onClick?.(activityId)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        {hovered && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-cloud-900 text-white text-xs px-2 py-1 rounded-md shadow-lg pointer-events-none">
            <p className="font-medium">{title}</p>
            {location && <p className="text-cloud-300">{location}</p>}
          </div>
        )}
      </div>
    </Marker>
  )
}
