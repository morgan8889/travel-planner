import type { Activity } from '../../lib/types'
import { CATEGORY_ICONS } from '../../lib/activityConstants'

interface ActivityDragCardProps {
  activity: Activity
}

export function ActivityDragCard({ activity }: ActivityDragCardProps) {
  const CategoryIcon = CATEGORY_ICONS[activity.category]
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-indigo-300 rounded-lg shadow-lg opacity-90 cursor-grabbing">
      <div className="flex-shrink-0 text-cloud-400">
        <CategoryIcon className="w-5 h-5" />
      </div>
      <span className="font-medium text-cloud-900 truncate">{activity.title}</span>
    </div>
  )
}
