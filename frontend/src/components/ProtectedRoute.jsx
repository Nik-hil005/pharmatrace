import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    navigate('/login')
    return null
  }

  // Check if user has required role
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="unauthorized-container">
        <div className="unauthorized-card">
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
          <p>Required role: <strong>{requiredRole}</strong></p>
          <p>Your role: <strong>{user.role}</strong></p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
