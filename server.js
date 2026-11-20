
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const apiRoutes = require('./routes/apiRoutes');
const errorHandler = require('./middleware/errorHandler');

app.use(cors());
app.use(express.json());

// Homepage
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Batloung FreshFlow!',
        system: 'Fresh Produce Distribution Management System'
    });
});

// API routes
app.use('/api', apiRoutes);

// Error handling
app.use(errorHandler);

// Route not found
app.use((req, res) => {
    res.status(404).json({
        message: 'Requested route not found'
    });
});

// Start server
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Batloung FreshFlow running on port ${PORT}`);
});
