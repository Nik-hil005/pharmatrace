import { useState, useRef, useEffect } from 'react'
import { Camera, CameraOff, AlertCircle, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import QrScanner from 'qr-scanner'

function QRScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [scanResult, setScanResult] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const videoRef = useRef(null)
  const qrScannerRef = useRef(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy()
      }
    }
  }, [])

  const startScanning = async () => {
    try {
      setError('')
      setScanResult('')
      
      if (!videoRef.current) {
        throw new Error('Video element not found')
      }

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => handleScanSuccess(result),
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      )

      qrScannerRef.current = qrScanner
      await qrScanner.start()
      setIsScanning(true)
    } catch (err) {
      setError('Unable to access camera. Please ensure camera permissions are granted.')
      console.error('Camera access error:', err)
    }
  }

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }
    setIsScanning(false)
  }

  const handleScanSuccess = async (result) => {
    if (isProcessing) return
    
    setIsProcessing(true)
    const token = result.data
    
    try {
      // Clean the token - remove any URL parameters or prefixes
      const cleanToken = token.includes('token=') 
        ? token.split('token=')[1].split('&')[0]
        : token.replace(/^(https?:\/\/[^/]+\/verify\?token=)/, '')
      
      setScanResult(cleanToken)
      
      const response = await fetch('http://localhost:5000/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: cleanToken,
          gps_lat: null, // Could be obtained from browser geolocation
          gps_lng: null,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            timestamp: new Date().toISOString()
          }
        }),
      })

      const verificationResult = await response.json()
      
      // Stop scanning and navigate to result
      stopScanning()
      navigate('/result', { state: { verificationResult } })
      
    } catch (err) {
      setError('Failed to verify medicine. Please try again.')
      console.error('Verification error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      setError('')
      setScanResult('')
      setIsProcessing(true)

      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      await handleScanSuccess(result)
    } catch (err) {
      setError('No QR code found in the image. Please try another image.')
      console.error('File scan error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualInput = async () => {
    const token = prompt('Enter medicine token manually:')
    if (!token) return

    try {
      setError('')
      setScanResult(token)
      setIsProcessing(true)

      const response = await fetch('http://localhost:5000/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const verificationResult = await response.json()
      navigate('/result', { state: { verificationResult } })
      
    } catch (err) {
      setError('Failed to verify medicine. Please check the token and try again.')
      console.error('Manual verification error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <h1 className="scanner-title">QR Code Scanner</h1>
        <p className="scanner-subtitle">
          Scan the QR code on the medicine package to verify authenticity
        </p>
      </div>

      <div className="qr-scanner">
        <div className="scanner-video">
          {isScanning ? (
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="scanner-placeholder">
              <Camera className="placeholder-icon" />
              <p>Camera preview will appear here</p>
            </div>
          )}
        </div>

        {scanResult && !isScanning && (
          <div className="scan-result-preview">
            <p><strong>Last Scanned:</strong></p>
            <code>{scanResult}</code>
          </div>
        )}

        {error && (
          <div className="error-message">
            <AlertCircle className="error-icon" />
            <span>{error}</span>
          </div>
        )}

        {isProcessing && (
          <div className="processing-message">
            <div className="loading"></div>
            <span>Verifying medicine...</span>
          </div>
        )}

        <div className="scanner-controls">
          {!isScanning ? (
            <>
              <button className="btn btn-primary" onClick={startScanning} disabled={!!isProcessing}>
                <Camera className="btn-icon" />
                Start Camera
              </button>
              <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={!!isProcessing}>
                <Upload className="btn-icon" />
                Upload Image
              </button>
              <button className="btn btn-secondary" onClick={handleManualInput} disabled={!!isProcessing}>
                Manual Entry
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={stopScanning}>
              <CameraOff className="btn-icon" />
              Stop Camera
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        <div className="scanner-instructions">
          <h3>Scanning Options:</h3>
          <ul>
            <li><strong>Camera Scan:</strong> Point camera at QR code for automatic detection</li>
            <li><strong>Image Upload:</strong> Upload a screenshot or photo of QR code</li>
            <li><strong>Manual Entry:</strong> Enter the token code manually</li>
          </ul>
          <h3>Tips:</h3>
          <ul>
            <li>Ensure good lighting for better camera scanning</li>
            <li>Hold steady until the code is detected</li>
            <li>For testing, use: TOKEN-00000001-a1b2c3d4</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .scanner-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
        }

        .placeholder-icon {
          width: 3rem;
          height: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .scan-result-preview {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
          text-align: left;
        }

        .scan-result-preview code {
          display: block;
          background: rgba(6, 78, 59, 0.5);
          padding: 0.5rem;
          border-radius: 0.25rem;
          color: var(--accent-green);
          font-family: monospace;
          word-break: break-all;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--error);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
          color: var(--error);
        }

        .processing-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid var(--primary-green);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
          color: var(--primary-green);
        }

        .error-icon {
          width: 1.25rem;
          height: 1.25rem;
        }

        .scanner-instructions {
          margin-top: 2rem;
          padding: 1.5rem;
          background: rgba(6, 78, 59, 0.3);
          border-radius: 0.5rem;
        }

        .scanner-instructions h3 {
          color: var(--accent-green);
          margin-bottom: 1rem;
          margin-top: 1.5rem;
        }

        .scanner-instructions h3:first-child {
          margin-top: 0;
        }

        .scanner-instructions ul {
          list-style: none;
          color: var(--text-secondary);
        }

        .scanner-instructions li {
          padding: 0.5rem 0;
          padding-left: 1.5rem;
          position: relative;
        }

        .scanner-instructions li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--primary-green);
        }

        .scanner-instructions strong {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}

export default QRScanner
