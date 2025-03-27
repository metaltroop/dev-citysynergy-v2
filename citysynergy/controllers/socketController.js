const { Op } = require("sequelize");

const socketController = (io, sequelize) => {
    io.on("connection", (socket) => {
        console.log(`✅ New client connected: ${socket.id}`);

        // Retrieve models from sequelize
        const { Messages, CommonUsers, Clashes, CommonDepts } = sequelize.models;

        // ✅ Validate department and clash
        socket.on("validateUser", async (data, callback) => {
            try {
                const { deptId, clashId } = data;

                // 🔹 Check if department exists
                const dept = await CommonDepts.findOne({
                    where: { deptId },
                    attributes: ["deptId", "deptName"],
                });

                if (!dept) {
                    return callback?.({
                        status: "error",
                        message: "Invalid department ID",
                    });
                }

                // 🔹 Check if clash exists and involves the department
                const clash = await Clashes.findOne({
                    where: {
                        clashID: clashId,
                        [Op.and]: [
                            sequelize.literal(`JSON_CONTAINS(involved_departments, '"${deptId}"')`),
                        ],
                    },
                });

                if (!clash) {
                    return callback?.({
                        status: "error",
                        message: "Department is not involved in this clash",
                    });
                }

                // ✅ Join the clash room
                socket.join(clashId);
                console.log(`✅ Dept ${deptId} joined clash room: ${clashId}`);

                callback?.({
                    status: "success",
                    deptName: dept.deptName,
                    message: `Joined clash room: ${clashId}`,
                });
            } catch (error) {
                console.error("❌ Validation error:", error);
                callback?.({
                    status: "error",
                    message: "Server error during validation",
                });
            }
        });

        // ✅ Handle chat messages and save to database
        socket.on("chatMessage", async (data, callback) => {
            try {
                console.log("📩 Received chat message:", data);
                const { clashId, deptId, message } = data;

                if (!message || !clashId || !deptId) {
                    return callback?.({
                        status: "error",
                        message: "Invalid message data",
                    });
                }

                // 🔹 Fetch email from CommonUsers
                const user = await CommonUsers.findOne({
                    where: { deptId },
                    attributes: ["email"],
                });

                if (!user) {
                    return callback?.({
                        status: "error",
                        message: "Invalid department ID or no user found",
                    });
                }

                // 🔹 Save the message in the database
                const newMessage = await Messages.create({
                    email: user.email,
                    department: deptId,
                    message,
                    clashID: clashId,
                });


                // 🔹 Broadcast the message to the clash room
                io.to(clashId).emit("message", {
                    id: newMessage.id,
                    email: user.email,
                    department: deptId,
                    message,
                    createdAt: newMessage.createdAt,
                });

                callback?.({
                    status: "success",
                    message: "Message sent successfully",
                });
            } catch (error) {
                console.error("❌ Message error:", error);
                callback?.({
                    status: "error",
                    message: "Server error while sending message",
                });
            }
        });

        // ✅ Join a room for a specific clashId
        socket.on("joinRoom", (data) => {
            const { clashId } = data;
            if (clashId) {
                socket.join(clashId);
                console.log(`✅ Client ${socket.id} joined room: ${clashId}`);
            }
        });

        // ✅ Handle user disconnect
        socket.on("disconnect", () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });
};

module.exports = socketController;
