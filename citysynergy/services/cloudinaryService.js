// Cloudinary service for image operations
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

//require dotenv
require('dotenv').config();

// Configure Cloudinary with credentials
cloudinary.config({
    cloud_name: process.env.cloud_name || 'dxgw7218b',
    api_key: process.env.api_key || '667977728967488',
    api_secret: process.env.api_secret || 'g_Et_x8ZlOr-9apmHrMIFCKKqYo'
});

// Log configuration status (for debugging)
console.log('Cloudinary Configuration:', {
    cloud_name: process.env.cloud_name ? 'Set from env' : 'Using fallback',
    api_key: process.env.api_key ? 'Set from env' : 'Using fallback',
    api_secret: process.env.api_secret ? 'Set from env (hidden)' : 'Using fallback (hidden)'
});

/**
 * Upload an image to Cloudinary
 * @param {Buffer} buffer - Image buffer
 * @param {string} userId - User ID for folder organization
 * @param {string} raisedByEmailID - Email ID for folder organization
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadImage = async (buffer, userId) => {
    try {
        return new Promise((resolve, reject) => {
            // Create a readable stream from the buffer
            const stream = Readable.from(buffer);
            
            // Create a cloudinary upload stream
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `citysynergy/profile_images/${userId}`,
                    resource_type: 'image',
                    transformation: [
                        { width: 250, height: 250, crop: 'fill', gravity: 'face' }
                    ]
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            
            // Pipe the buffer to the upload stream
            stream.pipe(uploadStream);
        });
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        throw error;
    }
};

const uploadImage1 = async (buffer, raisedByEmailID) => {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Invalid buffer data. Expected a Buffer object.");
    }
  
    return new Promise((resolve, reject) => {
      try {
        // Create a readable stream from the buffer
        const stream = Readable.from(buffer);
  
        // Set folder path dynamically
        const folderPath = `citysynergy/Issue_images/${raisedByEmailID}`;
  
        // Create a Cloudinary upload stream
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            resource_type: "image",
            transformation: [
                { width: 250, height: 250, crop: "fill", gravity: "face" },
                ],
            
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary Upload Error:", error);
              return reject(error);
            }
            resolve(result);
          }
        );
  
        // Pipe the buffer to the upload stream
        stream.pipe(uploadStream);
      } catch (error) {
        console.error("Unexpected Error in uploadImage1:", error);
        reject(error);
      }
    });
  };
  

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} - Cloudinary deletion result
 */
const deleteImage = async (publicId) => {
    try {
        return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        throw error;
    }
};



module.exports = {
    uploadImage,
    deleteImage,
    uploadImage1
}; 