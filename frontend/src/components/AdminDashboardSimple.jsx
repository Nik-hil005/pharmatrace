import { useState, useEffect } from 'react'
import { Users, Building, Package, Clock, Bell, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalManufacturers: 0,
    totalVendors: 0,
    pendingRequests: 0
  })
  const [pendingRequests, setPendingRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationIdCounter, setNotificationIdCounter] = useState(1)

  useEffect(() => {
    // Initialize with empty data - no fake database
    setStats({
      totalUsers: 0,
      totalManufacturers: 0,
      totalVendors: 0,
      pendingRequests: 0
    })
    setPendingRequests([])
    setNotifications([])
  }, [])

  const handleApproveRequest = (requestId) => {
    const request = pendingRequests.find(req => req.id === requestId)
    if (request) {
      // Remove from pending
      setPendingRequests(prev => prev.filter(req => req.id !== requestId))
      
      // Update stats
      if (request.type === 'MANUFACTURER') {
        setStats(prev => ({
          ...prev,
          totalManufacturers: prev.totalManufacturers + 1,
          pendingRequests: prev.pendingRequests - 1,
          totalUsers: prev.totalUsers + 1
        }))
      } else if (request.type === 'VENDOR') {
        setStats(prev => ({
          ...prev,
          totalVendors: prev.totalVendors + 1,
          pendingRequests: prev.pendingRequests - 1,
          totalUsers: prev.totalUsers + 1
        }))
      }

      // Add notification
      setNotificationIdCounter(prev => {
        const newId = prev + 1
        const notification = {
          id: newId,
          type: 'success',
          message: `Approved ${request.type.toLowerCase()} registration for ${request.companyName}`,
          timestamp: new Date(),
          icon: CheckCircle
        }
        setNotifications(notificationsPrev => [notification, ...notificationsPrev].slice(0, 5))
        return newId
      })
    }
  }

  const handleRejectRequest = (requestId) => {
    const request = pendingRequests.find(req => req.id === requestId)
    if (request) {
      // Remove from pending
      setPendingRequests(prev => prev.filter(req => req.id !== requestId))
      
      // Update stats
      setStats(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests - 1
      }))

      // Add notification
      setNotificationIdCounter(prev => {
        const newId = prev + 1
        const notification = {
          id: newId,
          type: 'error',
          message: `Rejected ${request.type.toLowerCase()} registration for ${request.companyName}`,
          timestamp: new Date(),
          icon: XCircle
        }
        setNotifications(notificationsPrev => [notification, ...notificationsPrev].slice(0, 5))
        return newId
      })
    }
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  return (
    <div style={{ padding: '2rem', background: '#1a1a1a', minHeight: '100vh' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: '#2F8D46', fontSize: '2rem', marginBottom: '0.5rem' }}>
            Admin Dashboard
          </h1>
          <p style={{ color: '#ccc' }}>
            Manage manufacturer and vendor registrations
          </p>
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

      {/* Pending Requests Section */}
      <div style={{ 
        background: '#2a2a2a', 
        border: '1px solid #2F8D46', 
        borderRadius: '0.5rem', 
        padding: '2rem'
      }}>
        <h2 style={{ color: '#2F8D46', marginBottom: '1.5rem' }}>
          Pending Registration Requests
        </h2>
        
        {pendingRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <AlertTriangle style={{ color: '#ffc107', width: '3rem', height: '3rem', marginBottom: '1rem' }} />
            <p style={{ color: '#ccc', fontSize: '1.1rem' }}>
              No pending registration requests
            </p>
            <p style={{ color: '#999', marginTop: '0.5rem' }}>
              When manufacturers or vendors register, their requests will appear here for approval.
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
                      {request.companyName}
                    </h3>
                    <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                      <strong>Type:</strong> {request.type}
                    </p>
                    <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                      <strong>Email:</strong> {request.email}
                    </p>
                    <p style={{ color: '#ccc', margin: '0 0 0.25rem 0' }}>
                      <strong>License:</strong> {request.licenseNumber}
                    </p>
                    <p style={{ color: '#ccc', margin: '0' }}>
                      <strong>Submitted:</strong> {new Date(request.createdAt).toLocaleDateString()}
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
