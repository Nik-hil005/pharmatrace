const express = require('express');
const router = express.Router();
const pool = require('../db');

// Create vendor
router.post('/', async (req, res) => {
    const { name, email, phone, address, license_number } = req.body;

    try {
        const query = `
            INSERT INTO vendors (name, email, phone, address, license_number)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const result = await pool.query(query, [name, email, phone, address, license_number]);
        
        res.json({
            success: true,
            vendor: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating vendor:', error);
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({
                success: false,
                error: 'Email or license number already exists'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to create vendor'
            });
        }
    }
});

// Get all vendors
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT id, name, email, phone, license_number, created_at
            FROM vendors
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query);
        
        res.json({
            success: true,
            vendors: result.rows
        });

    } catch (error) {
        console.error('Error getting vendors:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve vendors'
        });
    }
});

// Get vendor by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT * FROM vendors WHERE id = $1
        `;
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vendor not found'
            });
        }

        res.json({
            success: true,
            vendor: result.rows[0]
        });

    } catch (error) {
        console.error('Error getting vendor:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve vendor'
        });
    }
});

module.exports = router;
