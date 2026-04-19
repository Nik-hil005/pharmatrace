// Setup Vendor User and Batch Assignments
// This script creates a vendor user and assigns real batches from database

const pool = require('./db');
const bcrypt = require('bcrypt');

async function setupVendorUser() {
    console.log('=== Setting Up Vendor User ===\n');
    
    try {
        await pool.connect();
        console.log('Connected to database');

        // Create vendor user in users table
        const hashedPassword = await bcrypt.hash('Vendor@123456', 10);
        
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', ['vendor@pharmatrace.com']);
        
        if (userCheck.rows.length === 0) {
            console.log('Creating vendor user...');
            await pool.query(`
                INSERT INTO users (email, password, role, first_name, last_name)
                VALUES ($1, $2, 'vendor', 'Jane', 'Doe')
            `, ['vendor@pharmatrace.com', hashedPassword]);
            
            console.log('Vendor user created: vendor@pharmatrace.com');
        } else {
            console.log('Vendor user already exists');
        }

        // Get vendor user ID
        const vendorUser = await pool.query('SELECT id FROM users WHERE email = $1', ['vendor@pharmatrace.com']);
        const vendorUserId = vendorUser.rows[0].id;

        // Create vendor record
        const vendorCheck = await pool.query('SELECT id FROM vendors WHERE license_number = $1', ['VEND-LIC-001']);
        
        if (vendorCheck.rows.length === 0) {
            console.log('Creating vendor record...');
            await pool.query(`
                INSERT INTO vendors (name, email, phone, address, license_number)
                VALUES ('Test Vendor', 'vendor@pharmatrace.com', '+1-555-0456', '456 Vendor Ave', 'VEND-LIC-001')
            `);
            console.log('Vendor record created');
        }

        // Get vendor ID
        const vendorRecord = await pool.query('SELECT id FROM vendors WHERE license_number = $1', ['VEND-LIC-001']);
        const vendorId = vendorRecord.rows[0].id;

        console.log(`Vendor User ID: ${vendorUserId}`);
        console.log(`Vendor Record ID: ${vendorId}`);

        // Check if there are any batches in database to assign
        const batchCheck = await pool.query('SELECT id, manufacturer_id, batch_number, medicine_name, total_units FROM batches WHERE vendor_id IS NULL LIMIT 5');
        
        if (batchCheck.rows.length > 0) {
            console.log(`\nFound ${batchCheck.rows.length} unassigned batches to assign to vendor:`);
            
            for (let i = 0; i < batchCheck.rows.length; i++) {
                const batch = batchCheck.rows[i];
                
                await pool.query('BEGIN');
                
                try {
                    // Assign batch to vendor
                    const assignQuery = `
                        UPDATE batches 
                        SET vendor_id = $1, status = 'PENDING'
                        WHERE id = $2
                    `;
                    await pool.query(assignQuery, [vendorId, batch.id]);
                    
                    console.log(`  Assigned batch ${batch.batch_number} (${batch.medicine_name}) to vendor`);
                    
                    await pool.query('COMMIT');
                    
                } catch (error) {
                    await pool.query('ROLLBACK');
                    console.error(`Error assigning batch ${batch.batch_number}:`, error);
                }
            }
        } else {
            console.log('No unassigned batches found in database');
            console.log('You need to create some batches first using the manufacturer portal');
        }

        // Verify vendor setup
        console.log('\n=== VERIFICATION ===');
        
        const vendorStats = await pool.query(`
            SELECT 
                COUNT(*) as assigned_batches,
                COUNT(CASE WHEN status = 'ACTIVATED' THEN 1 END) as activated_batches,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_batches,
                SUM(total_units) as total_units,
                SUM(CASE WHEN status = 'ACTIVATED' THEN total_units ELSE 0 END) as activated_units
            FROM batches 
            WHERE vendor_id = $1
        `, [vendorId]);
        
        const stats = vendorStats.rows[0];
        
        console.log(`Vendor Batches: ${stats.assigned_batches}`);
        console.log(`Activated Batches: ${stats.activated_batches}`);
        console.log(`Pending Batches: ${stats.pending_batches}`);
        console.log(`Total Units: ${stats.total_units || 0}`);
        console.log(`Activated Units: ${stats.activated_units || 0}`);

        console.log('\n=== SETUP COMPLETE ===');
        console.log('Vendor portal should now show real assigned batches from database!');
        console.log('Login with: vendor@pharmatrace.com / Vendor@123456');

        await pool.end();

    } catch (error) {
        console.error('Setup failed:', error);
        await pool.end();
        process.exit(1);
    }
}

// Run setup
setupVendorUser();
