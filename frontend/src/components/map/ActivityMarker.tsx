import { Marker } from 'react-map-gl'
import type { ActivityCategory } from '../../lib/types'

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  activity: '#4338CA',
  transport: '#3730A3',
  food: '#B8862D',
  lodging: '#3D8A5E',
}

interface ActivityMarkerProps {
  activityId: string
  longitude: number
  latitude: number
  sortOrder: number
  category: ActivityCategory
  title: string
  onClick?: (activityId: string) => void
}

export function ActivityMarker({
  activityId,
  longitude,
  latitude,
  sortOrder,
  category,
  title,
  onClick,
}: ActivityMarkerProps) {
  const color = CATEGORY_COLORS[category]

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer shadow-md hover:scale-110 transition-transform"
        style={{ backgroundColor: color }}
        onClick={() => onClick?.(activityId)}
        title={title}
      >
        {sortOrder + 1}
      </div>
    </Marker>
  )
}
