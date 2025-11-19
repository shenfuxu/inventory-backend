const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
// const { logOperation } = require('./logs'); // 暂时注释掉，稍后修复
const { body, validationResult } = require('express-validator');

// 获取数据库连接
const db = new sqlite3.Database('./inventory.db');

// 获取库存变动记录
router.get('/movements', authenticateToken, (req, res) => {
  const { product_id, type, start_date, end_date, limit = 50 } = req.query;
  
  let query = `
    SELECT 
      sm.*,
      p.name as product_name,
      p.code as product_code,
      u.name as operator_name
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.operator_id = u.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (product_id) {
    query += ' AND sm.product_id = ?';
    params.push(product_id);
  }
  
  if (type) {
    query += ' AND sm.type = ?';
    params.push(type);
  }
  
  if (start_date) {
    query += ' AND sm.created_at >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND sm.created_at <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY sm.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, movements) => {
    if (err) {
      return res.status(500).json({ error: '获取库存记录失败' });
    }
    res.json({ movements });
  });
});

// 入库
router.post('/in', [
  authenticateToken,
  body('product_id').isInt().withMessage('产品ID必须是整数'),
  body('quantity').isInt({ min: 1 }).withMessage('数量必须是正整数'),
  body('supplier').optional(),
  body('batch_no').optional(),
  body('reason').optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { product_id, quantity, supplier, batch_no, reason } = req.body;
  const operator_id = req.user.id;

  // 开始事务
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 获取当前库存
    db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (!product) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: '产品不存在' });
      }

      const before_stock = product.current_stock;
      const after_stock = before_stock + quantity;

      // 更新产品库存
      db.run(
        'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [after_stock, product_id],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: '更新库存失败' });
          }

          // 记录库存变动
          db.run(
            `INSERT INTO stock_movements 
            (product_id, type, quantity, before_stock, after_stock, operator_id, supplier, batch_no, reason)
            VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)`,
            [product_id, quantity, before_stock, after_stock, operator_id, supplier, batch_no, reason],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: '记录库存变动失败' });
              }

              // 检查是否需要创建预警
              checkAndCreateAlert(product_id, after_stock, product);

              db.run('COMMIT');
              res.json({
                message: '入库成功',
                movement: {
                  id: this.lastID,
                  product_id,
                  type: 'in',
                  quantity,
                  before_stock,
                  after_stock,
                  operator_id
                }
              });
            }
          );
        }
      );
    });
  });
});

// 出库
router.post('/out', [
  authenticateToken,
  body('product_id').isInt().withMessage('产品ID必须是整数'),
  body('quantity').isInt({ min: 1 }).withMessage('数量必须是正整数'),
  body('department').optional(),
  body('reason').optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { product_id, quantity, department, reason } = req.body;
  const operator_id = req.user.id;

  // 开始事务
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 获取当前库存
    db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (!product) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: '产品不存在' });
      }

      const before_stock = product.current_stock;
      
      // 检查库存是否足够
      if (before_stock < quantity) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: '库存不足' });
      }
      
      const after_stock = before_stock - quantity;

      // 更新产品库存
      db.run(
        'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [after_stock, product_id],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: '更新库存失败' });
          }

          // 记录库存变动
          db.run(
            `INSERT INTO stock_movements 
            (product_id, type, quantity, before_stock, after_stock, operator_id, department, reason)
            VALUES (?, 'out', ?, ?, ?, ?, ?, ?)`,
            [product_id, quantity, before_stock, after_stock, operator_id, department, reason],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: '记录库存变动失败' });
              }

              // 检查是否需要创建预警
              checkAndCreateAlert(product_id, after_stock, product);

              db.run('COMMIT');
              res.json({
                message: '出库成功',
                movement: {
                  id: this.lastID,
                  product_id,
                  type: 'out',
                  quantity,
                  before_stock,
                  after_stock,
                  operator_id
                }
              });
            }
          );
        }
      );
    });
  });
});

// 库存盘点
router.post('/adjust', [
  authenticateToken,
  body('product_id').isInt().withMessage('产品ID必须是整数'),
  body('actual_stock').isInt({ min: 0 }).withMessage('实际库存必须是非负整数'),
  body('reason').notEmpty().withMessage('调整原因不能为空')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { product_id, actual_stock, reason } = req.body;
  const operator_id = req.user.id;

  // 获取当前库存
  db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!product) {
      return res.status(404).json({ error: '产品不存在' });
    }

    const before_stock = product.current_stock;
    const difference = actual_stock - before_stock;
    
    if (difference === 0) {
      return res.json({ message: '库存无需调整' });
    }

    const type = difference > 0 ? 'in' : 'out';
    const quantity = Math.abs(difference);

    // 更新产品库存
    db.run(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [actual_stock, product_id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '更新库存失败' });
        }

        // 记录库存调整
        db.run(
          `INSERT INTO stock_movements 
          (product_id, type, quantity, before_stock, after_stock, operator_id, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [product_id, type, quantity, before_stock, actual_stock, operator_id, `盘点调整: ${reason}`],
          function(err) {
            if (err) {
              return res.status(500).json({ error: '记录库存变动失败' });
            }

            res.json({
              message: '库存调整成功',
              adjustment: {
                product_id,
                before_stock,
                after_stock: actual_stock,
                difference,
                reason
              }
            });
          }
        );
      }
    );
  });
});

// 检查并创建库存预警
function checkAndCreateAlert(product_id, current_stock, product) {
  if (current_stock < product.min_stock) {
    const message = `产品 ${product.name} 库存不足，当前库存: ${current_stock}，最低库存: ${product.min_stock}`;
    db.run(
      'INSERT INTO alerts (product_id, type, message) VALUES (?, ?, ?)',
      [product_id, 'low_stock', message]
    );
  } else if (current_stock > product.max_stock) {
    const message = `产品 ${product.name} 库存过量，当前库存: ${current_stock}，最高库存: ${product.max_stock}`;
    db.run(
      'INSERT INTO alerts (product_id, type, message) VALUES (?, ?, ?)',
      [product_id, 'high_stock', message]
    );
  }
}

module.exports = router;
