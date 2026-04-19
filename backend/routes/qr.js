const express = require('express');
const router = express.Router();
const pool = require('../db');
const {
    reverseGeocodeToCity,
    forwardGeocodeCityCached,
    haversineDistanceKm
} = require('../services/nominatimGeocode');

async function ensureQrChainSchema() {
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activation_location TEXT`);
    await pool.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS master_batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_lat DOUBLE PRECISION`);
    await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_lon DOUBLE PRECISION`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS scan_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            group_id INTEGER REFERENCES batch_groups(id) ON DELETE SET NULL,
            batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
            scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            result VARCHAR(50) NOT NULL,
            user_agent TEXT,
            device_info JSONB,
            ip_address INET,
            raw_payload JSONB
        )
    `);
    await pool.query(`ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS scanned_latitude DOUBLE PRECISION`);
    await pool.query(`ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS scanned_longitude DOUBLE PRECISION`);
    await pool.query(`ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS scanned_city VARCHAR(255)`);
    await pool.query(`ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS vendor_city VARCHAR(255)`);
    await pool.query(`ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION`);
    await pool.query(`ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS location_status VARCHAR(20)`);
}

function getSafeDistanceKm() {
    const n = parseFloat(String(process.env.SAFE_DISTANCE_KM || '').trim());
    return Number.isFinite(n) && n > 0 ? n : 300;
}

/**
 * Advisory regional check — never sets verified: false.
 * @returns {Promise<{ authenticity: string, location_check: object, log: object }>}
 */
async function performRegionalLocationCheck(pool, { scanLat, scanLon, vendorCityName, vendorProfileId }) {
    const safeKm = getSafeDistanceKm();

    const baseLog = {
        scanned_latitude: null,
        scanned_longitude: null,
        scanned_city: null,
        vendor_city: null,
        distance_km: null,
        location_status: 'SKIPPED'
    };

    if (
        scanLat == null ||
        scanLon == null ||
        !Number.isFinite(Number(scanLat)) ||
        !Number.isFinite(Number(scanLon))
    ) {
        return {
            authenticity: 'GENUINE',
            location_check: {
                status: 'SKIPPED',
                message: 'Location not provided. Unable to perform regional authenticity check.'
            },
            log: { ...baseLog }
        };
    }

    const sla = Number(scanLat);
    const slo = Number(scanLon);

    let scannedCity = null;
    try {
        scannedCity = await reverseGeocodeToCity(sla, slo);
    } catch {
        scannedCity = null;
    }

    const vendorCityTrimmed =
        vendorCityName && String(vendorCityName).trim() ? String(vendorCityName).trim() : '';

    if (!vendorCityTrimmed) {
        return {
            authenticity: 'GENUINE',
            location_check: {
                status: 'SKIPPED',
                message: 'Vendor city not on file. Unable to perform regional authenticity check.',
                ...(scannedCity ? { scanned_city: scannedCity } : {})
            },
            log: {
                ...baseLog,
                scanned_latitude: sla,
                scanned_longitude: slo,
                scanned_city: scannedCity,
                location_status: 'SKIPPED'
            }
        };
    }

    let vendorCoords = null;
    try {
        if (vendorProfileId) {
            const r = await pool.query(
                `SELECT vendor_lat, vendor_lon FROM vendors WHERE id = $1`,
                [vendorProfileId]
            );
            if (
                r.rows[0] &&
                r.rows[0].vendor_lat != null &&
                r.rows[0].vendor_lon != null &&
                Number.isFinite(Number(r.rows[0].vendor_lat)) &&
                Number.isFinite(Number(r.rows[0].vendor_lon))
            ) {
                vendorCoords = {
                    lat: Number(r.rows[0].vendor_lat),
                    lon: Number(r.rows[0].vendor_lon)
                };
            } else {
                vendorCoords = await forwardGeocodeCityCached(vendorCityTrimmed);
                if (vendorCoords) {
                    await pool.query(
                        `UPDATE vendors SET vendor_lat = $1, vendor_lon = $2 WHERE id = $3`,
                        [vendorCoords.lat, vendorCoords.lon, vendorProfileId]
                    );
                }
            }
        } else {
            vendorCoords = await forwardGeocodeCityCached(vendorCityTrimmed);
        }
    } catch {
        vendorCoords = null;
    }

    if (!vendorCoords) {
        return {
            authenticity: 'GENUINE',
            location_check: {
                status: 'SKIPPED',
                message: 'Could not resolve vendor city location. Unable to perform regional authenticity check.',
                ...(scannedCity ? { scanned_city: scannedCity } : {}),
                vendor_city: vendorCityTrimmed
            },
            log: {
                ...baseLog,
                scanned_latitude: sla,
                scanned_longitude: slo,
                scanned_city: scannedCity,
                vendor_city: vendorCityTrimmed,
                location_status: 'SKIPPED'
            }
        };
    }

    let distKm;
    try {
        distKm = haversineDistanceKm(sla, slo, vendorCoords.lat, vendorCoords.lon);
    } catch {
        return {
            authenticity: 'GENUINE',
            location_check: {
                status: 'SKIPPED',
                message: 'Location check failed. Unable to perform regional authenticity check.'
            },
            log: {
                ...baseLog,
                scanned_latitude: sla,
                scanned_longitude: slo,
                scanned_city: scannedCity,
                vendor_city: vendorCityTrimmed,
                location_status: 'SKIPPED'
            }
        };
    }

    const scannedCityDisplay = scannedCity || 'Unknown';
    const distanceRounded = Math.round(distKm * 10) / 10;

    if (distKm <= safeKm) {
        return {
            authenticity: 'GENUINE',
            location_check: {
                status: 'PASS',
                scanned_city: scannedCityDisplay,
                vendor_city: vendorCityTrimmed,
                distance_km: distanceRounded,
                message: 'Scanned within authorized region'
            },
            log: {
                scanned_latitude: sla,
                scanned_longitude: slo,
                scanned_city: scannedCity,
                vendor_city: vendorCityTrimmed,
                distance_km: distKm,
                location_status: 'PASS'
            }
        };
    }

    return {
        authenticity: 'CAUTION',
        location_check: {
            status: 'WARNING',
            scanned_city: scannedCityDisplay,
            vendor_city: vendorCityTrimmed,
            distance_km: distanceRounded,
            message:
                "Warning: This medicine was scanned far outside the vendor's authorized region. It may not be authentic. Please verify with the manufacturer before consuming."
        },
        log: {
            scanned_latitude: sla,
            scanned_longitude: slo,
            scanned_city: scannedCity,
            vendor_city: vendorCityTrimmed,
            distance_km: distKm,
            location_status: 'WARNING'
        }
    };
}

function parseQrData(qr_data) {
    if (qr_data == null) return null;
    if (typeof qr_data === 'object' && !Array.isArray(qr_data)) return qr_data;
    if (typeof qr_data === 'string') {
        const t = qr_data.trim();
        try {
            return JSON.parse(t);
        } catch {
            return null;
        }
    }
    return null;
}

function extractDosage(medicineName) {
    if (!medicineName) return null;
    const m = String(medicineName).match(/(\d+\s*(?:mg|g|mcg|ml)\b)/i);
    return m ? m[1].replace(/\s+/g, ' ') : null;
}

async function insertScanLog(client, opts) {
    const {
        userId,
        groupId,
        batchId,
        result,
        req,
        rawPayload,
        scanned_latitude = null,
        scanned_longitude = null,
        scanned_city = null,
        vendor_city = null,
        distance_km = null,
        location_status = null
    } = opts;
    const deviceInfo = req.body?.device_info;
    const ip = req.ip && String(req.ip).trim() ? String(req.ip).trim() : null;
    const values = [
        userId || null,
        groupId || null,
        batchId || null,
        result,
        req.get('User-Agent') || null,
        deviceInfo || null,
        ip,
        rawPayload || null,
        scanned_latitude,
        scanned_longitude,
        scanned_city,
        vendor_city,
        distance_km,
        location_status
    ];
    try {
        await client.query(
            `INSERT INTO scan_logs (
                user_id, group_id, batch_id, result, user_agent, device_info, ip_address, raw_payload,
                scanned_latitude, scanned_longitude, scanned_city, vendor_city, distance_km, location_status
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9, $10, $11, $12, $13, $14)`,
            values
        );
    } catch (e) {
        if (e && e.code === '22P02') {
            values[6] = null;
            await client.query(
                `INSERT INTO scan_logs (
                    user_id, group_id, batch_id, result, user_agent, device_info, ip_address, raw_payload,
                    scanned_latitude, scanned_longitude, scanned_city, vendor_city, distance_km, location_status
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9, $10, $11, $12, $13, $14)`,
                values
            );
        } else {
            throw e;
        }
    }
}

/**
 * POST /api/qr/scan/master
 * Body: { qr_data, vendor_user_id, activation_location? }
 */
router.post('/scan/master', async (req, res) => {
    const { qr_data, vendor_user_id: vendorUserId, activation_location: activationLocation } = req.body;

    if (!vendorUserId) {
        return res.status(400).json({
            success: false,
            error: 'vendor_user_id is required'
        });
    }

    const payload = parseQrData(qr_data);
    if (!payload || payload.batch_id == null || payload.group_id != null) {
        return res.status(400).json({
            success: false,
            error: 'Invalid master QR payload'
        });
    }

    let client;
    try {
        await ensureQrChainSchema();
        client = await pool.connect();
        await client.query('BEGIN');

        const userResult = await client.query(
            `SELECT id, role, is_active FROM users WHERE id = $1`,
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
            [payload.batch_id]
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
                 activated_by = $1,
                 activation_location = COALESCE($2, activation_location)
             WHERE id = $3`,
            [vendorUserId, activationLocation || null, batch.id]
        );

        await client.query(
            `UPDATE batch_groups
             SET status = 'active',
                 activated_at = CURRENT_TIMESTAMP
             WHERE batch_id = $1`,
            [batch.id]
        );

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Batch activated successfully. All group QRs are now live.',
            batch: {
                id: batch.id,
                batch_number: batch.batch_number,
                medicine_name: batch.medicine_name
            }
        });
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (_e) {
                /* ignore */
            }
        }
        console.error('Master QR scan error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to process master QR scan'
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

/**
 * POST /api/qr/scan/unit
 * Body: { qr_data, user_id?, latitude?, longitude? } — anonymous consumer allowed (user_id optional)
 */
router.post('/scan/unit', async (req, res) => {
    const { qr_data, user_id: userId, latitude, longitude } = req.body;
    const scannedAt = new Date().toISOString();

    const failInvalid = async () => {
        try {
            await ensureQrChainSchema();
            await insertScanLog(pool, {
                userId: userId || null,
                groupId: null,
                batchId: null,
                result: 'invalid',
                req,
                rawPayload: parseQrData(qr_data) || { raw: typeof qr_data === 'string' ? qr_data.slice(0, 500) : null }
            });
        } catch (logErr) {
            console.error('scan_logs insert (invalid):', logErr);
        }
        return res.status(200).json({
            verified: false,
            reason: 'Invalid or unrecognized QR code',
            scanned_at: scannedAt
        });
    };

    const payload = parseQrData(qr_data);
    if (!payload || payload.batch_id == null || payload.group_id == null) {
        return await failInvalid();
    }

    const batchId = Number(payload.batch_id);
    const groupId = Number(payload.group_id);

    try {
        await ensureQrChainSchema();

        const groupResult = await pool.query(
            `SELECT DISTINCT ON (bg.id)
                bg.id AS group_id,
                bg.group_number,
                bg.unit_start,
                bg.unit_end,
                bg.status AS group_status,
                b.id AS batch_id,
                b.batch_number,
                b.medicine_name,
                b.description,
                b.manufacturing_date,
                b.expiry_date,
                b.total_units,
                b.activation_status,
                b.activated_at,
                b.activation_location,
                m.name AS manufacturer_name,
                CONCAT(
                    COALESCE(vu.first_name, ''),
                    CASE WHEN vu.first_name IS NOT NULL AND vu.last_name IS NOT NULL THEN ' ' ELSE '' END,
                    COALESCE(vu.last_name, '')
                ) AS vendor_display_name,
                vu.email AS vendor_email,
                v.id AS vendor_profile_id,
                CASE
                    WHEN NULLIF(TRIM(COALESCE(v.city, '')), '') IS NOT NULL THEN TRIM(v.city)
                    WHEN NULLIF(TRIM(COALESCE(vu.city, '')), '') IS NOT NULL THEN TRIM(vu.city)
                    ELSE NULL
                END AS vendor_city_for_check
             FROM batch_groups bg
             JOIN batches b ON bg.batch_id = b.id
             LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
             LEFT JOIN users vu ON b.assigned_vendor_id = vu.id
             LEFT JOIN vendor_users vusr ON vusr.user_id = vu.id
             LEFT JOIN vendors v ON v.id = vusr.vendor_id
             WHERE bg.id = $1 AND bg.batch_id = $2
             ORDER BY bg.id, v.id NULLS LAST`,
            [groupId, batchId]
        );

        if (groupResult.rows.length === 0) {
            await insertScanLog(pool, {
                userId: userId || null,
                groupId,
                batchId,
                result: 'invalid',
                req,
                rawPayload: payload
            });
            return res.status(200).json({
                verified: false,
                reason: 'Invalid or unrecognized QR code',
                scanned_at: scannedAt
            });
        }

        const row = groupResult.rows[0];
        const groupActive = String(row.group_status || 'inactive').toLowerCase() === 'active';
        const batchActive = String(row.activation_status || 'inactive').toLowerCase() === 'active';

        if (!groupActive || !batchActive) {
            await insertScanLog(pool, {
                userId: userId || null,
                groupId: row.group_id,
                batchId: row.batch_id,
                result: 'inactive',
                req,
                rawPayload: payload
            });
            return res.status(200).json({
                verified: false,
                reason: 'This medicine has not been activated in the supply chain yet. Do not consume.',
                scanned_at: scannedAt
            });
        }

        const assignedVendorName =
            (row.vendor_display_name || '').trim() || row.vendor_email || 'N/A';
        const manufactureDate = row.manufacturing_date
            ? new Date(row.manufacturing_date).toISOString().slice(0, 10)
            : null;
        const expiryDate = row.expiry_date ? new Date(row.expiry_date).toISOString().slice(0, 10) : null;

        let regional;
        try {
            regional = await performRegionalLocationCheck(pool, {
                scanLat: latitude,
                scanLon: longitude,
                vendorCityName: row.vendor_city_for_check,
                vendorProfileId: row.vendor_profile_id || null
            });
        } catch (locErr) {
            console.warn('Regional location check failed:', locErr);
            regional = {
                authenticity: 'GENUINE',
                location_check: {
                    status: 'SKIPPED',
                    message: 'Location check failed. Unable to perform regional authenticity check.'
                },
                log: {
                    scanned_latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
                    scanned_longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
                    scanned_city: null,
                    vendor_city: row.vendor_city_for_check || null,
                    distance_km: null,
                    location_status: 'SKIPPED'
                }
            };
        }

        await insertScanLog(pool, {
            userId: userId || null,
            groupId: row.group_id,
            batchId: row.batch_id,
            result: 'verified',
            req,
            rawPayload: payload,
            ...regional.log
        });

        return res.status(200).json({
            verified: true,
            authenticity: regional.authenticity,
            location_check: regional.location_check,
            medicine: {
                name: row.medicine_name,
                dosage: extractDosage(row.medicine_name),
                batch_number: row.batch_number,
                manufacture_date: manufactureDate,
                expiry_date: expiryDate
            },
            batch: {
                batch_id: String(row.batch_id),
                total_units: Number(row.total_units),
                manufacturer: row.manufacturer_name || 'Unknown'
            },
            group: {
                group_id: String(row.group_id),
                group_number: row.group_number,
                unit_range: `Units ${row.unit_start} to ${row.unit_end}`
            },
            supply_chain: {
                manufactured_by: row.manufacturer_name || 'Unknown',
                assigned_vendor: assignedVendorName,
                activated_at: row.activated_at ? new Date(row.activated_at).toISOString() : null,
                activation_location: row.activation_location || null
            },
            scanned_at: scannedAt
        });
    } catch (error) {
        console.error('Unit QR scan error:', error);
        try {
            await ensureQrChainSchema();
            await insertScanLog(pool, {
                userId: userId || null,
                groupId: Number.isFinite(groupId) ? groupId : null,
                batchId: Number.isFinite(batchId) ? batchId : null,
                result: 'error',
                req,
                rawPayload: payload
            });
        } catch (logErr) {
            console.error('scan_logs insert (error):', logErr);
        }
        return res.status(500).json({
            verified: false,
            reason: 'Verification failed. Please try again.'
        });
    }
});

module.exports = router;
