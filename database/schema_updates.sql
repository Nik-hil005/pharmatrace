-- Essential schema updates for role-based access and approval workflows

-- Manufacturer-User relationships (link users to manufacturer profiles)
CREATE TABLE manufacturer_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    manufacturer_id INTEGER REFERENCES manufacturers(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'MANUFACTURER_ADMIN', -- MANUFACTURER_ADMIN, MANUFACTURER_USER
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, manufacturer_id)
);

-- Vendor-User relationships (link users to vendor profiles)
CREATE TABLE vendor_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'VENDOR_ADMIN', -- VENDOR_ADMIN, VENDOR_USER
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, vendor_id)
);

-- Registration requests for manufacturers and vendors
CREATE TABLE IF NOT EXISTS registration_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL, -- MANUFACTURER, VENDOR
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    license_number VARCHAR(100),
    description TEXT,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Master QR codes for batch activation
CREATE TABLE master_qr_codes (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE,
    master_token VARCHAR(255) UNIQUE NOT NULL,
    qr_code_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'CREATED', -- CREATED, ACTIVATED, EXPIRED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    activated_by INTEGER REFERENCES users(id), -- User who activated (vendor)
    expires_at TIMESTAMP
);

-- Batch-level and group-level QR storage for PDF downloads
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS master_qr_code TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_vendor_id INTEGER REFERENCES users(id);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS activation_status VARCHAR(50) DEFAULT 'inactive';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS activated_by INTEGER REFERENCES users(id);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id);

CREATE TABLE IF NOT EXISTS batch_groups (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    group_number INTEGER NOT NULL,
    unit_start INTEGER NOT NULL,
    unit_end INTEGER NOT NULL,
    group_qr_code TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_id, group_number)
);

CREATE INDEX IF NOT EXISTS idx_batch_groups_batch_id ON batch_groups(batch_id);

-- Update batches table to add manufacturer assignment
ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id); -- Admin who assigned batch to vendor
ALTER TABLE batches ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP; -- When batch was assigned to vendor

-- Update units table to add activation tracking
ALTER TABLE units ADD COLUMN IF NOT EXISTS activated_by INTEGER REFERENCES users(id); -- User who activated unit
ALTER TABLE units ADD COLUMN IF NOT EXISTS activation_method VARCHAR(50); -- MASTER_QR, INDIVIDUAL_QR

-- Indexes for new tables
CREATE INDEX idx_manufacturer_users_user_id ON manufacturer_users(user_id);
CREATE INDEX idx_manufacturer_users_manufacturer_id ON manufacturer_users(manufacturer_id);
CREATE INDEX idx_vendor_users_user_id ON vendor_users(user_id);
CREATE INDEX idx_vendor_users_vendor_id ON vendor_users(vendor_id);
CREATE INDEX idx_registration_requests_status ON registration_requests(status);

-- Vendor application / profile: city (required for vendor applications via API)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS city VARCHAR(150);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(150);

-- Consumer scan regional check + vendor geocode cache
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS scanned_latitude DOUBLE PRECISION;
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS scanned_longitude DOUBLE PRECISION;
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS scanned_city VARCHAR(255);
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS vendor_city VARCHAR(255);
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS location_status VARCHAR(20);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_lat DOUBLE PRECISION;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_lon DOUBLE PRECISION;

-- Application registration password (bcrypt hash only)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
CREATE INDEX idx_registration_requests_type ON registration_requests(request_type);
CREATE INDEX idx_master_qr_codes_batch_id ON master_qr_codes(batch_id);
CREATE INDEX idx_master_qr_codes_token ON master_qr_codes(master_token);

-- Trigger for registration_requests updated_at
CREATE TRIGGER update_registration_requests_updated_at BEFORE UPDATE ON registration_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
