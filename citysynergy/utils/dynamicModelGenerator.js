const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Cache for department models
const modelCache = new Map();

const getDepartmentModels = (deptId, deptCode) => {
    try {
        const modelPrefix = `Dept${deptCode}`;
        
        // Check cache first
        if (modelCache.has(modelPrefix)) {
            return modelCache.get(modelPrefix);
        }

        // Define models if they don't exist
        if (!sequelize.models[`${modelPrefix}Role`]) {
            const DeptRole = sequelize.define(`${modelPrefix}Role`, {
                roleId: {
                    type: DataTypes.STRING,
                    primaryKey: true
                },
                roleName: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                description: {
                    type: DataTypes.STRING
                },
                isDeleted: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: false
                }
            }, {
                tableName: `dept_${deptCode.toLowerCase()}_role`,
                timestamps: true
            });

            const DeptFeature = sequelize.define(`${modelPrefix}Feature`, {
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
                tableName: `dept_${deptCode.toLowerCase()}_feature`,
                timestamps: true
            });

            const DeptRoleFeature = sequelize.define(`${modelPrefix}RoleFeature`, {
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
                tableName: `dept_${deptCode.toLowerCase()}_role_feature`,
                timestamps: true
            });

            const DeptUserRole = sequelize.define(`${modelPrefix}UserRole`, {
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
                tableName: `dept_${deptCode.toLowerCase()}_user_role`,
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

            DeptUserRole.belongsTo(DeptRole, {
                foreignKey: 'roleId',
                as: 'role'
            });

            const models = {
                DeptRole,
                DeptFeature,
                DeptRoleFeature,
                DeptUserRole
            };

            modelCache.set(modelPrefix, models);
            return models;
        }

        return modelCache.get(modelPrefix);
    } catch (error) {
        console.error(`Error generating department models for ${deptCode}:`, error);
        throw new Error(`Failed to generate department models for ${deptCode}: ${error.message}`);
    }
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
    getDepartmentModels,
    validateDepartment
};
 