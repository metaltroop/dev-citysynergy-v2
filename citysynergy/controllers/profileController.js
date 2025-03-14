const { withTransaction } = require('../utils/transactionManager');
const cloudinaryService = require('../services/cloudinaryService');
const { getDepartmentModels } = require('../utils/helpers');

const viewProfile = async (req, res) => {
    try {
        const { uuid } = req.user;
        const { sequelize } = req.app.locals;
        const { CommonUsers, CommonDepts, UserImage } = sequelize.models;

        const user = await CommonUsers.findOne({
            where: { uuid },
            attributes: ['uuid', 'username', 'email', 'type', 'deptId', 'lastLogin'],
            include: [
                {
                    model: CommonDepts,
                    as: 'department',
                    attributes: ['deptName', 'deptCode']
                },
                {
                    model: UserImage,
                    where: { isActive: true },
                    attributes: ['imageUrl'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                }
            ]
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
                    lastLogin: user.lastLogin,
                    profileImage: user.UserImages && user.UserImages.length > 0 ? user.UserImages[0].imageUrl : null
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
        const { CommonUsers } = sequelize.models;

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

/**
 * Upload a profile image for the current user
 */
const uploadProfileImage = async (req, res) => {
    try {
        const { uuid } = req.user;
        const { sequelize } = req.app.locals;
        const { UserImage, CommonUsers } = sequelize.models;

        // Check if user exists
        const user = await CommonUsers.findByPk(uuid);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        // Upload image to Cloudinary
        const uploadResult = await cloudinaryService.uploadImage(req.file.buffer, uuid);

        // Save image reference in database
        const result = await withTransaction(async (transaction) => {
            // Deactivate any existing profile images
            await UserImage.update(
                { isActive: false },
                { 
                    where: { userId: uuid, isActive: true },
                    transaction
                }
            );

            // Create new profile image record
            const image = await UserImage.create({
                userId: uuid,
                imageUrl: uploadResult.secure_url,
                cloudinaryPublicId: uploadResult.public_id,
                isActive: true
            }, { transaction });

            return image;
        });

        res.status(201).json({
            success: true,
            message: 'Profile image uploaded successfully',
            data: {
                imageUrl: result.imageUrl
            }
        });
    } catch (error) {
        console.error('Error uploading profile image:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading profile image',
            error: error.message
        });
    }
};

/**
 * Delete the current user's profile image
 */
const deleteProfileImage = async (req, res) => {
    try {
        const { uuid } = req.user;
        const { sequelize } = req.app.locals;
        const { UserImage } = sequelize.models;

        // Find the active profile image
        const image = await UserImage.findOne({
            where: { userId: uuid, isActive: true }
        });

        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'No active profile image found'
            });
        }

        // Delete from Cloudinary
        await cloudinaryService.deleteImage(image.cloudinaryPublicId);

        // Update database
        await withTransaction(async (transaction) => {
            await image.update({ isActive: false }, { transaction });
        });

        res.status(200).json({
            success: true,
            message: 'Profile image deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting profile image:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting profile image',
            error: error.message
        });
    }
};

/**
 * Get a user's profile image by user ID
 */
const getProfileImage = async (req, res) => {
    try {
        const { userId } = req.params;
        const { sequelize } = req.app.locals;
        const { UserImage } = sequelize.models;

        // Find the active profile image for the specified user
        const image = await UserImage.findOne({
            where: { userId, isActive: true },
            order: [['createdAt', 'DESC']]
        });

        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'No profile image found for this user'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                imageUrl: image.imageUrl
            }
        });
    } catch (error) {
        console.error('Error fetching profile image:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile image',
            error: error.message
        });
    }
};

/**
 * Get the current user's profile image
 */
const getCurrentUserProfileImage = async (req, res) => {
    try {
        const { uuid } = req.user;
        const { sequelize } = req.app.locals;
        const { UserImage } = sequelize.models;

        // Find the active profile image for the current user
        const image = await UserImage.findOne({
            where: { userId: uuid, isActive: true },
            order: [['createdAt', 'DESC']]
        });

        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'No profile image found for current user'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                imageUrl: image.imageUrl
            }
        });
    } catch (error) {
        console.error('Error fetching current user profile image:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile image',
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
    updateProfile,
    uploadProfileImage,
    deleteProfileImage,
    getProfileImage,
    getCurrentUserProfileImage
}; 