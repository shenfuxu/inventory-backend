const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// 获取数据库连接
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inventory.db');

// 获取所有预警
router.get('/', authenticateToken, (req, res) => {
  const { is_read, limit = 50 } = req.query;
  
  let query = `
    SELECT 
      a.*,
      p.name as product_name,
      p.code as product_code,
      p.current_stock
    FROM alerts a
    LEFT JOIN products p ON a.product_id = p.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (is_read !== undefined) {
    query += ' AND a.is_read = ?';
    params.push(is_read === 'true' ? 1 : 0);
  }
  
  query += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, alerts) => {
    if (err) {
      return res.status(500).json({ error: '获取预警列表失败' });
    }
    res.json({ alerts });
  });
});

// 获取未读预警数量
router.get('/unread-count', authenticateToken, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0', (err, result) => {
    if (err) {
      return res.status(500).json({ error: '获取未读数量失败' });
    }
    res.json({ count: result.count });
  });
});

// 标记预警为已读
router.put('/:id/read', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('UPDATE alerts SET is_read = 1 WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '更新失败' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: '预警不存在' });
    }
    
    res.json({ message: '标记成功' });
  });
});

// 批量标记为已读
router.put('/mark-all-read', authenticateToken, (req, res) => {
  db.run('UPDATE alerts SET is_read = 1 WHERE is_read = 0', function(err) {
    if (err) {
      return res.status(500).json({ error: '批量标记失败' });
    }
    res.json({ message: '批量标记成功', count: this.changes });
  });
});

// 删除预警
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM alerts WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '删除失败' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: '预警不存在' });
    }
    
    res.json({ message: '删除成功' });
  });
});

// 清空已读预警
router.delete('/clear-read', authenticateToken, (req, res) => {
  db.run('DELETE FROM alerts WHERE is_read = 1', function(err) {
    if (err) {
      return res.status(500).json({ error: '清空失败' });
    }
    res.json({ message: '清空成功', count: this.changes });
  });
});

module.exports = router;
