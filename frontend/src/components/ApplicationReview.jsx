import { useState, useEffect } from 'react'
import { Building, User, Mail, Phone, FileText, Calendar, CheckCircle, XCircle, Clock, TrendingUp, Users, MapPin } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiJson, authHeadersJson } from '../utils/api'

function ApplicationReview() {
  const { user, token } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    total_applications: 0,
    pending_applications: 0,
    approved_applications: 0,
    rejected_applications: 0
  })

  const fetchApplications = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await apiJson('/api/applications/pending', {
        headers: authHeadersJson(token)
      })

      if (data.success && Array.isArray(data.applications)) {
        setApplications(data.applications)
      } else {
        const msg = data?.error || 'Unexpected response from /api/applications/pending'
        console.error('fetchApplications:', msg, data)
        setError(msg)
        setApplications([])
      }
    } catch (err) {
      console.error('Error fetching applications:', err.status, err.message, err.body)
      setError(err.message || 'Network error. Please try again.')
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const data = await apiJson('/api/applications/stats', {
        headers: authHeadersJson(token)
      })

      if (data.success && data.stats) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Error fetching stats:', err.status, err.message, err.body)
    }
  }

  useEffect(() => {
    fetchApplications()
    fetchStats()
  }, [])

  const handleAccept = async (applicationId) => {
    if (!window.confirm('Are you sure you want to approve this application?')) {
      return
    }

    if (user?.id == null) {
      alert('Missing admin user id. Log in again with a valid admin account.')
      return
    }

    try {
      const result = await apiJson(`/api/applications/${applicationId}/accept`, {
        method: 'POST',
        headers: authHeadersJson(token),
        body: JSON.stringify({ adminId: user.id })
      })

      if (result.success) {
        alert(
          result.message ||
            'Application approved. The applicant can log in with the email and password they used when applying.'
        )
        fetchApplications()
        fetchStats()
      } else {
        alert(result.error || 'Failed to approve application')
      }
    } catch (err) {
      console.error('Error approving application:', err.status, err.message, err.body)
      alert(err.message || 'Request failed. Please try again.')
    }
  }

  const handleReject = async (applicationId) => {
    const reason = prompt('Please provide rejection reason:')
    if (reason == null || !String(reason).trim()) {
      return
    }

    if (user?.id == null) {
      alert('Missing admin user id. Log in again with a valid admin account.')
      return
    }

    try {
      const result = await apiJson(`/api/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: authHeadersJson(token),
        body: JSON.stringify({
          adminId: user.id,
          rejectionReason: String(reason).trim()
        })
      })

      if (result.success) {
        alert('Application rejected successfully')
        fetchApplications()
        fetchStats()
      } else {
        alert(result.error || 'Failed to reject application')
      }
    } catch (err) {
      console.error('Error rejecting application:', err.status, err.message, err.body)
      alert(err.message || 'Request failed. Please try again.')
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="status-badge pending"><Clock className="status-icon" /> Pending</span>
      case 'approved':
        return <span className="status-badge approved"><CheckCircle className="status-icon" /> Approved</span>
      case 'rejected':
        return <span className="status-badge rejected"><XCircle className="status-icon" /> Rejected</span>
      default:
        return <span className="status-badge">{status}</span>
    }
  }

  return (
    <div className="application-review">
      <div className="review-header">
        <h1>Application Review</h1>
        <p>Review and manage vendor/manufacturer registration applications</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-value">{stats.total_applications}</div>
          <div className="stat-label">Total Applications</div>
        </div>
        <div className="stat-card">
          <Clock className="stat-icon" />
          <div className="stat-value">{stats.pending_applications}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-card">
          <CheckCircle className="stat-icon" />
          <div className="stat-value">{stats.approved_applications}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <XCircle className="stat-icon" />
          <div className="stat-value">{stats.rejected_applications}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Applications List */}
      <div className="applications-section">
        <h2>Pending Applications</h2>
        
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading applications...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <XCircle className="error-icon" />
            <p>{error}</p>
            <button onClick={fetchApplications} className="btn btn-primary">
              Retry
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-icon" />
            <h3>No Pending Applications</h3>
            <p>All applications have been reviewed.</p>
          </div>
        ) : (
          <div className="applications-grid">
            {applications.map((app) => (
              <div key={app.id} className="application-card">
                <div className="card-header">
                  <div className="applicant-info">
                    <h3>{app.full_name}</h3>
                    <span className={`role-badge ${app.role}`}>{app.role}</span>
                  </div>
                  <div className="submission-date">
                    <Calendar className="date-icon" />
                    {new Date(app.submitted_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="card-content">
                  <div className="info-grid">
                    <div className="info-item">
                      <Mail className="info-icon" />
                      <span>{app.email}</span>
                    </div>
                    <div className="info-item">
                      <Phone className="info-icon" />
                      <span>{app.phone || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <Building className="info-icon" />
                      <span>{app.company_name}</span>
                    </div>
                    {app.role === 'vendor' && (
                      <div className="info-item">
                        <MapPin className="info-icon" />
                        <span>
                          <strong>City:</strong>{' '}
                          {app.city && String(app.city).trim() ? app.city : '—'}
                        </span>
                      </div>
                    )}
                    <div className="info-item">
                      <FileText className="info-icon" />
                      <span>{app.license_number}</span>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    onClick={() => handleAccept(app.id)}
                    className="btn btn-success"
                  >
                    <CheckCircle className="btn-icon" />
                    Accept
                  </button>
                  <button 
                    onClick={() => handleReject(app.id)}
                    className="btn btn-danger"
                  >
                    <XCircle className="btn-icon" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .application-review {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .review-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .review-header h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }

        .review-header p {
          color: #6b7280;
          font-size: 1rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          color: #3b82f6;
          margin-bottom: 1rem;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .applications-section {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .applications-section h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: #1a1a1a;
        }

        .loading-state,
        .error-state,
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #6b7280;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-icon,
        .empty-icon {
          width: 64px;
          height: 64px;
          margin-bottom: 1rem;
          color: #d1d5db;
        }

        .applications-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
        }

        .application-card {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .card-header {
          background: #f9fafb;
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .applicant-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .applicant-info h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0;
        }

        .role-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-badge.vendor {
          background: #dbeafe;
          color: #1e40af;
        }

        .role-badge.manufacturer {
          background: #dcfce7;
          color: #166534;
        }

        .submission-date {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .date-icon {
          width: 16px;
          height: 16px;
        }

        .card-content {
          padding: 1.5rem;
        }

        .info-grid {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 8px;
        }

        .info-icon {
          width: 20px;
          height: 20px;
          color: #6b7280;
        }

        .card-actions {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-success {
          background: #10b981;
          color: white;
        }

        .btn-success:hover {
          background: #059669;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover {
          background: #dc2626;
        }

        .btn-icon {
          width: 16px;
          height: 16px;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.approved {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.rejected {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-icon {
          width: 14px;
          height: 14px;
        }

        @media (max-width: 768px) {
          .application-review {
            padding: 1rem;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .applications-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

export default ApplicationReview
