const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure multer for memory storage (we'll stream to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: User profile management
 */

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */

router.get('/',
    profileController.viewProfile
);

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */

router.put('/',
    profileController.updateProfile
);

/**
 * @swagger
 * /api/profile/image:
 *   post:
 *     summary: Upload a profile image
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Profile image uploaded successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.post('/image',
    upload.single('image'),
    profileController.uploadProfileImage
);

/**
 * @swagger
 * /api/profile/image:
 *   delete:
 *     summary: Delete the current profile image
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile image deleted successfully
 *       404:
 *         description: No active profile image found
 *       401:
 *         description: Unauthorized
 */
router.delete('/image',
    profileController.deleteProfileImage
);

/**
 * @swagger
 * /api/profile/image/current:
 *   get:
 *     summary: Get the current user's profile image
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile image retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     imageUrl:
 *                       type: string
 *       404:
 *         description: No profile image found for current user
 *       401:
 *         description: Unauthorized
 */
router.get('/image/current',
    profileController.getCurrentUserProfileImage
);

/**
 * @swagger
 * /api/profile/image/{userId}:
 *   get:
 *     summary: Get a user's profile image by user ID
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: Profile image retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     imageUrl:
 *                       type: string
 *       404:
 *         description: No profile image found for this user
 *       401:
 *         description: Unauthorized
 */
router.get('/image/:userId',
    profileController.getProfileImage
);

module.exports = router;