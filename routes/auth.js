const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// JWT密钥（实际项目应该放在环境变量中）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// 获取数据库连接
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inventory.db');

// 注册
router.post('/register', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('name').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, name } = req.body;

  try {
    // 检查用户是否存在
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (user) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      db.run(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name || email.split('@')[0]],
        function(err) {
          if (err) {
            return res.status(500).json({ error: '注册失败' });
          }

          // 生成JWT
          const token = jwt.sign(
            { id: this.lastID, email },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({
            message: '注册成功',
            token,
            user: {
              id: this.lastID,
              email,
              name: name || email.split('@')[0]
            }
          });
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录
router.post('/login', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').notEmpty().withMessage('请输入密码')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // 查找用户
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (!user) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 验证密码
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 生成JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: '登录成功',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, email, name, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user });
  });
});

// JWT验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '认证令牌无效' });
    }
    req.user = user;
    next();
  });
}

module.exports = router;
