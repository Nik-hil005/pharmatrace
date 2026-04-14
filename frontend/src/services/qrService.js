import QRCode from 'qrcode'

// Generate QR code with minimal medicine information
export const generateMedicineQR = (token, medicineInfo = {}) => {
  const qrData = {
    token: token,
    timestamp: new Date().toISOString(),
    // Only include essential information
    name: medicineInfo.name || 'Unknown Medicine',
    batch: medicineInfo.batch || 'Unknown Batch',
    manufacturer: medicineInfo.manufacturer || 'Unknown Manufacturer',
    expiryDate: medicineInfo.expiryDate || null,
    version: '1.0'
  }

  const qrString = JSON.stringify(qrData)
  
  try {
    return QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'H',
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#2F8D46',
        light: '#FFFFFF'
      }
    })
  } catch (error) {
    console.error('QR Code generation error:', error)
    throw new Error('Failed to generate QR code')
  }
}

// Generate master QR code for batch activation
export const generateMasterQR = (batchId, batchNumber) => {
  const masterData = {
    type: 'MASTER_QR',
    batchId: batchId,
    batchNumber: batchNumber,
    timestamp: new Date().toISOString(),
    action: 'ACTIVATE_BATCH',
    version: '1.0'
  }

  const qrString = JSON.stringify(masterData)
  
  try {
    return QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'H',
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#2F8D46',
        light: '#FFFFFF'
      },
      width: 256
    })
  } catch (error) {
    console.error('Master QR Code generation error:', error)
    throw new Error('Failed to generate master QR code')
  }
}

// Parse QR code data to extract token
export const parseQRData = (qrString) => {
  try {
    const data = JSON.parse(qrString)
    return data
  } catch (error) {
    console.error('QR parsing error:', error)
    return null
  }
}

// Validate QR code format
export const validateMedicineQR = (data) => {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid QR code format' }
  }

  // Check for required fields
  if (!data.token) {
    return { valid: false, error: 'Missing token in QR code' }
  }

  // Check if it's a master QR
  if (data.type === 'MASTER_QR') {
    if (!data.batchId || !data.action) {
      return { valid: false, error: 'Invalid master QR code format' }
    }
    return { valid: true, type: 'master', data }
  }

  // Regular medicine QR validation
  if (!data.name && !data.batch) {
    return { valid: false, error: 'Missing medicine information in QR code' }
  }

  return { valid: true, type: 'medicine', data }
}
