const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Zones = sequelize.define(
    "common_zones",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "common_zones",
      timestamps: false,
    }
  );

  return Zones;
};
