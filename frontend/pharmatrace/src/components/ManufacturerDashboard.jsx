import { useState, useEffect } from 'react'
import { Package, Plus, QrCode, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import QRDisplay from './QRDisplay'
import { generateMasterQR } from '../services/qrService'
import QRCode from 'qrcode'

function ManufacturerDashboard() {
  const [stats, setStats] = useState({
    totalBatches: 0,
    activeBatches: 0,
    totalUnits: 0,
    activatedUnits: 0,
    scannedUnits: 0
  })
  const [batches, setBatches] = useState([])
  const [vendors, setVendors] = useState([])
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [generatedQR, setGeneratedQR] = useState(null)
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [batchForm, setBatchForm] = useState({
    batchNumber: '',
    medicineName: '',
    units: '',
    manufacturingDate: '',
    expiryDate: '',
    description: ''
  })
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const fetchManufacturerData = async () => {
    try {
      // Mock data for now
      setStats({
        totalBatches: 12,
        activeBatches: 8,
        totalUnits: 4800,
        activatedUnits: 2150,
        scannedUnits: 1250
      })
      
      setBatches([
        { 
          id: 1, 
          batchNumber: 'BATCH-001', 
          medicineName: 'Paracetamol 500mg', 
          status: 'ACTIVATED', 
          units: 400, 
          activatedUnits: 215, 
          scannedUnits: 180,
          vendor: 'City Pharmacy',
          masterScanned: true,
          assignedVendor: 'City Pharmacy'
        },
        { 
          id: 2, 
          batchNumber: 'BATCH-002', 
          medicineName: 'Amoxicillin 250mg', 
          status: 'PENDING', 
          units: 500, 
          activatedUnits: 0, 
          scannedUnits: 0,
          vendor: null,
          masterScanned: false,
          assignedVendor: null
        },
        { 
          id: 3, 
          batchNumber: 'BATCH-003', 
          medicineName: 'Ibuprofen 400mg', 
          status: 'ACTIVATED', 
          units: 300, 
          activatedUnits: 180, 
          scannedUnits: 120,
          vendor: 'MedSupply',
          masterScanned: true,
          assignedVendor: 'MedSupply'
        }
      ])
    } catch (error) {
      console.error('Error fetching manufacturer data:', error)
    }
  }

  const fetchVendors = async () => {
    try {
      // Mock vendors
      setVendors([
        { id: 1, name: 'City Pharmacy', email: 'info@citypharmacy.com' },
        { id: 2, name: 'MedSupply', email: 'contact@medsupply.com' },
        { id: 3, name: 'HealthMart', email: 'orders@healthmart.com' }
      ])
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  useEffect(() => {
    fetchManufacturerData()
    fetchVendors()
  }, [])

  const handleAssignBatch = (batchId, vendorId) => {
    console.log('Assigning batch', batchId, 'to vendor', vendorId)
    // API call to assign batch
    
    // Update batch with assigned vendor
    setBatches(prev => prev.map(batch => 
      batch.id === batchId 
        ? { ...batch, assignedVendor: vendors.find(v => v.id === vendorId)?.name || null }
        : batch
    ))
  }

  const handleMasterQRScanned = (batchId) => {
    // Simulate master QR scan by approved vendor
    setBatches(prev => prev.map(batch => {
      if (batch.id === batchId && batch.assignedVendor && batch.status === 'ACTIVATED') {
        return {
          ...batch,
          masterScanned: true,
          activatedUnits: batch.units, // All units become activatable
          status: 'MASTER_SCANNED'
        }
      }
      return batch
    }))
    
    alert(`Master QR for batch ${batchId} has been scanned! Unit QR codes are now activatable.`)
  }

  const handleUnitQRScanned = (batchId) => {
    // Simulate unit QR scan and update database
    setBatches(prev => prev.map(batch => {
      if (batch.id === batchId && batch.masterScanned && batch.scannedUnits < batch.units) {
        const newScannedUnits = batch.scannedUnits + 1
        return {
          ...batch,
          scannedUnits: newScannedUnits
        }
      }
      return batch
    }))
    
    // Update global stats
    setStats(prev => ({
      ...prev,
      scannedUnits: prev.scannedUnits + 1
    }))
  }

  const handleDownloadQR = (qrData) => {
    if (!qrData) return
    
    try {
      const link = document.createElement('a')
      link.download = `qr-${Date.now()}.png`
      link.href = qrData
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  const handleCopyQR = async (qrData) => {
    if (!qrData) return
    
    try {
      await navigator.clipboard.writeText(qrData)
      alert('QR code data copied to clipboard!')
    } catch (error) {
      console.error('Copy error:', error)
    }
  }

  const handleBatchFormChange = (e) => {
    const { name, value } = e.target
    setBatchForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCreateBatch = (e) => {
    e.preventDefault()
    
    // Validate form
    if (!batchForm.batchNumber || !batchForm.medicineName || !batchForm.units) {
      alert('Please fill in all required fields')
      return
    }

    // Create new batch
    const newBatch = {
      id: batches.length + 1,
      batchNumber: batchForm.batchNumber,
      medicineName: batchForm.medicineName,
      units: parseInt(batchForm.units),
      status: 'PENDING', // Back to PENDING status
      activatedUnits: 0,
      scannedUnits: 0,
      vendor: null,
      manufacturingDate: batchForm.manufacturingDate,
      expiryDate: batchForm.expiryDate,
      description: batchForm.description,
      createdAt: new Date().toISOString(),
      qrGenerated: false,
      masterScanned: false,
      assignedVendor: null
    }

    // Add to batches
    setBatches(prev => [...prev, newBatch])
    
    // Update stats
    setStats(prev => ({
      ...prev,
      totalBatches: prev.totalBatches + 1,
      totalUnits: prev.totalUnits + parseInt(batchForm.units)
    }))

    // Reset form and close modal
    setBatchForm({
      batchNumber: '',
      medicineName: '',
      units: '',
      manufacturingDate: '',
      expiryDate: '',
      description: ''
    })
    setShowBatchForm(false)
    
    alert('Batch created successfully! You can now generate QR codes for this batch.')
  }

  const handleGenerateQR = async (batchId) => {
    const batch = batches.find(b => b.id === batchId)
    if (!batch) return

    // Set loading state
    setIsGeneratingQR(true)

    // Remove admin approval check - allow QR generation for any created batch
    try {
      // Generate both unit QR codes and master QR code
      const masterQR = await generateMasterQR(batch.id, batch.batchNumber)
      setGeneratedQR(masterQR)
      setShowQRModal(true)
      setSelectedBatch(batch)
      
      // Mark batch as having QR codes generated
      setBatches(prev => prev.map(b => 
        b.id === batchId ? { ...b, qrGenerated: true } : b
      ))
      
      console.log('Generated QR codes for batch:', batch.batchNumber)
    } catch (error) {
      console.error('QR generation error:', error)
      alert('Failed to generate QR codes. Please try again.')
    } finally {
      setIsGeneratingQR(false)
    }
  }

  const handlePrintAllQRCodes = async (batch) => {
    setIsGeneratingPDF(true)
    
    try {
      // Generate ONE QR code for all units (identical QR codes)
      const unitQRData = {
        type: 'UNIT_QR',
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        medicineName: batch.medicineName,
        totalUnits: batch.units,
        manufacturingDate: batch.manufacturingDate,
        expiryDate: batch.expiryDate,
        timestamp: new Date().toISOString(),
        action: 'VERIFY_UNIT',
        version: '1.0'
      }
      
      const qrString = JSON.stringify(unitQRData)
      const unitQR = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'H',
        type: 'png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#2F8D46',
          light: '#FFFFFF'
        },
        width: 60,
        height: 60
      })

      // Create a print-friendly window with identical QR codes
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Codes - ${batch.batchNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .batch-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
            .qr-section { margin-bottom: 30px; page-break-inside: avoid; }
            .qr-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; color: #2F8D46; }
            .qr-description { color: #666; margin-bottom: 15px; }
            .unit-qr-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
            .unit-qr-item { text-align: center; border: 1px solid #ddd; padding: 10px; border-radius: 8px; }
            .unit-number { font-weight: bold; margin-bottom: 10px; }
            .qr-image { width: 60px; height: 60px; margin: 0 auto; }
            .qr-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold; color: #856404; }
            .unit-notice { background: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center; color: #0066cc; }
            @media print { .qr-section { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PharmaTrace - QR Codes</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="batch-info">
            <h2>Batch Information</h2>
            <p><strong>Batch Number:</strong> ${batch.batchNumber}</p>
            <p><strong>Medicine:</strong> ${batch.medicineName}</p>
            <p><strong>Total Units:</strong> ${batch.units}</p>
            <p><strong>Manufacturing Date:</strong> ${batch.manufacturingDate || 'N/A'}</p>
            <p><strong>Expiry Date:</strong> ${batch.expiryDate || 'N/A'}</p>
          </div>
          
          <div class="qr-section">
            <div class="qr-title">Master QR Code</div>
            <div class="qr-description">Scan this QR code to activate all units in this batch</div>
            <div style="text-align: center;">
              <img src="${generatedQR}" class="qr-image" alt="Master QR Code" />
            </div>
          </div>
          
          <div class="qr-notice">
            ⚠️ IMPORTANT: All unit QR codes are IDENTICAL. Verification is based on batch tracking and scan analytics.
          </div>
          
          <div class="qr-section">
            <div class="qr-title">Unit QR Code (Identical for All ${batch.units} Units)</div>
            <div class="qr-description">All units in this batch share the same QR code. Print and attach to any unit.</div>
            <div style="text-align: center;">
              <img src="${unitQR}" class="qr-image" alt="Unit QR Code" />
            </div>
            <div class="unit-notice">
              <strong>Important:</strong> This single QR code is identical for all ${batch.units} units in this batch.
              You can print multiple copies and attach them to individual units.
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
        </html>
      `)
      printWindow.document.close()
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF with QR codes. Please try again.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <div className="manufacturer-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Manufacturer Dashboard</h1>
        <p className="dashboard-subtitle">Manage your medicine batches and track distribution</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <Package className="stat-icon" />
          <div className="stat-value">{stats.totalBatches}</div>
          <div className="stat-label">Total Batches</div>
        </div>
        <div className="stat-card">
          <CheckCircle className="stat-icon" />
          <div className="stat-value">{stats.activeBatches}</div>
          <div className="stat-label">Active Batches</div>
        </div>
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-value">{stats.totalUnits.toLocaleString()}</div>
          <div className="stat-label">Total Units</div>
        </div>
        <div className="stat-card">
          <TrendingUp className="stat-icon" />
          <div className="stat-value">{stats.activatedUnits.toLocaleString()}</div>
          <div className="stat-label">Activated Units</div>
        </div>
        <div className="stat-card">
          <QrCode className="stat-icon" />
          <div className="stat-value">{stats.scannedUnits.toLocaleString()}</div>
          <div className="stat-label">Scanned Units</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn btn-primary" onClick={() => setShowBatchForm(true)}>
          <Plus className="btn-icon" />
          Create New Batch
        </button>
      </div>

      {/* Batches Table */}
      <div className="batches-section">
        <h2>Your Batches</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Medicine Name</th>
                <th>Total Units</th>
                <th>Activated Units</th>
                <th>Scanned Units</th>
                <th>Status</th>
                <th>Master Scanned</th>
                <th>Assigned Vendor</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => (
                <tr key={batch.id}>
                  <td>{batch.batchNumber}</td>
                  <td>{batch.medicineName}</td>
                  <td>{batch.units}</td>
                  <td>{batch.activatedUnits}</td>
                  <td>{batch.scannedUnits || 0}</td>
                  <td>
                    <span className={`status-badge ${batch.status.toLowerCase()}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td>
                    <span className={`master-scan-status ${batch.masterScanned ? 'scanned' : 'not-scanned'}`}>
                      {batch.masterScanned ? '✅ Scanned' : '⏳ Not Scanned'}
                    </span>
                  </td>
                  <td>
                    {batch.vendor ? (
                      <span className="vendor-name">{batch.vendor}</span>
                    ) : (
                      <select 
                        className="vendor-select"
                        onChange={(e) => handleAssignBatch(batch.id, parseInt(e.target.value))}
                        defaultValue=""
                      >
                        <option value="">Assign to vendor...</option>
                        {vendors.map(vendor => (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons-cell">
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleGenerateQR(batch.id)}
                        title="Generate QR Codes"
                        disabled={isGeneratingQR}
                      >
                        {isGeneratingQR ? (
                          <div className="loading-spinner"></div>
                        ) : (
                          <QrCode className="btn-icon" />
                        )}
                      </button>
                      
                      {/* Simulation buttons for testing */}
                      {batch.assignedVendor && !batch.masterScanned && (
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleMasterQRScanned(batch.id)}
                          title="Simulate Master QR Scan"
                        >
                          🔑 Master
                        </button>
                      )}
                      
                      {batch.masterScanned && batch.scannedUnits < batch.units && (
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => handleUnitQRScanned(batch.id)}
                          title="Simulate Unit QR Scan"
                        >
                          📱 Unit
                        </button>
                      )}
                      
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDownloadQR(batch.id)}
                        title="Download QR Codes"
                      >
                        <Clock className="btn-icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && selectedBatch && (
        <div className="modal-overlay">
          <div className="modal-content qr-modal">
            <h3>QR Codes Generated</h3>
            <p>Batch: <strong>{selectedBatch.batchNumber}</strong> | Medicine: <strong>{selectedBatch.medicineName}</strong></p>
            
            <div className="qr-codes-container">
              {/* Master QR Code */}
              <div className="qr-code-section">
                <h4>Master QR Code</h4>
                <QRDisplay
                  qrData={generatedQR}
                  title="Master QR Code"
                  description="Scan this QR code to activate all units in this batch"
                  onDownload={handleDownloadQR}
                  onCopy={handleCopyQR}
                />
              </div>
              
              {/* Unit QR Codes Preview */}
              <div className="qr-code-section">
                <h4>Unit QR Codes ({selectedBatch.units} units)</h4>
                <div className="unit-qr-preview">
                  <p className="qr-preview-text">
                    Individual unit QR codes are generated for each of the {selectedBatch.units} units in this batch.
                    Each unit has a unique QR code that can be scanned individually.
                  </p>
                  <div className="qr-stats">
                    <div className="stat-item">
                      <span className="stat-label">Total Units:</span>
                      <span className="stat-value">{selectedBatch.units}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Activated:</span>
                      <span className="stat-value">{selectedBatch.activatedUnits}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn btn-primary"
                onClick={() => handlePrintAllQRCodes(selectedBatch)}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <>
                    <div className="loading-spinner"></div>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    🖨️ Print All QR Codes
                  </>
                )}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowQRModal(false)
                  setSelectedBatch(null)
                  setGeneratedQR(null)
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Creation Form Modal */}
      {showBatchForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create New Batch</h3>
            
            <form onSubmit={handleCreateBatch} className="batch-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="batchNumber">Batch Number *</label>
                  <input
                    type="text"
                    id="batchNumber"
                    name="batchNumber"
                    value={batchForm.batchNumber}
                    onChange={handleBatchFormChange}
                    placeholder="e.g., BATCH-001"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="medicineName">Medicine Name *</label>
                  <input
                    type="text"
                    id="medicineName"
                    name="medicineName"
                    value={batchForm.medicineName}
                    onChange={handleBatchFormChange}
                    placeholder="e.g., Paracetamol 500mg"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="units">Total Units *</label>
                  <input
                    type="number"
                    id="units"
                    name="units"
                    value={batchForm.units}
                    onChange={handleBatchFormChange}
                    placeholder="e.g., 1000"
                    min="1"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="manufacturingDate">Manufacturing Date</label>
                  <input
                    type="date"
                    id="manufacturingDate"
                    name="manufacturingDate"
                    value={batchForm.manufacturingDate}
                    onChange={handleBatchFormChange}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="expiryDate">Expiry Date</label>
                  <input
                    type="date"
                    id="expiryDate"
                    name="expiryDate"
                    value={batchForm.expiryDate}
                    onChange={handleBatchFormChange}
                  />
                </div>
                
                <div className="form-group full-width">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={batchForm.description}
                    onChange={handleBatchFormChange}
                    placeholder="Additional information about this batch..."
                    rows="3"
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  <Plus className="btn-icon" />
                  Create Batch
                </button>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowBatchForm(false)
                    setBatchForm({
                      batchNumber: '',
                      medicineName: '',
                      units: '',
                      manufacturingDate: '',
                      expiryDate: '',
                      description: ''
                    })
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .manufacturer-dashboard {
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

        .action-buttons {
          text-align: center;
          margin-bottom: 2rem;
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

        .vendor-name {
          color: var(--accent-green);
          font-weight: 600;
        }

        .vendor-select {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          color: var(--text-primary);
          padding: 0.5rem;
          border-radius: 0.25rem;
          min-width: 150px;
        }

        .action-buttons-cell {
          display: flex;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .manufacturer-dashboard {
            padding: 1rem;
          }

          .data-table {
            font-size: 0.875rem;
          }

          .data-table th,
          .data-table td {
            padding: 0.5rem;
          }
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

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        /* Batch Form Styles */
        .batch-form {
          text-align: left;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          color: var(--text-primary);
          font-weight: 500;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .form-group input,
        .form-group textarea {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          padding: 0.75rem;
          color: var(--text-primary);
          font-size: 0.9rem;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--primary-green);
          box-shadow: 0 0 0 2px rgba(47, 141, 70, 0.2);
        }

        .form-group input::placeholder,
        .form-group textarea::placeholder {
          color: var(--text-secondary);
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .form-actions {
            flex-direction: column;
          }
          
          .modal-content {
            max-width: 95%;
            padding: 1.5rem;
          }
        }

        /* QR Modal Styles */
        .qr-modal {
          max-width: 800px !important;
          text-align: left;
        }

        .qr-codes-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin: 2rem 0;
        }

        .qr-code-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-green);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .qr-code-section h4 {
          color: var(--primary-green);
          margin-bottom: 1rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .unit-qr-preview {
          margin-top: 1rem;
        }

        .qr-preview-text {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
          margin-bottom: 1rem;
        }

        .qr-stats {
          display: flex;
          gap: 1rem;
          background: rgba(47, 141, 70, 0.1);
          padding: 0.75rem;
          border-radius: 0.5rem;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.8rem;
          margin-bottom: 0.25rem;
        }

        .stat-value {
          color: var(--primary-green);
          font-weight: 600;
          font-size: 1.1rem;
        }

        @media (max-width: 768px) {
          .qr-codes-container {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          
          .qr-modal {
            max-width: 95% !important;
          }
        }

        /* Loading Spinner */
        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid var(--primary-green);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Master Scan Status */
        .master-scan-status {
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
          font-weight: 500;
          text-align: center;
          display: inline-block;
        }

        .master-scan-status.scanned {
          background: rgba(40, 167, 69, 0.1);
          color: #28a745;
          border: 1px solid #28a745;
        }

        .master-scan-status.not-scanned {
          background: rgba(255, 193, 7, 0.1);
          color: #ffc107;
          border: 1px solid #ffc107;
        }

        /* Action buttons styling */
        .action-buttons-cell {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn-sm {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
        }
      `}</style>
    </div>
  )
}

export default ManufacturerDashboard
