// API测试脚本
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
let token = '';
let productId = null;

async function testAPI() {
  console.log('=== 开始测试库存管理系统API ===\n');

  try {
    // 1. 测试健康检查
    console.log('1. 测试健康检查...');
    const health = await axios.get(`${API_BASE}/health`);
    console.log('✓ 健康检查成功:', health.data.message);

    // 2. 测试注册
    console.log('\n2. 测试用户注册...');
    const testEmail = `test${Date.now()}@example.com`;
    const register = await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: 'password123',
      name: '测试用户'
    });
    token = register.data.token;
    console.log('✓ 注册成功, 用户ID:', register.data.user.id);

    // 3. 测试登录
    console.log('\n3. 测试用户登录...');
    const login = await axios.post(`${API_BASE}/auth/login`, {
      email: testEmail,
      password: 'password123'
    });
    console.log('✓ 登录成功');

    // 配置请求头
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    // 4. 测试获取当前用户
    console.log('\n4. 测试获取当前用户信息...');
    const me = await axios.get(`${API_BASE}/auth/me`, config);
    console.log('✓ 获取用户信息成功:', me.data.user.name);

    // 5. 测试创建产品
    console.log('\n5. 测试创建产品...');
    const product = await axios.post(`${API_BASE}/products`, {
      code: 'P001',
      name: '测试产品',
      category: '电子产品',
      unit: '个',
      min_stock: 10,
      max_stock: 1000
    }, config);
    productId = product.data.product.id;
    console.log('✓ 创建产品成功, 产品ID:', productId);

    // 6. 测试获取产品列表
    console.log('\n6. 测试获取产品列表...');
    const products = await axios.get(`${API_BASE}/products`, config);
    console.log('✓ 获取产品列表成功, 产品数量:', products.data.products.length);

    // 7. 测试入库操作
    console.log('\n7. 测试入库操作...');
    const stockIn = await axios.post(`${API_BASE}/stock/in`, {
      product_id: productId,
      quantity: 100,
      supplier: '测试供应商',
      reason: '采购入库'
    }, config);
    console.log('✓ 入库成功, 当前库存:', stockIn.data.movement.after_stock);

    // 8. 测试出库操作
    console.log('\n8. 测试出库操作...');
    const stockOut = await axios.post(`${API_BASE}/stock/out`, {
      product_id: productId,
      quantity: 30,
      department: '生产部',
      reason: '生产领用'
    }, config);
    console.log('✓ 出库成功, 当前库存:', stockOut.data.movement.after_stock);

    // 9. 测试获取库存变动记录
    console.log('\n9. 测试获取库存变动记录...');
    const movements = await axios.get(`${API_BASE}/stock/movements`, config);
    console.log('✓ 获取库存记录成功, 记录数量:', movements.data.movements.length);

    // 10. 测试仪表盘统计
    console.log('\n10. 测试仪表盘统计...');
    const stats = await axios.get(`${API_BASE}/dashboard/stats`, config);
    console.log('✓ 获取统计数据成功:');
    console.log('  - 产品总数:', stats.data.stats.totalProducts);
    console.log('  - 今日入库:', stats.data.stats.todayIn);
    console.log('  - 今日出库:', stats.data.stats.todayOut);

    // 11. 测试预警系统
    console.log('\n11. 测试获取预警...');
    const alerts = await axios.get(`${API_BASE}/alerts`, config);
    console.log('✓ 获取预警列表成功, 预警数量:', alerts.data.alerts.length);

    // 12. 测试删除产品
    console.log('\n12. 测试删除产品...');
    await axios.delete(`${API_BASE}/products/${productId}`, config);
    console.log('✓ 删除产品成功');

    console.log('\n=== 所有API测试通过 ✅ ===');
  } catch (error) {
    console.error('\n❌ 测试失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

// 安装axios后运行: npm install axios
// 运行测试: node test-api.js
testAPI();
