const { Server } = require("socket.io");
const socketController = require("../controllers/socketController");

const socketRoutes = (server, sequelize) => {
    const io = new Server(server, {
        cors: {
            origin: ["http://localhost:5500", "http://127.0.0.1:5500"],
            methods: ["GET", "POST"],
        },
    });

    socketController(io, sequelize); // Pass Sequelize to the controller

    return io;
};

module.exports = socketRoutes;
