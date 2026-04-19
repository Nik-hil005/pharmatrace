const express = require('express');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');
const QRCode = require('qrcode');

// Generate unique token for each unit
function generateUniqueToken() {
    return crypto.randomBytes(32).toString('hex');
}

const GROUP_SIZE = 100;

async function ensureBatchQrSchema() {
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS master_qr_code TEXT`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_vendor_id INTEGER REFERENCES users(id)`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activation_status VARCHAR(50) DEFAULT 'inactive'`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS activated_by INTEGER REFERENCES users(id)`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP`);
    await pool.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id)`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS batch_groups (
            id SERIAL PRIMARY KEY,
            batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
            group_number INTEGER NOT NULL,
            unit_start INTEGER NOT NULL,
            unit_end INTEGER NOT NULL,
            group_qr_code TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'inactive',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(batch_id, group_number)
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_batch_groups_batch_id ON batch_groups(batch_id)`);
    await pool.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'inactive'`);
    await pool.query(
        `ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS master_batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE`
    );
    await pool.query(`UPDATE batch_groups SET master_batch_id = batch_id WHERE master_batch_id IS NULL`);
}

// Create a new batch with units
router.post('/batches', async (req, res) => {
    const { 
        manufacturer_id, 
        batch_number, 
        medicine_name, 
        description, 
        manufacturing_date, 
        expiry_date, 
        total_units 
    } = req.body;

    try {
        if (!batch_number || !medicine_name || !total_units) {
            return res.status(400).json({
                success: false,
                error: 'batch_number, medicine_name and total_units are required'
            });
        }

        await ensureBatchQrSchema();

        // Start transaction
        await pool.query('BEGIN');

        // Create batch
        const batchQuery = `
            INSERT INTO batches (manufacturer_id, batch_number, medicine_name, description, manufacturing_date, expiry_date, total_units)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const batchResult = await pool.query(batchQuery, [
            manufacturer_id || null, batch_number, medicine_name, description || null, manufacturing_date || null, expiry_date || null, total_units
        ]);
        const batch = batchResult.rows[0];

        const masterQrPayload = {
            batch_id: batch.id,
            batch_number: batch.batch_number,
            medicine_name: batch.medicine_name,
            total_units: Number(batch.total_units),
            created_at: batch.created_at
        };
        const masterQrCode = await QRCode.toDataURL(JSON.stringify(masterQrPayload));
        await pool.query(
            `UPDATE batches SET master_qr_code = $1 WHERE id = $2`,
            [masterQrCode, batch.id]
        );

        const groups = [];
        let groupNumber = 1;
        for (let unitStart = 1; unitStart <= Number(total_units); unitStart += GROUP_SIZE) {
            const unitEnd = Math.min(unitStart + GROUP_SIZE - 1, Number(total_units));

            const groupInsertResult = await pool.query(
                `INSERT INTO batch_groups (batch_id, master_batch_id, group_number, unit_start, unit_end, group_qr_code, status)
                 VALUES ($1, $1, $2, $3, $4, $5, 'inactive')
                 RETURNING id, batch_id, group_number, unit_start, unit_end`,
                [batch.id, groupNumber, unitStart, unitEnd, 'PENDING_QR_GENERATION']
            );

            const insertedGroup = groupInsertResult.rows[0];
            const groupQrPayload = {
                batch_id: batch.id,
                group_id: insertedGroup.id,
                group_number: insertedGroup.group_number,
                unit_range: `${insertedGroup.unit_start}-${insertedGroup.unit_end}`,
                medicine_name: batch.medicine_name
            };
            const groupQrCode = await QRCode.toDataURL(JSON.stringify(groupQrPayload));

            const groupUpdateResult = await pool.query(
                `UPDATE batch_groups
                 SET group_qr_code = $1
                 WHERE id = $2
                 RETURNING id, batch_id, group_number, unit_start, unit_end, group_qr_code`,
                [groupQrCode, insertedGroup.id]
            );
            groups.push(groupUpdateResult.rows[0]);
            groupNumber += 1;
        }

        // Generate units for the batch
        const units = [];
        for (let i = 0; i < total_units; i++) {
            const token = generateUniqueToken();
            const unitQuery = `
                INSERT INTO units (token, batch_id, status)
                VALUES ($1, $2, 'CREATED')
                RETURNING *
            `;
            const unitResult = await pool.query(unitQuery, [token, batch.id]);
            units.push(unitResult.rows[0]);
        }

        // Commit transaction
        await pool.query('COMMIT');

        res.json({
            success: true,
            batch: { ...batch, master_qr_code: masterQrCode },
            groups,
            units,
            total_units: units.length
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error creating batch:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create batch'
        });
    }
});

// Get all batches
router.get('/batches', async (_req, res) => {
    try {
        await ensureBatchQrSchema();
        const query = `
            SELECT
                b.*,
                m.name as manufacturer_name,
                CONCAT(COALESCE(vu.first_name, ''), CASE WHEN vu.first_name IS NOT NULL AND vu.last_name IS NOT NULL THEN ' ' ELSE '' END, COALESCE(vu.last_name, '')) as assigned_vendor_name,
                COUNT(bg.id)::int as group_count
            FROM batches b
            LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
            LEFT JOIN users vu ON b.assigned_vendor_id = vu.id
            LEFT JOIN batch_groups bg ON bg.batch_id = b.id
            GROUP BY b.id, m.name, vu.first_name, vu.last_name
            ORDER BY b.created_at DESC
        `;
        const result = await pool.query(query);

        res.json({
            success: true,
            batches: result.rows
        });
    } catch (error) {
        console.error('Error getting all batches:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve batches'
        });
    }
});

// Get all batches for a manufacturer
router.get('/batches/manufacturer/:manufacturer_id', async (req, res) => {
    const { manufacturer_id } = req.params;

    try {
        await ensureBatchQrSchema();
        const query = `
            SELECT
                b.*,
                m.name as manufacturer_name,
                CONCAT(COALESCE(vu.first_name, ''), CASE WHEN vu.first_name IS NOT NULL AND vu.last_name IS NOT NULL THEN ' ' ELSE '' END, COALESCE(vu.last_name, '')) as assigned_vendor_name,
                COUNT(bg.id)::int as group_count
            FROM batches b
            JOIN manufacturers m ON b.manufacturer_id = m.id
            LEFT JOIN users vu ON b.assigned_vendor_id = vu.id
            LEFT JOIN batch_groups bg ON bg.batch_id = b.id
            WHERE b.manufacturer_id = $1
            GROUP BY b.id, m.name, vu.first_name, vu.last_name
            ORDER BY b.created_at DESC
        `;
        const result = await pool.query(query, [manufacturer_id]);
        
        res.json({
            success: true,
            batches: result.rows
        });

    } catch (error) {
        console.error('Error getting batches:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve batches'
        });
    }
});

// Delete a batch
router.delete('/batches/:batch_id', async (req, res) => {
    const { batch_id } = req.params;

    try {
        await ensureBatchQrSchema();
        await pool.query('BEGIN');

        await pool.query('DELETE FROM batch_groups WHERE batch_id = $1', [batch_id]);
        await pool.query('DELETE FROM units WHERE batch_id = $1', [batch_id]);
        const deleteResult = await pool.query('DELETE FROM batches WHERE id = $1 RETURNING id', [batch_id]);

        if (deleteResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }

        await pool.query('COMMIT');
        res.json({
            success: true,
            message: 'Batch deleted successfully'
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error deleting batch:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete batch'
        });
    }
});

// Get batch details with units
router.get('/batches/:batch_id', async (req, res) => {
    const { batch_id } = req.params;

    try {
        await ensureBatchQrSchema();
        // Get batch details
        const batchQuery = `
            SELECT b.*, m.name as manufacturer_name, v.name as vendor_name
            FROM batches b
            LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
            LEFT JOIN vendors v ON b.vendor_id = v.id
            WHERE b.id = $1
        `;
        const batchResult = await pool.query(batchQuery, [batch_id]);
        
        if (batchResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }

        // Get units for this batch
        const unitsQuery = `
            SELECT * FROM units 
            WHERE batch_id = $1 
            ORDER BY created_at
        `;
        const unitsResult = await pool.query(unitsQuery, [batch_id]);

        res.json({
            success: true,
            batch: batchResult.rows[0],
            units: unitsResult.rows
        });

    } catch (error) {
        console.error('Error getting batch details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve batch details'
        });
    }
});

router.get('/batches/:batch_id/qrcodes', async (req, res) => {
    const { batch_id } = req.params;

    try {
        await ensureBatchQrSchema();

        const batchResult = await pool.query(
            `SELECT id, batch_number, medicine_name, total_units, created_at, master_qr_code
             FROM batches
             WHERE id = $1`,
            [batch_id]
        );

        if (batchResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }

        const groupsResult = await pool.query(
            `SELECT id, batch_id, group_number, unit_start, unit_end, group_qr_code
             FROM batch_groups
             WHERE batch_id = $1
             ORDER BY group_number ASC`,
            [batch_id]
        );

        res.json({
            success: true,
            batch: batchResult.rows[0],
            groups: groupsResult.rows
        });
    } catch (error) {
        console.error('Error fetching batch QR codes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch batch QR codes'
        });
    }
});

router.get('/vendors/assignable', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, first_name, last_name, role
             FROM users
             WHERE LOWER(role) = 'vendor' AND is_active = true
             ORDER BY first_name ASC NULLS LAST, last_name ASC NULLS LAST, email ASC`
        );

        res.json({
            success: true,
            vendors: result.rows
        });
    } catch (error) {
        console.error('Error fetching assignable vendors:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vendors'
        });
    }
});

router.post('/batches/:batch_id/assign-vendor', async (req, res) => {
    const { batch_id } = req.params;
    const { assigned_vendor_id, assigned_by } = req.body;

    if (!assigned_vendor_id) {
        return res.status(400).json({
            success: false,
            error: 'assigned_vendor_id is required'
        });
    }

    try {
        await ensureBatchQrSchema();
        await pool.query('BEGIN');

        const vendorResult = await pool.query(
            `SELECT id, role, is_active, first_name, last_name, email
             FROM users
             WHERE id = $1`,
            [assigned_vendor_id]
        );

        if (vendorResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Vendor user not found'
            });
        }

        const vendor = vendorResult.rows[0];
        if (String(vendor.role).toLowerCase() !== 'vendor' || !vendor.is_active) {
            await pool.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Selected user is not an active vendor'
            });
        }

        const lockResult = await pool.query(
            `SELECT id, batch_number, assigned_vendor_id
             FROM batches
             WHERE id = $1
             FOR UPDATE`,
            [batch_id]
        );

        if (lockResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }

        const batch = lockResult.rows[0];
        if (batch.assigned_vendor_id) {
            await pool.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                error: 'This batch is already assigned and cannot be reassigned'
            });
        }

        const updateResult = await pool.query(
            `UPDATE batches
             SET assigned_vendor_id = $1,
                 assigned_at = CURRENT_TIMESTAMP,
                 assigned_by = $2,
                 activation_status = 'inactive',
                 activated_at = NULL,
                 activated_by = NULL
             WHERE id = $3
             RETURNING *`,
            [assigned_vendor_id, assigned_by || null, batch_id]
        );

        await pool.query(
            `UPDATE batch_groups
             SET status = 'inactive'
             WHERE batch_id = $1`,
            [batch_id]
        );

        await pool.query('COMMIT');
        res.json({
            success: true,
            message: 'Vendor assigned successfully',
            batch: updateResult.rows[0],
            assigned_vendor: {
                id: vendor.id,
                name: `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim() || vendor.email
            }
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error assigning vendor to batch:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign vendor'
        });
    }
});

// Generate QR code for a specific unit
router.get('/units/:unit_id/qrcode', async (req, res) => {
    const { unit_id } = req.params;

    try {
        const query = `
            SELECT u.token, b.medicine_name, b.batch_number, m.name as manufacturer_name
            FROM units u
            JOIN batches b ON u.batch_id = b.id
            JOIN manufacturers m ON b.manufacturer_id = m.id
            WHERE u.id = $1
        `;
        const result = await pool.query(query, [unit_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Unit not found'
            });
        }

        const unit = result.rows[0];
        
        // Create QR code data (in a real implementation, you'd use a QR code library)
        const qrData = {
            token: unit.token,
            medicine_name: unit.medicine_name,
            batch_number: unit.batch_number,
            manufacturer: unit.manufacturer_name,
            verification_url: `https://yourdomain.com/verify?token=${unit.token}`
        };

        // For now, return the data that would be encoded in QR
        res.json({
            success: true,
            qr_data: qrData,
            token: unit.token
        });

    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate QR code'
        });
    }
});

module.exports = router;
