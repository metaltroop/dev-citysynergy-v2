const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const DevFeatures = sequelize.define('DevFeatures', {
        featureId: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
        },
        featureName: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        featureDescription: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'dev_features',
        timestamps: true,
        hooks: {
            beforeValidate: async (feature) => {
                if (!feature.featureId) {
                    feature.featureId = await generateCustomId(sequelize.models.DevFeatures, 'FEAT', 'featureId');
                }
            }
        }
    });

    return DevFeatures;
};
