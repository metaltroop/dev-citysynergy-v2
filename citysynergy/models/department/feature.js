const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../../utils/helpers');

module.exports = (prefix) => (sequelize) => {
    const DeptFeature = sequelize.define(`${prefix}_feature`, {
        featureId: {
            type: DataTypes.STRING,
            primaryKey: true
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
        tableName: `${prefix}_feature`,
        timestamps: true,
        hooks: {
            beforeCreate: async (feature) => {
                if (!feature.featureId) {
                    feature.featureId = await generateCustomId(DeptFeature, `${prefix}FET`, 'featureId');
                }
            }
        }
    });

    return DeptFeature;
};

