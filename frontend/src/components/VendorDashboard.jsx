import { useState, useEffect } from 'react'
import { Package, QrCode, CheckCircle, Clock, TrendingUp, AlertTriangle, User } from 'lucide-react'

function VendorDashboard() {
  const [stats, setStats] = useState({
    assignedBatches: 0,
    totalUnits: 0,
    activatedUnits: 0,
    pendingActivation: 0
  })
  const [batches, setBatches] = useState([])
  const [showActivationModal, setShowActivationModal] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)

  const fetchVendorData = async () => {
    try {
      // Mock data for now
      setStats({
        assignedBatches: 5,
        totalUnits: 2000,
        activatedUnits: 850,
        pendingActivation: 1150
      })
      
      setBatches([
        { 
          id: 1, 
          batchNumber: 'BATCH-001', 
          medicineName: 'Paracetamol 500mg', 
          manufacturer: 'MediCorp',
          totalUnits: 400, 
          activatedUnits: 215,
          status: 'ACTIVATED',
          masterQR: 'MASTER-BATCH-001-XYZ123',
          assignedAt: '2024-01-15'
        },
        { 
          id: 2, 
          batchNumber: 'BATCH-004', 
          medicineName: 'Vitamin C 500mg', 
          manufacturer: 'CureWell',
          totalUnits: 300, 
          activatedUnits: 0,
          status: 'PENDING',
          masterQR: 'MASTER-BATCH-004-ABC456',
          assignedAt: '2024-01-20'
        },
        { 
          id: 3, 
          batchNumber: 'BATCH-007', 
          medicineName: 'Aspirin 100mg', 
          manufacturer: 'GlobalHealth',
          totalUnits: 500, 
          activatedUnits: 350,
          status: 'ACTIVATED',
          masterQR: 'MASTER-BATCH-007-DEF789',
          assignedAt: '2024-01-10'
        }
      ])
    } catch (error) {
      console.error('Error fetching vendor data:', error)
    }
  }

  useEffect(() => {
    fetchVendorData()
  }, [])

  const handleActivateBatch = (batch) => {
    setSelectedBatch(batch)
    setShowActivationModal(true)
  }

  const handleMasterQRScan = (masterToken) => {
    console.log('Scanning master QR:', masterToken)
    // This would activate all units in the batch
    alert(`Master QR ${masterToken} scanned! This will activate all units in the batch.`)
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACTIVATED':
        return 'activated'
      case 'PENDING':
        return 'pending'
      default:
        return 'pending'
    }
  }

  const getActivationProgress = (activated, total) => {
    return total > 0 ? Math.round((activated / total) * 100) : 0
  }

  return (
    <div className="vendor-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Vendor Dashboard</h1>
        <p className="dashboard-subtitle">Manage assigned medicine batches and activate units for sale</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <Package className="stat-icon" />
          <div className="stat-value">{stats.assignedBatches}</div>
          <div className="stat-label">Assigned Batches</div>
        </div>
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-value">{stats.totalUnits.toLocaleString()}</div>
          <div className="stat-label">Total Units</div>
        </div>
        <div className="stat-card">
          <CheckCircle className="stat-icon" />
          <div className="stat-value">{stats.activatedUnits.toLocaleString()}</div>
          <div className="stat-label">Activated Units</div>
        </div>
        <div className="stat-card">
          <Clock className="stat-icon" />
          <div className="stat-value">{stats.pendingActivation.toLocaleString()}</div>
          <div className="stat-label">Pending Activation</div>
        </div>
      </div>

      {/* Master QR Scanner Section */}
      <div className="master-qr-section">
        <h2>Master QR Scanner</h2>
        <p>Scan master QR codes to activate all units in a batch</p>
        <button className="btn btn-primary" onClick={() => document.getElementById('master-qr-input').click()}>
          <QrCode className="btn-icon" />
          Scan Master QR Code
        </button>
        <input
          id="master-qr-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files[0]
            if (file) {
              // Handle QR file upload
              console.log('Master QR file selected:', file)
            }
          }}
        />
      </div>

      {/* Assigned Batches Table */}
      <div className="batches-section">
        <h2>Assigned Batches</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Medicine Name</th>
                <th>Manufacturer</th>
                <th>Total Units</th>
                <th>Activated Units</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Master QR</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => (
                <tr key={batch.id}>
                  <td>{batch.batchNumber}</td>
                  <td>{batch.medicineName}</td>
                  <td>{batch.manufacturer}</td>
                  <td>{batch.totalUnits}</td>
                  <td>{batch.activatedUnits}</td>
                  <td>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${getActivationProgress(batch.activatedUnits, batch.totalUnits)}%` }}
                      ></div>
                      <span className="progress-text">
                        {getActivationProgress(batch.activatedUnits, batch.totalUnits)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(batch.status)}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td>
                    <code className="master-qr-code">{batch.masterQR}</code>
                  </td>
                  <td>
                    <div className="action-buttons-cell">
                      {batch.status === 'PENDING' && (
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleActivateBatch(batch)}
                        >
                          <CheckCircle className="btn-icon" />
                          Activate
                        </button>
                      )}
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleMasterQRScan(batch.masterQR)}
                      >
                        <QrCode className="btn-icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activation Modal */}
      {showActivationModal && selectedBatch && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Activate Batch - {selectedBatch.batchNumber}</h3>
            <p>Scan the master QR code or enter it manually to activate all {selectedBatch.totalUnits} units in this batch.</p>
            
            <div className="activation-input">
              <label>Master QR Code:</label>
              <input
                type="text"
                placeholder={selectedBatch.masterQR}
                className="qr-input"
              />
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  handleMasterQRScan(selectedBatch.masterQR)
                  setShowActivationModal(false)
                }}
              >
                <CheckCircle className="btn-icon" />
                Activate Batch
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowActivationModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .vendor-dashboard {
          padding: 2rem;
          min-height: 100vh;
        }

        .dashboard-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .dashboard-subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
          margin-top: 0.5rem;
        }

        .master-qr-section {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          margin-bottom: 2rem;
          text-align: center;
          backdrop-filter: blur(10px);
        }

        .master-qr-section h2 {
          color: var(--text-primary);
          margin-bottom: 1rem;
        }

        .master-qr-section p {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .batches-section {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          backdrop-filter: blur(10px);
        }

        .batches-section h2 {
          color: var(--text-primary);
          margin-bottom: 1.5rem;
        }

        .table-container {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .data-table th,
        .data-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid rgba(16, 185, 129, 0.2);
        }

        .data-table th {
          background: rgba(16, 185, 129, 0.1);
          color: var(--text-primary);
          font-weight: 600;
        }

        .data-table tbody tr:hover {
          background: rgba(16, 185, 129, 0.05);
        }

        .progress-bar {
          position: relative;
          width: 100px;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary-green), var(--light-green));
          transition: width 0.3s ease;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .status-badge.activated {
          background: rgba(34, 197, 94, 0.2);
          color: var(--success);
        }

        .status-badge.pending {
          background: rgba(245, 158, 11, 0.2);
          color: var(--warning);
        }

        .master-qr-code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875rem;
          color: var(--accent-green);
        }

        .action-buttons-cell {
          display: flex;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--bg-secondary);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          text-align: center;
        }

        .modal-content h3 {
          color: var(--text-primary);
          margin-bottom: 1rem;
        }

        .modal-content p {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .activation-input {
          margin-bottom: 1.5rem;
          text-align: left;
        }

        .activation-input label {
          display: block;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .qr-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-family: monospace;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .vendor-dashboard {
            padding: 1rem;
          }

          .data-table {
            font-size: 0.875rem;
          }

          .data-table th,
          .data-table td {
            padding: 0.5rem;
          }

          .modal-content {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  )
}

export default VendorDashboard
