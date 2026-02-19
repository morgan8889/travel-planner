import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface PlanSidebarProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function PlanSidebar({ isOpen, onClose, children }: PlanSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/10 md:hidden"
          onClick={onClose}
        />
      )}
      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-[350px] max-w-[90vw] bg-white border-l border-cloud-200 shadow-xl z-40
          transform transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex items-center justify-end p-4">
          <button
            onClick={onClose}
            className="p-1.5 text-cloud-400 hover:text-cloud-600 hover:bg-cloud-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {children}
        </div>
      </div>
    </>
  )
}
