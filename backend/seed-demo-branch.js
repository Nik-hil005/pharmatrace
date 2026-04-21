/**
 * Demo branch seed: manufacturer@pharmatrace.com + 3 batches + 2 vendor accounts.
 * Run: node seed-demo-branch.js (from backend/, with DATABASE_URL / PG* in .env)
 */
require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const GROUP_SIZE = 100;
const DEMO_PASSWORD = 'Demo@1234';

const MFG_EMAIL = 'manufacturer@pharmatrace.com';
const V1_EMAIL = 'vendor1@pharmatrace.com';
const V2_EMAIL = 'vendor2@pharmatrace.com';

/** Approximate city centers for reliable regional check without waiting on Nominatim */
const VENDOR_LOCATIONS = {
    v1: { city: 'Lucknow, Uttar Pradesh', lat: 26.8467, lon: 80.9462 },
    v2: { city: 'Chennai, Tamil Nadu', lat: 13.0827, lon: 80.2707 }
};

function generateUniqueToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function ensureDemoSchema(client) {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(150)`);
    await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city VARCHAR(150)`);
    await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_lat DOUBLE PRECISION`);
    await client.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_lon DOUBLE PRECISION`);
    await client.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`);
}

async function upsertRegistrationRequest(client, { requestType, companyName, email, address, licenseNumber }) {
    await client.query(
        `INSERT INTO registration_requests (request_type, company_name, email, phone, address, license_number, status)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE NOT EXISTS (SELECT 1 FROM registration_requests WHERE email = $3 AND status = 'APPROVED')`,
        [requestType, companyName, email, '+91-9876543210', address, licenseNumber, 'APPROVED']
    );
}

async function ensureManufacturerUserAndRecord(client, passwordHash) {
    let mfgUserId;
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [MFG_EMAIL]);
    if (existing.rows.length > 0) {
        mfgUserId = existing.rows[0].id;
        await client.query(
            `UPDATE users SET password_hash = $1, role = 'manufacturer', is_active = true, first_name = COALESCE(NULLIF(TRIM(first_name), ''), 'Demo'), last_name = COALESCE(NULLIF(TRIM(last_name), ''), 'Manufacturer') WHERE id = $2`,
            [passwordHash, mfgUserId]
        );
    } else {
        const res = await client.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
            [MFG_EMAIL, passwordHash, 'Demo', 'Manufacturer', 'manufacturer']
        );
        mfgUserId = res.rows[0].id;
    }

    let mfgRecordId;
    const mRec = await client.query('SELECT id FROM manufacturers WHERE email = $1', [MFG_EMAIL]);
    if (mRec.rows.length > 0) {
        mfgRecordId = mRec.rows[0].id;
    } else {
        const res = await client.query(
            `INSERT INTO manufacturers (name, email, phone, address, license_number)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            ['Demo Pharma Corp', MFG_EMAIL, '+91-9876500000', 'Mumbai, Maharashtra', 'MFG-DEMO-001']
        );
        mfgRecordId = res.rows[0].id;
    }
    return { mfgUserId, mfgRecordId };
}

/**
 * Approved vendor user + vendors row + vendor_users link (needed for vendor_profile_id / cache in scans).
 */
async function ensureVendorAccount(client, passwordHash, cfg) {
    const { email, firstName, lastName, companyName, loc, licenseNumber } = cfg;

    let userId;
    const u = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (u.rows.length > 0) {
        userId = u.rows[0].id;
        await client.query(
            `UPDATE users SET password_hash = $1, role = 'vendor', is_active = true, city = $2,
             first_name = $3, last_name = $4 WHERE id = $5`,
            [passwordHash, loc.city, firstName, lastName, userId]
        );
    } else {
        const res = await client.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, city)
             VALUES ($1, $2, $3, $4, 'vendor', true, $5) RETURNING id`,
            [email, passwordHash, firstName, lastName, loc.city]
        );
        userId = res.rows[0].id;
    }

    let vendorProfileId;
    const v = await client.query('SELECT id FROM vendors WHERE email = $1', [email]);
    if (v.rows.length > 0) {
        vendorProfileId = v.rows[0].id;
        await client.query(
            `UPDATE vendors SET name = $1, city = $2, vendor_lat = $3, vendor_lon = $4, address = $5 WHERE id = $6`,
            [companyName, loc.city, loc.lat, loc.lon, loc.city, vendorProfileId]
        );
    } else {
        const res = await client.query(
            `INSERT INTO vendors (name, email, phone, address, license_number, city, vendor_lat, vendor_lon)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [companyName, email, '+91-9876500099', loc.city, licenseNumber, loc.city, loc.lat, loc.lon]
        );
        vendorProfileId = res.rows[0].id;
    }

    await client.query(
        `INSERT INTO vendor_users (user_id, vendor_id, role, is_active)
         VALUES ($1, $2, 'VENDOR_ADMIN', true)
         ON CONFLICT (user_id, vendor_id) DO NOTHING`,
        [userId, vendorProfileId]
    );

    await upsertRegistrationRequest(client, {
        requestType: 'VENDOR',
        companyName,
        email,
        address: loc.city,
        licenseNumber
    });

    return userId;
}

async function runSeed() {
    console.log('PharmaTrace demo seed (manufacturer@pharmatrace.com + 3 batches + 2 vendors)...');
    const client = await pool.connect();

    try {
        await ensureDemoSchema(client);
        await client.query('BEGIN');

        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

        const { mfgUserId, mfgRecordId } = await ensureManufacturerUserAndRecord(client, passwordHash);

        const v1UserId = await ensureVendorAccount(client, passwordHash, {
            email: V1_EMAIL,
            firstName: 'Arjun',
            lastName: 'Verma',
            companyName: 'Lucknow Medical Distributors',
            loc: VENDOR_LOCATIONS.v1,
            licenseNumber: 'V1-DEMO-LKO-001'
        });

        const v2UserId = await ensureVendorAccount(client, passwordHash, {
            email: V2_EMAIL,
            firstName: 'Priya',
            lastName: 'Krishnan',
            companyName: 'Chennai Pharma Hub',
            loc: VENDOR_LOCATIONS.v2,
            licenseNumber: 'V2-DEMO-MAA-001'
        });

        const batchesConfig = [
            {
                bn: 'DEMO-PAR-500-UNASSIGNED',
                med: 'Paracetamol 500mg Tablets',
                num_units: 250,
                status: 'pending',
                vendor_id: null,
                assigned_at_sql: 'NULL',
                assigned_by: null,
                activation_status: 'inactive',
                activated_at_sql: 'NULL',
                activated_by: null,
                groups_active: false
            },
            {
                bn: 'DEMO-AMOX-250-ASSIGNED',
                med: 'Amoxicillin 250mg Capsules',
                num_units: 150,
                status: 'assigned',
                vendor_id: v1UserId,
                assigned_at_sql: 'CURRENT_TIMESTAMP',
                assigned_by: mfgUserId,
                activation_status: 'inactive',
                activated_at_sql: 'NULL',
                activated_by: null,
                groups_active: false
            },
            {
                bn: 'DEMO-AZI-500-ACTIVE',
                med: 'Azithromycin 500mg Tablets',
                num_units: 200,
                status: 'active',
                vendor_id: v2UserId,
                assigned_at_sql: 'CURRENT_TIMESTAMP - interval \'2 days\'',
                assigned_by: mfgUserId,
                activation_status: 'active',
                activated_at_sql: 'CURRENT_TIMESTAMP - interval \'1 day\'',
                activated_by: v2UserId,
                groups_active: true
            }
        ];

        for (let idx = 0; idx < batchesConfig.length; idx++) {
            const bConf = batchesConfig[idx];
            const bCheck = await client.query('SELECT id FROM batches WHERE batch_number = $1', [bConf.bn]);
            if (bCheck.rows.length > 0) {
                console.log(`  Batch "${bConf.bn}" already exists — skipping insert (delete batch to re-seed).`);
                continue;
            }

            console.log(`  Creating batch ${idx + 1}: ${bConf.bn}…`);

            const batchQuery = `
                INSERT INTO batches (
                    manufacturer_id, batch_number, medicine_name, description,
                    manufacturing_date, expiry_date, total_units, status,
                    assigned_vendor_id, assigned_at, assigned_by,
                    activation_status, activated_at, activated_by
                )
                VALUES (
                    $1, $2, $3, $4,
                    CURRENT_DATE - interval '30 days', CURRENT_DATE + interval '18 months', $5, $6,
                    $7, ${bConf.assigned_at_sql}, $8,
                    $9, ${bConf.activated_at_sql}, $10
                )
                RETURNING *
            `;

            const bRes = await client.query(batchQuery, [
                mfgRecordId,
                bConf.bn,
                bConf.med,
                'Seeded demo batch for PharmaTrace',
                bConf.num_units,
                bConf.status,
                bConf.vendor_id,
                bConf.assigned_by,
                bConf.activation_status,
                bConf.activated_by
            ]);
            const batch = bRes.rows[0];

            const masterQrPayload = {
                batch_id: batch.id,
                batch_number: batch.batch_number,
                medicine_name: batch.medicine_name,
                total_units: Number(batch.total_units),
                created_at: batch.created_at
            };
            const masterQrCode = await QRCode.toDataURL(JSON.stringify(masterQrPayload));
            await client.query(`UPDATE batches SET master_qr_code = $1 WHERE id = $2`, [masterQrCode, batch.id]);

            await client.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS master_batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE`);
            await client.query(`ALTER TABLE batch_groups ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`);

            let firstGroupPayloadJson = null;

            for (let unitStart = 1; unitStart <= Number(bConf.num_units); unitStart += GROUP_SIZE) {
                const unitEnd = Math.min(unitStart + GROUP_SIZE - 1, Number(bConf.num_units));
                const groupNum = Math.floor((unitStart - 1) / GROUP_SIZE) + 1;

                const groupInsertRes = await client.query(
                    `INSERT INTO batch_groups (batch_id, master_batch_id, group_number, unit_start, unit_end, group_qr_code, status, activated_at)
                     VALUES ($1, $1, $2, $3, $4, $5, $6, ${bConf.groups_active ? 'CURRENT_TIMESTAMP' : 'NULL'})
                     RETURNING id`,
                    [batch.id, groupNum, unitStart, unitEnd, 'PENDING_QR_GEN', bConf.groups_active ? 'active' : 'inactive']
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

                if (groupNum === 1) {
                    firstGroupPayloadJson = JSON.stringify(groupQrPayload);
                }
            }

            for (let i = 0; i < Number(bConf.num_units); i++) {
                const token = generateUniqueToken();
                await client.query(`INSERT INTO units (token, batch_id, status) VALUES ($1, $2, 'CREATED')`, [token, batch.id]);
            }

            console.log(`    — Master + ${Math.ceil(Number(bConf.num_units) / GROUP_SIZE)} group QR(s); sample unit/group payload (scan or paste): ${firstGroupPayloadJson}`);
        }

        await client.query('COMMIT');
        console.log('');
        console.log('Seed completed successfully.');
        console.log(`  Logins (password ${DEMO_PASSWORD}): ${MFG_EMAIL}, ${V1_EMAIL}, ${V2_EMAIL}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
