const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// Import routes
const authRoutes = require('./routes/auth')
const manufacturersRoutes = require('./routes/manufacturers')
const manufacturersCRUDRoutes = require('./routes/manufacturers_crud')
const vendorsRoutes = require('./routes/vendors')
const vendorsCRUDRoutes = require('./routes/vendors_crud')
const verificationRoutes = require('./routes/verification')

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/manufacturers', manufacturersCRUDRoutes)
app.use('/api/manufacturers', manufacturersRoutes)
app.use('/api/vendors', vendorsCRUDRoutes)
app.use('/api/vendors', vendorsRoutes)
app.use('/api', verificationRoutes)

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'PharmaTrace Backend API'
    })
})

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'PharmaTrace Backend API',
        version: '1.0.0',
        endpoints: {
            manufacturers: '/api/manufacturers',
            vendors: '/api/vendors',
            verification: '/api/verify',
            health: '/health'
        }
    })
})

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
    })
})

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`PharmaTrace server running on port ${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/health`)
})