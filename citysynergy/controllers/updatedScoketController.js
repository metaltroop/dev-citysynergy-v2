const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");

const socketController = (io, sequelize) => {
    io.on("connection", (socket) => {
        console.log(`✅ New client connected: ${socket.id}`);

        // Retrieve models from sequelize
        const { Messages, CommonUsers, Clashes, CommonDepts } = sequelize.models;

        // ✅ Middleware to authenticate user via JWT
        socket.on("authenticate", async (token, callback) => {
            try {
                console.log("🔍 Received authentication request...");
                
                if (!token) {
                    console.log("❌ No token provided.");
                    return callback?.({ status: "error", message: "No token provided" });
                }

                // Verify token
                const decoded = jwt.verify(token, "spidermonkey");
                const { deptId, email } = decoded;
                console.log(`🔑 Decoded JWT - Dept: ${deptId}, Email: ${email}`);

                // Validate department existence
                const user = await CommonUsers.findOne({
                    where: { deptId, email },
                    attributes: ["email", "deptId"],
                });

                if (!user) {
                    console.log("❌ Unauthorized user.");
                    return callback?.({ status: "error", message: "Unauthorized user" });
                }

                // Attach user data to socket session
                socket.user = { email: user.email, deptId: user.deptId };

                console.log(`✅ User authenticated: ${user.email} (${user.deptId})`);
                callback?.({ status: "success", message: "User authenticated" });

            } catch (error) {
                console.error("❌ Authentication error:", error);
                callback?.({ status: "error", message: "Invalid or expired token" });
            }
        });

        // ✅ Validate department and clash
        socket.on("validateUser", async (data, callback) => {
            try {
                console.log("🔍 Validating user for clash...", data);

                if (!socket.user) {
                    console.log("❌ Unauthorized request: No user session.");
                    return callback?.({ status: "error", message: "Unauthorized user" });
                }

                const { clashId } = data;
                const { deptId } = socket.user;

                console.log(`🔎 Checking department: ${deptId} for clash: ${clashId}`);

                // 🔹 Check if department exists
                const dept = await CommonDepts.findOne({
                    where: { deptId },
                    attributes: ["deptId", "deptName"],
                });

                if (!dept) {
                    console.log("❌ Department not found.");
                    return callback?.({ status: "error", message: "Invalid department ID" });
                }

                // 🔹 Check if clash exists and involves the department
                const clash = await Clashes.findOne({
                    where: {
                        clashID: clashId,
                        involved_departments: { [Op.like]: `%${deptId}%` },
                    },
                });

                if (!clash) {
                    console.log(`❌ Clash ${clashId} does not involve department ${deptId}.`);
                    return callback?.({ status: "error", message: "Department is not involved in this clash" });
                }

                // ✅ Join the clash room
                socket.join(clashId);
                console.log(`✅ Department ${deptId} joined clash room: ${clashId}`);

                callback?.({
                    status: "success",
                    deptName: dept.deptName,
                    message: `Joined clash room: ${clashId}`,
                });

            } catch (error) {
                console.error("❌ Validation error:", error);
                callback?.({ status: "error", message: "Server error during validation" });
            }
        });

        // ✅ Handle chat messages and save to database
        socket.on("chatMessage", async (data, callback) => {
            console.log("📩 Received chat message request:", data);
            
            if (!socket.user) {
                console.log("❌ Unauthorized request. socket.user is missing!", socket.user);
                return callback?.({
                    status: "error",
                    message: "Unauthorized user",
                });
            }
            
            const { clashId, message } = data;
            const { deptId, email } = socket.user;
            
            console.log(`💬 Message from ${email} (Dept: ${deptId}) -> Clash: ${clashId}`);
        
            if (!message || !clashId || !deptId) {
                console.log("❌ Invalid message data.");
                return callback?.({ status: "error", message: "Invalid message data" });
            }
        
            // 🔹 Save the message in the database
            const newMessage = await Messages.create({
                email,
                department: deptId,
                message,
                clashID: clashId,
            });
        
            console.log("💾 Message saved to DB:", newMessage.toJSON());
        
            // 🔹 Broadcast the message to the clash room
            io.to(clashId).emit("message", {
                id: newMessage.id,
                email,
                department: deptId,
                message,
                createdAt: newMessage.createdAt,
            });
        
            console.log(`📢 Message broadcasted to room ${clashId}.`);
        
            callback?.({
                status: "success",
                message: "Message sent successfully",
            });
        });
        

        // ✅ Join a room for a specific clashId
        socket.on("joinRoom", (data) => {
            if (!socket.user) return;

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
