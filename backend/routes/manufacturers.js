const express = require('express');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');

// Generate unique token for each unit
function generateUniqueToken() {
    return crypto.randomBytes(32).toString('hex');
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
        // Start transaction
        await pool.query('BEGIN');

        // Create batch
        const batchQuery = `
            INSERT INTO batches (manufacturer_id, batch_number, medicine_name, description, manufacturing_date, expiry_date, total_units)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const batchResult = await pool.query(batchQuery, [
            manufacturer_id, batch_number, medicine_name, description, manufacturing_date, expiry_date, total_units
        ]);
        const batch = batchResult.rows[0];

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
            batch,
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

// Get all batches for a manufacturer
router.get('/batches/manufacturer/:manufacturer_id', async (req, res) => {
    const { manufacturer_id } = req.params;

    try {
        const query = `
            SELECT b.*, m.name as manufacturer_name
            FROM batches b
            JOIN manufacturers m ON b.manufacturer_id = m.id
            WHERE b.manufacturer_id = $1
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

// Get batch details with units
router.get('/batches/:batch_id', async (req, res) => {
    const { batch_id } = req.params;

    try {
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
