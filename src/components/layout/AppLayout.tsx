import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useNotificationCount } from '../../hooks/useNotificationCount'

const navItems = [
  { path: '/dashboard', label: 'Home', icon: '🏠' },
  { path: '/availability', label: 'Availability', icon: '📅' },
  { path: '/matches', label: 'Matches', icon: '🎾' },
  { path: '/courts', label: 'Courts', icon: '🏟️' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const { unreadCount } = useNotificationCount()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-bold text-lg text-gray-900">
            🎾 Matchmaker
          </Link>

          <div className="flex items-center gap-4">
            {/* Notification bell placeholder */}
            <Link
              to="/notifications"
              className="text-gray-500 hover:text-gray-700 relative"
              aria-label="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Profile menu */}
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                {profile?.display_name || 'Profile'}
              </Link>
              <button
                onClick={signOut}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden bg-white border-t border-gray-200 sticky bottom-0 z-10">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center py-2 px-3 text-xs ${
                  isActive
                    ? 'text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
