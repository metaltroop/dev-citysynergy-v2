const activityLogService = require('../services/activityLogService');

const logLoginActivity = async (req, res, next) => {
    // Store the original send function
    const originalSend = res.send;
    
    // Override the send function
    res.send = function(body) {
        try {
            // Parse the response body
            const parsedBody = JSON.parse(body);
            
            // If login was successful, log it
            if (parsedBody.success && req.path.includes('/login')) {
                const userData = parsedBody.data.user;
                
                activityLogService.createActivityLog(req.app.locals.sequelize, {
                    activityType: 'LOGIN',
                    description: `User "${userData.email}" logged in`,
                    userId: userData.id,
                    deptId: userData.deptId,
                    ipAddress: req.ip
                }).catch(err => console.error('Error logging login activity:', err));
            }
        } catch (error) {
            console.error('Error in login activity logging middleware:', error);
            // Don't block the response if logging fails
        }
        
        // Call the original send function
        return originalSend.call(this, body);
    };
    
    next();
};

// Add a middleware to log failed login attempts
const logFailedLoginAttempt = async (req, res, next) => {
    // Store the original send function
    const originalSend = res.send;
    
    // Override the send function
    res.send = function(body) {
        try {
            // Parse the response body
            const parsedBody = JSON.parse(body);
            
            // If login failed, log it
            if (!parsedBody.success && req.path.includes('/login') && res.statusCode === 401) {
                const { email } = req.body;
                
                activityLogService.createActivityLog(req.app.locals.sequelize, {
                    activityType: 'SYSTEM',
                    description: `Failed login attempt for ${email}`,
                    ipAddress: req.ip
                }).catch(err => console.error('Error logging failed login activity:', err));
            }
        } catch (error) {
            console.error('Error in failed login logging middleware:', error);
            // Don't block the response if logging fails
        }
        
        // Call the original send function
        return originalSend.call(this, body);
    };
    
    next();
};

module.exports = {
    logLoginActivity,
    logFailedLoginAttempt
}; 