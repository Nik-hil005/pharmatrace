-- PharmaTrace Database Schema
-- Cleaned and optimized schema for pharmaceutical authentication and supply chain tracking

-- Users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user', -- user, manufacturer, vendor, admin
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for JWT token management
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturers table
CREATE TABLE manufacturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendors table
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Batches table
CREATE TABLE batches (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    manufacturer_id INTEGER REFERENCES manufacturers(id),
    medicine_name VARCHAR(255) NOT NULL,
    description TEXT,
    manufacturing_date DATE,
    expiry_date DATE,
    total_units INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    vendor_id INTEGER REFERENCES vendors(id),
    status VARCHAR(50) DEFAULT 'PENDING' -- PENDING, ACTIVATED, EXPIRED
);

-- Units table (individual medicine packages with unique tokens)
CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    batch_id INTEGER REFERENCES batches(id),
    qr_code_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'CREATED', -- CREATED, ACTIVATED, SCANNED, EXPIRED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    first_scanned_at TIMESTAMP,
    scan_count INTEGER DEFAULT 0
);

-- Scans table (logging every QR scan with time and optional GPS/device info)
CREATE TABLE scans (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER REFERENCES units(id),
    token VARCHAR(255) NOT NULL,
    scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    device_info JSONB,
    scan_result VARCHAR(50) NOT NULL -- VERIFIED, SUSPICIOUS, FAKE
);

-- Scan alerts table for suspicious activity
CREATE TABLE scan_alerts (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER REFERENCES scans(id),
    unit_id INTEGER REFERENCES units(id),
    alert_type VARCHAR(100) NOT NULL, -- DUPLICATE_SCAN, PRE_ACTIVATION_SCAN, EXCESSIVE_SCANS, LOCATION_ANOMALY
    description TEXT,
    severity VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);

-- Indexes for performance optimization
CREATE INDEX idx_units_token ON units(token);
CREATE INDEX idx_units_batch_id ON units(batch_id);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_scans_token ON scans(token);
CREATE INDEX idx_scans_scan_time ON scans(scan_time);
CREATE INDEX idx_scans_unit_id ON scans(unit_id);
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_manufacturer_id ON batches(manufacturer_id);
CREATE INDEX idx_batches_vendor_id ON batches(vendor_id);

-- User-related indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_manufacturers_updated_at BEFORE UPDATE ON manufacturers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scan_alerts_updated_at BEFORE UPDATE ON scan_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
