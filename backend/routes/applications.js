const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../db');

async function ensureApplicationCityColumns() {
    await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS city VARCHAR(150)`);
}

async function ensureApplicationPasswordHashColumn() {
    await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
}

async function ensureVendorUserCityColumns() {
    await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city VARCHAR(150)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(150)`);
}

function normalizeCity(value) {
    return String(value ?? '').trim();
}

function validateVendorCity(value) {
    const city = normalizeCity(value);
    if (!city) {
        return { ok: false, error: 'City is required' };
    }
    if (city.length < 2) {
        return { ok: false, error: 'City must be at least 2 characters' };
    }
    if (!/^[A-Za-z\s-]+$/.test(city)) {
        return { ok: false, error: 'City may only contain letters, spaces, and hyphens' };
    }
    return { ok: true, city };
}

function validateApplicantPassword(plain) {
    if (!plain || typeof plain !== 'string') {
        return { ok: false, error: 'Password is required' };
    }
    if (plain.length < 8) {
        return { ok: false, error: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(plain)) {
        return { ok: false, error: 'Password must include at least one uppercase letter' };
    }
    if (!/[0-9]/.test(plain)) {
        return { ok: false, error: 'Password must include at least one number' };
    }
    if (!/[^A-Za-z0-9]/.test(plain)) {
        return { ok: false, error: 'Password must include at least one special character' };
    }
    return { ok: true };
}

function stripPasswordHash(row) {
    if (!row || typeof row !== 'object') return row;
    const safe = { ...row };
    delete safe.password_hash;
    return safe;
}

// Submit new application
router.post('/submit', async (req, res) => {
    const { fullName, email, phone, companyName, role, licenseNumber, address, description, city, password } =
        req.body;

    try {
        await ensureApplicationCityColumns();
        await ensureApplicationPasswordHashColumn();

        // Validate required fields
        if (!fullName || !email || !companyName || !role || !licenseNumber) {
            return res.status(400).json({
                success: false,
                error: 'All required fields must be provided'
            });
        }

        // Validate role
        if (!['vendor', 'manufacturer'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role specified'
            });
        }

        const pwdCheck = validateApplicantPassword(password);
        if (!pwdCheck.ok) {
            return res.status(400).json({
                success: false,
                error: pwdCheck.error
            });
        }

        let cityForDb = null;
        if (role === 'vendor') {
            const cityCheck = validateVendorCity(city);
            if (!cityCheck.ok) {
                return res.status(400).json({
                    success: false,
                    error: cityCheck.error
                });
            }
            cityForDb = cityCheck.city;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Check if email already exists in applications or users
        const existingCheck = await pool.query(`
            SELECT email FROM applications WHERE email = $1 AND status != 'rejected'
            UNION
            SELECT email FROM users WHERE email = $1
        `, [email]);

        if (existingCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'An application or account with this email already exists'
            });
        }

        // Insert new application (password_hash only — never store plain text)
        const query = `
            INSERT INTO applications (full_name, email, phone, company_name, role, license_number, city, password_hash, address, description, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            fullName,
            email,
            phone,
            companyName,
            role,
            licenseNumber,
            cityForDb,
            passwordHash,
            address,
            description
        ]);

        res.status(201).json({
            success: true,
            application: stripPasswordHash(result.rows[0]),
            message: 'Application submitted successfully'
        });

    } catch (error) {
        console.error('Application submission error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit application'
        });
    }
});

// Get all pending applications for admin review
router.get('/pending', async (req, res) => {
    try {
        await ensureApplicationCityColumns();
        await ensureApplicationPasswordHashColumn();
        const query = `
            SELECT 
                id,
                full_name,
                email,
                phone,
                company_name,
                role,
                license_number,
                city,
                status,
                submitted_at
            FROM applications 
            WHERE status = 'pending'
            ORDER BY submitted_at DESC
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            applications: result.rows
        });

    } catch (error) {
        console.error('Error fetching pending applications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch applications'
        });
    }
});

// Get application statistics (must be registered before /:id)
router.get('/stats', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_applications,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_applications,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_applications,
                COUNT(CASE WHEN status = 'vendor' THEN 1 END) as vendor_applications,
                COUNT(CASE WHEN status = 'manufacturer' THEN 1 END) as manufacturer_applications
            FROM applications
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            stats: result.rows[0]
        });

    } catch (error) {
        console.error('Error fetching application stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// Get application details
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT * FROM applications WHERE id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }

        res.json({
            success: true,
            application: stripPasswordHash(result.rows[0])
        });

    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch application'
        });
    }
});

// Accept application
router.post('/:id/accept', async (req, res) => {
    const { id } = req.params;
    const { adminId } = req.body;

    try {
        await ensureApplicationCityColumns();
        await ensureApplicationPasswordHashColumn();
        await ensureVendorUserCityColumns();
        await pool.query('BEGIN');

        // Get application details
        const appQuery = 'SELECT * FROM applications WHERE id = $1 AND status = $2';
        const appResult = await pool.query(appQuery, [id, 'pending']);

        if (appResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Application not found or already processed'
            });
        }

        const application = appResult.rows[0];

        if (!application.password_hash || String(application.password_hash).trim().length === 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Cannot approve: application has no password hash on file'
            });
        }

        let vendorAccountCity = null;
        if (application.role === 'vendor') {
            const cityCheck = validateVendorCity(application.city);
            if (!cityCheck.ok) {
                await pool.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: `Cannot approve: ${cityCheck.error}`
                });
            }
            vendorAccountCity = cityCheck.city;
        }

        // Create user account using the same bcrypt hash the applicant set at registration
        const userQuery = `
            INSERT INTO users (email, password_hash, role, first_name, last_name, city, email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;
        
        const nameParts = application.full_name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const userResult = await pool.query(userQuery, [
            application.email,
            application.password_hash,
            application.role,
            firstName,
            lastName,
            vendorAccountCity,
            false
        ]);

        const userId = userResult.rows[0].id;

        // Create role-specific record
        if (application.role === 'vendor') {
            await pool.query(`
                INSERT INTO vendors (name, email, phone, address, license_number, city)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                application.company_name,
                application.email,
                application.phone,
                application.address,
                application.license_number,
                vendorAccountCity
            ]);
        } else if (application.role === 'manufacturer') {
            await pool.query(`
                INSERT INTO manufacturers (name, email, phone, address, license_number)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                application.company_name,
                application.email,
                application.phone,
                application.address,
                application.license_number
            ]);
        }

        // Update application status
        await pool.query(`
            UPDATE applications 
            SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1
            WHERE id = $2
        `, [adminId, id]);

        await pool.query('COMMIT');

        console.log(`User account created for ${application.email} (applicant password hash applied)`);

        res.json({
            success: true,
            message: 'Application approved successfully. The applicant can log in with the password they chose at registration.',
            userId: userId
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error accepting application:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept application'
        });
    }
});

// Reject application
router.post('/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { adminId, rejectionReason } = req.body;

    try {
        const query = `
            UPDATE applications 
            SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1, rejection_reason = $2
            WHERE id = $3 AND status = 'pending'
            RETURNING *
        `;
        
        const result = await pool.query(query, [adminId, rejectionReason, id]);

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Application not found or already processed'
            });
        }

        // TODO: Send rejection email notification
        console.log(`Application ${id} rejected. Reason: ${rejectionReason}`);

        res.json({
            success: true,
            message: 'Application rejected successfully',
            application: stripPasswordHash(result.rows[0])
        });

    } catch (error) {
        console.error('Error rejecting application:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject application'
        });
    }
});

module.exports = router;
