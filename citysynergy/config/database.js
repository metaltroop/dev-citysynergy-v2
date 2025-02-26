// Database connection configuration

const { Sequelize } = require('sequelize');
const config = require('./config');
const mysql = require('mysql2/promise');
const path = require('path');

// Import models
const CommonUsers = require('../models/common_users');
const CommonDept = require('../models/common_dept');
const CommonInventory = require('../models/common_inventory');
const CommonIssues = require('../models/common_Issues');
const Clashes = require('../models/clashes');
const DevFeatures = require('../models/dev_features');
const DevRoles = require('../models/dev_roles');
const DevRoleFeature = require('../models/dev_roleFeature');
const DevUserRole = require('../models/dev_user_role');
const InventoryRequest = require('../models/inventory_request');
const OTP = require('../models/otp');
const Tenders = require('../models/tenders');

const initializeDatabase = async () => {
    try {
        // Create connection to MySQL server without database
        const connection = await mysql.createConnection({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password
        });

        // Create database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.database.name}`);
        await connection.end();

        // Create Sequelize instance
        const sequelize = new Sequelize(
            config.database.name,
            config.database.user,
            config.database.password,
            {
                host: config.database.host,
                port: config.database.port,
                dialect: 'mysql',
                logging: false,
                pool: {
                    max: 5,
                    min: 0,
                    acquire: 30000,
                    idle: 10000
                }
            }
        );

        // Initialize models
        const models = [
            CommonUsers,
            CommonDept,
            CommonInventory,
            CommonIssues,
            Clashes,
            DevFeatures,
            DevRoles,
            DevRoleFeature,
            DevUserRole,
            InventoryRequest,
            OTP,
            Tenders
        ];

        // Initialize each model
        models.forEach(model => model(sequelize));

        // Set up associations
        Object.values(sequelize.models).forEach(model => {
            if (model.associate) {
                model.associate(sequelize.models);
            }
        });

        // Test connection
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Sync models with database
        await sequelize.sync({ alter: true });
        console.log('Database models synchronized successfully.');

        return sequelize;
    } catch (error) {
        console.error('Unable to initialize database:', error);
        throw error;
    }
};

module.exports = {
    initializeDatabase
};
