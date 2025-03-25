const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const LocalArea = sequelize.define(
    "common_local_areas",
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
      tableName: "common_local_areas",
      timestamps: false,
    }
  );

  return LocalArea;
};
