// Authorization middleware

const { getDepartmentModels } = require('../utils/dynamicModelGenerator');

const authorizeMiddleware = (requiredFeatures, requiredPermission) => {
    return async (req, res, next) => {
        try {
            const { uuid, type, deptId } = req.user;
            const { sequelize } = req.app.locals;
            const { 
                DevRoles, 
                DevFeatures, 
                DevRoleFeatures, 
                DevUserRoles, 
                CommonDepts 
            } = sequelize.models;

            // Validate required inputs
            if (!requiredFeatures?.length || !requiredPermission) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid permission requirements'
                });
            }

            let hasPermission = false;

            // Handle developer users
            if (type === 'dev') {
                const userRoles = await DevUserRoles.findAll({
                    where: { userId: uuid },
                    include: [{
                        model: DevRoles,
                        include: [{
                            model: DevFeatures,
                            through: {
                                where: {
                                    [requiredPermission]: true
                                }
                            },
                            where: {
                                featureName: requiredFeatures,
                                isDeleted: false
                            }
                        }]
                    }]
                });

                hasPermission = userRoles.some(userRole => 
                    userRole.DevRole.DevFeatures.length === requiredFeatures.length
                );
            } 
            // Handle department users
            else if (deptId) {
                const department = await CommonDepts.findOne({
                    where: { 
                        deptId,
                        isDeleted: false 
                    }
                });

                if (!department) {
                    return res.status(403).json({
                        success: false,
                        message: 'Department not found or inactive'
                    });
                }

                const deptModels = await getDepartmentModels(deptId, department.deptCode);
                
                const userRoles = await deptModels.DeptUserRole.findAll({
                    where: { userId: uuid },
                    include: [{
                        model: deptModels.DeptRole,
                        include: [{
                            model: deptModels.DeptFeature,
                            through: {
                                where: {
                                    [requiredPermission]: true
                                }
                            },
                            where: {
                                featureName: requiredFeatures,
                                isDeleted: false
                            }
                        }]
                    }]
                });

                hasPermission = userRoles.some(userRole => 
                    userRole.role.DeptFeatures.length === requiredFeatures.length
                );
            }

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking permissions',
                error: error.message
            });
        }
    };
};

module.exports = {
    authorizeMiddleware
};
