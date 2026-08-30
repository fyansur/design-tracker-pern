const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const ownerRoutes = require("./routes/owner.routes");
const storeRoutes = require("./routes/store.routes");
const categoryRoutes = require("./routes/category.routes");
const designRoutes = require("./routes/design.routes");
const goalRoutes = require("./routes/goal.routes");
const dailyGoalRoutes = require("./routes/dailyGoal.routes");


const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/owners", ownerRoutes);    
app.use("/api/stores", storeRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/designs", designRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/daily-goals", dailyGoalRoutes);

module.exports = app;