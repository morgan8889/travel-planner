import { Component, useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import Map, { type MapRef } from 'react-map-gl'
import { MapPin } from 'lucide-react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

interface MapErrorBoundaryProps {
  className: string
  children: ReactNode
}

interface MapErrorBoundaryState {
  hasError: boolean
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={`flex flex-col items-center justify-center gap-2 bg-cloud-100 rounded-xl border border-cloud-200 text-cloud-500 text-sm ${this.props.className}`}
        >
          <MapPin className="w-6 h-6 text-cloud-400" />
          <span>Map could not be loaded</span>
        </div>
      )
    }
    return this.props.children
  }
}

interface MapViewProps {
  center?: [number, number] // [lng, lat]
  zoom?: number
  children?: ReactNode
  className?: string
  interactive?: boolean
  fitBounds?: [[number, number], [number, number]] // [[minLng, minLat], [maxLng, maxLat]]
}

export function MapView({
  center,
  zoom = 10,
  children,
  className = '',
  interactive = true,
  fitBounds,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [mapReady, setMapReady] = useState(false)

  const onLoad = useCallback(() => {
    setMapReady(true)
    if (fitBounds && mapRef.current) {
      mapRef.current.fitBounds(fitBounds, { padding: 40, maxZoom: 14 })
    }
  }, [fitBounds])

  // Re-fit when bounds change after initial load (e.g. activities load later)
  const boundsKey = fitBounds ? JSON.stringify(fitBounds) : null
  useEffect(() => {
    if (fitBounds && mapRef.current) {
      mapRef.current.fitBounds(fitBounds, { padding: 40, maxZoom: 14 })
    }
  }, [boundsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-cloud-100 rounded-xl border border-cloud-200 text-cloud-500 text-sm ${className}`}
      >
        <MapPin className="w-6 h-6 text-cloud-400" />
        <span>Map unavailable — configure VITE_MAPBOX_TOKEN</span>
      </div>
    )
  }

  const initialViewState = center
    ? { longitude: center[0], latitude: center[1], zoom }
    : { longitude: 0, latitude: 20, zoom: 1.5 }

  return (
    <MapErrorBoundary className={className}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        scrollZoom={interactive}
        dragPan={interactive}
        doubleClickZoom={interactive}
        touchZoomRotate={interactive}
        onLoad={onLoad}
      >
        {mapReady && children}
      </Map>
    </MapErrorBoundary>
  )
}
