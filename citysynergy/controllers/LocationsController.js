const { Op } = require("sequelize");


// ✅ Search Pincode API
exports.searchPincode = async (req, res) => {
    const { pincode } = req.query;
  
    const { sequelize } = req.app.locals; // Added sequelize
    const { Pincode } = sequelize.models; // Added Pincode model
  
    if (!pincode || pincode.length < 2) {
      return res.status(400).json({ message: "Type at least 2 digits" });
    }
  
    try {
      const pincodes = await Pincode.findAll({
        where: {
          pincode: {
            [Op.like]: `${pincode}%`,
          },
        },
      });
      res.status(200).json(pincodes);
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
  // ✅ Search Locality API
  exports.searchLocality = async (req, res) => {
    const { locality } = req.query;
  
    const { sequelize } = req.app.locals; // Added sequelize
    const { Locality } = sequelize.models; // Added Locality model
  
    if (!locality || locality.length < 2) {
      return res.status(400).json({ message: "Type at least 2 characters" });
    }
  
    try {
      const localities = await Locality.findAll({
        where: {
          locality: {
            [Op.like]: `${locality}%`,
          },
        },
      });
      res.status(200).json(localities);
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

  
// ✅ Search City API
exports.searchCity = async (req, res) => {
  const { city } = req.query;

  const { sequelize } = req.app.locals; // Added sequelize
  const { City } = sequelize.models; // Added City model

  if (!city || city.length < 2) {
    return res.status(400).json({ message: "Type at least 2 characters" });
  }

  try {
    const cities = await City.findAll({
      where: {
        name: {
          [Op.like]: `${city}%`,
        },
      },
    });
    res.status(200).json(cities);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.searchZone = async (req, res) => {
    const { zone } = req.query;
    const { sequelize } = req.app.locals;


    const { Zones } = sequelize.models; // ✅ Use the correct model name

    if (!Zones) {
        return res.status(500).json({ message: "Zones model not found in Sequelize" });
    }

    if (!zone || zone.length < 2) {
        return res.status(400).json({ message: "Type at least 2 characters" });
    }

    try {
        const zones = await Zones.findAll({
            where: {
                name: {
                    [Op.like]: `${zone}%`,
                },
            },
        });
        res.status(200).json(zones);
    } catch (error) {
        console.error("Error in searchZone:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


  // ✅ Search Local Area API
exports.searchLocalArea = async (req, res) => {
    const { localArea } = req.query;
  
    const { sequelize } = req.app.locals; // Added sequelize
    const { LocalArea } = sequelize.models; // Added LocalArea model
  
    if (!localArea || localArea.length < 2) {
      return res.status(400).json({ message: "Type at least 2 characters" });
    }
  
    try {
      const localAreas = await LocalArea.findAll({
        where: {
          name: {
            [Op.like]: `${localArea}%`,
          },
        },
      });
      res.status(200).json(localAreas);
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

  
