require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const GROUP_SIZE = 100;

function generateUniqueToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function createRegistrationRequest(email, type, company, city) {
    await pool.query(
        `INSERT INTO registration_requests (request_type, company_name, email, phone, address, license_number, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [type, company, email, '+91-9876543210', city, 'DEMO-LIC-123', 'APPROVED']
    );
}

async function runSeed() {
    console.log('Starting seed process for demo branch...');
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const passwordHash = await bcrypt.hash('Demo@1234', 10);

        // 1. Setup Manufacturer
        const mfgEmail = 'manufacturer@pharmatrace.com';
        let mfgUserId;
        const mfgUserRes = await client.query('SELECT id FROM users WHERE email = $1', [mfgEmail]);
        if (mfgUserRes.rows.length > 0) {
            mfgUserId = mfgUserRes.rows[0].id;
            console.log('Manufacturer user already exists, ID:', mfgUserId);
        } else {
            const res = await client.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
                 VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
                [mfgEmail, passwordHash, 'Demo', 'Manufacturer', 'manufacturer']
            );
            mfgUserId = res.rows[0].id;
            console.log('Created manufacturer user, ID:', mfgUserId);
        }

        let mfgRecordId;
        const mfgRecordRes = await client.query('SELECT id FROM manufacturers WHERE email = $1', [mfgEmail]);
        if (mfgRecordRes.rows.length > 0) {
            mfgRecordId = mfgRecordRes.rows[0].id;
        } else {
            const res = await client.query(
                `INSERT INTO manufacturers (name, email, phone, address, license_number) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                ['Demo Pharma Corp', mfgEmail, '+91-9876500000', 'Mumbai, Maharashtra', 'MFG-DEMO-001']
            );
            mfgRecordId = res.rows[0].id;
        }

        // 2. Setup Vendor 1
        const v1Email = 'vendor1@pharmatrace.com';
        let v1UserId;
        const v1UserRes = await client.query('SELECT id FROM users WHERE email = $1', [v1Email]);
        if (v1UserRes.rows.length === 0) {
            const res = await client.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
                 VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
                [v1Email, passwordHash, 'Vendor', 'One', 'Vendor']
            );
            v1UserId = res.rows[0].id;
            
            await client.query(
                `INSERT INTO vendors (name, email, phone, address, license_number)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['Demo Vendor 1', v1Email, '+91-9876500001', 'Delhi', 'V1-DEMO-001']
            );
            await createRegistrationRequest(v1Email, 'VENDOR', 'Demo Vendor 1', 'Delhi');
            console.log('Created Vendor 1, ID:', v1UserId);
        } else {
            v1UserId = v1UserRes.rows[0].id;
        }

        // 3. Setup Vendor 2
        const v2Email = 'vendor2@pharmatrace.com';
        let v2UserId;
        const v2UserRes = await client.query('SELECT id FROM users WHERE email = $1', [v2Email]);
        if (v2UserRes.rows.length === 0) {
            const res = await client.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
                 VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
                [v2Email, passwordHash, 'Vendor', 'Two', 'Vendor']
            );
            v2UserId = res.rows[0].id;
            
            await client.query(
                `INSERT INTO vendors (name, email, phone, address, license_number)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['Demo Vendor 2', v2Email, '+91-9876500002', 'Bangalore, Karnataka', 'V2-DEMO-001']
            );
            await createRegistrationRequest(v2Email, 'VENDOR', 'Demo Vendor 2', 'Bangalore, Karnataka');
            console.log('Created Vendor 2, ID:', v2UserId);
        } else {
            v2UserId = v2UserRes.rows[0].id;
        }

        // Create exactly 3 batches using realistic values.
        console.log('Creating 3 demo batches...');

        const batchesConfig = [
            { bn: 'PAR-750-XYZ', med: 'Paracetamol 750mg', num_units: 300, vendor_id: null, assigned_at: null, activated: false }, // Batch 1
            { bn: 'AMO-250-ABC', med: 'Amoxicillin 250mg', num_units: 150, vendor_id: v1UserId, assigned_at: 'CURRENT_TIMESTAMP', activated: false }, // Batch 2
            { bn: 'AZI-500-DEF', med: 'Azithromycin 500mg', num_units: 200, vendor_id: v2UserId, assigned_at: 'CURRENT_TIMESTAMP - interval \'1 day\'', activated: true }  // Batch 3
        ];

        for (const [idx, bConf] of batchesConfig.entries()) {
            console.log(`Setting up Batch ${idx+1}: ${bConf.med}...`);

            // Check if batch exists to prevent reruns piling up identically named batches during strict demoseed
            const bCheck = await client.query('SELECT id FROM batches WHERE batch_number = $1', [bConf.bn]);
            if (bCheck.rows.length > 0) {
                console.log(` Batch ${bConf.bn} already exists, skipping...`);
                continue;
            }

            const batchQuery = `
                INSERT INTO batches (
                    manufacturer_id, batch_number, medicine_name, description, 
                    manufacturing_date, expiry_date, total_units,
                    assigned_vendor_id, assigned_at, assigned_by,
                    activation_status, activated_at, activated_by
                )
                VALUES ($1, $2, $3, $4, CURRENT_DATE - interval '10 days', CURRENT_DATE + interval '365 days', $5,
                        $6, ${bConf.assigned_at ? bConf.assigned_at : 'NULL'}, $7,
                        $8, ${bConf.activated ? 'CURRENT_TIMESTAMP' : 'NULL'}, $9)
                RETURNING *
            `;

            const assigner = bConf.vendor_id ? mfgUserId : null;
            const activatorId = bConf.activated ? bConf.vendor_id : null;
            const actStatus = bConf.activated ? 'active' : 'inactive';

            const bRes = await client.query(batchQuery, [
                mfgRecordId, bConf.bn, bConf.med, 'Demo batch for Pharmatrace', bConf.num_units,
                bConf.vendor_id, assigner, actStatus, activatorId
            ]);
            const batch = bRes.rows[0];

            // Master QR
            const masterQrPayload = {
                batch_id: batch.id,
                batch_number: batch.batch_number,
                medicine_name: batch.medicine_name,
                total_units: Number(batch.total_units),
                created_at: batch.created_at
            };
            const masterQrCode = await QRCode.toDataURL(JSON.stringify(masterQrPayload));
            await client.query(`UPDATE batches SET master_qr_code = $1 WHERE id = $2`, [masterQrCode, batch.id]);

            // Groups
            for (let unitStart = 1; unitStart <= Number(bConf.num_units); unitStart += GROUP_SIZE) {
                const unitEnd = Math.min(unitStart + GROUP_SIZE - 1, Number(bConf.num_units));
                const groupNum = Math.floor(unitStart / GROUP_SIZE) + 1;

                await client.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS master_batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE`);
                await client.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`);
                const groupInsertRes = await client.query(
                    `INSERT INTO batch_groups (batch_id, master_batch_id, group_number, unit_start, unit_end, group_qr_code, status, activated_at)
                     VALUES ($1, $1, $2, $3, $4, $5, $6, ${bConf.activated ? 'CURRENT_TIMESTAMP' : 'NULL'})
                     RETURNING id`,
                    [batch.id, groupNum, unitStart, unitEnd, 'PENDING', bConf.activated ? 'active' : 'inactive']
                );
                const groupId = groupInsertRes.rows[0].id;

                const groupQrPayload = {
                    batch_id: batch.id,
                    group_id: groupId,
                    group_number: groupNum,
                    unit_range: `${unitStart}-${unitEnd}`,
                    medicine_name: batch.medicine_name
                };
                const groupQrCode = await QRCode.toDataURL(JSON.stringify(groupQrPayload));
                
                await client.query(`UPDATE batch_groups SET group_qr_code = $1 WHERE id = $2`, [groupQrCode, groupId]);
            }

            // Units
            for (let i = 0; i < Number(bConf.num_units); i++) {
                const token = generateUniqueToken();
                // We encode the verified URL correctly to simulate exactly what the verification API does if somebody scans it directly.
                await client.query(
                    `INSERT INTO units (token, batch_id, status) VALUES ($1, $2, 'CREATED')`,
                    [token, batch.id]
                );
            }
        }

        await client.query('COMMIT');
        console.log('Seed completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

runSeed();
