// Setup Vendor Batch Assignments
// This script creates test batches and assigns them to vendor for testing

const pool = require('./db');
const crypto = require('crypto');

// Generate unique batch token
function generateBatchToken() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `BATCH-${timestamp}-${random}`.toUpperCase();
}

// Generate unique token for each unit
function generateUniqueToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function setupVendorBatches() {
    console.log('=== Setting Up Vendor Batch Assignments ===\n');
    
    try {
        await pool.connect();
        console.log('Connected to database');

        // Check if manufacturer exists
        const manufacturerCheck = await pool.query('SELECT id FROM manufacturers LIMIT 1');
        if (manufacturerCheck.rows.length === 0) {
            console.log('Creating manufacturer...');
            await pool.query(`
                INSERT INTO manufacturers (name, email, phone, address, license_number)
                VALUES ('Test Manufacturer', 'test@manufacturer.com', '+1-555-0123', '123 Test St', 'TEST-LIC-001')
            `);
        }

        // Check if vendor exists
        const vendorCheck = await pool.query('SELECT id FROM vendors LIMIT 1');
        if (vendorCheck.rows.length === 0) {
            console.log('Creating vendor...');
            await pool.query(`
                INSERT INTO vendors (name, email, phone, address, license_number)
                VALUES ('Test Vendor', 'vendor@pharmatrace.com', '+1-555-0456', '456 Vendor Ave', 'VEND-LIC-001')
            `);
        }

        // Get IDs
        const manufacturerId = (await pool.query('SELECT id FROM manufacturers LIMIT 1')).rows[0].id;
        const vendorId = (await pool.query('SELECT id FROM vendors LIMIT 1')).rows[0].id;

        console.log(`Using Manufacturer ID: ${manufacturerId}`);
        console.log(`Using Vendor ID: ${vendorId}`);

        // Create test batches for vendor
        const testBatches = [
            {
                batch_number: 'VENDOR-BATCH-001',
                medicine_name: 'Paracetamol 500mg',
                description: 'Test batch for vendor',
                total_units: 100
            },
            {
                batch_number: 'VENDOR-BATCH-002', 
                medicine_name: 'Amoxicillin 250mg',
                description: 'Another test batch for vendor',
                total_units: 150
            },
            {
                batch_number: 'VENDOR-BATCH-003',
                medicine_name: 'Ibuprofen 400mg',
                description: 'Third test batch for vendor',
                total_units: 200
            }
        ];

        console.log('\nCreating batches and assigning to vendor...');

        for (let i = 0; i < testBatches.length; i++) {
            const batchData = testBatches[i];
            const batchToken = generateBatchToken();
            
            await pool.query('BEGIN');
            
            try {
                // Create batch
                const batchQuery = `
                    INSERT INTO batches (manufacturer_id, batch_number, batch_token, medicine_name, description, manufacturing_date, expiry_date, total_units, vendor_id, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
                    RETURNING *
                `;
                const batchResult = await pool.query(batchQuery, [
                    manufacturerId,
                    batchData.batch_number,
                    batchToken,
                    batchData.medicine_name,
                    batchData.description,
                    new Date().toISOString().split('T')[0],
                    new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
                    batchData.total_units,
                    vendorId
                ]);
                
                const batch = batchResult.rows[0];
                console.log(`Created batch: ${batch.batch_number} (ID: ${batch.id})`);
                
                // Create units for the batch
                for (let j = 0; j < batchData.total_units; j++) {
                    const token = generateUniqueToken();
                    await pool.query(`
                        INSERT INTO units (token, batch_id, status)
                        VALUES ($1, $2, 'CREATED')
                    `, [token, batch.id]);
                }
                
                console.log(`  Created ${batchData.total_units} units for batch ${batch.batch_number}`);
                
                await pool.query('COMMIT');
                
            } catch (error) {
                await pool.query('ROLLBACK');
                console.error(`Error creating batch ${batchData.batch_number}:`, error);
                throw error;
            }
        }

        // Activate one batch for testing
        console.log('\nActivating one batch for testing...');
        const firstBatch = await pool.query('SELECT id FROM batches WHERE vendor_id = $1 LIMIT 1', [vendorId]);
        
        if (firstBatch.rows.length > 0) {
            const batchId = firstBatch.rows[0].id;
            
            await pool.query('BEGIN');
            
            // Update batch status
            await pool.query(`
                UPDATE batches 
                SET status = 'ACTIVATED', activated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [batchId]);
            
            // Update units in batch
            await pool.query(`
                UPDATE units 
                SET status = 'ACTIVATED', activated_at = CURRENT_TIMESTAMP
                WHERE batch_id = $1
            `, [batchId]);
            
            await pool.query('COMMIT');
            
            console.log(`Activated batch ID: ${batchId}`);
        }

        // Verify setup
        console.log('\n=== VERIFICATION ===');
        
        const batchCount = await pool.query('SELECT COUNT(*) as count FROM batches WHERE vendor_id = $1', [vendorId]);
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
        const statsResult = await pool.query(statsQuery, [vendorId]);
        const stats = statsResult.rows[0];
        
        console.log(`Vendor Batches: ${batchCount.rows[0].count}`);
        console.log(`Total Batches: ${stats.total_batches}`);
        console.log(`Activated Batches: ${stats.activated_batches}`);
        console.log(`Pending Batches: ${stats.pending_batches}`);
        console.log(`Total Units: ${stats.total_units}`);
        console.log(`Activated Units: ${stats.activated_units}`);

        console.log('\n=== SETUP COMPLETE ===');
        console.log('Vendor dashboard should now show:');
        console.log(`- ${stats.total_batches} assigned batches`);
        console.log(`- ${stats.total_units} total units`);
        console.log(`- ${stats.activated_units} activated units`);
        console.log(`- ${stats.pending_batches} pending batches`);

        await pool.end();

    } catch (error) {
        console.error('Setup failed:', error);
        await pool.end();
        process.exit(1);
    }
}

// Run setup
setupVendorBatches();
