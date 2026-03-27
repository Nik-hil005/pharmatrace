const express = require('express');
const router = express.Router();
const pool = require('../db');

// Activate a batch (vendor receives shipment and activates it)
router.post('/batches/:batch_id/activate', async (req, res) => {
    const { batch_id } = req.params;
    const { vendor_id } = req.body;

    try {
        // Check if batch exists and is pending
        const batchQuery = `
            SELECT * FROM batches 
            WHERE id = $1 AND status = 'PENDING'
        `;
        const batchResult = await pool.query(batchQuery, [batch_id]);

        if (batchResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found or already activated'
            });
        }

        // Start transaction
        await pool.query('BEGIN');

        // Update batch status and assign to vendor
        const updateBatchQuery = `
            UPDATE batches 
            SET status = 'ACTIVATED', 
                vendor_id = $1, 
                activated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        const updatedBatch = await pool.query(updateBatchQuery, [vendor_id, batch_id]);

        // Update all units in this batch to ACTIVATED status
        const updateUnitsQuery = `
            UPDATE units 
            SET status = 'ACTIVATED', 
                activated_at = CURRENT_TIMESTAMP
            WHERE batch_id = $1
        `;
        await pool.query(updateUnitsQuery, [batch_id]);

        // Commit transaction
        await pool.query('COMMIT');

        res.json({
            success: true,
            batch: updatedBatch.rows[0],
            message: 'Batch activated successfully'
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error activating batch:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to activate batch'
        });
    }
});

// Assign batch to vendor (alternative to activate)
router.post('/batches/:batch_id/assign', async (req, res) => {
    const { batch_id } = req.params;
    const { vendor_id } = req.body;

    try {
        const query = `
            UPDATE batches 
            SET vendor_id = $1
            WHERE id = $2
            RETURNING *
        `;
        const result = await pool.query(query, [vendor_id, batch_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }

        res.json({
            success: true,
            batch: result.rows[0]
        });

    } catch (error) {
        console.error('Error assigning batch:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign batch to vendor'
        });
    }
});

// Get all batches for a vendor
router.get('/batches/vendor/:vendor_id', async (req, res) => {
    const { vendor_id } = req.params;

    try {
        const query = `
            SELECT b.*, m.name as manufacturer_name
            FROM batches b
            JOIN manufacturers m ON b.manufacturer_id = m.id
            WHERE b.vendor_id = $1
            ORDER BY b.created_at DESC
        `;
        const result = await pool.query(query, [vendor_id]);
        
        res.json({
            success: true,
            batches: result.rows
        });

    } catch (error) {
        console.error('Error getting vendor batches:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve batches'
        });
    }
});

// Get vendor statistics
router.get('/vendors/:vendor_id/stats', async (req, res) => {
    const { vendor_id } = req.params;

    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_batches,
                COUNT(CASE WHEN status = 'ACTIVATED' THEN 1 END) as activated_batches,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_batches,
                SUM(total_units) as total_units,
                SUM(CASE WHEN status = 'ACTIVATED' THEN total_units ELSE 0 END) as activated_units
            FROM batches 
            WHERE vendor_id = $1
        `;
        const statsResult = await pool.query(statsQuery, [vendor_id]);

        res.json({
            success: true,
            stats: statsResult.rows[0]
        });

    } catch (error) {
        console.error('Error getting vendor stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve vendor statistics'
        });
    }
});

module.exports = router;
