interface SidebarHolidayDetailProps {
  name: string
  date: string
  countryCode: string
}

export function SidebarHolidayDetail({ name, date, countryCode }: SidebarHolidayDetailProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-cloud-900">{name}</h3>
      <p className="text-sm text-cloud-500">{date}</p>
      <p className="text-sm text-cloud-600">
        Federal Holiday ({countryCode})
      </p>
    </div>
  )
}
