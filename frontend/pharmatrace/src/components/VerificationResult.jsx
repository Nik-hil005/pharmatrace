import { useLocation, useNavigate, useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, XCircle, ArrowLeft, MapPin, Users, Activity, Shield } from 'lucide-react'
import VerificationService from '../services/verificationService'

function VerificationResult() {
  const location = useLocation()
  const navigate = useNavigate()
  const { verificationResult, qrData } = location.state || {}
  const [detailedVerification, setDetailedVerification] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const performDetailedVerification = async () => {
      if (qrData) {
        setLoading(true)
        try {
          const verificationService = new VerificationService()
          const result = await verificationService.verifyQRCode(qrData, 'user_' + Date.now())
          setDetailedVerification(result)
        } catch (error) {
          console.error('Verification error:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    performDetailedVerification()
  }, [qrData])

  if (!verificationResult && !detailedVerification) {
    return (
      <div className="result-container">
        <div className="result-card">
          <h2>No Verification Data</h2>
          <p>Please scan a QR code to verify medicine authenticity.</p>
          <button className="btn btn-primary" onClick={() => navigate('/scan')}>
            Go to Scanner
          </button>
        </div>
      </div>
    )
  }

  // Use detailed verification if available, otherwise fall back to basic
  const currentResult = detailedVerification || verificationResult
  const medicineData = currentResult.data || currentResult.medicineInfo || {}

  const getStatusIcon = () => {
    if (detailedVerification) {
      if (!detailedVerification.success) {
        return detailedVerification.blocked ? <Shield /> : <AlertTriangle />
      }
      return <CheckCircle />
    }
    
    switch (currentResult.status) {
      case 'VERIFIED':
        return <CheckCircle className="status-icon" />
      case 'SUSPICIOUS':
        return <AlertTriangle className="status-icon" />
      case 'FAKE':
        return <XCircle className="status-icon" />
      default:
        return <AlertTriangle className="status-icon" />
    }
  }

  const getStatusClass = () => {
    if (detailedVerification) {
      if (!detailedVerification.success) {
        return detailedVerification.blocked ? 'status-blocked' : 'status-error'
      }
      return 'status-verified'
    }
    return `status-${currentResult.status?.toLowerCase()}`
  }

  const getStatusMessage = () => {
    if (detailedVerification) {
      if (!detailedVerification.success) {
        return detailedVerification.error
      }
      return 'QR code verified and tracked successfully with advanced fraud detection.'
    }
    
    switch (currentResult.status) {
      case 'VERIFIED':
        return 'This medicine is authentic and safe to use.'
      case 'SUSPICIOUS':
        return 'This medicine shows suspicious activity. Please verify with your pharmacist.'
      case 'FAKE':
        return 'This medicine appears to be counterfeit. Do not use!'
      default:
        return 'Unable to verify this medicine.'
    }
  }

  return (
    <div className="result-container">
      <div className={`result-card ${getStatusClass()}`}>
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Performing advanced verification...</p>
          </div>
        ) : (
          <>
            {getStatusIcon()}
            
            <h2 className="status-title">
              {detailedVerification ? (detailedVerification.success ? 'VERIFIED' : 'VERIFICATION FAILED') : currentResult.status}
            </h2>
            
            <p className="status-message">
              {getStatusMessage()}
            </p>

            {/* Advanced Location Information */}
            {detailedVerification?.location && (
              <div className="location-info">
                <h4><MapPin className="icon" /> Scan Location</h4>
                <div className="location-details">
                  {detailedVerification.location.city && (
                    <p><strong>City:</strong> {detailedVerification.location.city}, {detailedVerification.location.region}, {detailedVerification.location.country}</p>
                  )}
                  {detailedVerification.location.ip && (
                    <p><strong>IP Address:</strong> {detailedVerification.location.ip}</p>
                  )}
                  <p><strong>Method:</strong> {detailedVerification.location.method === 'geolocation' ? 'GPS' : 'IP-based'}</p>
                </div>
              </div>
            )}

            {/* Medicine Information */}
            {(currentResult.medicine || detailedVerification?.data) && (
              <div className="medicine-info">
                <h3>Medicine Information</h3>
                <div className="info-row">
                  <span className="info-label">Name:</span>
                  <span className="info-value">{medicineData.name || medicineData.medicineName || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Batch Number:</span>
                  <span className="info-value">{medicineData.batch_number || medicineData.batchNumber || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Manufacturer:</span>
                  <span className="info-value">{medicineData.manufacturer || 'N/A'}</span>
                </div>
                {medicineData.vendor && (
                  <div className="info-row">
                    <span className="info-label">Vendor:</span>
                    <span className="info-value">{medicineData.vendor}</span>
                  </div>
                )}
                {medicineData.expiry_date && (
                  <div className="info-row">
                    <span className="info-label">Expiry Date:</span>
                    <span className="info-value">{new Date(medicineData.expiry_date).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">Scan Count:</span>
                  <span className="info-value">{medicineData.scan_count || detailedVerification?.data?.scanCount || 0}</span>
                </div>
                {detailedVerification?.data?.uniqueLocations && (
                  <div className="info-row">
                    <span className="info-label">Unique Locations:</span>
                    <span className="info-value">{detailedVerification.data.uniqueLocations}</span>
                  </div>
                )}
              </div>
            )}

            {/* Fraud Alerts */}
            {(detailedVerification?.fraudAlerts || currentResult.alerts) && (
              <div className="alerts">
                <h4>Security Alerts</h4>
                {(detailedVerification?.fraudAlerts || []).map((alert, index) => (
                  <div key={index} className={`alert-item ${alert.severity?.toLowerCase() || 'medium'}`}>
                    <AlertTriangle className="alert-icon" />
                    <div>
                      <strong>{alert.type.replace(/_/g, ' ')}</strong>
                      <p>{alert.message}</p>
                    </div>
                  </div>
                ))}
                {(currentResult?.alerts || []).map((alert, index) => (
                  <div key={index} className="alert-item medium">
                    <AlertTriangle className="alert-icon" />
                    <p>{alert}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Analytics Toggle */}
            {detailedVerification && (
              <div className="analytics-section">
                <button 
                  className="btn btn-outline toggle-details"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <Activity className="icon" />
                  {showDetails ? 'Hide' : 'Show'} Analytics Details
                </button>

                {showDetails && (
                  <div className="analytics-details">
                    <h4><Activity className="icon" /> Scan Analytics</h4>
                    <div className="analytics-grid">
                      <div className="analytics-item">
                        <Users className="analytics-icon" />
                        <div>
                          <strong>Unique Locations</strong>
                          <p>{detailedVerification.data.uniqueLocations} locations scanned</p>
                        </div>
                      </div>
                      <div className="analytics-item">
                        <Shield className="analytics-icon" />
                        <div>
                          <strong>Security Status</strong>
                          <p>Normal - No high-risk alerts</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="actions">
          <button className="btn btn-secondary" onClick={() => navigate('/scan')}>
            <ArrowLeft className="btn-icon" />
            Back to Scanner
          </button>
        </div>
      </div>

      <style jsx>{`
        .result-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 2rem;
        }

        .result-card {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          backdrop-filter: blur(10px);
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .result-card.status-verified {
          border-color: #28a745;
          background: rgba(40, 167, 69, 0.1);
        }

        .result-card.status-error {
          border-color: #dc3545;
          background: rgba(220, 53, 69, 0.1);
        }

        .result-card.status-blocked {
          border-color: #ffc107;
          background: rgba(255, 193, 7, 0.1);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid var(--primary-green);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .status-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1rem;
          color: var(--primary-green);
        }

        .result-card.status-error .status-icon {
          color: #dc3545;
        }

        .result-card.status-blocked .status-icon {
          color: #ffc107;
        }

        .status-title {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .status-message {
          font-size: 1.1rem;
          margin-bottom: 2rem;
          color: var(--text-secondary);
        }

        .location-info,
        .medicine-info {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
          text-align: left;
        }

        .location-info h4,
        .medicine-info h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          color: var(--primary-green);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .info-label {
          font-weight: 500;
          color: var(--text-secondary);
        }

        .info-value {
          color: var(--text-primary);
        }

        .alerts {
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid #ffc107;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
          text-align: left;
        }

        .alert-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .alert-item.high {
          border-left: 4px solid #dc3545;
          padding-left: 0.5rem;
        }

        .alert-item.medium {
          border-left: 4px solid #ffc107;
          padding-left: 0.5rem;
        }

        .alert-icon {
          color: #ffc107;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .analytics-section {
          margin-top: 1rem;
        }

        .toggle-details {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .analytics-details {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          padding: 1rem;
          text-align: left;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .analytics-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .analytics-icon {
          color: var(--primary-green);
        }

        .actions {
          display: flex;
          justify-content: center;
          margin-top: 2rem;
        }

        .icon {
          width: 16px;
          height: 16px;
        }
      `}</style>
    </div>
  )
}

export default VerificationResult
