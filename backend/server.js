require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/DB");

const authRouter = require("./routes/auth.routes");
const projectRouter = require("./routes/project.routes");
const taskRouter = require("./routes/task.routes");
const errorHandler = require("./middleware/error.handler");

connectDB();

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/auth", authRouter);
app.use("/api/project", projectRouter);
app.use("/api/task", taskRouter);

app.use(errorHandler);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
