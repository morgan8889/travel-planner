import { Popup } from 'react-map-gl'

interface MarkerPopupProps {
  longitude: number
  latitude: number
  title: string
  subtitle?: string
  onClose: () => void
}

export function MarkerPopup({
  longitude,
  latitude,
  title,
  subtitle,
  onClose,
}: MarkerPopupProps) {
  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      onClose={onClose}
      closeButton
      closeOnClick={false}
      className="z-50"
    >
      <div className="px-1 py-0.5 min-w-[120px]">
        <p className="font-medium text-cloud-800 text-sm">{title}</p>
        {subtitle && <p className="text-cloud-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
    </Popup>
  )
}
