const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const AllTenders = sequelize.define(
    "All_Tenders",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      Tender_ID: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      Tender_by_Department: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Tender_by_Classification: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Sanction_Date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      Start_Date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      Completion_Date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_startDate: {
        type: DataTypes.DATE,
        allowNull: true, // Since it's updated later
      },
      updated_endDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      Sanction_Amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      Total_Duration_Days: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      Complete_Pending: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Locality: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Local_Area: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Zones: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      City: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Pincode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "All_Tenders",
      timestamps: true,
    }
  );

  return AllTenders;
};
