const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Locality = sequelize.define(
    "common_localities",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      locality: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    { tableName: "common_localities", timestamps: false }
  );
  return Locality;
};
