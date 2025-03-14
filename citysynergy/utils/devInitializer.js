const bcrypt = require('bcrypt');
require('dotenv').config();


const getRolePermissions = (roleName, feature) => {
    switch (roleName) {
        case 'Dev Admin':
            return {
                canRead: true,
                canWrite: true,
                canUpdate: true,
                canDelete: true
            };
        case 'Owner':
            return { 
                canRead: true,
                canWrite: true,
                canUpdate: true,
                canDelete: false
            };
        case 'System Creator': 
            return {
                canRead: true,
                canWrite: true,
                canUpdate: false,
                canDelete: false
            };
        default:
            return {
                canRead: false,
                canWrite: false,
                canUpdate: false,
                canDelete: false
            };
    }
};

const initializeDevTables = async (sequelize) => {
    try {
        console.log('\n=== Starting Dev Tables Initialization ===');
        const { DevRoles, DevFeatures, DevRoleFeature, DevUserRole, CommonUsers } = sequelize.models;

        if (!DevUserRole) {
            throw new Error('DevUserRole model not found in sequelize.models');
        }

        // Define all required features
        const requiredFeatures = [
            { featureName: 'Users Management', featureDescription: 'Manage system users' },
            { featureName: 'Department Management', featureDescription: 'Manage departments' },
            { featureName: 'Role Management', featureDescription: 'Manage roles' },
            { featureName: 'Feature Management', featureDescription: 'Manage features' },
            { featureName: 'Clashes Management', featureDescription: 'Manage clashes' }
        ];

        // Check and create missing features
        console.log('Checking and creating features...');
        const existingFeatures = await DevFeatures.findAll();
        const existingFeatureNames = existingFeatures.map(f => f.featureName);
        
        const missingFeatures = requiredFeatures.filter(
            f => !existingFeatureNames.includes(f.featureName)
        );

        if (missingFeatures.length > 0) {
            console.log(`Creating ${missingFeatures.length} missing features...`);
            for (let i = 0; i < missingFeatures.length; i++) {
                const paddedNumber = String(existingFeatures.length + i + 1).padStart(3, '0');
                await DevFeatures.create({
                    ...missingFeatures[i],
                    featureId: `FEAT${paddedNumber}`
                });
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log(`✓ Created ${missingFeatures.length} missing features successfully`);
        } else {
            console.log('✓ All required features exist');
        }

        // Check if roles exist
        const existingRoles = await DevRoles.findAll();
        if (existingRoles.length === 0) {
            console.log('Creating dev roles...');
            const roleData = [
                { roleName: 'Dev Admin' },
                { roleName: 'Owner' },
                { roleName: 'System Creator' }
            ];

            const roles = [];
            for (let i = 0; i < roleData.length; i++) {
                const paddedNumber = String(i + 1).padStart(3, '0');
                const role = await DevRoles.create({
                    ...roleData[i],
                    roleId: `DROL${paddedNumber}`
                });
                roles.push(role);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log(`✓ Created ${roles.length} dev roles successfully`);
        } else {
            console.log('✓ Dev roles already exist, skipping creation');
        }

        // Rest of the code for dev admin user creation...
        let devAdmin = await CommonUsers.findOne({
            where: { username: 'devAdmin' }
        });

        if (!devAdmin) {
            console.log('Creating dev admin user...');
            const devAdminEmail = process.env.devadminemail;
            const devAdminPassword = process.env.devadminpassword;
            const hashedPassword = await bcrypt.hash(devAdminPassword, 10);
            
            devAdmin = await CommonUsers.create({
                username: 'devAdmin',
                password: hashedPassword,
                email: devAdminEmail,  // Changed from devAdminPassword to devAdminEmail
                type: 'dev',
                isFirstLogin: false,
                needsPasswordChange: false
            });
            console.log('✓ Created dev admin user successfully');
        } else {
            console.log('✓ Dev admin user already exists, skipping creation');
        }

        // Get Dev Admin role
        const devAdminRole = await DevRoles.findOne({
            where: { roleName: 'Dev Admin' }
        });

        if (!devAdminRole) {
            throw new Error('Dev Admin role not found');
        }

        // Check and create user role assignment
        const existingUserRole = await DevUserRole.findOne({
            where: {
                userId: devAdmin.uuid,
                roleId: devAdminRole.roleId
            }
        });

        if (!existingUserRole) {
            console.log('Assigning Dev Admin role to dev admin user...');
            await DevUserRole.create({
                userId: devAdmin.uuid,
                roleId: devAdminRole.roleId
            });
            console.log('✓ Assigned Dev Admin role successfully');
        } else {
            console.log('✓ Dev admin role assignment already exists');
        }

        // Get all roles and features for permission assignment
        const allRoles = await DevRoles.findAll();
        const allFeatures = await DevFeatures.findAll();

        console.log('Checking and assigning feature permissions to all roles...');
        
        for (const role of allRoles) {
            console.log(`Processing permissions for role: ${role.roleName}`);
            let assignedCount = 0;

            for (const feature of allFeatures) {
                const existingRoleFeature = await DevRoleFeature.findOne({
                    where: {
                        roleId: role.roleId,
                        featureId: feature.featureId
                    }
                });

                if (!existingRoleFeature) {
                    const permissions = getRolePermissions(role.roleName, feature);
                    await DevRoleFeature.create({
                        roleId: role.roleId,
                        featureId: feature.featureId,
                        ...permissions
                    });
                    assignedCount++;
                }
            }
            
            if (assignedCount > 0) {
                console.log(`✓ Assigned ${assignedCount} features to ${role.roleName}`);
            } else {
                console.log(`✓ Features already assigned to ${role.roleName}`);
            }
        }

        console.log('=== Dev Tables Initialization Completed Successfully ===\n');
        return true;
    } catch (error) {
        console.error('\n❌ Error initializing dev tables:', error);
        throw error;
    }
};

module.exports = {
    initializeDevTables
};