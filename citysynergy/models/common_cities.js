const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const City = sequelize.define(
    "common_cities",
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
      tableName: "common_cities",
      timestamps: false,
    }
  );

  return City;
};
