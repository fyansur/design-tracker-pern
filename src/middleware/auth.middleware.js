const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Not logged in" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // dipakai di semua route berikutnya
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
}

module.exports = authRequired;