import { Navigate, useLocation } from 'react-router-dom'
import { tieneAcceso } from '../../lib/roles.js'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const raw = localStorage.getItem('admin_session')
  if (!raw) return <Navigate to="/login" replace />

  const session = JSON.parse(raw)
  if (!tieneAcceso(session.role, location.pathname)) {
    return <Navigate to="/admin" replace />
  }
  return children
}
