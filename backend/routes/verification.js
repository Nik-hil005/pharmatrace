const express = require('express');
const router = express.Router();
const pool = require('../db');

async function ensureActivationSchema() {
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_vendor_id INTEGER REFERENCES users(id)`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activation_status VARCHAR(50) DEFAULT 'inactive'`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activated_by INTEGER REFERENCES users(id)`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activation_location TEXT`);
    await pool.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'inactive'`);
    await pool.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`);
    await pool.query(
        `ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS master_batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE`
    );
}

// Verify medicine by token
router.post('/verify', async (req, res) => {
    const { token } = req.body;
    const vendorUserId = req.body.vendor_user_id || null;
    const clientInfo = {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        gps_lat: req.body.gps_lat,
        gps_lng: req.body.gps_lng,
        device_info: req.body.device_info
    };

    try {
        await ensureActivationSchema();

        let parsedQrPayload = null;
        try {
            parsedQrPayload = JSON.parse(token);
        } catch (_error) {
            parsedQrPayload = null;
        }

        // Master QR activation flow (legacy /api/verify path — prefer POST /api/qr/scan/master).
        if (parsedQrPayload && parsedQrPayload.batch_id != null && parsedQrPayload.group_id == null) {
            if (!vendorUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'vendor_user_id is required to activate a batch'
                });
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const userResult = await client.query(
                    `SELECT id, role, is_active
                     FROM users
                     WHERE id = $1`,
                    [vendorUserId]
                );

                if (
                    userResult.rows.length === 0 ||
                    String(userResult.rows[0].role).toLowerCase() !== 'vendor' ||
                    !userResult.rows[0].is_active
                ) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        success: false,
                        error: 'You are not authorized to activate batches'
                    });
                }

                const batchResult = await client.query(
                    `SELECT id, batch_number, medicine_name, assigned_vendor_id, activation_status
                     FROM batches
                     WHERE id = $1
                     FOR UPDATE`,
                    [parsedQrPayload.batch_id]
                );

                if (batchResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({
                        success: false,
                        error: 'Batch not found'
                    });
                }

                const batch = batchResult.rows[0];
                if (!batch.assigned_vendor_id || Number(batch.assigned_vendor_id) !== Number(vendorUserId)) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        success: false,
                        error: 'You are not the assigned vendor for this batch'
                    });
                }

                const statusNorm = String(batch.activation_status || 'inactive').toLowerCase();
                if (statusNorm === 'active') {
                    await client.query('COMMIT');
                    return res.status(200).json({
                        success: true,
                        status: 'ACTIVATED',
                        message: 'Batch is already active',
                        already_active: true,
                        batch: {
                            id: batch.id,
                            batch_number: batch.batch_number,
                            medicine_name: batch.medicine_name
                        }
                    });
                }

                await client.query(
                    `UPDATE batches
                     SET activation_status = 'active',
                         activated_at = CURRENT_TIMESTAMP,
                         activated_by = $1
                     WHERE id = $2`,
                    [vendorUserId, batch.id]
                );

                await client.query(
                    `UPDATE batch_groups
                     SET status = 'active',
                         activated_at = CURRENT_TIMESTAMP
                     WHERE batch_id = $1`,
                    [batch.id]
                );

                await client.query('COMMIT');
                return res.json({
                    success: true,
                    status: 'ACTIVATED',
                    message: 'Batch activated successfully. All group QRs are now live.',
                    batch: {
                        id: batch.id,
                        batch_number: batch.batch_number,
                        medicine_name: batch.medicine_name
                    }
                });
            } catch (masterErr) {
                try {
                    await client.query('ROLLBACK');
                } catch (_e) {
                    /* ignore */
                }
                throw masterErr;
            } finally {
                client.release();
            }
        }

        // Group QR verification flow.
        if (parsedQrPayload && parsedQrPayload.batch_id && parsedQrPayload.group_id) {
            const groupResult = await pool.query(
                `SELECT
                    bg.id,
                    bg.group_number,
                    bg.unit_start,
                    bg.unit_end,
                    bg.status as group_status,
                    b.id as batch_id,
                    b.batch_number,
                    b.medicine_name,
                    b.total_units,
                    b.activation_status,
                    b.created_at,
                    m.name as manufacturer_name,
                    CONCAT(COALESCE(vu.first_name, ''), CASE WHEN vu.first_name IS NOT NULL AND vu.last_name IS NOT NULL THEN ' ' ELSE '' END, COALESCE(vu.last_name, '')) as vendor_name
                 FROM batch_groups bg
                 JOIN batches b ON bg.batch_id = b.id
                 LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
                 LEFT JOIN users vu ON b.assigned_vendor_id = vu.id
                 WHERE bg.id = $1 AND bg.batch_id = $2`,
                [parsedQrPayload.group_id, parsedQrPayload.batch_id]
            );

            if (groupResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Group QR not found'
                });
            }

            const group = groupResult.rows[0];
            const groupActive = String(group.group_status || 'inactive').toLowerCase() === 'active';
            const batchActive = String(group.activation_status || 'inactive').toLowerCase() === 'active';
            if (!groupActive || !batchActive) {
                return res.status(403).json({
                    success: false,
                    error: 'This medicine has not been activated in the supply chain yet. Do not consume.'
                });
            }

            return res.json({
                success: true,
                status: 'VERIFIED',
                message: 'Group QR verified successfully',
                medicine: {
                    name: group.medicine_name,
                    batch_number: group.batch_number,
                    manufacturer: group.manufacturer_name,
                    vendor: (group.vendor_name || '').trim() || 'N/A',
                    total_units: group.total_units,
                    group_number: group.group_number,
                    unit_range: `${group.unit_start}-${group.unit_end}`,
                    activation_status: group.activation_status,
                    created_at: group.created_at
                }
            });
        }

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
            await pool.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Medicine token not found'
            });
        }

        const unit = unitResult.rows[0];
        const scanResult = 'VERIFIED';

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

module.exports = router;
