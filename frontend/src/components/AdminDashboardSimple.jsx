import { useState, useEffect } from 'react'
import { Users, Building, Package, Clock, Bell, CheckCircle, XCircle, AlertTriangle, RefreshCw, Activity, ShieldAlert } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiJson, authHeadersJson } from '../utils/api'

function AdminDashboard() {
  const { token, user } = useAuth()
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalManufacturers: 0,
    totalVendors: 0,
    pendingRequests: 0
  })
  /** Pending rows from `applications` (vendor/manufacturer apply forms), not `registration_requests`. */
  const [pendingRequests, setPendingRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(true)

  const [scanRefreshing, setScanRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])


  const fetchDashboardData = async () => {
    setLoadError('')
    setDashboardLoading(true)
    let manufacturers = []
    let vendors = []
    let pendingApps = []
    let pendingCount = 0

    try {
      const appsPayload = await apiJson('/api/applications/pending', {
        headers: authHeadersJson(token)
      })
      if (!appsPayload.success || !Array.isArray(appsPayload.applications)) {
        const msg = appsPayload?.error || 'Invalid response shape from /api/applications/pending'
        console.error('Admin pending applications:', msg, appsPayload)
        setLoadError(msg)
      } else {
        pendingApps = appsPayload.applications
        pendingCount = pendingApps.length
      }
    } catch (error) {
      console.error('Error loading pending applications:', error)
      setLoadError(error.message || 'Failed to load pending applications')
    }

    try {
      const statsPayload = await apiJson('/api/applications/stats', {
        headers: authHeadersJson(token)
      })
      if (statsPayload.success && statsPayload.stats) {
        pendingCount = Number(statsPayload.stats.pending_applications) || pendingCount
      }
    } catch (error) {
      console.warn('Application stats unavailable:', error.message)
    }

    try {
      const manufacturersData = await apiJson('/api/manufacturers')
      manufacturers = manufacturersData.manufacturers || manufacturersData || []
      if (!Array.isArray(manufacturers)) manufacturers = []
    } catch (error) {
      console.warn('Manufacturers list unavailable:', error.message)
    }

    try {
      const vendorsData = await apiJson('/api/vendors')
      vendors = vendorsData.vendors || vendorsData || []
      if (!Array.isArray(vendors)) vendors = []
    } catch (error) {
      console.warn('Vendors list unavailable:', error.message)
    }

    setPendingRequests(pendingApps)
    setStats({
      totalUsers: manufacturers.length + vendors.length,
      totalManufacturers: manufacturers.length,
      totalVendors: vendors.length,
      pendingRequests: pendingCount
    })
    setDashboardLoading(false)
  }

  const handleRefreshAll = async () => {
    setScanRefreshing(true)
    try {
      await fetchDashboardData()
    } finally {
      setScanRefreshing(false)
    }
  }

  const handleApproveRequest = async (requestId) => {
    const request = pendingRequests.find((req) => req.id === requestId)
    if (!request) return

    const adminId = user?.id
    if (adminId == null) {
      const msg = 'Your session has no user id. Log in with a real admin account to approve applications.'
      addNotification('error', msg)
      console.error(msg)
      return
    }

    try {
      await apiJson(`/api/applications/${requestId}/accept`, {
        method: 'POST',
        headers: authHeadersJson(token),
        body: JSON.stringify({ adminId })
      })

      await fetchDashboardData()
      addNotification(
        'success',
        `Approved ${(request.role || 'account').toLowerCase()} application for ${request.company_name}`
      )
    } catch (error) {
      addNotification('error', error.message || 'Failed to approve application')
    }
  }

  const handleRejectRequest = async (requestId) => {
    const request = pendingRequests.find((req) => req.id === requestId)
    if (!request) return

    const adminId = user?.id
    if (adminId == null) {
      const msg = 'Your session has no user id. Log in with a real admin account to reject applications.'
      addNotification('error', msg)
      console.error(msg)
      return
    }

    const reason = window.prompt('Rejection reason (required):', 'Does not meet registration criteria')
    if (reason == null || !String(reason).trim()) {
      return
    }

    try {
      await apiJson(`/api/applications/${requestId}/reject`, {
        method: 'POST',
        headers: authHeadersJson(token),
        body: JSON.stringify({ adminId, rejectionReason: String(reason).trim() })
      })

      await fetchDashboardData()
      addNotification(
        'success',
        `Rejected ${(request.role || 'account').toLowerCase()} application for ${request.company_name}`
      )
    } catch (error) {
      addNotification('error', error.message || 'Failed to reject application')
    }
  }

  const addNotification = (type, message) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date(),
      icon: type === 'success' ? CheckCircle : XCircle
    }
    setNotifications(notificationsPrev => [notification, ...notificationsPrev].slice(0, 5))
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  return (
    <div style={{ padding: '2rem', background: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: '#2F8D46', fontSize: '2rem', marginBottom: '0.5rem' }}>
              Admin Dashboard
            </h1>
            <p style={{ color: '#ccc', margin: 0 }}>
              Manage manufacturer and vendor registrations
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={scanRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#2a2a2a',
              border: '1px solid #2F8D46',
              color: '#2F8D46',
              borderRadius: '0.5rem',
              padding: '0.6rem 1rem',
              cursor: scanRefreshing ? 'wait' : 'pointer',
              fontWeight: 600,
              opacity: scanRefreshing ? 0.7 : 1
            }}
          >
            <RefreshCw style={{ width: '1.1rem', height: '1.1rem' }} />
            Refresh
          </button>
        </div>
        
        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            style={{ 
              background: '#2a2a2a', 
              border: '1px solid #2F8D46', 
              borderRadius: '0.5rem', 
              padding: '0.75rem',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <Bell style={{ color: '#2F8D46', width: '1.5rem', height: '1.5rem' }} />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#dc3545',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {notifications.length}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              background: '#2a2a2a',
              border: '1px solid #2F8D46',
              borderRadius: '0.5rem',
              padding: '1rem',
              minWidth: '300px',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 1000,
              marginTop: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ color: '#2F8D46', margin: 0 }}>Notifications</h3>
                <button 
                  onClick={clearNotifications}
                  style={{ 
                    background: 'none', 
                    border: '1px solid #2F8D46', 
                    color: '#2F8D46', 
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Clear All
                </button>
              </div>
              
              {notifications.length === 0 ? (
                <p style={{ color: '#ccc', textAlign: 'center', margin: '1rem 0' }}>
                  No notifications
                </p>
              ) : (
                notifications.map(notification => {
                  const Icon = notification.icon
                  return (
                    <div 
                      key={notification.id}
                      style={{
                        background: notification.type === 'success' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                        border: `1px solid ${notification.type === 'success' ? '#28a745' : '#dc3545'}`,
                        borderRadius: '0.25rem',
                        padding: '0.75rem',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon style={{ 
                          color: notification.type === 'success' ? '#28a745' : '#dc3545',
                          width: '1rem',
                          height: '1rem'
                        }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ color: '#fff', margin: '0 0 0.25rem 0', fontSize: '0.875rem' }}>
                            {notification.message}
                          </p>
                          <p style={{ color: '#ccc', margin: 0, fontSize: '0.75rem' }}>
                            {notification.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{ 
          background: '#2a2a2a', 
          border: '1px solid #2F8D46', 
          borderRadius: '0.5rem', 
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <Users style={{ color: '#2F8D46', width: '2rem', height: '2rem', marginBottom: '0.5rem' }} />
          <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
            {stats.totalUsers}
          </div>
          <div style={{ color: '#ccc' }}>Total Users</div>
        </div>
        
        <div style={{ 
          background: '#2a2a2a', 
          border: '1px solid #2F8D46', 
          borderRadius: '0.5rem', 
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <Building style={{ color: '#2F8D46', width: '2rem', height: '2rem', marginBottom: '0.5rem' }} />
          <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
            {stats.totalManufacturers}
          </div>
          <div style={{ color: '#ccc' }}>Manufacturers</div>
        </div>
        
        <div style={{ 
          background: '#2a2a2a', 
          border: '1px solid #2F8D46', 
          borderRadius: '0.5rem', 
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <Package style={{ color: '#2F8D46', width: '2rem', height: '2rem', marginBottom: '0.5rem' }} />
          <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
            {stats.totalVendors}
          </div>
          <div style={{ color: '#ccc' }}>Vendors</div>
        </div>
        
        <div style={{ 
          background: '#2a2a2a', 
          border: '1px solid #2F8D46', 
          borderRadius: '0.5rem', 
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <Clock style={{ color: '#2F8D46', width: '2rem', height: '2rem', marginBottom: '0.5rem' }} />
          <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
            {stats.pendingRequests}
          </div>
          <div style={{ color: '#ccc' }}>Pending Requests</div>
        </div>
      </div>


      {loadError && (
        <div
          style={{
            background: 'rgba(220, 53, 69, 0.15)',
            border: '1px solid #dc3545',
            borderRadius: '0.5rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#ffb4b4'
          }}
        >
          <strong>Could not load applications:</strong> {loadError}
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ccc' }}>
            Check the browser console for HTTP status and response. Ensure the API is reachable
            (Vite proxy to backend or set <code style={{ color: '#2F8D46' }}>VITE_API_URL</code>).
          </div>
        </div>
      )}

      {/* Pending applications from `applications` table (/api/applications/submit) */}
      <div style={{ 
        background: '#2a2a2a', 
        border: '1px solid #2F8D46', 
        borderRadius: '0.5rem', 
        padding: '2rem'
      }}>
        <h2 style={{ color: '#2F8D46', marginBottom: '1.5rem' }}>
          Pending registration applications
        </h2>

        {dashboardLoading ? (
          <p style={{ color: '#ccc', textAlign: 'center', padding: '2rem' }}>Loading applications…</p>
        ) : pendingRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <AlertTriangle style={{ color: '#ffc107', width: '3rem', height: '3rem', marginBottom: '1rem' }} />
            <p style={{ color: '#ccc', fontSize: '1.1rem' }}>
              No pending applications
            </p>
            <p style={{ color: '#999', marginTop: '0.5rem' }}>
              Submissions from <strong>/apply/vendor</strong> and <strong>/apply/manufacturer</strong> appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingRequests.map(request => (
              <div 
                key={request.id}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '0.5rem',
                  padding: '1.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>
                      {request.company_name}
                    </h3>
                    <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                      <strong>Applicant:</strong> {request.full_name}
                    </p>
                    <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                      <strong>Role:</strong>{' '}
                      {request.role ? String(request.role).charAt(0).toUpperCase() + String(request.role).slice(1) : '—'}
                    </p>
                    <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                      <strong>Email:</strong> {request.email}
                    </p>
                    {request.city ? (
                      <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                        <strong>City:</strong> {request.city}
                      </p>
                    ) : null}
                    <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                      <strong>License:</strong> {request.license_number}
                    </p>
                    <p style={{ color: '#ccc', margin: '0' }}>
                      <strong>Submitted:</strong>{' '}
                      {request.submitted_at
                        ? new Date(request.submitted_at).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleApproveRequest(request.id)}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <CheckCircle style={{ width: '1rem', height: '1rem' }} />
                      Approve
                    </button>
                    <button 
                      onClick={() => handleRejectRequest(request.id)}
                      style={{
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <XCircle style={{ width: '1rem', height: '1rem' }} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Welcome Message */}
      <div style={{ 
        background: '#2a2a2a', 
        border: '1px solid #2F8D46', 
        borderRadius: '0.5rem', 
        padding: '2rem',
        textAlign: 'center',
        marginTop: '2rem'
      }}>
        <h2 style={{ color: '#2F8D46', marginBottom: '1rem' }}>
          PharmaTrace Admin Portal
        </h2>
        <p style={{ color: '#ccc', lineHeight: '1.6' }}>
          Welcome to the admin dashboard. Here you can manage manufacturer and vendor registrations,
          approve requests, and monitor the pharmaceutical supply chain.
        </p>
        <div style={{ marginTop: '1.5rem', color: '#2F8D46' }}>
          <strong>Features:</strong> Registration Management • User Analytics • Real-time Notifications • System Monitoring
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
