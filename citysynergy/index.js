// citysynergy/index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const specs = require('./config/swagger');
const { initializeDatabase } = require('./config/database');
const { initializeDevTables } = require('./utils/devInitializer');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const profileRoutes = require('./routes/profileRoutes');
const roleRoutes = require('./routes/roleRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/roles', roleRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something broke!',
        error: err.message
    }); 
});

// Initialize database and start server
const startServer = async () => {
    try {
        // Initialize database first
        const sequelize = await initializeDatabase();
        
        // Store sequelize instance in app locals
        app.locals.sequelize = sequelize;

        // Import routes AFTER database initialization
        const authRoutes = require('./routes/authRoutes');
        const departmentRoutes = require('./routes/departmentRoutes');
        const roleRoutes = require('./routes/roleRoutes');
        const userRoutes = require('./routes/userRoutes');

        // Mount routes
        app.use('/api/auth', authRoutes);
        app.use('/api/departments', departmentRoutes);
        app.use('/api/roles', roleRoutes);
        app.use('/api/users', userRoutes);

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Export for testing
module.exports = app;

// Start server
startServer();
