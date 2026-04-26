require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const connectDB = require("./config/DB");
const authRouter = require("./routes/auth.routes");
const projectRouter = require("./routes/project.routes");
const errorHandler = require("./middleware/error.handler");

connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] },
});

// Make io accessible in controllers via req.app.get("io")
app.set("io", io);

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Health check
app.get("/", (req, res) =>
  res.json({ success: true, message: "EsMagico API running" }),
);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/project", projectRouter);

// WebSocket: clients join a room per project
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join:project", (projectId) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project ${projectId}`);
  });

  socket.on("leave:project", (projectId) => {
    socket.leave(projectId);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
