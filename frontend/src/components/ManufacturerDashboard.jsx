import { useEffect, useMemo, useState } from 'react'
import { Package, Plus, Trash2, Download, Lock } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useAuth } from '../hooks/useAuth'

// Safely parse JSON from a fetch Response — avoids "unexpected end of data" when
// the server returns an empty body or an HTML error page.
async function safeJson(response) {
  const text = await response.text()
  if (!text || text.trim() === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    // Non-JSON body (e.g. HTML 502/504 from proxy) — surface a readable message.
    throw new Error(`Server returned an unexpected response (status ${response.status}). Make sure the backend is running.`)
  }
}

function ManufacturerDashboard() {
  const { user } = useAuth()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [downloadingBatchId, setDownloadingBatchId] = useState(null)
  const [assigningBatchId, setAssigningBatchId] = useState(null)
  const [selectedVendorByBatch, setSelectedVendorByBatch] = useState({})
  const [vendorsByBatch, setVendorsByBatch] = useState({})
  const [loadingVendorsByBatch, setLoadingVendorsByBatch] = useState({})
  const [fetchErrorByBatch, setFetchErrorByBatch] = useState({})
  const [confirmAssignModal, setConfirmAssignModal] = useState(null)
  const [batchForm, setBatchForm] = useState({
    batchNumber: '',
    medicineName: '',
    units: '',
    manufacturingDate: '',
    expiryDate: '',
    description: ''
  })

  const loadBatches = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/manufacturers/batches')
      const data = await safeJson(response)
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load batches')
      }
      setBatches(data.batches || [])
    } catch (err) {
      setError(err.message || 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBatches()
  }, [])

  const stats = useMemo(() => {
    const totalBatches = batches.length
    const totalUnits = batches.reduce((sum, batch) => sum + Number(batch.total_units || 0), 0)
    return { totalBatches, totalUnits }
  }, [batches])

  const handleBatchFormChange = (e) => {
    const { name, value } = e.target
    setBatchForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateBatch = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const payload = {
        batch_number: batchForm.batchNumber,
        medicine_name: batchForm.medicineName,
        total_units: Number(batchForm.units),
        manufacturing_date: batchForm.manufacturingDate || null,
        expiry_date: batchForm.expiryDate || null,
        description: batchForm.description || null
      }

      const response = await fetch('/api/manufacturers/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await safeJson(response)
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create batch')
      }

      setShowBatchForm(false)
      setBatchForm({
        batchNumber: '',
        medicineName: '',
        units: '',
        manufacturingDate: '',
        expiryDate: '',
        description: ''
      })
      await loadBatches()
    } catch (err) {
      setError(err.message || 'Failed to create batch')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteBatch = async (batchId, batchNumber) => {
    const shouldDelete = window.confirm(`Delete batch ${batchNumber}? This action cannot be undone.`)
    if (!shouldDelete) return

    setError('')
    try {
      const response = await fetch(`/api/manufacturers/batches/${batchId}`, {
        method: 'DELETE'
      })
      const data = await safeJson(response)
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete batch')
      }
      await loadBatches()
    } catch (err) {
      setError(err.message || 'Failed to delete batch')
    }
  }

  const handleDownloadQRCodes = async (batch) => {
    if (!batch?.id) return
    setError('')
    setDownloadingBatchId(batch.id)

    try {
      const response = await fetch(`/api/manufacturers/batches/${batch.id}/qrcodes`)
      const data = await safeJson(response)
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch QR codes')
      }

      if (!data.batch?.master_qr_code || !Array.isArray(data.groups) || data.groups.length === 0) {
        throw new Error('No QR data available for this batch')
      }

      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()

      // Cover page with master QR.
      pdf.setFontSize(18)
      pdf.text('Batch QR Codes', pageWidth / 2, 20, { align: 'center' })
      pdf.setFontSize(12)
      pdf.text(`Batch Number: ${data.batch.batch_number}`, 20, 36)
      pdf.text(`Medicine Name: ${data.batch.medicine_name}`, 20, 44)
      pdf.text(`Total Units: ${data.batch.total_units}`, 20, 52)
      pdf.text(`Created Date: ${new Date(data.batch.created_at).toLocaleString()}`, 20, 60)
      pdf.setFontSize(13)
      pdf.text('Master Batch QR', pageWidth / 2, 72, { align: 'center' })
      pdf.addImage(data.batch.master_qr_code, 'PNG', (pageWidth - 80) / 2, 78, 80, 80)

      data.groups.forEach((group) => {
        pdf.addPage()
        pdf.setFontSize(16)
        pdf.text(`Group ${group.group_number} QR`, pageWidth / 2, 20, { align: 'center' })
        pdf.setFontSize(12)
        pdf.text(`Unit Range: Units ${group.unit_start}-${group.unit_end}`, 20, 34)
        pdf.text(
          `Label: Group ${group.group_number} QR - Units ${group.unit_start} to ${group.unit_end}`,
          20,
          42
        )
        pdf.addImage(group.group_qr_code, 'PNG', (pageWidth - 70) / 2, 52, 70, 70)
        pdf.setFontSize(11)
        pdf.text('This QR is identical for all units in this group', pageWidth / 2, 132, {
          align: 'center'
        })
      })

      pdf.save(`${data.batch.batch_number}_QRCodes.pdf`)
    } catch (err) {
      setError(err.message || 'Failed to download QR codes')
    } finally {
      setDownloadingBatchId(null)
    }
  }

  const loadAssignableVendorsForBatch = async (batchId) => {
    if (!batchId || loadingVendorsByBatch[batchId]) return

    setLoadingVendorsByBatch((prev) => ({ ...prev, [batchId]: true }))
    setFetchErrorByBatch((prev) => ({ ...prev, [batchId]: false }))
    try {
      const primaryResponse = await fetch('/api/manufacturers/vendors/assignable')
      if (primaryResponse.ok) {
        const primaryData = await safeJson(primaryResponse)
        setVendorsByBatch((prev) => ({ ...prev, [batchId]: primaryData.vendors || [] }))
        return
      }

      // Fallback for backend versions that expose vendors only via /api/vendors.
      const fallbackResponse = await fetch('/api/vendors')
      const fallbackData = await safeJson(fallbackResponse)
      if (!fallbackResponse.ok) {
        throw new Error(fallbackData.error || 'Failed to load vendors')
      }

      const normalizedVendors = (fallbackData.vendors || []).map((vendor) => ({
        id: vendor.id,
        first_name: vendor.name || '',
        last_name: '',
        email: vendor.email || '',
        company_name: vendor.name || '',
        city: vendor.address || ''
      }))

      setVendorsByBatch((prev) => ({ ...prev, [batchId]: normalizedVendors }))
    } catch (err) {
      setFetchErrorByBatch((prev) => ({ ...prev, [batchId]: true }))
    } finally {
      setLoadingVendorsByBatch((prev) => ({ ...prev, [batchId]: false }))
    }
  }

  const openAssignConfirmation = (batch) => {
    const selectedVendorId = selectedVendorByBatch[batch.id]
    if (!selectedVendorId) {
      setError('Please select a vendor before assigning')
      return
    }

    const selectedVendor = (vendorsByBatch[batch.id] || []).find(
      (vendor) => Number(vendor.id) === Number(selectedVendorId)
    )
    if (!selectedVendor) {
      setError('Selected vendor is no longer available')
      return
    }

    const vendorName = `${selectedVendor.first_name || ''} ${selectedVendor.last_name || ''}`.trim() || selectedVendor.email
    setConfirmAssignModal({
      batchId: batch.id,
      batchNumber: batch.batch_number,
      vendorId: selectedVendor.id,
      vendorName
    })
  }

  const handleConfirmAssign = async () => {
    if (!confirmAssignModal) return

    setAssigningBatchId(confirmAssignModal.batchId)
    setError('')
    try {
      const response = await fetch(`/api/manufacturers/batches/${confirmAssignModal.batchId}/assign-vendor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_vendor_id: Number(confirmAssignModal.vendorId),
          assigned_by: user?.id || null
        })
      })
      const data = await safeJson(response)
      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign vendor')
      }

      setConfirmAssignModal(null)
      setSelectedVendorByBatch((prev) => {
        const next = { ...prev }
        delete next[confirmAssignModal.batchId]
        return next
      })
      await loadBatches()
    } catch (err) {
      setError(err.message || 'Failed to assign vendor')
    } finally {
      setAssigningBatchId(null)
    }
  }

  return (
    <div className="manufacturer-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Manufacturer Dashboard</h1>
        <p className="dashboard-subtitle">Create batches and view saved batch records from database</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <Package className="stat-icon" />
          <div className="stat-value">{stats.totalBatches}</div>
          <div className="stat-label">Total Batches</div>
        </div>
        <div className="stat-card">
          <Package className="stat-icon" />
          <div className="stat-value">{stats.totalUnits}</div>
          <div className="stat-label">Total Units</div>
        </div>
      </div>

      <div className="action-buttons">
        <button className="btn btn-primary" onClick={() => setShowBatchForm(true)}>
          <Plus className="btn-icon" />
          Create New Batch
        </button>
      </div>

      {error && <p style={{ color: '#ff6b6b', textAlign: 'center' }}>{error}</p>}

      <div className="batches-section">
        <h2>Saved Batches</h2>
        {loading ? (
          <p>Loading batches...</p>
        ) : batches.length === 0 ? (
          <p>No batch data found. Create your first batch.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch Number</th>
                  <th>Medicine Name</th>
                  <th>Total Units</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>QR Codes</th>
                  <th>Assign Vendor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.batch_number}</td>
                    <td>{batch.medicine_name}</td>
                    <td>{batch.total_units}</td>
                    <td>{batch.status}</td>
                    <td>{new Date(batch.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-qr"
                        onClick={() => handleDownloadQRCodes(batch)}
                        disabled={!batch.master_qr_code || Number(batch.group_count || 0) === 0 || downloadingBatchId === batch.id}
                        title={!batch.master_qr_code || Number(batch.group_count || 0) === 0 ? 'No QR' : 'Download QR PDF'}
                      >
                        <Download className="btn-icon" />
                        {!batch.master_qr_code || Number(batch.group_count || 0) === 0
                          ? 'No QR'
                          : downloadingBatchId === batch.id
                            ? 'Preparing...'
                            : 'Download QR'}
                      </button>
                    </td>
                    <td>
                      {batch.assigned_vendor_id ? (
                        <div className="assigned-vendor">
                          <span>{(batch.assigned_vendor_name || '').trim() || `Vendor #${batch.assigned_vendor_id}`}</span>
                          <Lock className="lock-icon" />
                        </div>
                      ) : (
                        <div className="assign-controls-wrapper">
                          <div className="assign-controls">
                            <select
                              className="vendor-select"
                              value={selectedVendorByBatch[batch.id] || ''}
                              onFocus={() => loadAssignableVendorsForBatch(batch.id)}
                              onChange={(e) =>
                                setSelectedVendorByBatch((prev) => ({ ...prev, [batch.id]: e.target.value }))
                              }
                              disabled={assigningBatchId === batch.id}
                            >
                              <option value="">
                                {loadingVendorsByBatch[batch.id] ? 'Loading vendors...' : 'Select Vendor'}
                              </option>
                              {vendorsByBatch[batch.id] && vendorsByBatch[batch.id].length === 0 && !loadingVendorsByBatch[batch.id] && !fetchErrorByBatch[batch.id] ? (
                                <option disabled>No approved vendors found in the system.</option>
                              ) : (
                                (vendorsByBatch[batch.id] || []).map((vendor) => {
                                  const displayName = vendor.company_name || vendor.name || vendor.first_name || 'Unknown Vendor'
                                  const displayCity = vendor.city || vendor.address || vendor.last_name || 'Unknown City'
                                  return (
                                    <option key={vendor.id} value={vendor.id}>
                                      {displayName} — {displayCity}
                                    </option>
                                  )
                                })
                              )}
                            </select>
                            <button
                              className="btn btn-primary btn-assign"
                              disabled={!selectedVendorByBatch[batch.id] || assigningBatchId === batch.id}
                              onClick={() => openAssignConfirmation(batch)}
                            >
                              {assigningBatchId === batch.id ? 'Assigning...' : 'Assign'}
                            </button>
                          </div>
                          {fetchErrorByBatch[batch.id] && (
                            <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '4px' }}>
                              Failed to load vendors. Please refresh.
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-delete"
                        onClick={() => handleDeleteBatch(batch.id, batch.batch_number)}
                      >
                        <Trash2 className="btn-icon" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBatchForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create New Batch</h3>
            <form onSubmit={handleCreateBatch} className="batch-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="batchNumber">Batch Number *</label>
                  <input id="batchNumber" name="batchNumber" value={batchForm.batchNumber} onChange={handleBatchFormChange} required />
                </div>
                <div className="form-group">
                  <label htmlFor="medicineName">Medicine Name *</label>
                  <input id="medicineName" name="medicineName" value={batchForm.medicineName} onChange={handleBatchFormChange} required />
                </div>
                <div className="form-group">
                  <label htmlFor="units">Total Units *</label>
                  <input id="units" type="number" min="1" name="units" value={batchForm.units} onChange={handleBatchFormChange} required />
                </div>
                <div className="form-group">
                  <label htmlFor="manufacturingDate">Manufacturing Date</label>
                  <input id="manufacturingDate" type="date" name="manufacturingDate" value={batchForm.manufacturingDate} onChange={handleBatchFormChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="expiryDate">Expiry Date</label>
                  <input id="expiryDate" type="date" name="expiryDate" value={batchForm.expiryDate} onChange={handleBatchFormChange} />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="description">Description</label>
                  <textarea id="description" name="description" rows="3" value={batchForm.description} onChange={handleBatchFormChange} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Batch'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBatchForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAssignModal && (
        <div className="modal-overlay">
          <div className="modal-content assign-confirm-modal">
            <h3>Confirm Vendor Assignment</h3>
            <p>
              You are about to assign <strong>{confirmAssignModal.batchNumber}</strong> to{' '}
              <strong>{confirmAssignModal.vendorName}</strong>. This action is permanent and cannot be undone.
              The vendor will be responsible for activating this batch by scanning the Master QR.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmAssignModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmAssign}>
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .manufacturer-dashboard {
          padding: 2rem;
          min-height: 100vh;
        }

        .dashboard-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .dashboard-subtitle {
          color: var(--text-secondary);
          margin-top: 0.5rem;
        }

        .action-buttons {
          text-align: center;
          margin: 1.5rem 0;
        }

        .batches-section {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 1.5rem;
          backdrop-filter: blur(8px);
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
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid rgba(16, 185, 129, 0.2);
        }

        .data-table th {
          color: var(--text-primary);
          background: rgba(16, 185, 129, 0.1);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--bg-secondary);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          width: min(760px, 92%);
          padding: 1.5rem;
        }

        .batch-form {
          text-align: left;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group input,
        .form-group textarea {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          color: var(--text-primary);
          padding: 0.65rem 0.75rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .btn-delete {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid #ef4444;
          color: #ff8a8a;
          padding: 0.4rem 0.75rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .btn-qr {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid var(--primary-green);
          color: var(--text-primary);
          padding: 0.4rem 0.75rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .btn-qr:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          border-color: rgba(156, 163, 175, 0.6);
          color: rgba(209, 213, 219, 0.8);
          background: rgba(107, 114, 128, 0.15);
        }

        .assign-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .vendor-select {
          min-width: 170px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--border-green);
          border-radius: 0.4rem;
          color: var(--text-primary);
          padding: 0.4rem 0.55rem;
        }

        .btn-assign {
          padding: 0.4rem 0.7rem;
          white-space: nowrap;
        }

        .assigned-vendor {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-primary);
        }

        .lock-icon {
          width: 0.9rem;
          height: 0.9rem;
          color: var(--text-secondary);
        }

        .assign-confirm-modal p {
          color: var(--text-secondary);
          line-height: 1.45;
        }
      `}</style>
    </div>
  )
}

export default ManufacturerDashboard
