const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Messages = sequelize.define(
        "Messages",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            department: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            clashID: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "messages",
            timestamps: false, // Disable automatic `updatedAt` field
        }
    );

    return Messages;
};