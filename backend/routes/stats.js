const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/dashboard', async (_req, res) => {
    try {
        const [batchesResult, scansResult, manufacturersResult, vendorsResult, recentResult] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS count FROM batches'),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE scan_result = 'VERIFIED')::int AS verified_scans,
                    COUNT(*) FILTER (WHERE scan_result = 'SUSPICIOUS')::int AS suspicious_scans,
                    COUNT(*) FILTER (WHERE scan_result = 'FAKE')::int AS fake_scans
                FROM scans
            `),
            pool.query('SELECT COUNT(*)::int AS count FROM manufacturers'),
            pool.query('SELECT COUNT(*)::int AS count FROM vendors'),
            pool.query(`
                SELECT
                    s.id,
                    s.scan_result AS status,
                    s.scan_time,
                    b.medicine_name,
                    b.batch_number
                FROM scans s
                LEFT JOIN units u ON s.unit_id = u.id
                LEFT JOIN batches b ON u.batch_id = b.id
                ORDER BY s.scan_time DESC
                LIMIT 10
            `)
        ]);

        const stats = {
            totalBatches: batchesResult.rows[0].count,
            verifiedScans: scansResult.rows[0].verified_scans,
            suspiciousScans: scansResult.rows[0].suspicious_scans,
            fakeScans: scansResult.rows[0].fake_scans,
            activeManufacturers: manufacturersResult.rows[0].count,
            activeVendors: vendorsResult.rows[0].count
        };

        const recentActivity = recentResult.rows.map((row) => ({
            id: row.id,
            type: 'scan',
            status: row.status || 'UNKNOWN',
            medicine: row.medicine_name || 'Unknown Medicine',
            batch: row.batch_number || 'UNKNOWN',
            time: new Date(row.scan_time).toLocaleString()
        }));

        res.json({
            success: true,
            stats,
            recentActivity
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load dashboard statistics'
        });
    }
});

module.exports = router;
