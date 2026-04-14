// Verification service for QR code scanning with fraud detection and geolocation

class VerificationService {
  constructor() {
    this.scanHistory = new Map() // Store scan history by batch ID
    this.userScanHistory = new Map() // Store user scan history
    this.locationHistory = new Map() // Store location data by batch
    this.fraudDetection = {
      maxScansPerUser: 5, // Max scans per user per hour
      maxScansPerLocation: 20, // Max scans per location per hour
      suspiciousDistanceThreshold: 500, // km - distance that triggers fraud alert
      cooldownPeriod: 3600000 // 1 hour in milliseconds
    }
  }

  // Get user's location (IP-based or geolocation)
  async getUserLocation() {
    try {
      // Try browser geolocation first
      if (navigator.geolocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          })
        })
        
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          method: 'geolocation',
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.log('Geolocation failed, falling back to IP-based location')
    }

    // Fallback to IP-based location
    try {
      const response = await fetch('https://ipapi.co/json/')
      const data = await response.json()
      
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city,
        region: data.region,
        country: data.country,
        ip: data.ip,
        method: 'ip',
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('IP location failed:', error)
      return {
        latitude: null,
        longitude: null,
        method: 'failed',
        timestamp: Date.now()
      }
    }
  }

  // Calculate distance between two coordinates in km
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null
    
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Check for potential fraud based on scan patterns
  detectFraud(batchId, userId, location, scanHistory) {
    const now = Date.now()
    const oneHourAgo = now - this.fraudDetection.cooldownPeriod
    
    const fraudAlerts = []

    // Check 1: Too many scans from same user
    const userScans = this.userScanHistory.get(userId) || []
    const recentUserScans = userScans.filter(scan => scan.timestamp > oneHourAgo)
    
    if (recentUserScans.length >= this.fraudDetection.maxScansPerUser) {
      fraudAlerts.push({
        type: 'EXCESSIVE_USER_SCANS',
        severity: 'HIGH',
        message: `User has scanned ${recentUserScans.length} times in the last hour`,
        recommendation: 'Block user from further scans'
      })
    }

    // Check 2: Too many scans from same location
    const locationKey = `${location.latitude},${location.longitude}`
    const locationScans = this.locationHistory.get(locationKey) || []
    const recentLocationScans = locationScans.filter(scan => scan.timestamp > oneHourAgo)
    
    if (recentLocationScans.length >= this.fraudDetection.maxScansPerLocation) {
      fraudAlerts.push({
        type: 'EXCESSIVE_LOCATION_SCANS',
        severity: 'MEDIUM',
        message: `Location has ${recentLocationScans.length} scans in the last hour`,
        recommendation: 'Monitor location for suspicious activity'
      })
    }

    // Check 3: Suspicious distance between scans
    if (scanHistory.length > 0) {
      const lastScan = scanHistory[scanHistory.length - 1]
      if (lastScan.location && location.latitude && location.longitude) {
        const distance = this.calculateDistance(
          lastScan.location.latitude, 
          lastScan.location.longitude,
          location.latitude, 
          location.longitude
        )
        
        if (distance > this.fraudDetection.suspiciousDistanceThreshold) {
          fraudAlerts.push({
            type: 'SUSPICIOUS_DISTANCE',
            severity: 'HIGH',
            message: `Scan location is ${Math.round(distance)}km from previous scan`,
            recommendation: 'Investigate potential QR code duplication'
          })
        }
      }
    }

    return fraudAlerts
  }

  // Main verification function
  async verifyQRCode(qrData, userId = 'anonymous') {
    try {
      // Parse QR data
      const qrParsed = JSON.parse(qrData)
      
      if (qrParsed.type !== 'UNIT_QR') {
        throw new Error('Invalid QR code type')
      }

      const batchId = qrParsed.batchId
      const batchNumber = qrParsed.batchNumber
      
      // Get current location
      const location = await this.getUserLocation()
      
      // Get scan history for this batch
      const batchScanHistory = this.scanHistory.get(batchId) || []
      
      // Check if batch is activated
      const isActivated = batchScanHistory.some(scan => scan.type === 'MASTER_SCAN')
      
      if (!isActivated) {
        return {
          success: false,
          error: 'Batch not activated. Master QR must be scanned first.',
          requiresMasterScan: true
        }
      }

      // Detect fraud
      const fraudAlerts = this.detectFraud(batchId, userId, location, batchScanHistory)
      
      // Check if we should block the scan due to fraud
      const shouldBlock = fraudAlerts.some(alert => alert.severity === 'HIGH')
      
      if (shouldBlock) {
        return {
          success: false,
          error: 'Scan blocked due to suspicious activity',
          fraudAlerts,
          blocked: true
        }
      }

      // Record the scan
      const scanRecord = {
        timestamp: Date.now(),
        userId,
        location,
        batchId,
        batchNumber,
        medicineName: qrParsed.medicineName,
        type: 'UNIT_SCAN',
        fraudAlerts: fraudAlerts.filter(alert => alert.severity === 'MEDIUM')
      }

      // Update scan histories
      batchScanHistory.push(scanRecord)
      this.scanHistory.set(batchId, batchScanHistory)
      
      // Update user scan history
      const userScans = this.userScanHistory.get(userId) || []
      userScans.push(scanRecord)
      this.userScanHistory.set(userId, userScans)
      
      // Update location history
      if (location.latitude && location.longitude) {
        const locationKey = `${location.latitude},${location.longitude}`
        const locationScans = this.locationHistory.get(locationKey) || []
        locationScans.push(scanRecord)
        this.locationHistory.set(locationKey, locationScans)
      }

      // Calculate verification stats
      const totalScans = batchScanHistory.filter(scan => scan.type === 'UNIT_SCAN').length
      const uniqueLocations = new Set(batchScanHistory.map(scan => 
        scan.location ? `${scan.location.latitude},${scan.location.longitude}` : null
      )).size
      
      return {
        success: true,
        data: {
          batchNumber: qrParsed.batchNumber,
          medicineName: qrParsed.medicineName,
          totalUnits: qrParsed.totalUnits,
          manufacturingDate: qrParsed.manufacturingDate,
          expiryDate: qrParsed.expiryDate,
          scanCount: totalScans,
          uniqueLocations,
          lastScanLocation: location
        },
        fraudAlerts: fraudAlerts.filter(alert => alert.severity === 'MEDIUM'),
        location
      }

    } catch (error) {
      return {
        success: false,
        error: 'Invalid QR code format',
        details: error.message
      }
    }
  }

  // Record master QR scan
  recordMasterScan(batchId, vendorId, location) {
    const scanRecord = {
      timestamp: Date.now(),
      userId: vendorId,
      location,
      batchId,
      type: 'MASTER_SCAN'
    }

    const batchScanHistory = this.scanHistory.get(batchId) || []
    batchScanHistory.push(scanRecord)
    this.scanHistory.set(batchId, batchScanHistory)
    
    return { success: true, message: 'Master QR scan recorded successfully' }
  }

  // Get batch analytics
  getBatchAnalytics(batchId) {
    const scanHistory = this.scanHistory.get(batchId) || []
    const unitScans = scanHistory.filter(scan => scan.type === 'UNIT_SCAN')
    
    const locationStats = {}
    const timeStats = {
      today: 0,
      thisWeek: 0,
      thisMonth: 0
    }
    
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    const oneWeek = 7 * oneDay
    const oneMonth = 30 * oneDay
    
    unitScans.forEach(scan => {
      // Location stats
      if (scan.location) {
        const locationKey = scan.location.city || `${scan.location.latitude},${scan.location.longitude}`
        locationStats[locationKey] = (locationStats[locationKey] || 0) + 1
      }
      
      // Time stats
      const timeDiff = now - scan.timestamp
      if (timeDiff < oneDay) timeStats.today++
      if (timeDiff < oneWeek) timeStats.thisWeek++
      if (timeDiff < oneMonth) timeStats.thisMonth++
    })
    
    return {
      totalScans: unitScans.length,
      uniqueLocations: Object.keys(locationStats).length,
      locationBreakdown: locationStats,
      timeStats,
      lastScan: unitScans[unitScans.length - 1] || null
    }
  }
}

export default VerificationService
