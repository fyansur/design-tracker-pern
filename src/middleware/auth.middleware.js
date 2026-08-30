const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Belum login" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // dipakai di semua route berikutnya
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid atau expired" });
  }
}

module.exports = authRequired;