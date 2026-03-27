import { useState, useEffect } from 'react'
import { Search, Filter, Calendar, User, Package, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

function ScanLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')

  const fetchScanLogs = async () => {
    try {
      // Mock data for scan logs
      const mockLogs = [
        {
          id: 1,
          timestamp: '2024-01-15T10:30:00Z',
          user: 'john.doe@email.com',
          userRole: 'vendor',
          token: 'TOKEN-ABC123-XYZ789',
          medicineName: 'Paracetamol 500mg',
          batchNumber: 'BATCH-001',
          manufacturer: 'MediCorp',
          status: 'VERIFIED',
          location: 'Mumbai, India',
          device: 'Mobile App'
        },
        {
          id: 2,
          timestamp: '2024-01-15T11:45:00Z',
          user: 'jane.smith@email.com',
          userRole: 'manufacturer',
          token: 'TOKEN-DEF456-ABC123',
          medicineName: 'Vitamin C 500mg',
          batchNumber: 'BATCH-004',
          manufacturer: 'CureWell',
          status: 'VERIFIED',
          location: 'Delhi, India',
          device: 'Web Scanner'
        },
        {
          id: 3,
          timestamp: '2024-01-15T12:20:00Z',
          user: 'unknown@temp.com',
          userRole: 'public',
          token: 'TOKEN-INVALID-XYZ',
          medicineName: null,
          batchNumber: null,
          manufacturer: null,
          status: 'FAKE',
          location: 'Bangalore, India',
          device: 'Mobile App'
        },
        {
          id: 4,
          timestamp: '2024-01-15T13:15:00Z',
          user: 'admin@pharmatrace.com',
          userRole: 'admin',
          token: 'TOKEN-GHI789-DEF456',
          medicineName: 'Aspirin 100mg',
          batchNumber: 'BATCH-007',
          manufacturer: 'GlobalHealth',
          status: 'VERIFIED',
          location: 'Chennai, India',
          device: 'Web Scanner'
        },
        {
          id: 5,
          timestamp: '2024-01-15T14:30:00Z',
          user: 'vendor@pharma.com',
          userRole: 'vendor',
          token: 'TOKEN-SUSPICIOUS-123',
          medicineName: 'Ibuprofen 200mg',
          batchNumber: 'BATCH-010',
          manufacturer: 'Unknown',
          status: 'SUSPICIOUS',
          location: 'Kolkata, India',
          device: 'Mobile App'
        }
      ]
      
      setLogs(mockLogs)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching scan logs:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScanLogs()
  }, [])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="status-icon verified" />
      case 'FAKE':
        return <XCircle className="status-icon fake" />
      case 'SUSPICIOUS':
        return <AlertTriangle className="status-icon suspicious" />
      default:
        return <AlertTriangle className="status-icon" />
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.medicineName && log.medicineName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filter === 'all' || log.status === filter
    
    return matchesSearch && matchesFilter
  })

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div className="scan-logs">
        <div className="loading">Loading scan logs...</div>
      </div>
    )
  }

  return (
    <div className="scan-logs">
      <div className="logs-header">
        <h2>Scan Logs</h2>
        <div className="logs-controls">
          <div className="search-box">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search by token, medicine, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-dropdown">
            <Filter className="filter-icon" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="FAKE">Fake</option>
              <option value="SUSPICIOUS">Suspicious</option>
            </select>
          </div>
        </div>
      </div>

      <div className="logs-stats">
        <div className="stat-card">
          <CheckCircle className="stat-icon" />
          <div className="stat-value">
            {logs.filter(log => log.status === 'VERIFIED').length}
          </div>
          <div className="stat-label">Verified</div>
        </div>
        <div className="stat-card">
          <XCircle className="stat-icon" />
          <div className="stat-value">
            {logs.filter(log => log.status === 'FAKE').length}
          </div>
          <div className="stat-label">Fake</div>
        </div>
        <div className="stat-card">
          <AlertTriangle className="stat-icon" />
          <div className="stat-value">
            {logs.filter(log => log.status === 'SUSPICIOUS').length}
          </div>
          <div className="stat-label">Suspicious</div>
        </div>
        <div className="stat-card">
          <Package className="stat-icon" />
          <div className="stat-value">{logs.length}</div>
          <div className="stat-label">Total Scans</div>
        </div>
      </div>

      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Role</th>
              <th>Token</th>
              <th>Medicine</th>
              <th>Batch</th>
              <th>Manufacturer</th>
              <th>Status</th>
              <th>Location</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id}>
                <td>{formatDate(log.timestamp)}</td>
                <td>{log.user}</td>
                <td>
                  <span className={`role-badge ${log.userRole}`}>
                    {log.userRole}
                  </span>
                </td>
                <td>
                  <code className="token-code">{log.token}</code>
                </td>
                <td>{log.medicineName || 'N/A'}</td>
                <td>{log.batchNumber || 'N/A'}</td>
                <td>{log.manufacturer || 'N/A'}</td>
                <td>
                  <div className="status-cell">
                    {getStatusIcon(log.status)}
                    <span className={`status-text ${log.status.toLowerCase()}`}>
                      {log.status}
                    </span>
                  </div>
                </td>
                <td>{log.location}</td>
                <td>{log.device}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .scan-logs {
          padding: 2rem;
          background: var(--bg-secondary);
          border-radius: 1rem;
          border: 1px solid var(--border-green);
        }

        .logs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .logs-header h2 {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 600;
        }

        .logs-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .search-box {
          display: flex;
          align-items: center;
          background: var(--bg-primary);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
        }

        .search-icon {
          width: 1.2rem;
          height: 1.2rem;
          color: var(--text-secondary);
          margin-right: 0.5rem;
        }

        .search-box input {
          background: none;
          border: none;
          color: var(--text-primary);
          outline: none;
          width: 250px;
        }

        .filter-dropdown {
          display: flex;
          align-items: center;
          background: var(--bg-primary);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
        }

        .filter-icon {
          width: 1.2rem;
          height: 1.2rem;
          color: var(--text-secondary);
          margin-right: 0.5rem;
        }

        .filter-dropdown select {
          background: none;
          border: none;
          color: var(--text-primary);
          outline: none;
        }

        .logs-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat-icon {
          width: 2rem;
          height: 2rem;
        }

        .stat-icon.verified {
          color: var(--primary-green);
        }

        .stat-icon.fake {
          color: #dc3545;
        }

        .stat-icon.suspicious {
          color: #ffc107;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .logs-table-container {
          background: var(--bg-primary);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          overflow-x: auto;
        }

        .logs-table {
          width: 100%;
          border-collapse: collapse;
        }

        .logs-table th,
        .logs-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border-green);
        }

        .logs-table th {
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-weight: 600;
        }

        .logs-table td {
          color: var(--text-secondary);
        }

        .role-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .role-badge.admin {
          background: rgba(220, 53, 69, 0.1);
          color: #dc3545;
        }

        .role-badge.vendor {
          background: rgba(47, 141, 70, 0.1);
          color: var(--primary-green);
        }

        .role-badge.manufacturer {
          background: rgba(0, 123, 255, 0.1);
          color: #007bff;
        }

        .role-badge.public {
          background: rgba(108, 117, 125, 0.1);
          color: #6c757d;
        }

        .token-code {
          background: var(--bg-secondary);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875rem;
        }

        .status-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-icon {
          width: 1rem;
          height: 1rem;
        }

        .status-icon.verified {
          color: var(--primary-green);
        }

        .status-icon.fake {
          color: #dc3545;
        }

        .status-icon.suspicious {
          color: #ffc107;
        }

        .status-text {
          font-weight: 500;
        }

        .status-text.verified {
          color: var(--primary-green);
        }

        .status-text.fake {
          color: #dc3545;
        }

        .status-text.suspicious {
          color: #ffc107;
        }

        @media (max-width: 768px) {
          .scan-logs {
            padding: 1rem;
          }

          .logs-header {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .logs-controls {
            flex-direction: column;
          }

          .search-box input {
            width: 100%;
          }

          .logs-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

export default ScanLogs
