const { withTransaction } = require('../utils/transactionManager');

const viewProfile = async (req, res) => {
    try {
        const { uuid } = req.user;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts } = sequelize.models;

        const user = await CommonUsers.findOne({
            where: { uuid },
            attributes: ['uuid', 'username', 'email', 'type', 'deptId', 'lastLogin'],
            include: [{
                model: CommonDepts,
                as: 'department',
                attributes: ['deptName', 'deptCode']
            }]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user permissions using existing getUserRoles logic
        const permissions = await getUserPermissions(user, sequelize);

        res.status(200).json({
            success: true,
            data: {
                profile: {
                    uuid: user.uuid,
                    username: user.username,
                    email: user.email,
                    type: user.type,
                    department: user.department ? {
                        name: user.department.deptName,
                        code: user.department.deptCode
                    } : null,
                    lastLogin: user.lastLogin
                },
                permissions
            }
        });
    } catch (error) {
        console.error('Error viewing profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error viewing profile',
            error: error.message
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { uuid } = req.user;
        const { email } = req.body;
        const { sequelize } = req.app.locals;

        const result = await withTransaction(async (transaction) => {
            const user = await CommonUsers.findByPk(uuid);
            if (!user) throw new Error('User not found');

            // Update email and username (since we use email as username)
            if (email) {
                await user.update({ 
                    email, 
                    username: email 
                }, { transaction });
            }

            return user;
        });

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                uuid: result.uuid,
                email: result.email
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};

// Helper function to get user permissions
const getUserPermissions = async (user, sequelize) => {
    let permissions = [];
    
    if (user.type === 'dev') {
        const { DevRole, DevFeature, DevRoleFeature, DevUserRole } = sequelize.models;
        permissions = await DevUserRole.findAll({
            where: { userId: user.uuid },
            include: [{
                model: DevRole,
                include: [{
                    model: DevFeature,
                    through: DevRoleFeature,
                    attributes: ['featureName', 'featureDescription']
                }]
            }]
        });
    } else if (user.deptId) {
        const department = await sequelize.models.CommonDepts.findByPk(user.deptId);
        if (department) {
            const deptModels = getDepartmentModels(user.deptId, department.deptCode);
            permissions = await deptModels.DeptUserRole.findAll({
                where: { userId: user.uuid },
                include: [{
                    model: deptModels.DeptRole,
                    include: [{
                        model: deptModels.DeptFeature,
                        through: deptModels.DeptRoleFeature,
                        attributes: ['featureName', 'featureDescription']
                    }]
                }]
            });
        }
    }

    return permissions;
};

module.exports = {
    viewProfile,
    updateProfile
}; 