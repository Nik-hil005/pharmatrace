const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    try {
        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if session exists and is valid
        const tokenHash = await bcrypt.hash(token, 10);
        const sessionResult = await pool.query(
            'SELECT s.expires_at, u.id, u.email, u.role, u.is_active FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP',
            [tokenHash]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired session'
            });
        }

        const user = sessionResult.rows[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Add user info to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        next();

    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
};

// Middleware to check user role
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Role-based access control helpers
const requireAdmin = requireRole(['admin']);
const requireManufacturer = requireRole(['admin', 'manufacturer']);
const requireVendor = requireRole(['admin', 'vendor']);
const requireUser = requireRole(['admin', 'manufacturer', 'vendor', 'user']);

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next(); // Continue without authentication
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const tokenHash = await bcrypt.hash(token, 10);
        
        const sessionResult = await pool.query(
            'SELECT s.expires_at, u.id, u.email, u.role, u.is_active FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP',
            [tokenHash]
        );

        if (sessionResult.rows.length > 0) {
            const user = sessionResult.rows[0];
            if (user.is_active) {
                req.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role
                };
            }
        }
    } catch (error) {
        // Ignore errors for optional auth
        console.log('Optional auth failed:', error.message);
    }

    next();
};

module.exports = {
    authenticateToken,
    requireRole,
    requireAdmin,
    requireManufacturer,
    requireVendor,
    requireUser,
    optionalAuth
};
