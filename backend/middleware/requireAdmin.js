const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function requireAdmin(req, res, next) {
    const raw = req.headers.authorization;
    const token = raw && raw.replace(/^Bearer\s+/i, '');
    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (String(decoded.role || '').toLowerCase() !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        req.adminUser = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

module.exports = requireAdmin;
