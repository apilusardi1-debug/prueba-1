import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const session = localStorage.getItem('admin_session')
  if (!session) return <Navigate to="/login" replace />
  return children
}
