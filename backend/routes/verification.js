const express = require('express');
const router = express.Router();
const pool = require('../db');

// Verify medicine by token
router.post('/verify', async (req, res) => {
    const { token } = req.body;
    const clientInfo = {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        gps_lat: req.body.gps_lat,
        gps_lng: req.body.gps_lng,
        device_info: req.body.device_info
    };

    try {
        // Start transaction
        await pool.query('BEGIN');

        // Check if token exists and get unit info
        const unitQuery = `
            SELECT u.*, b.medicine_name, b.batch_number, b.expiry_date, 
                   m.name as manufacturer_name, v.name as vendor_name
            FROM units u
            JOIN batches b ON u.batch_id = b.id
            LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
            LEFT JOIN vendors v ON b.vendor_id = v.id
            WHERE u.token = $1
        `;
        const unitResult = await pool.query(unitQuery, [token]);

        if (unitResult.rows.length === 0) {
            // Log the fake scan
            await logScan(null, token, 'FAKE', clientInfo);
            await pool.query('COMMIT');
            
            return res.json({
                success: true,
                status: 'FAKE',
                message: 'Invalid token - medicine not found in system'
            });
        }

        const unit = unitResult.rows[0];
        let scanResult = 'VERIFIED';
        let alerts = [];

        // Check for anomalies
        const anomalies = await detectScanAnomalies(unit, clientInfo);
        
        if (anomalies.length > 0) {
            scanResult = 'SUSPICIOUS';
            alerts = anomalies;
        }

        // Update unit scan count and first scanned time
        const updateUnitQuery = `
            UPDATE units 
            SET scan_count = scan_count + 1,
                first_scanned_at = COALESCE(first_scanned_at, CURRENT_TIMESTAMP)
            WHERE id = $1
        `;
        await pool.query(updateUnitQuery, [unit.id]);

        // Log the scan
        const scanRecord = await logScan(unit.id, token, scanResult, clientInfo);

        // Create alerts if any anomalies detected
        for (const alert of alerts) {
            await createAlert(scanRecord.id, unit.id, alert.type, alert.description, alert.severity);
        }

        // Commit transaction
        await pool.query('COMMIT');

        res.json({
            success: true,
            status: scanResult,
            medicine: {
                name: unit.medicine_name,
                batch_number: unit.batch_number,
                manufacturer: unit.manufacturer_name,
                vendor: unit.vendor_name,
                expiry_date: unit.expiry_date,
                scan_count: parseInt(unit.scan_count) + 1
            },
            alerts: alerts,
            scan_time: scanRecord.scan_time
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error verifying medicine:', error);
        res.status(500).json({
            success: false,
            error: 'Verification failed'
        });
    }
});

// Detect scan anomalies
async function detectScanAnomalies(unit, clientInfo) {
    const anomalies = [];

    // Check if unit is activated
    if (unit.status !== 'ACTIVATED') {
        anomalies.push({
            type: 'PRE_ACTIVATION_SCAN',
            description: 'Unit scanned before batch activation',
            severity: 'HIGH'
        });
    }

    // Check for excessive scans (more than 5 scans might be suspicious)
    if (unit.scan_count >= 5) {
        anomalies.push({
            type: 'EXCESSIVE_SCANS',
            description: `Unit scanned ${unit.scan_count + 1} times`,
            severity: 'MEDIUM'
        });
    }

    // Check for expired medicine
    if (unit.expiry_date && new Date(unit.expiry_date) < new Date()) {
        anomalies.push({
            type: 'EXPIRED_MEDICINE',
            description: 'Medicine has expired',
            severity: 'HIGH'
        });
    }

    // Check for location anomalies if GPS data available
    if (clientInfo.gps_lat && clientInfo.gps_lng) {
        const recentScansQuery = `
            SELECT gps_lat, gps_lng, scan_time
            FROM scans 
            WHERE unit_id = $1 
            AND gps_lat IS NOT NULL 
            AND gps_lng IS NOT NULL
            AND scan_time > NOW() - INTERVAL '24 hours'
            ORDER BY scan_time DESC
            LIMIT 1
        `;
        const recentScans = await pool.query(recentScansQuery, [unit.id]);

        if (recentScans.rows.length > 0) {
            const lastScan = recentScans.rows[0];
            const distance = calculateDistance(
                clientInfo.gps_lat, clientInfo.gps_lng,
                lastScan.gps_lat, lastScan.gps_lng
            );

            // If scans are more than 100km apart within 24 hours, it's suspicious
            if (distance > 100) {
                anomalies.push({
                    type: 'LOCATION_ANOMALY',
                    description: `Unit scanned ${Math.round(distance)}km from previous location within 24 hours`,
                    severity: 'HIGH'
                });
            }
        }
    }

    return anomalies;
}

// Calculate distance between two GPS coordinates (in kilometers)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Log scan to database
async function logScan(unitId, token, result, clientInfo) {
    const query = `
        INSERT INTO scans (unit_id, token, ip_address, user_agent, gps_lat, gps_lng, device_info, scan_result)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `;
    const values = [
        unitId, token, clientInfo.ip_address, clientInfo.user_agent,
        clientInfo.gps_lat, clientInfo.gps_lng, 
        JSON.stringify(clientInfo.device_info), result
    ];
    
    const result2 = await pool.query(query, values);
    return result2.rows[0];
}

// Create alert in database
async function createAlert(scanId, unitId, alertType, description, severity) {
    const query = `
        INSERT INTO scan_alerts (scan_id, unit_id, alert_type, description, severity)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    const values = [scanId, unitId, alertType, description, severity];
    
    await pool.query(query, values);
}

// Get scan history for a unit
router.get('/units/:token/scans', async (req, res) => {
    const { token } = req.params;

    try {
        const query = `
            SELECT s.*, u.status as unit_status
            FROM scans s
            LEFT JOIN units u ON s.unit_id = u.id
            WHERE s.token = $1
            ORDER BY s.scan_time DESC
        `;
        const result = await pool.query(query, [token]);

        res.json({
            success: true,
            scans: result.rows
        });

    } catch (error) {
        console.error('Error getting scan history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve scan history'
        });
    }
});

// Get alerts for a unit
router.get('/units/:token/alerts', async (req, res) => {
    const { token } = req.params;

    try {
        const query = `
            SELECT sa.*, s.scan_time
            FROM scan_alerts sa
            JOIN scans s ON sa.scan_id = s.id
            WHERE sa.unit_id = (SELECT id FROM units WHERE token = $1)
            ORDER BY sa.created_at DESC
        `;
        const result = await pool.query(query, [token]);

        res.json({
            success: true,
            alerts: result.rows
        });

    } catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve alerts'
        });
    }
});

module.exports = router;
