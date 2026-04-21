import { useState, useRef, useEffect, useCallback } from 'react'
import { QrCode, Upload, Camera, CameraOff } from 'lucide-react'
import { validateMedicineQR } from '../services/qrService'
import QrScanner from 'qr-scanner'

function QRReader({ onScanComplete, onScanError, showCamera = true }) {
  const [isScanning, setIsScanning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)
  const qrScannerRef = useRef(null)

  const startCamera = useCallback(async () => {
    try {
      setIsScanning(true)
      
      if (videoRef.current) {
        // Initialize QR Scanner
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          async (result) => {
            setIsProcessing(true)
            try {
              const rawData = result?.data || result
              console.log('Raw QR Data decoded (Reader):', rawData)

              let qrData = null
              try {
                qrData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
              } catch (e) {
                qrData = { token: typeof rawData === 'string' ? rawData.trim() : '' }
              }
              
              // Validate QR data
              const validation = validateMedicineQR(qrData)
              setResult(validation)
              
              if (validation.valid) {
                onScanComplete?.(validation)
              } else {
                onScanError?.(validation.error || 'Invalid QR code')
              }
            } catch (error) {
              console.error('QR processing error:', error)
              onScanError?.('Failed to process QR code')
            } finally {
              setIsProcessing(false)
              // Stop scanning after successful read
              if (qrScannerRef.current) {
                qrScannerRef.current.stop()
              }
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
            maxScansPerSecond: 10
          }
        )
        
        await qrScannerRef.current.start()
      }
    } catch (error) {
      console.error('Camera access error:', error)
      onScanError?.('Camera access denied or not available')
      setIsScanning(false)
    }
  }, [onScanComplete, onScanError])

  const stopCamera = useCallback(() => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current = null
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    setIsScanning(false)
  }, [])

  const scannerInitialised = useRef(false)

  useEffect(() => {
    if (showCamera && videoRef.current) {
      if (!scannerInitialised.current) {
        scannerInitialised.current = true
        startCamera()
      }
    }
    
    return () => {
      if (scannerInitialised.current) {
        scannerInitialised.current = false
        stopCamera()
      }
    }
  }, [showCamera, startCamera, stopCamera])

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setIsProcessing(true)
    
    try {
      // Scan QR code from image file
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true
      })
      
      if (result && result.data) {
        // Validate QR data
        const validation = validateMedicineQR(result.data)
        setResult(validation)
        
        if (validation.valid) {
          onScanComplete?.(validation)
        } else {
          onScanError?.(validation.error || 'Invalid QR code')
        }
      } else {
        onScanError?.('No QR code found in image')
      }
    } catch (error) {
      console.error('File processing error:', error)
      onScanError?.('Failed to scan QR code from image')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualInput = () => {
    const token = prompt('Enter medicine token manually:')
    if (!token) return

    setIsProcessing(true)
    
    try {
      // Try to validate the token
      const validation = validateMedicineQR(token)
      setResult(validation)
      
      if (validation.valid) {
        onScanComplete?.(validation)
      } else {
        // Show empty medicine data if token is not found
        const emptyMedicineData = {
          valid: false,
          error: 'Medicine not found in database',
          token: token,
          medicine: null,
          message: 'This medicine token is not registered in our system'
        }
        setResult(emptyMedicineData)
        onScanError?.('Medicine not found')
      }
    } catch (error) {
      console.error('Manual input error:', error)
      onScanError?.('Invalid token format')
    } finally {
      setIsProcessing(false)
    }
  }

  // Simulate QR code detection from camera (in production, use a real QR scanning library)
  const simulateQRDetection = () => {
    if (!isScanning) return
    
    setTimeout(() => {
      const mockToken = `TOKEN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 9)}`
      const mockData = {
        token: mockToken,
        name: 'Scanned Medicine',
        batch: 'BATCH-SCAN-001',
        manufacturer: 'Camera Scan',
        expiryDate: '2025-12-31'
      }
      
      const validation = validateMedicineQR(mockData)
      setResult(validation)
      
      if (validation.valid) {
        onScanComplete?.(validation)
      } else {
        onScanError?.(validation.error)
      }
    }, 3000)
  }

  return (
    <div className="qr-reader">
      {showCamera && (
        <div className="camera-section">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
          />
          
          <div className="camera-controls">
            {isScanning ? (
              <button className="btn btn-danger" onClick={stopCamera}>
                <CameraOff className="btn-icon" />
                Stop Camera
              </button>
            ) : (
              <button className="btn btn-primary" onClick={startCamera}>
                <Camera className="btn-icon" />
                Start Camera
              </button>
            )}
            
            <button className="btn btn-secondary" onClick={simulateQRDetection}>
              <QrCode className="btn-icon" />
              Simulate Scan
            </button>
          </div>
        </div>
      )}

      <div className="input-section">
        <h3>Alternative Input Methods</h3>
        
        <div className="input-methods">
          <button 
            className="btn btn-secondary btn-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload className="btn-icon" />
            Upload QR Image
          </button>
          
          <button 
            className="btn btn-secondary btn-full"
            onClick={handleManualInput}
            disabled={isProcessing}
          >
            <QrCode className="btn-icon" />
            Manual Token Entry
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {result && (
        <div className="scan-result">
          <h3>Scan Result</h3>
          
          {result.valid ? (
            <div className="result-success">
              <div className="result-info">
                <p><strong>Token:</strong> {result.data.token}</p>
                <p><strong>Medicine:</strong> {result.data.name}</p>
                <p><strong>Batch:</strong> {result.data.batch}</p>
                <p><strong>Manufacturer:</strong> {result.data.manufacturer}</p>
                {result.data.expiryDate && (
                  <p><strong>Expiry:</strong> {result.data.expiryDate}</p>
                )}
              </div>
              
              {result.type === 'master' && (
                <div className="master-qr-info">
                  <div className="badge">MASTER QR</div>
                  <p>This QR code will activate all units in batch {result.data.batchNumber}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="result-error">
              <p><strong>Error:</strong> {result.error}</p>
            </div>
          )}
          
          <div className="result-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setResult(null)}
            >
              Scan Another
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-content">
            <div className="loading"></div>
            <span>Processing QR code...</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .qr-reader {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .camera-section {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          backdrop-filter: blur(10px);
        }

        .camera-video {
          width: 100%;
          height: 300px;
          background: #000;
          border-radius: 0.5rem;
          object-fit: cover;
        }

        .camera-controls {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
          justify-content: center;
        }

        .input-section {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .input-section h3 {
          color: var(--text-primary);
          margin-bottom: 1rem;
          text-align: center;
        }

        .input-methods {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .scan-result {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 1.5rem;
          margin-top: 2rem;
          backdrop-filter: blur(10px);
        }

        .result-success {
          color: var(--text-primary);
        }

        .result-info {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid var(--success);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .result-info p {
          margin-bottom: 0.5rem;
          line-break: break-word;
        }

        .master-qr-info {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid var(--primary-green);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-top: 1rem;
        }

        .badge {
          display: inline-block;
          background: var(--primary-green);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .result-error {
          color: var(--error);
        }

        .result-actions {
          text-align: center;
          margin-top: 1rem;
        }

        .processing-overlay {
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

        .processing-content {
          text-align: center;
          color: var(--text-primary);
        }

        .processing-content span {
          margin-left: 1rem;
        }

        @media (max-width: 768px) {
          .qr-reader {
            padding: 1rem;
          }

          .camera-controls {
            flex-direction: column;
          }

          .input-methods {
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  )
}

export default QRReader
