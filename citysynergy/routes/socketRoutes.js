const { Server } = require("socket.io");
const socketController = require("../controllers/socketController");

const socketRoutes = (server, sequelize) => {
  const io = new Server(server, {
    cors: {
      origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://localhost:5173",
        "https://synergy.metaltroop.fun",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  socketController(io, sequelize); // Pass sequelize here

  return io;
};

module.exports = socketRoutes;
