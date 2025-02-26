// Authentication middleware

const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET } = process.env;

const authMiddleware = async (req, res, next) => {
    try {
        const { sequelize } = req.app.locals;
        const { CommonUsers } = sequelize.models;
        
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user
        const user = await CommonUsers.findOne({
            where: { 
                uuid: decoded.uuid,
                isDeleted: false
            }
        });

        // Add user info to request
        req.user = {
            uuid: decoded.uuid,
            type: decoded.type,
            deptId: decoded.deptId
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

module.exports = {
    authMiddleware
};
