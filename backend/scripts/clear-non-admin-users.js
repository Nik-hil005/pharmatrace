/**
 * Removes all user accounts except those with role "admin" (case-insensitive).
 * Clears foreign-key references from batches, units, applications, etc. first.
 *
 * Usage (from backend directory): node scripts/clear-non-admin-users.js
 */

const pool = require('../db');

async function tableExists(client, name) {
    const r = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [name]
    );
    return r.rows.length > 0;
}

async function clearNonAdminUsers() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const adminCount = await client.query(
            `SELECT COUNT(*)::int AS c FROM users WHERE LOWER(TRIM(COALESCE(role, ''))) = 'admin'`
        );
        if (adminCount.rows[0].c === 0) {
            console.warn(
                'Warning: no users with role "admin" found. All non-admin accounts will still be removed. Create an admin after (e.g. node create-admin-simple.js).'
            );
        }

        const { rows } = await client.query(
            `SELECT id, email, role FROM users WHERE LOWER(TRIM(COALESCE(role, ''))) <> 'admin'`
        );
        if (rows.length === 0) {
            console.log('No non-admin users found. Nothing to delete.');
            await client.query('COMMIT');
            return;
        }

        const ids = rows.map((r) => r.id);
        console.log(`Removing ${ids.length} non-admin user(s):`);
        rows.forEach((r) => console.log(`  - id=${r.id} email=${r.email} role=${r.role}`));

        await client.query(`DELETE FROM user_sessions WHERE user_id = ANY($1::int[])`, [ids]);

        if (await tableExists(client, 'vendor_users')) {
            await client.query(`DELETE FROM vendor_users WHERE user_id = ANY($1::int[])`, [ids]);
        }
        if (await tableExists(client, 'manufacturer_users')) {
            await client.query(`DELETE FROM manufacturer_users WHERE user_id = ANY($1::int[])`, [ids]);
        }

        if (await tableExists(client, 'registration_requests')) {
            await client.query(`DELETE FROM registration_requests WHERE user_id = ANY($1::int[])`, [ids]);
        }

        await client.query(
            `UPDATE batches SET assigned_vendor_id = NULL WHERE assigned_vendor_id = ANY($1::int[])`,
            [ids]
        );
        await client.query(
            `UPDATE batches SET activated_by = NULL WHERE activated_by = ANY($1::int[])`,
            [ids]
        );
        await client.query(
            `UPDATE batches SET assigned_by = NULL WHERE assigned_by = ANY($1::int[])`,
            [ids]
        );

        if (await tableExists(client, 'units')) {
            await client.query(`UPDATE units SET activated_by = NULL WHERE activated_by = ANY($1::int[])`, [
                ids
            ]);
        }

        if (await tableExists(client, 'applications')) {
            await client.query(
                `UPDATE applications SET reviewed_by = NULL WHERE reviewed_by = ANY($1::int[])`,
                [ids]
            );
        }

        if (await tableExists(client, 'master_qr_codes')) {
            await client.query(
                `UPDATE master_qr_codes SET activated_by = NULL WHERE activated_by = ANY($1::int[])`,
                [ids]
            );
        }

        if (await tableExists(client, 'scan_logs')) {
            await client.query(`UPDATE scan_logs SET user_id = NULL WHERE user_id = ANY($1::int[])`, [ids]);
        }

        const del = await client.query(`DELETE FROM users WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
        console.log(`Deleted ${del.rowCount} user row(s). Admin accounts preserved.`);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('clear-non-admin-users failed:', err.message);
        process.exitCode = 1;
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

clearNonAdminUsers().catch(() => process.exit(1));
