const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// 获取数据库连接
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inventory.db');

// 获取仪表盘统计数据
router.get('/stats', authenticateToken, (req, res) => {
  const stats = {};
  
  // 获取产品总数
  db.get('SELECT COUNT(*) as count FROM products', (err, result) => {
    if (err) {
      return res.status(500).json({ error: '获取统计数据失败' });
    }
    stats.totalProducts = result.count;
    
    // 获取低库存产品数量
    db.get('SELECT COUNT(*) as count FROM products WHERE current_stock < min_stock', (err, result) => {
      if (err) {
        return res.status(500).json({ error: '获取统计数据失败' });
      }
      stats.lowStockCount = result.count;
      
      // 获取高库存产品数量
      db.get('SELECT COUNT(*) as count FROM products WHERE current_stock > max_stock', (err, result) => {
        if (err) {
          return res.status(500).json({ error: '获取统计数据失败' });
        }
        stats.highStockCount = result.count;
        
        // 获取今日入库数量
        const today = new Date().toISOString().split('T')[0];
        db.get(
          "SELECT COALESCE(SUM(quantity), 0) as total FROM stock_movements WHERE type = 'in' AND DATE(created_at) = ?",
          [today],
          (err, result) => {
            if (err) {
              return res.status(500).json({ error: '获取统计数据失败' });
            }
            stats.todayIn = result.total;
            
            // 获取今日出库数量
            db.get(
              "SELECT COALESCE(SUM(quantity), 0) as total FROM stock_movements WHERE type = 'out' AND DATE(created_at) = ?",
              [today],
              (err, result) => {
                if (err) {
                  return res.status(500).json({ error: '获取统计数据失败' });
                }
                stats.todayOut = result.total;
                
                // 获取未读预警数量
                db.get('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0', (err, result) => {
                  if (err) {
                    return res.status(500).json({ error: '获取统计数据失败' });
                  }
                  stats.unreadAlerts = result.count;
                  
                  res.json({ stats });
                });
              }
            );
          }
        );
      });
    });
  });
});

// 获取最近的库存变动
router.get('/recent-movements', authenticateToken, (req, res) => {
  const { limit = 10 } = req.query;
  
  const query = `
    SELECT 
      sm.*,
      p.name as product_name,
      p.code as product_code,
      u.name as operator_name
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.operator_id = u.id
    ORDER BY sm.created_at DESC
    LIMIT ?
  `;
  
  db.all(query, [parseInt(limit)], (err, movements) => {
    if (err) {
      return res.status(500).json({ error: '获取库存记录失败' });
    }
    res.json({ movements });
  });
});

// 获取低库存产品
router.get('/low-stock-products', authenticateToken, (req, res) => {
  const { limit = 10 } = req.query;
  
  const query = `
    SELECT *
    FROM products
    WHERE current_stock < min_stock
    ORDER BY (min_stock - current_stock) DESC
    LIMIT ?
  `;
  
  db.all(query, [parseInt(limit)], (err, products) => {
    if (err) {
      return res.status(500).json({ error: '获取低库存产品失败' });
    }
    res.json({ products });
  });
});

// 获取库存趋势数据（最近7天）
router.get('/stock-trend', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      DATE(created_at) as date,
      SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) as total_in,
      SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) as total_out
    FROM stock_movements
    WHERE DATE(created_at) >= DATE('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  
  db.all(query, [], (err, trend) => {
    if (err) {
      return res.status(500).json({ error: '获取趋势数据失败' });
    }
    res.json({ trend });
  });
});

// 获取分类统计
router.get('/category-stats', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      category,
      COUNT(*) as product_count,
      SUM(current_stock) as total_stock,
      SUM(current_stock * 1) as stock_value
    FROM products
    GROUP BY category
    ORDER BY product_count DESC
  `;
  
  db.all(query, [], (err, categories) => {
    if (err) {
      return res.status(500).json({ error: '获取分类统计失败' });
    }
    res.json({ categories });
  });
});

module.exports = router;
