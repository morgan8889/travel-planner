import type { TripMember } from '../../lib/types'
import { X } from 'lucide-react'

interface TripMembersListProps {
  members: TripMember[]
  isOwner: boolean
  onRemove?: (memberId: string) => void
  onUpdateRole?: (memberId: string, role: 'owner' | 'member') => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const avatarColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-pink-500',
]

export function TripMembersList({
  members,
  isOwner,
  onRemove,
  onUpdateRole,
}: TripMembersListProps) {
  return (
    <ul className="divide-y divide-stone-100">
      {members.map((member, index) => (
        <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div
            className={`w-9 h-9 rounded-full ${avatarColors[index % avatarColors.length]} flex items-center justify-center shrink-0`}
          >
            <span className="text-xs font-medium text-white">
              {getInitials(member.display_name || member.email)}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-stone-900 truncate">
              {member.display_name || member.email.split('@')[0]}
            </p>
            <p className="text-xs text-stone-500 truncate">{member.email}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {member.role === 'owner' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Owner
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isOwner && onUpdateRole) {
                    onUpdateRole(member.id, member.role === 'member' ? 'owner' : 'member')
                  }
                }}
                disabled={!isOwner}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  isOwner
                    ? 'bg-stone-100 text-stone-600 hover:bg-blue-50 hover:text-blue-700 hover:ring-1 hover:ring-blue-200 cursor-pointer transition-all duration-200'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                Member
              </button>
            )}

            {isOwner && member.role !== 'owner' && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(member.id)}
                className="p-1 text-stone-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                aria-label={`Remove ${member.display_name || member.email}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
