const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

// 数据库连接
const db = new sqlite3.Database(path.join(__dirname, '..', 'inventory.db'));

// 记录操作日志的工具函数
const logOperation = (userId, userEmail, action, module, details, ipAddress) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO operation_logs (user_id, user_email, action, module, details, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, userEmail, action, module, details, ipAddress],
      function(err) {
        if (err) {
          console.error('记录日志失败:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
};

// 获取操作日志列表
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, pageSize = 50, module, userId, startDate, endDate } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = `
    SELECT 
      l.*,
      u.name as user_name
    FROM operation_logs l
    LEFT JOIN users u ON l.user_id = u.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (module) {
    query += ` AND l.module = ?`;
    params.push(module);
  }
  
  if (userId) {
    query += ` AND l.user_id = ?`;
    params.push(userId);
  }
  
  if (startDate) {
    query += ` AND l.created_at >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND l.created_at <= ?`;
    params.push(endDate);
  }
  
  // 获取总数
  const countQuery = query.replace('l.*, u.name as user_name', 'COUNT(*) as total');
  
  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: '获取日志总数失败' });
    }
    
    // 获取分页数据
    query += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), offset);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取日志失败' });
      }
      
      res.json({
        logs: rows,
        total: countResult.total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    });
  });
});

// 获取日志统计
router.get('/stats', authenticateToken, (req, res) => {
  const { days = 7 } = req.query;
  
  const queries = {
    // 按模块统计
    byModule: `
      SELECT module, COUNT(*) as count 
      FROM operation_logs 
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY module
    `,
    // 按操作类型统计
    byAction: `
      SELECT action, COUNT(*) as count 
      FROM operation_logs 
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `,
    // 按用户统计
    byUser: `
      SELECT user_email, COUNT(*) as count 
      FROM operation_logs 
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY user_email
      ORDER BY count DESC
      LIMIT 10
    `,
    // 按日期统计
    byDate: `
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM operation_logs 
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `
  };
  
  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;
  
  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error(`统计${key}失败:`, err);
      }
      results[key] = rows || [];
      completed++;
      
      if (completed === totalQueries) {
        res.json({ stats: results });
      }
    });
  });
});

// 清理旧日志（保留30天）
router.delete('/cleanup', authenticateToken, (req, res) => {
  // 只允许管理员清理
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }
  
  db.run(
    `DELETE FROM operation_logs WHERE created_at < datetime('now', '-30 days')`,
    function(err) {
      if (err) {
        return res.status(500).json({ error: '清理日志失败' });
      }
      
      // 记录清理操作
      logOperation(
        req.user.id,
        req.user.email,
        'CLEANUP',
        '系统管理',
        `清理了${this.changes}条旧日志`,
        req.ip
      );
      
      res.json({ 
        message: '日志清理成功',
        deleted: this.changes 
      });
    }
  );
});

// 导出路由
module.exports = router;
