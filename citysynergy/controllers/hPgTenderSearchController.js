const { Op } = require('sequelize');

// 1. Get unique pincodes (autocomplete)
const getPincodes = async (req, res) => {
    try {
        const { query } = req.query;
        const { sequelize } = req.app.locals;
        const { AllTenders } = sequelize.models;
        const where = {};
        if (query) {
            where.Pincode = { [Op.like]: `%${query}%` };
        }
        const pincodes = await AllTenders.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Pincode')), 'Pincode']],
            where,
            order: [[sequelize.col('Pincode'), 'ASC']]
        });
        res.json({ success: true, data: pincodes.map(p => p.Pincode).filter(Boolean) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching pincodes', error: error.message });
    }
};

// 2. Get unique areas (Zones) by pincode (autocomplete)
const getAreas = async (req, res) => {
    try {
        const { pincode, query } = req.query;
        if (!pincode) return res.status(400).json({ success: false, message: 'pincode is required' });
        const { sequelize } = req.app.locals;
        const { AllTenders } = sequelize.models;
        const where = { Pincode: pincode };
        if (query) {
            where.Zones = { [Op.like]: `%${query}%` };
        }
        const areas = await AllTenders.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Zones')), 'Zones']],
            where,
            order: [[sequelize.col('Zones'), 'ASC']]
        });
        res.json({ success: true, data: areas.map(a => a.Zones).filter(Boolean) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching areas', error: error.message });
    }
};

// 3. Get unique local areas by pincode and area (autocomplete)
const getLocalAreas = async (req, res) => {
    try {
        const { pincode, area, query } = req.query;
        if (!pincode || !area) return res.status(400).json({ success: false, message: 'pincode and area are required' });
        const { sequelize } = req.app.locals;
        const { AllTenders } = sequelize.models;
        const where = { Pincode: pincode, Zones: area };
        if (query) {
            where.Local_Area = { [Op.like]: `%${query}%` };
        }
        const localAreas = await AllTenders.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Local_Area')), 'Local_Area']],
            where,
            order: [[sequelize.col('Local_Area'), 'ASC']]
        });
        res.json({ success: true, data: localAreas.map(l => l.Local_Area).filter(Boolean) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching local areas', error: error.message });
    }
};

// 4. Search tenders by pincode, area, localArea
const searchTenders = async (req, res) => {
    try {
        const { pincode, area, localArea } = req.query;
        const { sequelize } = req.app.locals;
        const { AllTenders } = sequelize.models;
        const where = {};
        if (pincode) where.Pincode = pincode;
        if (area) where.Zones = area;
        if (localArea) where.Local_Area = localArea;
        if (!pincode && !area && !localArea) {
            return res.status(400).json({ success: false, message: 'At least one search parameter is required' });
        }
        const tenders = await AllTenders.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: tenders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error searching tenders', error: error.message });
    }
};

module.exports = {
    getPincodes,
    getAreas,
    getLocalAreas,
    searchTenders
};
