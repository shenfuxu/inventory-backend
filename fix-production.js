// 生产环境修复脚本
const fs = require('fs');
const path = require('path');

// 确保数据目录存在
const dataDir = process.env.NODE_ENV === 'production' ? '/tmp' : '.';
const dbPath = path.join(dataDir, 'inventory.db');

console.log('Database path:', dbPath);
console.log('Environment:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

// 检查目录权限
try {
  fs.accessSync(dataDir, fs.constants.W_OK);
  console.log('✅ Directory is writable');
} catch (error) {
  console.error('❌ Directory is not writable:', error.message);
}

module.exports = { dbPath };
