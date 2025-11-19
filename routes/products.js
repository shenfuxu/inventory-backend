const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

// 获取数据库连接
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inventory.db');

// 获取所有产品
router.get('/', authenticateToken, (req, res) => {
  const query = `
    SELECT * FROM products 
    ORDER BY created_at DESC
  `;
  
  db.all(query, [], (err, products) => {
    if (err) {
      return res.status(500).json({ error: '获取产品列表失败' });
    }
    res.json({ products });
  });
});

// 获取单个产品
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      return res.status(500).json({ error: '获取产品失败' });
    }
    
    if (!product) {
      return res.status(404).json({ error: '产品不存在' });
    }
    
    res.json({ product });
  });
});

// 创建产品
router.post('/', [
  authenticateToken,
  body('code').notEmpty().withMessage('产品编号不能为空'),
  body('name').notEmpty().withMessage('产品名称不能为空'),
  body('category').optional(),
  body('unit').optional(),
  body('min_stock').isInt({ min: 0 }).withMessage('最低库存必须是非负整数'),
  body('max_stock').isInt({ min: 0 }).withMessage('最高库存必须是非负整数')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, category, unit, min_stock, max_stock, image_url } = req.body;

  // 检查产品编号是否已存在
  db.get('SELECT * FROM products WHERE code = ?', [code], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (existing) {
      return res.status(400).json({ error: '产品编号已存在' });
    }

    // 插入新产品
    const query = `
      INSERT INTO products (code, name, category, unit, min_stock, max_stock, current_stock, image_url)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `;
    
    db.run(query, [code, name, category, unit, min_stock || 0, max_stock || 999999, image_url], function(err) {
      if (err) {
        return res.status(500).json({ error: '创建产品失败' });
      }
      
      res.status(201).json({
        message: '产品创建成功',
        product: {
          id: this.lastID,
          code,
          name,
          category,
          unit,
          min_stock: min_stock || 0,
          max_stock: max_stock || 999999,
          current_stock: 0,
          image_url
        }
      });
    });
  });
});

// 更新产品
router.put('/:id', [
  authenticateToken,
  body('code').optional().notEmpty().withMessage('产品编号不能为空'),
  body('name').optional().notEmpty().withMessage('产品名称不能为空'),
  body('min_stock').optional().isInt({ min: 0 }).withMessage('最低库存必须是非负整数'),
  body('max_stock').optional().isInt({ min: 0 }).withMessage('最高库存必须是非负整数')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  // 检查产品是否存在
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!product) {
      return res.status(404).json({ error: '产品不存在' });
    }

    // 如果更新编号，检查新编号是否已存在
    if (updates.code && updates.code !== product.code) {
      db.get('SELECT * FROM products WHERE code = ? AND id != ?', [updates.code, id], (err, existing) => {
        if (existing) {
          return res.status(400).json({ error: '产品编号已存在' });
        }
        updateProduct();
      });
    } else {
      updateProduct();
    }

    function updateProduct() {
      const fields = [];
      const values = [];
      
      Object.keys(updates).forEach(key => {
        if (['code', 'name', 'category', 'unit', 'min_stock', 'max_stock', 'image_url'].includes(key)) {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });
      
      if (fields.length === 0) {
        return res.status(400).json({ error: '没有提供更新内容' });
      }
      
      values.push(id);
      const query = `UPDATE products SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      
      db.run(query, values, function(err) {
        if (err) {
          return res.status(500).json({ error: '更新产品失败' });
        }
        
        res.json({ message: '产品更新成功' });
      });
    }
  });
});

// 删除产品
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // 检查产品是否存在
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!product) {
      return res.status(404).json({ error: '产品不存在' });
    }
    
    // 删除产品（相关的库存记录会级联删除）
    db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: '删除产品失败' });
      }
      
      res.json({ message: '产品删除成功' });
    });
  });
});

// 搜索产品
router.get('/search/:keyword', authenticateToken, (req, res) => {
  const { keyword } = req.params;
  const searchTerm = `%${keyword}%`;
  
  const query = `
    SELECT * FROM products 
    WHERE code LIKE ? OR name LIKE ? OR category LIKE ?
    ORDER BY created_at DESC
  `;
  
  db.all(query, [searchTerm, searchTerm, searchTerm], (err, products) => {
    if (err) {
      return res.status(500).json({ error: '搜索失败' });
    }
    res.json({ products });
  });
});

module.exports = router;
