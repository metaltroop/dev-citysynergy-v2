// utils/dynamicModelGenerator.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Cache for department models
const modelCache = new Map();

const createDepartmentModels = (sequelize, deptId, deptCode) => {
    try {
        const modelPrefix = `${deptId}_${deptCode}`;
        
        // Check cache first
        if (modelCache.has(modelPrefix)) {
            return modelCache.get(modelPrefix);
        }

        // Define models
        const DeptRole = sequelize.define(
          `${modelPrefix}_Role`,
          {
            roleId: {
              type: DataTypes.STRING,
              primaryKey: true,
            },
            roleName: {
              type: DataTypes.STRING,
              allowNull: false,
            },
            description: {
              type: DataTypes.STRING,
            },
            hierarchyLevel: {
              type: DataTypes.INTEGER,
              defaultValue: 100,
              comment: 'Lower number means higher privilege (e.g., 10 is higher than 50)'
            },
            isDeleted: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
          },
          {
            tableName: `${deptId}_${deptCode.toLowerCase()}_role`,
            timestamps: true,
          }
        );

        const DeptFeature = sequelize.define(`${modelPrefix}_Feature`, {
            featureId: {
                type: DataTypes.STRING,
                primaryKey: true
            },
            featureName: {
                type: DataTypes.STRING,
                allowNull: false
            },
            isDeleted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            }
        }, {
            tableName: `${deptId}_${deptCode.toLowerCase()}_feature`,
            timestamps: true
        });

        const DeptRoleFeature = sequelize.define(`${modelPrefix}_RoleFeature`, {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            roleId: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: DeptRole,
                    key: 'roleId'
                }
            },
            featureId: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: DeptFeature,
                    key: 'featureId'
                }
            },
            canRead: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            canWrite: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            canUpdate: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            canDelete: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            }
        }, {
            tableName: `${deptId}_${deptCode.toLowerCase()}_role_feature`,
            timestamps: true
        });

        const DeptUserRole = sequelize.define(`${modelPrefix}_UserRole`, {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            userId: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: 'common_users',
                    key: 'uuid'
                }
            },
            roleId: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: DeptRole,
                    key: 'roleId'
                }
            },
            isDeleted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            }
        }, {
            tableName: `${deptId}_${deptCode.toLowerCase()}_user_role`,
            timestamps: true
        });

        // Set up associations
        DeptRole.belongsToMany(DeptFeature, {
            through: DeptRoleFeature,
            foreignKey: 'roleId',
            otherKey: 'featureId'
        });

        DeptFeature.belongsToMany(DeptRole, {
            through: DeptRoleFeature,
            foreignKey: 'featureId',
            otherKey: 'roleId'
        });

        // Updated User-Role associations
        DeptRole.belongsToMany(sequelize.models.CommonUsers, {
            through: DeptUserRole,
            foreignKey: 'roleId',
            otherKey: 'userId',
            as: 'users'
        });

        sequelize.models.CommonUsers.belongsToMany(DeptRole, {
            through: DeptUserRole,
            foreignKey: 'userId',
            otherKey: 'roleId',
            as: `${deptId}_${deptCode}_roles`
        });

        DeptUserRole.belongsTo(DeptRole, {
            foreignKey: 'roleId',
            as: 'role'
        });

        DeptUserRole.belongsTo(sequelize.models.CommonUsers, {
            foreignKey: 'userId',
            as: 'user'
        });

        const models = {
            DeptRole,
            DeptFeature,
            DeptRoleFeature,
            DeptUserRole
        };

        modelCache.set(modelPrefix, models);
        return models;
    } catch (error) {
        console.error(`Error creating department models for ${deptCode}:`, error);
        throw new Error(`Failed to create department models for ${deptCode}: ${error.message}`);
    }
}; 

const getDepartmentModels = (deptId, deptCode) => {
    const modelPrefix = `${deptId}_${deptCode}`;
    return modelCache.get(modelPrefix) || createDepartmentModels(sequelize, deptId, deptCode);
};

// Add this new function
function getExistingDepartmentModels() {
    console.log("Fetching department models...");
    const existingModels = {}; // Fetch your actual models here

    if (!existingModels || Object.keys(existingModels).length === 0) {
        console.error("Error: No department models found.");
        return {}; // Prevent undefined errors
    }

    return existingModels;
}



// Initialize department tables with default data
const initializeDepartmentTables = async (models, transaction) => {
    const { DeptRole, DeptFeature, DeptRoleFeature } = models;

    // Create default department roles with hierarchy levels
    const roles = await DeptRole.bulkCreate([
        {
            roleId: 'ROLE_HEAD',
            roleName: 'Department Head',
            description: 'Department Head with all permissions',
            hierarchyLevel: 10
        },
        //admin 
        {
            roleId: 'ROLE_ADMIN',
            roleName: 'Department Admin',
            description: 'Department Admin with all permissions but the delete permission',
            hierarchyLevel: 20
        },
        {
            roleId: 'ROLE_RELATIONSHIP_MANAGER',
            roleName: 'Department Relationship Manager',
            description: 'relation manager with issues and tenders , clashes  access only',
            hierarchyLevel: 50
        }, 
        {
            roleId: 'ROLE_RESOURCE_MANAGER',
            roleName: 'Department Resource Manager',
            description: 'resource manager with inventory access only',
            hierarchyLevel: 60
        },
        {
            roleId: 'ROLE_STAFF',
            roleName: 'Department Staff',
            description: 'Regular department staff',
            hierarchyLevel: 100
        }
    ], { transaction });

    // Create default features
    const features = await DeptFeature.bulkCreate([
        { featureId: 'FEAT_DEPT_MGMT', featureName: 'Department Management' },
        { featureId: 'FEAT_USER_MGMT', featureName: 'User Management' },
        { featureId: 'FEAT_ROLE_MGMT', featureName: 'Role Management' },
        { featureId: 'FEAT_INVENTORY', featureName: 'Inventory Management' },
        { featureId: 'FEAT_ISSUES', featureName: 'Issue Management' },
        { featureId: 'FEAT_TENDERS', featureName: 'Tender Management' },
        { featureId: 'FEAT_CLASHES', featureName: 'Clashes Management' }

    ], { transaction });

    // Define permission mappings for different roles
    const rolePermissions = {
        'ROLE_HEAD': {
            permissions: features.map(feature => ({
                roleId: 'ROLE_HEAD',
                featureId: feature.featureId,
                canRead: true,
                canWrite: true,
                canUpdate: true,
                canDelete: true
            }))
        },
        'ROLE_ADMIN': {
            permissions: features.map(feature => ({
                roleId: 'ROLE_ADMIN',
                featureId: feature.featureId,
                canRead: true,
                canWrite: true,
                canUpdate: true,
                canDelete: false
            }))
        },
        'ROLE_RELATIONSHIP_MANAGER': {
            permissions: features.map(feature => {
                const allowedFeatures = ['FEAT_CLASHES', 'FEAT_TENDERS', 'FEAT_ISSUES'];
                return {
                    roleId: 'ROLE_RELATIONSHIP_MANAGER',
                    featureId: feature.featureId,
                    canRead: allowedFeatures.includes(feature.featureId),
                    canWrite: allowedFeatures.includes(feature.featureId),
                    canUpdate: allowedFeatures.includes(feature.featureId),
                    canDelete: allowedFeatures.includes(feature.featureId)
                };
            })
        },
        'ROLE_RESOURCE_MANAGER': {
            permissions: features.map(feature => ({
                roleId: 'ROLE_RESOURCE_MANAGER',
                featureId: feature.featureId,
                canRead: feature.featureId === 'FEAT_INVENTORY',
                canWrite: feature.featureId === 'FEAT_INVENTORY',
                canUpdate: feature.featureId === 'FEAT_INVENTORY',
                canDelete: feature.featureId === 'FEAT_INVENTORY'
            }))
        }
    };

    // Create role-feature mappings with permissions
    for (const role of Object.keys(rolePermissions)) {
        await DeptRoleFeature.bulkCreate(rolePermissions[role].permissions, { transaction });
    }

    return {
        roles,
        features,
        rolePermissions
    };
};

// Helper function to validate department existence
const validateDepartment = async (deptId) => {
    const department = await sequelize.models.CommonDepts.findOne({
        where: { deptId, isDeleted: false }
    });
    if (!department) {
        throw new Error('Department not found or inactive');
    }
    return department;
};

module.exports = {
    createDepartmentModels,
    getDepartmentModels,
    getExistingDepartmentModels,
    initializeDepartmentTables,
    validateDepartment
};
    