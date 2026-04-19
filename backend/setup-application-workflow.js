// Setup Application Workflow
// This script initializes the application system for testing

const pool = require('./db');

async function setupApplicationWorkflow() {
    console.log('=== Setting Up Application Workflow ===\n');
    
    try {
        await pool.connect();
        console.log('Connected to database');

        // Create applications table
        console.log('Creating applications table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS applications (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                company_name VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('vendor', 'manufacturer')),
                license_number VARCHAR(100) NOT NULL,
                address TEXT,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP,
                reviewed_by INTEGER REFERENCES users(id),
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
            CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
            CREATE INDEX IF NOT EXISTS idx_applications_role ON applications(role);
            CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications(submitted_at);
        `);

        console.log('Applications table created successfully');

        // Create trigger for updated_at
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_applications_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            CREATE TRIGGER update_applications_updated_at
                BEFORE UPDATE ON applications
                FOR EACH ROW
                EXECUTE FUNCTION update_applications_updated_at();
        `);

        console.log('Trigger created successfully');

        // Verify setup
        const tableCheck = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'applications'
        `);

        if (tableCheck.rows.length > 0) {
            console.log('✅ Applications table exists and is ready');
        } else {
            console.log('❌ Applications table creation failed');
        }

        console.log('\n=== WORKFLOW SETUP COMPLETE ===');
        console.log('Application system is ready for testing!');
        console.log('\nAvailable endpoints:');
        console.log('POST /api/applications/submit - Submit new application');
        console.log('GET /api/applications/pending - Get pending applications');
        console.log('GET /api/applications/:id - Get application details');
        console.log('POST /api/applications/:id/accept - Accept application');
        console.log('POST /api/applications/:id/reject - Reject application');
        console.log('GET /api/applications/stats - Get application statistics');
        
        console.log('\nFrontend routes:');
        console.log('/apply/vendor - Vendor registration form');
        console.log('/apply/manufacturer - Manufacturer registration form');
        console.log('/admin/applications - Admin review panel (protected)');

        await pool.end();

    } catch (error) {
        console.error('Setup failed:', error);
        await pool.end();
        process.exit(1);
    }
}

// Run setup
setupApplicationWorkflow();
