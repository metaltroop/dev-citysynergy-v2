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

module.exports = {
    getDevFeatures
};