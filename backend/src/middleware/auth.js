const jwt = require('jsonwebtoken');
const config = require('../config');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

module.exports = authMiddleware;
