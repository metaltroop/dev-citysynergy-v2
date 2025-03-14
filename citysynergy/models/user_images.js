const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserImage = sequelize.define('UserImage', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_users',
                key: 'uuid'
            }
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cloudinaryPublicId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'user_images',
        timestamps: true,
        paranoid: true // Soft deletes
    });

    return UserImage;
}; 