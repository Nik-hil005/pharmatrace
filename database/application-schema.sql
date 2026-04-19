-- Applications Table for Vendor/Manufacturer Registration
-- This table stores pending applications that require admin approval

CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    company_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('vendor', 'manufacturer')),
    license_number VARCHAR(100) NOT NULL,
    city VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    address TEXT,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_role ON applications(role);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications(submitted_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_applications_updated_at();

-- Add comments for documentation
COMMENT ON TABLE applications IS 'Stores vendor/manufacturer registration applications pending admin approval';
COMMENT ON COLUMN applications.status IS 'Application status: pending, approved, or rejected';
COMMENT ON COLUMN applications.reviewed_by IS 'Admin user ID who reviewed the application';
COMMENT ON COLUMN applications.rejection_reason IS 'Reason for application rejection (if rejected)';
