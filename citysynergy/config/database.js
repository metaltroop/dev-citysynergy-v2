// Database connection configuration

const { Sequelize } = require('sequelize');
const config = require('./config');
const mysql = require('mysql2/promise');
const path = require('path');
const { initializeDevTables } = require('../utils/devInitializer');



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
        sequelize.models.CommonInventory = require('../models/common_inventory')(sequelize);
        sequelize.models.InventoryRequest = require('../models/inventory_request')(sequelize);
        sequelize.models.InventoryHistory = require('../models/inventory_history')(sequelize);
        sequelize.models.ActivityLog = require('../models/activity_log')(sequelize);
        sequelize.models.UserImage = require('../models/user_images')(sequelize);
        sequelize.models.CommonIssuees = require('../models/Issues')(sequelize);
        sequelize.models.Pincode = require('../models/Pincode')(sequelize);
        sequelize.models.City = require('../models/common_cities')(sequelize);
        sequelize.models.Zones = require('../models/Zones')(sequelize);
        sequelize.models.Locality = require('../models/Locality')(sequelize);
        sequelize.models.LocalArea = require('../models/LocalArea')(sequelize);
        sequelize.models.AllTenders = require('../models/All_Tenders')(sequelize);
        sequelize.models.Clashes = require('../models/Clashes')(sequelize);
        sequelize.models.Messages = require('../models/messages')(sequelize);
        
        
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
            Pincode,
            City,
            Zones,
            Locality,
            LocalArea,
            CommonIssuees,
            CommonInventory,
            InventoryRequest,
            InventoryHistory,
            ActivityLog,
            UserImage,
            AllTenders,
            Clashes,
            Messages
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

        CommonInventory.belongsTo(CommonDepts, {
            foreignKey: 'deptId',
            as: 'department'
        });

        CommonInventory.belongsTo(CommonDepts, {
            foreignKey: 'borrowedFromDeptId',
            as: 'borrowedFromDepartment'
        });

        CommonInventory.belongsTo(CommonUsers, {
            foreignKey: 'lastUpdatedBy',
            as: 'updatedByUser'
        });

        InventoryRequest.belongsTo(CommonDepts, {
            foreignKey: 'fromDept',
            as: 'fromDepartment'
        });

        InventoryRequest.belongsTo(CommonDepts, {
            foreignKey: 'forDept',
            as: 'forDepartment'
        });

        InventoryRequest.belongsTo(CommonInventory, {
            foreignKey: 'itemId',
            targetKey: 'itemId'
        });

        InventoryHistory.belongsTo(CommonInventory, {
            foreignKey: 'itemId',
            targetKey: 'itemId'
        });

        InventoryHistory.belongsTo(CommonUsers, {
            foreignKey: 'performedBy',
            targetKey: 'uuid',
            as: 'performer'
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
            CommonInventory.sync().then(() => console.log('✓ CommonInventory table synchronized')),
            InventoryRequest.sync().then(() => console.log('✓ InventoryRequest table synchronized')),
            InventoryHistory.sync().then(() => console.log('✓ InventoryHistory table synchronized')),
            ActivityLog.sync({alter: true}).then(() => console.log('✓ ActivityLog table synchronized')),
            UserImage.sync().then(() => console.log('✓ UserImage table synchronized')),
            CommonIssuees.sync().then(() => console.log('✓ CommonIssuees table synchronized')),
            Pincode.sync().then(() => console.log('✓ Pincode table synchronized')),
            City.sync().then(() => console.log('✓ City table synchronized')),
            Zones.sync().then(() => console.log('✓ Zones table synchronized')),
            Locality.sync().then(() => console.log('✓ Locality table synchronized')),
            LocalArea.sync().then(() => console.log('✓ LocalArea table synchronized')),
            AllTenders.sync().then(() => console.log('✓ All_Tenders table synchronized')),
            Clashes.sync().then(() => console.log('✓ Clashes table synchronized')),
            Messages.sync().then(() => console.log('✓ Messages table synchronized'))
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
