const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello from Design Tracker API");
});

app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});