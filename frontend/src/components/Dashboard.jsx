import { useState, useEffect } from 'react'
import { Package, Users, Activity, AlertTriangle, TrendingUp, Calendar } from 'lucide-react'

function Dashboard() {
  const [stats, setStats] = useState({
    totalBatches: 0,
    verifiedScans: 0,
    suspiciousScans: 0,
    fakeScans: 0,
    activeManufacturers: 0,
    activeVendors: 0
  })

  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    // Simulate loading dashboard data
    const loadDashboardData = async () => {
      // Mock data for demonstration
      setStats({
        totalBatches: 156,
        verifiedScans: 2847,
        suspiciousScans: 23,
        fakeScans: 8,
        activeManufacturers: 12,
        activeVendors: 34
      })

      setRecentActivity([
        {
          id: 1,
          type: 'scan',
          status: 'VERIFIED',
          medicine: 'Paracetamol 500mg',
          time: '2 minutes ago',
          batch: 'BATCH-2024-001'
        },
        {
          id: 2,
          type: 'alert',
          status: 'SUSPICIOUS',
          medicine: 'Amoxicillin 250mg',
          time: '15 minutes ago',
          batch: 'BATCH-2024-002',
          reason: 'Multiple scans from different locations'
        },
        {
          id: 3,
          type: 'scan',
          status: 'FAKE',
          medicine: 'Ibuprofen 400mg',
          time: '1 hour ago',
          batch: 'UNKNOWN'
        },
        {
          id: 4,
          type: 'batch',
          status: 'CREATED',
          medicine: 'Vitamin C 1000mg',
          time: '2 hours ago',
          batch: 'BATCH-2024-045'
        }
      ])
    }

    loadDashboardData()
  }, [])

  const getActivityIcon = (type, status) => {
    if (type === 'scan') {
      switch (status) {
        case 'VERIFIED':
          return <Package className="activity-icon verified" />
        case 'SUSPICIOUS':
          return <AlertTriangle className="activity-icon suspicious" />
        case 'FAKE':
          return <AlertTriangle className="activity-icon fake" />
        default:
          return <Activity className="activity-icon" />
      }
    }
    return <Package className="activity-icon" />
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'VERIFIED':
        return 'var(--success)'
      case 'SUSPICIOUS':
        return 'var(--warning)'
      case 'FAKE':
        return 'var(--error)'
      default:
        return 'var(--text-secondary)'
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">PharmaTrace Dashboard</h1>
        <p>Real-time medicine authentication and supply chain monitoring</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <Package className="stat-icon" />
          <div className="stat-value">{stats.totalBatches}</div>
          <div className="stat-label">Total Batches</div>
        </div>

        <div className="stat-card">
          <Activity className="stat-icon" />
          <div className="stat-value">{stats.verifiedScans}</div>
          <div className="stat-label">Verified Scans</div>
        </div>

        <div className="stat-card">
          <AlertTriangle className="stat-icon" />
          <div className="stat-value">{stats.suspiciousScans}</div>
          <div className="stat-label">Suspicious Activity</div>
        </div>

        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-value">{stats.activeManufacturers}</div>
          <div className="stat-label">Active Manufacturers</div>
        </div>

        <div className="stat-card">
          <TrendingUp className="stat-icon" />
          <div className="stat-value">{stats.activeVendors}</div>
          <div className="stat-label">Active Vendors</div>
        </div>

        <div className="stat-card">
          <AlertTriangle className="stat-icon" style={{ color: 'var(--error)' }} />
          <div className="stat-value">{stats.fakeScans}</div>
          <div className="stat-label">Fake Detected</div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="activity-section">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon-container">
                  {getActivityIcon(activity.type, activity.status)}
                </div>
                <div className="activity-details">
                  <div className="activity-header">
                    <h4>{activity.medicine}</h4>
                    <span 
                      className="activity-status" 
                      style={{ color: getStatusColor(activity.status) }}
                    >
                      {activity.status}
                    </span>
                  </div>
                  <div className="activity-meta">
                    <span className="activity-batch">{activity.batch}</span>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                  {activity.reason && (
                    <div className="activity-reason">
                      <small>{activity.reason}</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="charts-section">
          <h2>Verification Trends</h2>
          <div className="chart-placeholder">
            <div className="chart-info">
              <TrendingUp className="chart-icon" />
              <h3>Scan Analytics</h3>
              <p>Chart showing verification trends over time would appear here</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-top: 2rem;
        }

        .activity-section, .charts-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          backdrop-filter: blur(10px);
        }

        .activity-section h2, .charts-section h2 {
          color: var(--text-primary);
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .activity-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: rgba(6, 78, 59, 0.3);
          border-radius: 0.5rem;
          transition: all 0.3s ease;
        }

        .activity-item:hover {
          background: rgba(6, 78, 59, 0.5);
        }

        .activity-icon-container {
          flex-shrink: 0;
        }

        .activity-icon {
          width: 2rem;
          height: 2rem;
        }

        .activity-icon.verified {
          color: var(--success);
        }

        .activity-icon.suspicious {
          color: var(--warning);
        }

        .activity-icon.fake {
          color: var(--error);
        }

        .activity-details {
          flex: 1;
        }

        .activity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .activity-header h4 {
          color: var(--text-primary);
          font-size: 1rem;
          font-weight: 600;
        }

        .activity-status {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .activity-meta {
          display: flex;
          gap: 1rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .activity-reason {
          margin-top: 0.5rem;
          color: var(--warning);
        }

        .chart-placeholder {
          height: 300px;
          background: rgba(6, 78, 59, 0.2);
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed var(--border-green);
        }

        .chart-info {
          text-align: center;
          color: var(--text-secondary);
        }

        .chart-icon {
          width: 3rem;
          height: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        @media (max-width: 1024px) {
          .dashboard-content {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .activity-section, .charts-section {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}

export default Dashboard
