// Tenders model definition

const { DataTypes } = require('sequelize');
const { generateCustomId } = require('../utils/helpers');

module.exports = (sequelize) => {
    const Tenders = sequelize.define('tenders', {
        tenderId: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        tenderCategory: {
            type: DataTypes.STRING,
            allowNull: true
        },
        tenderDepartmentID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'common_dept',
                key: 'deptId'
            }
        },
        tenderDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        sanctionDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        apxStartDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        apxEndDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        acceptedStartDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        acceptedEndDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        duration: {
            type: DataTypes.STRING,
            allowNull: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        status: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {
                passed: true,
                hasClash: false,
                accepted: false,
                workInProgress: false,
                isCompleted: false
            }
        },
        locality: {
            type: DataTypes.STRING,
            allowNull: true
        },
        localArea: {
            type: DataTypes.STRING,
            allowNull: true
        },
        zone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true
        },
        pincode: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        lastEdited: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'tenders',
        timestamps: true,
        hooks: {
            beforeCreate: async (tender) => {
                if (!tender.tenderId) {
                    tender.tenderId = await generateCustomId(Tenders, 'TND', 'tenderId');
                }
            }
        }
    });

    return Tenders;
};
