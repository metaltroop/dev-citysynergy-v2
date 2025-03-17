// scripts/addHierarchyToDeptRoles.js
// One-time script to add hierarchy levels to existing department role tables

const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const mysql = require('mysql2/promise'); // Use mysql2 directly for connection
require('dotenv').config(); // Load environment variables

async function addHierarchyToDeptRoles() {
    // Create a direct connection to the database
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'myproject.mysql.database.azure.com',
        user: process.env.DB_USER || 'cityadmin',
        password: process.env.DB_PASSWORD || 'synergy@2025',
        database: process.env.DB_NAME || 'citysynergydb',
        port: process.env.DB_PORT || 3306
    });
    
    try {
        console.log('Starting migration: Adding hierarchy levels to department role tables...');
        
        // Get all departments
        const [departments] = await connection.query(
            'SELECT deptId, deptCode FROM common_dept WHERE isDeleted = 0'
        );
        
        console.log(`Found ${departments.length} active departments`);
        
        // Process each department
        for (const dept of departments) {
            const deptId = dept.deptId;
            const deptCode = dept.deptCode.toLowerCase();
            const roleTableName = `${deptId}_${deptCode}_role`;
            
            console.log(`Processing department: ${deptId} (${deptCode})`);
            
            try {
                // Check if table exists
                const [tables] = await connection.query(
                    `SHOW TABLES LIKE '${roleTableName}'`
                );
                
                if (tables.length === 0) {
                    console.log(`Table ${roleTableName} does not exist, skipping...`);
                    continue;
                }
                
                // Check if hierarchyLevel column already exists
                const [columns] = await connection.query(
                    `SHOW COLUMNS FROM \`${roleTableName}\` LIKE 'hierarchyLevel'`
                );
                
                if (columns.length === 0) {
                    // Add hierarchyLevel column if it doesn't exist
                    console.log(`Adding hierarchyLevel column to ${roleTableName}`);
                    await connection.query(
                        `ALTER TABLE \`${roleTableName}\` 
                         ADD COLUMN hierarchyLevel INT DEFAULT 100 
                         COMMENT 'Lower number means higher privilege (e.g., 10 is higher than 50)'`
                    );
                    
                    // Update hierarchy levels based on role names
                    console.log(`Updating hierarchy levels for existing roles in ${roleTableName}`);
                    
                    // Define hierarchy levels based on role names/IDs
                    const hierarchyUpdates = [
                        { pattern: 'ROLE_HEAD', level: 10 },
                        { pattern: 'ROLE_ADMIN', level: 20 },
                        { pattern: 'HEAD', level: 10 },
                        { pattern: 'ADMIN', level: 20 },
                        { pattern: 'MANAGER', level: 50 },
                        { pattern: 'SUPERVISOR', level: 60 },
                        { pattern: 'STAFF', level: 100 },
                        { pattern: 'USER', level: 100 },
                        { pattern: 'VIEWER', level: 110 }
                    ];
                    
                    // Apply updates based on role name patterns
                    for (const update of hierarchyUpdates) {
                        await connection.query(
                            `UPDATE \`${roleTableName}\` 
                             SET hierarchyLevel = ? 
                             WHERE (roleId LIKE ? OR roleName LIKE ?) 
                             AND isDeleted = 0`,
                            [
                                update.level,
                                `%${update.pattern}%`,
                                `%${update.pattern}%`
                            ]
                        );
                    }
                    
                    // Set default hierarchy for any remaining roles
                    await connection.query(
                        `UPDATE \`${roleTableName}\` 
                         SET hierarchyLevel = 100 
                         WHERE hierarchyLevel IS NULL AND isDeleted = 0`
                    );
                    
                    console.log(`Hierarchy levels updated for ${roleTableName}`);
                } else {
                    console.log(`HierarchyLevel column already exists in ${roleTableName}`);
                }
            } catch (error) {
                console.error(`Error processing ${roleTableName}: ${error.message}`);
                // Continue with next department
            }
        }
        
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        // Close database connection
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

// Run the migration
addHierarchyToDeptRoles()
    .then(() => {
        console.log('Script execution completed.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Script execution failed:', err);
        process.exit(1);
    }); 