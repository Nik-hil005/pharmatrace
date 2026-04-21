import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, CameraOff, AlertCircle, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import QrScanner from 'qr-scanner'

/**
 * Camera: navigator.mediaDevices.getUserMedia requires a secure context
 * (https:// or http://localhost). Over plain HTTP on a LAN IP, the camera may be blocked.
 */
function cameraErrorMessage(err) {
  const name = err && (err.name || err.constructor?.name)
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access in your browser settings and reload this page.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use by another app or could not be started.'
  }
  if (name === 'OverconstrainedError') {
    return 'The camera does not support the required settings. Try another device.'
  }
  if (name === 'SecurityError') {
    return 'Camera blocked: open this app over HTTPS or http://localhost.'
  }
  return err?.message || 'Unable to access the camera. Check permissions and try again.'
}

function stopVideoTracks(videoEl) {
  const stream = videoEl?.srcObject
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((t) => t.stop())
  }
  if (videoEl) {
    videoEl.srcObject = null
  }
}

function destroyScannerInstance(scanner) {
  if (!scanner) return
  try {
    scanner.stop()
    scanner.destroy()
  } catch {
    /* ignore */
  }
}

function QRScanner() {
  const [cameraState, setCameraState] = useState('starting') // 'starting' | 'active' | 'stopped' | 'error'
  const [error, setError] = useState('')
  const [scanResult, setScanResult] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const videoRef = useRef(null)
  const qrScannerRef = useRef(null)
  const fileInputRef = useRef(null)
  const isProcessingRef = useRef(false)
  const handleScanSuccessRef = useRef(null)
  const isMountedRef = useRef(true)
  const navigate = useNavigate()

  const getConsumerScanPosition = (timeoutMs = 8000) =>
    new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null)
        return
      }
      const timer = setTimeout(() => resolve(null), timeoutMs)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer)
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          })
        },
        () => {
          clearTimeout(timer)
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 }
      )
    })

  const deviceInfo = () => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    timestamp: new Date().toISOString()
  })

  const teardownCamera = useCallback(() => {
    destroyScannerInstance(qrScannerRef.current)
    qrScannerRef.current = null
    stopVideoTracks(videoRef.current)
  }, [])

  const stopCamera = useCallback(() => {
    teardownCamera()
    setCameraState('stopped')
  }, [teardownCamera])

  const handleScanSuccess = useCallback(
    async (result) => {
      console.log('Raw QR decode result:', result)

      if (isProcessingRef.current) return

      isProcessingRef.current = true
      setIsProcessing(true)

      // result.data exists if returnDetailedScanResult: true was passed, else result itself is the string
      const rawToken = result?.data || result
      console.log('Extracted raw token:', rawToken)

      try {
        // Fallback checks just in case the token evaluates to an object
        const tokenString = typeof rawToken === 'string' ? rawToken : JSON.stringify(rawToken)

        const cleanToken = tokenString.includes('token=')
          ? tokenString.split('token=')[1].split('&')[0]
          : tokenString.replace(/^(https?:\/\/[^/]+\/verify\?token=)/, '')

        setScanResult(cleanToken)

        let parsedQr = null
        try {
          parsedQr = JSON.parse(cleanToken)
        } catch {
          parsedQr = null
        }

        const isGroupUnitQr =
          parsedQr &&
          typeof parsedQr === 'object' &&
          parsedQr.batch_id != null &&
          parsedQr.group_id != null

        const geo = isGroupUnitQr ? await getConsumerScanPosition() : null
        const unitScanBody = {
          qr_data: parsedQr,
          device_info: deviceInfo(),
          ...(geo ? { latitude: geo.latitude, longitude: geo.longitude } : {})
        }

        const response = isGroupUnitQr
          ? await fetch('/api/qr/scan/unit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(unitScanBody)
            })
          : await fetch('/api/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: cleanToken,
                gps_lat: null,
                gps_lng: null,
                device_info: deviceInfo()
              })
            })

        const verificationResult = await response.json()

        stopCamera()
        navigate('/result', { state: { verificationResult } })
      } catch (err) {
        setError('Failed to verify medicine. Please try again.')
        console.error('Verification error:', err)
      } finally {
        isProcessingRef.current = false
        setIsProcessing(false)
      }
    },
    [navigate, stopCamera]
  )

  handleScanSuccessRef.current = handleScanSuccess

  const startCamera = useCallback(async () => {
    if (isMountedRef.current) {
      setError('')
      setScanResult('')
    }

    const videoEl = videoRef.current
    if (!videoEl) {
      if (isMountedRef.current) {
        setError('Camera preview is not ready yet.')
        setCameraState('error')
      }
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      if (isMountedRef.current) {
        setError(
          'This browser does not support camera access, or the page is not in a secure context (use HTTPS or localhost).'
        )
        setCameraState('error')
      }
      return
    }

    teardownCamera()
    if (isMountedRef.current) setCameraState('starting')

    try {
      const scanner = new QrScanner(
        videoEl,
        (res) => {
          handleScanSuccessRef.current?.(res)
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
          maxScansPerSecond: 10
        }
      )

      qrScannerRef.current = scanner
      await scanner.start()

      // Ensure playback (some browsers need explicit play() even with autoPlay)
      try {
        await videoEl.play()
      } catch {
        /* play() can reject if interrupted; stream may still show */
      }

      if (isMountedRef.current) setCameraState('active')
    } catch (err) {
      console.error('Camera access error:', err)
      if (isMountedRef.current) {
        setError(cameraErrorMessage(err))
        setCameraState('error')
      }
      destroyScannerInstance(qrScannerRef.current)
      qrScannerRef.current = null
      stopVideoTracks(videoEl)
    }
  }, [teardownCamera])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Ref to track if scanner has been started to avoid StrictMode double-mount conflicts
  const scannerInitialised = useRef(false)

  // Auto-start camera on mount; stop all tracks on unmount (React Strict Mode runs this twice in dev).
  useEffect(() => {
    let cancelled = false

    if (scannerInitialised.current) return
    scannerInitialised.current = true

    ;(async () => {
      await startCamera()
      if (cancelled) {
        destroyScannerInstance(qrScannerRef.current)
        qrScannerRef.current = null
        stopVideoTracks(videoRef.current)
      }
    })()

    return () => {
      cancelled = true
      scannerInitialised.current = false
      destroyScannerInstance(qrScannerRef.current)
      qrScannerRef.current = null
      stopVideoTracks(videoRef.current)
    }
  }, [startCamera])

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      setError('')
      setScanResult('')
      setIsProcessing(true)
      isProcessingRef.current = true

      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      await handleScanSuccess(result)
    } catch (err) {
      setError('No QR code found in the image. Please try another image.')
      console.error('File scan error:', err)
    } finally {
      isProcessingRef.current = false
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
      isProcessingRef.current = true

      let parsedQr = null
      try {
        parsedQr = JSON.parse(token.trim())
      } catch {
        parsedQr = null
      }
      const isGroupUnitQr =
        parsedQr &&
        typeof parsedQr === 'object' &&
        parsedQr.batch_id != null &&
        parsedQr.group_id != null

      const geo = isGroupUnitQr ? await getConsumerScanPosition() : null
      const unitScanBody = {
        qr_data: parsedQr,
        device_info: deviceInfo(),
        ...(geo ? { latitude: geo.latitude, longitude: geo.longitude } : {})
      }

      const response = isGroupUnitQr
        ? await fetch('/api/qr/scan/unit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(unitScanBody)
          })
        : await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          })

      const verificationResult = await response.json()
      navigate('/result', { state: { verificationResult } })
    } catch (err) {
      setError('Failed to verify medicine. Please check the token and try again.')
      console.error('Manual verification error:', err)
    } finally {
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }

  const showPlaceholderOverlay = cameraState !== 'active'

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
          {/*
            Keep the video in the layout at all times with autoPlay/playsInline/muted.
            Do not toggle display:none — that prevents the live preview from rendering in several browsers.
          */}
          <video
            ref={videoRef}
            className="scanner-video-element"
            autoPlay
            playsInline
            muted
          />
          {showPlaceholderOverlay && (
            <div className="scanner-placeholder-overlay" aria-hidden={cameraState === 'active'}>
              <Camera className="placeholder-icon" />
              {cameraState === 'starting' && <p>Starting camera…</p>}
              {cameraState === 'stopped' && <p>Camera stopped. Press &quot;Start camera&quot; to resume.</p>}
              {cameraState === 'error' && <p>Camera unavailable. Use upload or manual entry, or try again.</p>}
            </div>
          )}
        </div>

        {scanResult && cameraState === 'stopped' && (
          <div className="scan-result-preview">
            <p>
              <strong>Last Scanned:</strong>
            </p>
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
          {cameraState !== 'active' ? (
            <>
              <button
                className="btn btn-primary"
                onClick={() => startCamera()}
                disabled={!!isProcessing}
              >
                <Camera className="btn-icon" />
                {cameraState === 'error' ? 'Retry camera' : 'Start camera'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!isProcessing}
              >
                <Upload className="btn-icon" />
                Upload Image
              </button>
              <button className="btn btn-secondary" onClick={handleManualInput} disabled={!!isProcessing}>
                Manual Entry
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={stopCamera} disabled={!!isProcessing}>
              <CameraOff className="btn-icon" />
              Stop camera
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
            <li>
              <strong>Camera Scan:</strong> Point camera at QR code for automatic detection
            </li>
            <li>
              <strong>Image Upload:</strong> Upload a screenshot or photo of QR code
            </li>
            <li>
              <strong>Manual Entry:</strong> Enter the token code manually
            </li>
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
