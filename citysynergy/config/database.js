// Database connection configuration

const { Sequelize } = require('sequelize');
const config = require('./config');
const mysql = require('mysql2/promise');
const path = require('path');
const { initializeDevTables } = require('../utils/devInitializer');

// Import all models
const CommonUsers = require('../models/common_users');
const CommonDepts = require('../models/common_dept');
const DevRoles = require('../models/dev_roles');
const DevFeatures = require('../models/dev_features');
const DevUserRole = require('../models/dev_user_role');
const DevRoleFeature = require('../models/dev_roleFeature');
const ActivityLog = require('../models/activity_log');
const UserImage = require('../models/user_images');

const initializeDatabase = async () => {
    try {
        console.log('\n=== Starting Database Initialization ===');
        
        // First, check if database exists
        console.log('Checking database existence...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });

        try {
            await connection.query(`USE ${process.env.DB_NAME}`);
            console.log(`✓ Database '${process.env.DB_NAME}' already exists`);
        } catch (error) {
            if (error.code === 'ER_BAD_DB_ERROR') {
                console.log(`❌ Database '${process.env.DB_NAME}' not found`);
                console.log(`Creating database '${process.env.DB_NAME}'...`);
                await connection.query(`CREATE DATABASE ${process.env.DB_NAME}`);
                console.log(`✓ Database '${process.env.DB_NAME}' created successfully`);
            } else {
                throw error;
            }
        } finally {
            await connection.end();
        }

        // Initialize Sequelize
        console.log('\nInitializing Sequelize connection...');
        const sequelize = new Sequelize(
            process.env.DB_NAME,
            process.env.DB_USER,
            process.env.DB_PASSWORD,
            {
                host: process.env.DB_HOST,
                dialect: 'mysql',
                logging: false
            }
        );

        await sequelize.authenticate();
        console.log('✓ Database connection established successfully');

        // Register all models with sequelize
        console.log('\nRegistering models...');
        
        // Independent tables first
        sequelize.models.CommonDepts = require('../models/common_dept')(sequelize);
        sequelize.models.DevRoles = require('../models/dev_roles')(sequelize);
        sequelize.models.DevFeatures = require('../models/dev_features')(sequelize);
        
        // Then dependent tables
        sequelize.models.CommonUsers = require('../models/common_users')(sequelize);
        sequelize.models.DevRoleFeature = require('../models/dev_roleFeature')(sequelize);
        sequelize.models.DevUserRole = require('../models/dev_user_role')(sequelize);
        sequelize.models.OTP = require('../models/otp')(sequelize);
        sequelize.models.Tender = require('../models/tenders')(sequelize);
        sequelize.models.Clash = require('../models/clashes')(sequelize);
        sequelize.models.CommonIssues = require('../models/common_issues')(sequelize);
        sequelize.models.CommonInventory = require('../models/common_inventory')(sequelize);
        sequelize.models.InventoryRequest = require('../models/inventory_request')(sequelize);
        sequelize.models.ActivityLog = require('../models/activity_log')(sequelize);
        sequelize.models.UserImage = require('../models/user_images')(sequelize);
        
        console.log('✓ All models registered successfully');

        // Set up associations
        console.log('\nSetting up model associations...');
        const { 
            CommonUsers, 
            CommonDepts, 
            DevRoles, 
            DevFeatures, 
            DevRoleFeature, 
            DevUserRole,
            OTP,
            Tender,
            Clash,
            CommonIssues,
            CommonInventory,
            InventoryRequest,
            ActivityLog,
            UserImage
        } = sequelize.models;

        // Dev role associations
        DevRoles.belongsToMany(DevFeatures, {
            through: DevRoleFeature,
            foreignKey: 'roleId'
        });

        DevFeatures.belongsToMany(DevRoles, {
            through: DevRoleFeature,
            foreignKey: 'featureId'
        });

        DevUserRole.belongsTo(DevRoles, {
            foreignKey: 'roleId',
            as: 'role'
        });

        DevRoles.hasMany(DevUserRole, {
            foreignKey: 'roleId',
            as: 'userRoles'
        });

        // Common Users associations
        CommonUsers.hasMany(OTP, {
            foreignKey: 'userId',
            sourceKey: 'uuid'
        });

        CommonUsers.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            targetKey: 'deptId'
        });

        // Department associations
        CommonDepts.hasMany(CommonUsers, {
            foreignKey: 'deptId',
            sourceKey: 'deptId'
        });

        
        CommonDepts.belongsTo(CommonUsers, {
             foreignKey: 'deptHead',
             as: 'DeptHead'
            });

        // Tender associations
        Tender.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            targetKey: 'deptId'
        });

        // Clash associations
        Clash.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            targetKey: 'deptId'
        });

        CommonIssues.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            targetKey: 'deptId'
        });

        CommonInventory.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            targetKey: 'deptId'
        });

        InventoryRequest.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            targetKey: 'deptId'
        });

        // Dev user role associations
        DevUserRole.belongsTo(CommonUsers, {
            foreignKey: 'userId',
            targetKey: 'uuid',
            as: 'CommonUser'
        });

        CommonUsers.hasMany(DevUserRole, {
            foreignKey: 'userId',
            sourceKey: 'uuid'
        });

        // ActivityLog associations
        CommonUsers.hasMany(ActivityLog, {
            foreignKey: 'userId',
            sourceKey: 'uuid'
        });

        ActivityLog.belongsTo(CommonUsers, {
            foreignKey: 'userId',
            targetKey: 'uuid'
        });

        CommonDepts.hasMany(ActivityLog, {
            foreignKey: 'deptId',
            sourceKey: 'deptId'
        });

        ActivityLog.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            targetKey: 'deptId'
        });

        // User Image associations
        CommonUsers.hasMany(UserImage, {
            foreignKey: 'userId',
            sourceKey: 'uuid'
        });

        UserImage.belongsTo(CommonUsers, {
            foreignKey: 'userId',
            targetKey: 'uuid'
        });

        console.log('✓ All model associations set up successfully');

        // Sync tables in correct order
        console.log('\nSynchronizing models with database...'); 
        
        // First, sync base tables without foreign keys
        console.log('Syncing base tables...');
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        
        await CommonDepts.sync();
        console.log('✓ CommonDepts table synchronized');
        
        await CommonUsers.sync();
        console.log('✓ CommonUsers table synchronized');

        // Add foreign key constraints if they don't exist
        console.log('\nChecking and adding foreign key constraints...');
        try {
            // Check if constraint exists
            const [constraints] = await sequelize.query(`
                SELECT CONSTRAINT_NAME 
                FROM information_schema.TABLE_CONSTRAINTS 
                WHERE TABLE_NAME = 'common_users' 
                AND CONSTRAINT_NAME = 'fk_user_dept'
            `);

            if (constraints.length === 0) {
                await sequelize.query(`
                    ALTER TABLE common_users 
                    ADD CONSTRAINT fk_user_dept 
                    FOREIGN KEY (deptId) 
                    REFERENCES common_dept(deptId) 
                    ON DELETE SET NULL 
                    ON UPDATE CASCADE
                `);
                console.log('✓ Added foreign key constraints');
            } else {
                console.log('✓ Foreign key constraints already exist');
            }
        } catch (error) {
            console.error('Error handling foreign key constraints:', error);
            throw error;
        }

        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        // Then sync remaining tables
        console.log('\nSyncing remaining tables...');
        await Promise.all([
            DevRoles.sync().then(() => console.log('✓ DevRoles table synchronized')),
            DevFeatures.sync().then(() => console.log('✓ DevFeatures table synchronized')),
            DevRoleFeature.sync().then(() => console.log('✓ DevRoleFeature table synchronized')),
            DevUserRole.sync().then(() => console.log('✓ DevUserRole table synchronized')),
            OTP.sync().then(() => console.log('✓ OTP table synchronized')),
            Tender.sync().then(() => console.log('✓ Tender table synchronized')),
            Clash.sync().then(() => console.log('✓ Clash table synchronized')),
            CommonIssues.sync().then(() => console.log('✓ CommonIssues table synchronized')),
            CommonInventory.sync().then(() => console.log('✓ CommonInventory table synchronized')),
            InventoryRequest.sync().then(() => console.log('✓ InventoryRequest table synchronized')),
            ActivityLog.sync().then(() => console.log('✓ ActivityLog table synchronized')),
            UserImage.sync().then(() => console.log('✓ UserImage table synchronized'))
        ]);

        console.log('✓ All models synchronized successfully\n'); 
 
        // Initialize dev tables
        await initializeDevTables(sequelize);

        console.log('=== Database Initialization Completed Successfully ===\n');
        return sequelize;
    } catch (error) {
        console.error('\n❌ Error initializing database:', error);
        throw error;
    }
};

module.exports = {
    initializeDatabase
};
