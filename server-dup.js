const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Serve static files from frontend directory
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));
app.use('/js', express.static(path.join(__dirname, 'frontend/js')));
app.use('/pages', express.static(path.join(__dirname, 'frontend/pages')));

// Main route - serve the leverage tool
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/pages/leverage.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Future API endpoints
app.get('/api/exchanges', (req, res) => {
    res.json({
        available: ['binance', 'bybit', 'okx'],
        default: 'binance'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 ClickShift Leverage Server running on port ${PORT}`);
    console.log(`📱 Open your browser to: http://localhost:${PORT}`);
    console.log(`🎯 Direct leverage tool: http://localhost:${PORT}/pages/leverage.html`);
    console.log(`⚡ Health check: http://localhost:${PORT}/health`);
});

module.exports = app;