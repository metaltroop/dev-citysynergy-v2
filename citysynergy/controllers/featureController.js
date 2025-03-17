const { Op } = require('sequelize');

const getDevFeatures = async (req, res) => {
    try {
        const { sequelize } = req.app.locals;
        const { DevFeatures, DevRoleFeature, DevRoles } = sequelize.models;

        const features = await DevFeatures.findAll({
            where: { isDeleted: false },
            include: [{
                model: DevRoles,
                through: {
                    model: DevRoleFeature,
                    attributes: ['canRead', 'canWrite', 'canUpdate', 'canDelete']
                },
                where: { isDeleted: false },
                required: false
            }]
        });

        const formattedFeatures = await Promise.all(features.map(async feature => {
            // Count roles with different permission types
            const rolePermissionCounts = await DevRoleFeature.findAll({
                where: { featureId: feature.featureId },
                attributes: [
                    [sequelize.literal('SUM(canRead)'), 'readCount'],
                    [sequelize.literal('SUM(canWrite)'), 'writeCount'],
                    [sequelize.literal('SUM(canUpdate)'), 'updateCount'],
                    [sequelize.literal('SUM(canDelete)'), 'deleteCount']
                ],
                raw: true
            });

            return {
                featureId: feature.featureId,
                featureName: feature.featureName,
                featureDescription: feature.featureDescription,
                rolePermissions: {
                    total: feature.DevRoles.length,
                    withRead: parseInt(rolePermissionCounts[0].readCount) || 0,
                    withWrite: parseInt(rolePermissionCounts[0].writeCount) || 0,
                    withUpdate: parseInt(rolePermissionCounts[0].updateCount) || 0,
                    withDelete: parseInt(rolePermissionCounts[0].deleteCount) || 0
                },
                roles: feature.DevRoles.map(role => ({
                    roleId: role.roleId,
                    roleName: role.roleName,
                    permissions: {
                        canRead: role.DevRoleFeature.canRead,
                        canWrite: role.DevRoleFeature.canWrite,
                        canUpdate: role.DevRoleFeature.canUpdate,
                        canDelete: role.DevRoleFeature.canDelete
                    }
                }))
            };
        }));

        res.status(200).json({
            success: true,
            data: formattedFeatures
        });

    } catch (error) {
        console.error('Error fetching features:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching features',
            error: error.message
        });
    }
};

//detdeptfeatures of the logged in user
const getDeptFeatures = async (req, res) => {
    try {
        const { deptId } = req.user;
        const { sequelize } = req.app.locals;
        const { CommonDepts } = sequelize.models;

        const department = await CommonDepts.findOne({
            where: { deptId, isDeleted: false }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or inactive'
            });
        }

        const deptCode = department.deptCode;
        const prefix = `${deptId}_${deptCode}`;

        const featureTableName = `${prefix}_feature`;
        const roleTableName = `${prefix}_role`;
        const roleFeatureTableName = `${prefix}_role_feature`;

        // Get all features
        const features = await sequelize.query(
            `SELECT featureId, featureName
             FROM \`${featureTableName}\` 
             WHERE isDeleted = 0`,
            {
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Get all active roles
        const roles = await sequelize.query(
            `SELECT roleId, roleName, hierarchyLevel
             FROM \`${roleTableName}\` 
             WHERE isDeleted = 0`,
            {
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Get all role-feature permissions
        const permissions = await sequelize.query(
            `SELECT rf.roleId, rf.featureId, rf.canRead, rf.canWrite, rf.canUpdate, rf.canDelete,
                    r.roleName
             FROM \`${roleFeatureTableName}\` rf
             JOIN \`${roleTableName}\` r ON rf.roleId = r.roleId
             WHERE r.isDeleted = 0`,
            {
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Process data to match the desired output format
        const formattedFeatures = features.map(feature => {
            // Get permissions for this feature
            const featurePermissions = permissions.filter(p => p.featureId === feature.featureId);
            
            // Calculate permission statistics
            const rolePermissions = {
                total: roles.length,
                withRead: featurePermissions.filter(p => p.canRead).length,
                withWrite: featurePermissions.filter(p => p.canWrite).length,
                withUpdate: featurePermissions.filter(p => p.canUpdate).length,
                withDelete: featurePermissions.filter(p => p.canDelete).length
            };

            // Format role permissions for this feature
            const featureRoles = roles.map(role => {
                const rolePermission = featurePermissions.find(p => p.roleId === role.roleId) || {
                    canRead: false,
                    canWrite: false,
                    canUpdate: false,
                    canDelete: false
                };

                return {
                    roleId: role.roleId,
                    roleName: role.roleName,
                    permissions: {
                        canRead: Boolean(rolePermission.canRead),
                        canWrite: Boolean(rolePermission.canWrite),
                        canUpdate: Boolean(rolePermission.canUpdate),
                        canDelete: Boolean(rolePermission.canDelete)
                    }
                };
            });

            return {
                featureId: feature.featureId,
                featureName: feature.featureName,
                rolePermissions,
                roles: featureRoles
            };
        });

        res.status(200).json({
            success: true,
            data: formattedFeatures
        });
    } catch (error) {
        console.error('Error fetching department features:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching department features',
            error: error.message
        });
    }
};



module.exports = {
    getDevFeatures,
    getDeptFeatures
};