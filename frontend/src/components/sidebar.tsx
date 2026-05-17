'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, ImageIcon, BarChart2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/compare', icon: ImageIcon, label: 'Compare' },
  { href: '/label', icon: Tag, label: 'Label' },
  { href: '/metrics', icon: BarChart2, label: 'Metrics' },
  { href: '/cameras', icon: Camera, label: 'Cameras' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-52 border-r bg-white flex flex-col shrink-0">
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm tracking-tight">CamWatch</span>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
