const pool = require('./db');
const bcrypt = require('bcryptjs');

async function createAdminAccount() {
    try {
        const existingAdmin = await pool.query(
            'SELECT id, email FROM users WHERE email = $1 AND LOWER(TRIM(COALESCE(role, \'\'))) = $2',
            ['admin@pharmatrace.com', 'admin']
        );

        if (existingAdmin.rows.length > 0) {
            console.log('Admin account already exists');
            return;
        }

        const password = 'Admin@123456';
        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `INSERT INTO users (email, password_hash, role, first_name, last_name, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['admin@pharmatrace.com', hashedPassword, 'admin', 'Admin', 'User']
        );

        console.log('Admin account created successfully!');
        console.log('Email: admin@pharmatrace.com');
        console.log('Password: Admin@123456');
    } catch (error) {
        console.error('Error creating admin account:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

createAdminAccount();
