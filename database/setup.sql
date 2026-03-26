-- PharmaTrace Database Setup
-- Clean and optimized database initialization

-- Create database (run this separately if you have admin privileges)
-- CREATE DATABASE pharmatrace;

-- Connect to the database
-- \c pharmatrace;

-- Run main schema first
\i schema.sql

-- Then run updates
\i schema_updates.sql

-- Create initial admin user (optional - use create-admin-simple.js instead)
-- INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified)
-- VALUES ('admin@pharmatrace.com', '$2b$12$hashedpassword...', 'Admin', 'User', 'admin', true, true);

COMMIT;

-- Verification queries
SELECT 'Database setup completed!' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as manufacturer_count FROM manufacturers;
SELECT COUNT(*) as vendor_count FROM vendors;
