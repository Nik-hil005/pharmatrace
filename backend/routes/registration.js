const express = require('express');
const router = express.Router();
const pool = require('../db');

const ensureRegistrationTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS registration_requests (
            id SERIAL PRIMARY KEY,
            request_type VARCHAR(50) NOT NULL,
            company_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            address TEXT,
            license_number VARCHAR(100),
            description TEXT,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            status VARCHAR(50) DEFAULT 'PENDING',
            admin_notes TEXT,
            reviewed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Backfill columns for older deployments where table existed before name fields were added.
    await pool.query(`ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)`);
    await pool.query(`ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)`);
};

router.post('/request', async (req, res) => {
    const {
        type,
        companyName,
        email,
        phone,
        address,
        licenseNumber,
        description,
        firstName,
        lastName
    } = req.body;

    if (!type || !companyName || !email || !licenseNumber) {
        return res.status(400).json({
            success: false,
            error: 'Type, company name, email and license number are required'
        });
    }

    if (!['MANUFACTURER', 'VENDOR'].includes(type)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid request type'
        });
    }

    try {
        await ensureRegistrationTable();

        const duplicateCheck = await pool.query(
            `SELECT id FROM registration_requests
             WHERE email = $1 AND request_type = $2 AND status = 'PENDING'`,
            [email, type]
        );

        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'A pending application already exists for this email and account type'
            });
        }

        const result = await pool.query(
            `INSERT INTO registration_requests
            (request_type, company_name, email, phone, address, license_number, description, first_name, last_name, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
            RETURNING *`,
            [type, companyName, email, phone || null, address || null, licenseNumber, description || null, firstName || null, lastName || null]
        );

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            application: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating registration request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit application'
        });
    }
});

router.get('/requests', async (req, res) => {
    try {
        await ensureRegistrationTable();
        const status = req.query.status || 'PENDING';
        const result = await pool.query(
            `SELECT *
             FROM registration_requests
             WHERE status = $1
             ORDER BY created_at DESC`,
            [status]
        );

        res.json({
            success: true,
            requests: result.rows
        });
    } catch (error) {
        console.error('Error fetching registration requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch registration requests'
        });
    }
});

router.post('/requests/:id/approve', async (req, res) => {
    const { id } = req.params;

    try {
        await ensureRegistrationTable();
        await pool.query('BEGIN');

        const requestResult = await pool.query(
            `SELECT *
             FROM registration_requests
             WHERE id = $1 AND status = 'PENDING'
             FOR UPDATE`,
            [id]
        );

        if (requestResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Pending application not found'
            });
        }

        const application = requestResult.rows[0];

        if (application.request_type === 'MANUFACTURER') {
            await pool.query(
                `INSERT INTO manufacturers (name, email, phone, address, license_number)
                 VALUES ($1, $2, $3, $4, $5)`,
                [application.company_name, application.email, application.phone, application.address, application.license_number]
            );
        } else {
            await pool.query(
                `INSERT INTO vendors (name, email, phone, address, license_number)
                 VALUES ($1, $2, $3, $4, $5)`,
                [application.company_name, application.email, application.phone, application.address, application.license_number]
            );
        }

        await pool.query(
            `UPDATE registration_requests
             SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [id]
        );

        await pool.query('COMMIT');
        res.json({
            success: true,
            message: 'Application approved successfully'
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error approving registration request:', error);

        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Email or license number already exists in approved accounts'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to approve application'
        });
    }
});

router.post('/requests/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        await ensureRegistrationTable();
        const result = await pool.query(
            `DELETE FROM registration_requests
             WHERE id = $1 AND status = 'PENDING'
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Pending application not found'
            });
        }

        res.json({
            success: true,
            message: reason ? `Application rejected: ${reason}` : 'Application rejected and removed'
        });
    } catch (error) {
        console.error('Error rejecting registration request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject application'
        });
    }
});

module.exports = router;
