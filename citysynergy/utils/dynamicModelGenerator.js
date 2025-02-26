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
const getExistingDepartmentModels = (deptId, deptCode) => {
    if (!deptId || !deptCode) {
        throw new Error('Department ID and Code are required');
    }

    const modelPrefix = `${deptId}_${deptCode}`.toUpperCase(); // Ensure uppercase
    const DeptRole = sequelize.models[`${modelPrefix}_role`];
    const DeptFeature = sequelize.models[`${modelPrefix}_feature`];
    const DeptRoleFeature = sequelize.models[`${modelPrefix}_role_feature`];
    const DeptUserRole = sequelize.models[`${modelPrefix}_user_role`];

    if (!DeptRole || !DeptFeature || !DeptRoleFeature || !DeptUserRole) {
        throw new Error(`Department models not found for ${deptCode} (${modelPrefix})`);
    }

    return {
        DeptRole,
        DeptFeature,
        DeptRoleFeature,
        DeptUserRole
    };
};

// Initialize department tables with default data
const initializeDepartmentTables = async (models, transaction) => {
    const { DeptRole, DeptFeature, DeptRoleFeature } = models;

    // Create default department roles
    const roles = await DeptRole.bulkCreate([
        {
            roleId: 'ROLE_HEAD',
            roleName: 'Department Head',
            description: 'Department Head with all permissions'
        },
        {
            roleId: 'ROLE_MANAGER',
            roleName: 'Department Manager',
            description: 'Department Manager with limited permissions'
        },
        {
            roleId: 'ROLE_SUPERVISOR',
            roleName: 'Department Supervisor',
            description: 'Supervisor with operational permissions'
        },
        {
            roleId: 'ROLE_STAFF',
            roleName: 'Department Staff',
            description: 'Regular department staff'
        }
    ], { transaction });

    // Create default features
    const features = await DeptFeature.bulkCreate([
        { featureId: 'FEAT_DEPT_MGMT', featureName: 'Department Management' },
        { featureId: 'FEAT_USER_MGMT', featureName: 'User Management' },
        { featureId: 'FEAT_ROLE_MGMT', featureName: 'Role Management' },
        { featureId: 'FEAT_INVENTORY', featureName: 'Inventory Management' },
        { featureId: 'FEAT_ISSUES', featureName: 'Issue Management' },
        { featureId: 'FEAT_REPORTS', featureName: 'Reports Management' },
        { featureId: 'FEAT_ATTENDANCE', featureName: 'Attendance Management' },
        { featureId: 'FEAT_TASKS', featureName: 'Task Management' }
    ], { transaction });

    // Define permission mappings for different roles
    const rolePermissions = {
        'ROLE_HEAD': {
            // Head has full access to all features
            permissions: features.map(feature => ({
                roleId: 'ROLE_HEAD',
                featureId: feature.featureId,
                canRead: true,
                canWrite: true,
                canUpdate: true,
                canDelete: true
            }))
        },
        'ROLE_MANAGER': {
            // Manager has full access except delete permissions
            permissions: features.map(feature => ({
                roleId: 'ROLE_MANAGER',
                featureId: feature.featureId,
                canRead: true,
                canWrite: true,
                canUpdate: true,
                canDelete: false
            }))
        },
        'ROLE_SUPERVISOR': {
            // Supervisor has limited permissions
            permissions: features.map(feature => ({
                roleId: 'ROLE_SUPERVISOR',
                featureId: feature.featureId,
                canRead: true,
                canWrite: feature.featureId !== 'FEAT_DEPT_MGMT' && 
                         feature.featureId !== 'FEAT_USER_MGMT' && 
                         feature.featureId !== 'FEAT_ROLE_MGMT',
                canUpdate: feature.featureId !== 'FEAT_DEPT_MGMT' && 
                          feature.featureId !== 'FEAT_USER_MGMT' && 
                          feature.featureId !== 'FEAT_ROLE_MGMT',
                canDelete: false
            }))
        },
        'ROLE_STAFF': {
            // Staff has basic read and write permissions for operational features
            permissions: features.map(feature => ({
                roleId: 'ROLE_STAFF',
                featureId: feature.featureId,
                canRead: true,
                canWrite: feature.featureId === 'FEAT_TASKS' || 
                         feature.featureId === 'FEAT_ATTENDANCE',
                canUpdate: feature.featureId === 'FEAT_TASKS' || 
                          feature.featureId === 'FEAT_ATTENDANCE',
                canDelete: false
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
 