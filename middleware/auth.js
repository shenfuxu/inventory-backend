const jwt = require('jsonwebtoken');

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// JWT验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '认证令牌无效或已过期' });
    }
    req.user = user;
    next();
  });
}

// 管理员权限检查中间件
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// 仓库管理员权限检查中间件
function requireWarehouseManager(req, res, next) {
  if (!req.user || !['admin', 'warehouse_manager'].includes(req.user.role)) {
    return res.status(403).json({ error: '需要仓库管理员权限' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireWarehouseManager
};
