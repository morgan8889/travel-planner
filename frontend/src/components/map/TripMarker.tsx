import { useState } from 'react'
import { Marker } from 'react-map-gl'
import type { TripStatus } from '../../lib/types'

const STATUS_COLORS: Record<TripStatus, string> = {
  dreaming: '#6B5CB5',
  planning: '#B8862D',
  booked: '#4A6DB5',
  active: '#3D8A5E',
  completed: '#7A7F91',
}

interface TripMarkerProps {
  tripId: string
  longitude: number
  latitude: number
  destination: string
  status: TripStatus
  onClick?: (tripId: string) => void
}

export function TripMarker({
  tripId,
  longitude,
  latitude,
  destination,
  status,
  onClick,
}: TripMarkerProps) {
  const [hovered, setHovered] = useState(false)
  const color = STATUS_COLORS[status]

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="bottom">
      <div
        className="relative cursor-pointer"
        onClick={() => onClick?.(tripId)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
          <path
            d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z"
            fill={color}
          />
          <circle cx="12" cy="12" r="5" fill="white" />
        </svg>
        {hovered && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-cloud-900 text-white text-xs px-2 py-1 rounded-md shadow-lg pointer-events-none">
            {destination}
          </div>
        )}
      </div>
    </Marker>
  )
}
