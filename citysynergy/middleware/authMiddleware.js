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

        // Fixed: Use JWT_ACCESS_SECRET instead of JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        
        // Get user and verify existence
        const user = await CommonUsers.findOne({
            where: { 
                uuid: decoded.uuid,
                isDeleted: false
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
        }

        // Add user info to request
        req.user = {
            uuid: decoded.uuid,
            type: decoded.type,
            deptId: decoded.deptId
        };

        next();
    } catch (error) {
        console.error('Authentication error for user :' + error.message);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

// Export the middleware function directly
module.exports = authMiddleware;
