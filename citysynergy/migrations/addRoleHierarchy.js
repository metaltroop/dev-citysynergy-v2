// Migration script to add hierarchy levels to existing roles
require('dotenv').config();
const { Sequelize } = require('sequelize');

// Helper function to get hierarchy level for a role (same as in devInitializer.js)
const getRoleHierarchyLevel = (roleName) => {
    switch (roleName) {
        case 'Dev Admin':
            return 10; // Highest privilege
        case 'Owner':
            return 20;
        case 'System Creator':
            return 30;
        default:
            if (roleName.toLowerCase().includes('admin')) {
                return 15; // Other admin roles
            } else if (roleName.toLowerCase().includes('manager')) {
                return 25; // Manager roles
            } else if (roleName.toLowerCase().includes('supervisor')) {
                return 35; // Supervisor roles
            } else if (roleName.toLowerCase().includes('user')) {
                return 90; // Regular users
            }
            return 100; // Default level
    }
};

async function migrateRoleHierarchy() {
    console.log('Starting role hierarchy migration...');
    
    // Initialize Sequelize connection
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

    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully');

        // Check if hierarchyLevel column exists
        try {
            console.log('Checking if hierarchyLevel column exists in dev_roles table...');
            await sequelize.query(`
                SELECT hierarchyLevel FROM dev_roles LIMIT 1
            `);
            console.log('✓ hierarchyLevel column already exists');
        } catch (error) {
            if (error.original && error.original.code === 'ER_BAD_FIELD_ERROR') {
                // Add hierarchyLevel column if it doesn't exist
                console.log('Adding hierarchyLevel column to dev_roles table...');
                await sequelize.query(`
                    ALTER TABLE dev_roles 
                    ADD COLUMN hierarchyLevel INT NOT NULL DEFAULT 100 
                    COMMENT 'Role hierarchy level (lower number = higher privilege)'
                `);
                console.log('✓ Column added successfully');
            } else {
                throw error;
            }
        }

        // Get all roles
        const [roles] = await sequelize.query(`
            SELECT roleId, roleName FROM dev_roles WHERE isDeleted = 0
        `);

        console.log(`Found ${roles.length} active roles`);

        // Set hierarchy levels based on role names
        for (const role of roles) {
            const level = getRoleHierarchyLevel(role.roleName);
            
            // Update the role's hierarchy level
            await sequelize.query(`
                UPDATE dev_roles 
                SET hierarchyLevel = :level 
                WHERE roleId = :roleId
            `, {
                replacements: { level, roleId: role.roleId }
            });
            
            console.log(`Updated role "${role.roleName}" (${role.roleId}) with hierarchy level ${level}`);
        }

        console.log('Role hierarchy migration completed successfully');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await sequelize.close();
        console.log('Database connection closed');
    }
}

// Run the migration if this script is executed directly
if (require.main === module) {
    migrateRoleHierarchy()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

module.exports = { migrateRoleHierarchy }; 