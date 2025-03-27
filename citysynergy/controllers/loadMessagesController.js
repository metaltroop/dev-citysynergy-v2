const loadMessages = async (req, res) => {
    const { clashId } = req.query;
    const { deptId } = req.user; // Get deptId from JWT token

    if (!clashId) {
        return res.status(400).json({ message: "Clash ID is required" });
    }

    try {
        const { Messages, Clashes } = req.app.locals.sequelize.models;

        // First check if department has access to this clash
        const clash = await Clashes.findOne({
            where: { clashID: clashId },
            attributes: ['involved_departments']
        });

        if (!clash) {
            return res.status(404).json({ message: "Clash not found" });
        }

        // Check if department is in involved_departments
        const involvedDepartments = clash.involved_departments;
        if (!involvedDepartments || !(deptId in involvedDepartments)) {
            return res.status(403).json({ 
                message: "You do not have access to this chat" 
            });
        }

        // If access is granted, fetch messages
        const messages = await Messages.findAll({
            where: { clashID: clashId },
            order: [["createdAt", "ASC"]],
        });

        res.status(200).json({ messages });
    } catch (error) {
        console.error("❌ Error loading messages:", error);
        res.status(500).json({ message: "Failed to load messages" });
    }
};

module.exports = { loadMessages };