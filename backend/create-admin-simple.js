const { Pool } = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdminAccount() {
  try {
    await require('./db').connect();
    
    const existingAdmin = await require('./db').query(
      'SELECT id, email FROM users WHERE email = $1 AND role = $2',
      ['admin@pharmatrace.com', 'admin']
    );
    
    if (existingAdmin.rows.length > 0) {
      console.log('Admin account already exists');
      return;
    }
    
    const password = 'Admin@123456';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await require('./db').query(
      'INSERT INTO users (email, password_hash, role, first_name, last_name, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      ['admin@pharmatrace.com', hashedPassword, 'admin', 'Admin', 'User']
    );
    
    console.log('Admin account created successfully!');
    console.log('Email: admin@pharmatrace.com');
    console.log('Password: Admin@123456');
    
    await require('./db').end();
  } catch (error) {
    console.error('Error creating admin account:', error);
  }
}

createAdminAccount();
