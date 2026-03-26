const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../db');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper functions
const generateToken = (userId, email, role) => {
    return jwt.sign(
        { userId, email, role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

const hashToken = (token) => {
    return bcrypt.hash(token, 10);
};

// Register new user (email/password)
router.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, role = 'user' } = req.body;

    try {
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
             VALUES ($1, $2, $3, $4, $5, false)
             RETURNING id, email, first_name, last_name, role, created_at`,
            [email, passwordHash, firstName, lastName, role]
        );

        const user = result.rows[0];
        const token = generateToken(user.id, user.email, user.role);
        const tokenHash = await hashToken(token);

        // Store session
        await pool.query(
            'INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [user.id, tokenHash, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), req.ip, req.get('User-Agent')]
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                emailVerified: user.email_verified
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// Login with email/password
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user
        const result = await pool.query(
            'SELECT id, email, password_hash, first_name, last_name, role, is_active, last_login FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        const user = result.rows[0];

        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }


        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user.id, user.email, user.role);
        const tokenHash = await hashToken(token);

        // Update last login and store session
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        await pool.query(
            'INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [user.id, tokenHash, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), req.ip, req.get('User-Agent')]
        );

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                lastLogin: user.last_login
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});


// Logout
router.post('/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'No token provided'
        });
    }

    try {
        // Remove session from database
        const tokenHash = await hashToken(token);
        await pool.query(
            'DELETE FROM user_sessions WHERE token_hash = $1',
            [tokenHash]
        );

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

// Verify token
router.get('/verify', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'No token provided'
        });
    }

    try {
        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if session exists
        const tokenHash = await hashToken(token);
        const sessionResult = await pool.query(
            'SELECT s.expires_at, u.id, u.email, u.first_name, u.last_name, u.role, u.is_active FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP',
            [tokenHash]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        const user = sessionResult.rows[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid token'
        });
    }
});

// Get user profile
router.get('/profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'No token provided'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const result = await pool.query(
            'SELECT id, email, first_name, last_name, role, avatar_url, email_verified, created_at, last_login FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                avatarUrl: user.avatar_url,
                emailVerified: user.email_verified,
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get profile'
        });
    }
});

module.exports = router;
