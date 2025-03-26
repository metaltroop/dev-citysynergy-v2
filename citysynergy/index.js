// citysynergy/index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const specs = require('./config/swagger');
const { initializeDatabase } = require('./config/database');
const { initializeDevTables } = require('./utils/devInitializer');
const cookieParser = require('cookie-parser');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const profileRoutes = require('./routes/profileRoutes');
const roleRoutes = require('./routes/roleRoutes');
const featureRoutes = require('./routes/featureRoutes');
const activityRoutes = require('./routes/activityRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const issueRoutes = require('./routes/IssueRoutes');

const app = express();

// Middleware
const allowedOrigins = ['http://localhost:5173', 'https://hoppscotch.io/','http://localhost:3000','http://127.0.0.1:5500'];


const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },// Update this to match your frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Add pre-flight handling
app.options('*', cors(corsOptions));

app.use(cors(corsOptions));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Enable cookie parsing

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/issues', issueRoutes);

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

        // After database initialization
        global.app = app;  // Make app globally available
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

//get hellow from localhost:3000
app.get('/', (req, res) => {
    res.send('Hello World!');
}
);

// Export for testing
module.exports = app;

// Start server
startServer();
