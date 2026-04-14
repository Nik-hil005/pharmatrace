import { useState } from 'react'
import { Download, QrCode, Copy, CheckCircle } from 'lucide-react'

function QRDisplay({ qrData, title, description, onDownload, onCopy }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (qrData) {
      try {
        // Copy a user-friendly message instead of the base64 data
        const copyText = `QR Code Generated\nType: ${title}\nDescription: ${description || 'No description available'}\nGenerated: ${new Date().toLocaleString()}`
        await navigator.clipboard.writeText(copyText)
        setCopied(true)
        onCopy?.()
        
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy:', error)
      }
    }
  }

  const handleDownload = () => {
    if (qrData) {
      onDownload?.(qrData)
    }
  }

  return (
    <div className="qr-display">
      <div className="qr-header">
        <h2>{title}</h2>
        {description && <p className="qr-description">{description}</p>}
      </div>

      <div className="qr-content">
        <div className="qr-code-container">
          {qrData ? (
            <>
              <img 
                src={qrData} 
                alt="Generated QR Code"
                className="qr-code-image"
              />
              
              <div className="qr-overlay">
                <div className="qr-info">
                  <p><strong>Status:</strong> QR Code Generated Successfully</p>
                  <p><strong>Type:</strong> {title}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="qr-placeholder">
              <QrCode className="qr-placeholder-icon" />
              <p>QR Code will be generated here</p>
            </div>
          )}
        </div>

        <div className="qr-actions">
          {qrData && (
            <>
              <button 
                className="btn btn-secondary"
                onClick={handleCopy}
                disabled={copied}
              >
                {copied ? (
                  <>
                    <CheckCircle className="btn-icon" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="btn-icon" />
                    Copy Info
                  </>
                )}
              </button>
              
              <button 
                className="btn btn-primary"
                onClick={handleDownload}
              >
                <Download className="btn-icon" />
                Download QR
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .qr-display {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          backdrop-filter: blur(10px);
          max-width: 500px;
          margin: 0 auto;
        }

        .qr-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .qr-header h2 {
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .qr-description {
          color: var(--text-secondary);
          font-size: 1rem;
          line-height: 1.5;
        }

        .qr-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .qr-code-container {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          background: white;
          border-radius: 0.5rem;
          padding: 1rem;
        }

        .qr-code-image {
          width: 256px;
          height: 256px;
          border-radius: 0.25rem;
        }

        .qr-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.5rem;
        }

        .qr-info {
          background: rgba(255, 255, 255, 0.95);
          padding: 0.75rem 1rem;
          border-radius: 0.25rem;
          max-width: 200px;
        }

        .qr-info code {
          font-family: monospace;
          font-size: 0.875rem;
          color: var(--primary-green);
          word-break: break-all;
          line-height: 1.4;
        }

        .qr-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .qr-placeholder {
          text-align: center;
          color: var(--text-secondary);
        }

        .qr-placeholder-icon {
          width: 4rem;
          height: 4rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
          .qr-display {
            padding: 1.5rem;
          }

          .qr-code-image {
            width: 200px;
            height: 200px;
          }
        }
      `}</style>
    </div>
  )
}

export default QRDisplay
