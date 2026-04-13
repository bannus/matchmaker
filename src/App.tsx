import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { ProfileSetup } from './pages/ProfileSetupPage'
import { DashboardPage } from './pages/DashboardPage'
import { AuthCallback } from './components/auth/AuthCallback'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { CourtsPage } from './pages/CourtsPage'
import { AvailabilityPage } from './pages/AvailabilityPage'
import { MatchesPage } from './pages/MatchesPage'
import { ProfilePage } from './pages/ProfilePage'
import { NotificationsPage } from './pages/NotificationsPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminCourtsPage } from './pages/AdminCourtsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile/setup" element={<ProfileSetup />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/courts" element={<CourtsPage />} />
            <Route path="/availability" element={<AvailabilityPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/courts" element={<AdminCourtsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
