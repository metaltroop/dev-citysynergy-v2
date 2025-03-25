const { DataTypes } = require('sequelize');



module.exports = (sequelize) => {
    const Pincode = sequelize.define('common_pincodes', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            pincode: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            }
        }
        ,{ 
            tableName: "common_pincodes", 
            timestamps: false,
          });
        
          return Pincode;
}
