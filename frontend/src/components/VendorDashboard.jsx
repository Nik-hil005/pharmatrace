import { useState, useEffect } from 'react'
import { Package, QrCode, CheckCircle, Clock, TrendingUp, AlertTriangle, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

function VendorDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    assignedBatches: 0,
    totalUnits: 0,
    activatedUnits: 0,
    pendingActivation: 0
  })
  const [batches, setBatches] = useState([])
  const [showActivationModal, setShowActivationModal] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [masterQrPaste, setMasterQrPaste] = useState('')
  const [activationMessage, setActivationMessage] = useState('')
  const [activationError, setActivationError] = useState('')
  const [activating, setActivating] = useState(false)

  const fetchVendorData = async () => {
    try {
      // Get vendor ID from logged-in user
      if (!user || !user.id) {
        console.error('No vendor user found');
        return;
      }
      
      const vendorId = user.id;
      
      // Fetch vendor stats
      const statsResponse = await fetch(`/api/vendors/vendors/${vendorId}/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.stats);
        }
      }
      
      // Fetch vendor batches
      const batchesResponse = await fetch(`/api/vendors/batches/vendor/${vendorId}`);
      if (batchesResponse.ok) {
        const batchesData = await batchesResponse.json();
        if (batchesData.success) {
          setBatches(batchesData.batches);
        }
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      // Fallback to empty state if API fails
      setStats({
        assignedBatches: 0,
        totalUnits: 0,
        activatedUnits: 0,
        pendingActivation: 0
      });
      setBatches([]);
    }
  }

  useEffect(() => {
    fetchVendorData()
  }, [user])

  const handleActivateBatch = (batch) => {
    setSelectedBatch(batch)
    setShowActivationModal(true)
  }

  const batchUiStatus = (batch) => {
    if (batch.activation_status && String(batch.activation_status).toLowerCase() === 'active') {
      return 'ACTIVATED'
    }
    if (batch.status) return batch.status
    return 'PENDING'
  }

  const batchIsActive = (batch) => batchUiStatus(batch) === 'ACTIVATED'

  const closeActivationModal = () => {
    setShowActivationModal(false)
    setMasterQrPaste('')
    setActivationMessage('')
    setActivationError('')
  }

  const handleSubmitMasterActivation = async () => {
    if (!user?.id) return
    let qr_data
    try {
      qr_data = JSON.parse(masterQrPaste.trim())
    } catch {
      setActivationError('Paste the exact JSON text read from the master QR (e.g. from a phone scanner).')
      return
    }
    if (qr_data.batch_id == null || qr_data.group_id != null) {
      setActivationError('Master QR JSON must include batch_id and must not include group_id.')
      return
    }

    setActivating(true)
    setActivationError('')
    setActivationMessage('')

    let activation_location = null
    try {
      if (navigator.geolocation) {
        activation_location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            () => resolve(null),
            { timeout: 5000 }
          )
        })
      }
    } catch {
      activation_location = null
    }

    try {
      const res = await fetch('/api/qr/scan/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_data,
          vendor_user_id: user.id,
          activation_location
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActivationError(data.error || 'Activation failed')
        return
      }
      setActivationMessage(data.message || 'Batch updated.')
      await fetchVendorData()
      if (!data.already_active) {
        setTimeout(() => closeActivationModal(), 1200)
      }
    } catch (e) {
      console.error(e)
      setActivationError('Network error. Try again.')
    } finally {
      setActivating(false)
    }
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
          <User className="stat-icon" />
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

      {/* Batches Table */}
      <div className="batches-section">
        <h2 className="section-title">Assigned Batches</h2>
        
        {batches.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-icon" />
            <h3>No Batches Assigned</h3>
            <p>You haven't been assigned any medicine batches yet.</p>
            <p>Contact manufacturers to get batches assigned to your account.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch Number</th>
                  <th>Medicine Name</th>
                  <th>Manufacturer</th>
                  <th>Total Units</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.batch_number}</td>
                    <td>{batch.medicine_name}</td>
                    <td>{batch.manufacturer_name}</td>
                    <td>{batch.total_units}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(batchUiStatus(batch))}`}>
                        {batchUiStatus(batch)}
                      </span>
                    </td>
                    <td>
                      {!batchIsActive(batch) && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleActivateBatch(batch)}
                        >
                          Activate Batch
                        </button>
                      )}
                      {batchIsActive(batch) && (
                        <span className="text-muted" style={{ fontSize: '0.875rem', color: '#6b7280' }}>Live</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activation Modal */}
      {showActivationModal && selectedBatch && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Activate Batch</h3>
            <div className="batch-details">
              <p><strong>Batch Number:</strong> {selectedBatch.batch_number}</p>
              <p><strong>Medicine:</strong> {selectedBatch.medicine_name}</p>
              <p><strong>Units:</strong> {selectedBatch.total_units}</p>
            </div>
            <p>Scan the printed master QR with your phone, then paste the JSON payload below (no images).</p>
            <textarea
              className="master-qr-textarea"
              rows={6}
              placeholder='{"batch_id":1,"batch_number":"...","medicine_name":"..."}'
              value={masterQrPaste}
              onChange={(e) => setMasterQrPaste(e.target.value)}
            />
            {activationError && <p className="modal-error">{activationError}</p>}
            {activationMessage && <p className="modal-success">{activationMessage}</p>}
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                type="button"
                onClick={closeActivationModal}
                disabled={activating}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                type="button"
                onClick={handleSubmitMasterActivation}
                disabled={activating || !masterQrPaste.trim()}
              >
                {activating ? 'Activating…' : 'Submit master QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .vendor-dashboard {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          margin-bottom: 2rem;
        }

        .dashboard-title {
          font-size: 2rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }

        .dashboard-subtitle {
          color: #6b7280;
          font-size: 1rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          color: #3b82f6;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: #1a1a1a;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .batches-section {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: #1a1a1a;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #6b7280;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          margin-bottom: 1rem;
          color: #d1d5db;
        }

        .table-container {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th,
        .data-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .data-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-badge.activated {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.pending {
          background: #fed7aa;
          color: #92400e;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
        }

        .batch-details {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .master-qr-textarea {
          width: 100%;
          margin: 1rem 0;
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-family: ui-monospace, monospace;
          font-size: 0.8125rem;
          box-sizing: border-box;
        }

        .modal-error {
          color: #b91c1c;
          font-size: 0.875rem;
          margin: 0.5rem 0 0;
        }

        .modal-success {
          color: #065f46;
          font-size: 0.875rem;
          margin: 0.5rem 0 0;
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
