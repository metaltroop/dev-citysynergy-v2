const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Clashes = sequelize.define(
    "Clashes",
    {
      clashID: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      Locality: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      involved_departments: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      involved_tenders: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      start_dates: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      end_dates: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      is_resolved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "Clashes",
      timestamps: true,
    }
  );

  // ✅ Generate `clashID` correctly
  Clashes.beforeCreate(async (clash, options) => {
    const lastClash = await Clashes.findOne({
      order: [["createdAt", "DESC"]],
      attributes: ["clashID"],
    });

    let lastId = 0;
    if (lastClash && lastClash.clashID) {
      const match = lastClash.clashID.match(/\d+/); // Extract numbers
      lastId = match ? parseInt(match[0]) : 0;
    }

    clash.clashID = `Clash${String(lastId + 1).padStart(3, "0")}`;
  });

  return Clashes;
};
