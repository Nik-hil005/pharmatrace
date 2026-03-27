const express = require('express');
const router = express.Router();
const pool = require('../db');

// Create manufacturer
router.post('/', async (req, res) => {
    const { name, email, phone, address, license_number } = req.body;

    try {
        const query = `
            INSERT INTO manufacturers (name, email, phone, address, license_number)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const result = await pool.query(query, [name, email, phone, address, license_number]);
        
        res.json({
            success: true,
            manufacturer: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating manufacturer:', error);
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({
                success: false,
                error: 'Email or license number already exists'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to create manufacturer'
            });
        }
    }
});

// Get all manufacturers
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT id, name, email, phone, license_number, created_at
            FROM manufacturers
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query);
        
        res.json({
            success: true,
            manufacturers: result.rows
        });

    } catch (error) {
        console.error('Error getting manufacturers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve manufacturers'
        });
    }
});

// Get manufacturer by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT * FROM manufacturers WHERE id = $1
        `;
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Manufacturer not found'
            });
        }

        res.json({
            success: true,
            manufacturer: result.rows[0]
        });

    } catch (error) {
        console.error('Error getting manufacturer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve manufacturer'
        });
    }
});

module.exports = router;
