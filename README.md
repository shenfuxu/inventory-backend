# 库存管理系统 - 后端API

基于 Node.js + Express + SQLite3 的库存管理系统后端API服务。

## 功能特性

- 🔐 JWT用户认证和授权
- 👥 多角色权限管理（管理员、仓库管理员、普通用户）
- 📦 完整的产品CRUD操作
- 📥📤 入库出库管理
- ⚠️ 自动库存预警
- 📊 仪表盘统计数据
- 📜 操作历史记录
- 🔄 RESTful API设计

## 技术栈

- **运行环境**：Node.js
- **Web框架**：Express.js
- **数据库**：SQLite3
- **认证**：JWT (jsonwebtoken)
- **密码加密**：bcryptjs
- **数据验证**：express-validator
- **跨域处理**：cors

## 快速开始

### 安装依赖

```bash
cd inventory-backend
npm install
```

### 配置环境变量

编辑 `.env` 文件：

```env
PORT=5000
JWT_SECRET=your-secret-key
DATABASE_PATH=./inventory.db
CLIENT_URL=http://localhost:3000
```

### 启动服务器

开发模式（支持热重载）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

服务器将在 http://localhost:5000 启动

## API文档

### 认证接口

#### 注册
- **POST** `/api/auth/register`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名称"
}
```

#### 登录
- **POST** `/api/auth/login`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 获取当前用户信息
- **GET** `/api/auth/me`
- **Headers**: `Authorization: Bearer <token>`

### 产品管理接口

#### 获取所有产品
- **GET** `/api/products`
- **Headers**: `Authorization: Bearer <token>`

#### 获取单个产品
- **GET** `/api/products/:id`
- **Headers**: `Authorization: Bearer <token>`

#### 创建产品
- **POST** `/api/products`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "code": "P001",
  "name": "产品名称",
  "category": "分类",
  "unit": "个",
  "min_stock": 10,
  "max_stock": 1000
}
```

#### 更新产品
- **PUT** `/api/products/:id`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: 同创建产品

#### 删除产品
- **DELETE** `/api/products/:id`
- **Headers**: `Authorization: Bearer <token>`

#### 搜索产品
- **GET** `/api/products/search/:keyword`
- **Headers**: `Authorization: Bearer <token>`

### 库存操作接口

#### 获取库存变动记录
- **GET** `/api/stock/movements`
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `product_id`: 产品ID（可选）
  - `type`: in/out（可选）
  - `start_date`: 开始日期（可选）
  - `end_date`: 结束日期（可选）
  - `limit`: 返回记录数（默认50）

#### 入库
- **POST** `/api/stock/in`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "product_id": 1,
  "quantity": 100,
  "supplier": "供应商名称",
  "batch_no": "批次号",
  "reason": "采购入库"
}
```

#### 出库
- **POST** `/api/stock/out`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "product_id": 1,
  "quantity": 50,
  "department": "使用部门",
  "reason": "生产领用"
}
```

#### 库存盘点调整
- **POST** `/api/stock/adjust`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "product_id": 1,
  "actual_stock": 95,
  "reason": "盘点差异"
}
```

### 预警接口

#### 获取所有预警
- **GET** `/api/alerts`
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `is_read`: true/false（可选）
  - `limit`: 返回记录数（默认50）

#### 获取未读预警数量
- **GET** `/api/alerts/unread-count`
- **Headers**: `Authorization: Bearer <token>`

#### 标记预警为已读
- **PUT** `/api/alerts/:id/read`
- **Headers**: `Authorization: Bearer <token>`

#### 批量标记为已读
- **PUT** `/api/alerts/mark-all-read`
- **Headers**: `Authorization: Bearer <token>`

#### 删除预警
- **DELETE** `/api/alerts/:id`
- **Headers**: `Authorization: Bearer <token>`

### 仪表盘接口

#### 获取统计数据
- **GET** `/api/dashboard/stats`
- **Headers**: `Authorization: Bearer <token>`

#### 获取最近库存变动
- **GET** `/api/dashboard/recent-movements`
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `limit`: 返回记录数（默认10）

#### 获取低库存产品
- **GET** `/api/dashboard/low-stock-products`
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `limit`: 返回记录数（默认10）

#### 获取库存趋势
- **GET** `/api/dashboard/stock-trend`
- **Headers**: `Authorization: Bearer <token>`

#### 获取分类统计
- **GET** `/api/dashboard/category-stats`
- **Headers**: `Authorization: Bearer <token>`

## 数据库结构

### users 表
- id: 用户ID
- email: 邮箱（唯一）
- password: 密码（加密）
- name: 用户名
- role: 角色（admin/warehouse_manager/user）
- created_at: 创建时间

### products 表
- id: 产品ID
- code: 产品编号（唯一）
- name: 产品名称
- category: 分类
- unit: 单位
- min_stock: 最低库存
- max_stock: 最高库存
- current_stock: 当前库存
- image_url: 产品图片
- created_at: 创建时间
- updated_at: 更新时间

### stock_movements 表
- id: 记录ID
- product_id: 产品ID
- type: 类型（in/out）
- quantity: 数量
- before_stock: 变动前库存
- after_stock: 变动后库存
- operator_id: 操作员ID
- reason: 原因
- supplier: 供应商（入库）
- department: 部门（出库）
- batch_no: 批次号
- created_at: 创建时间

### alerts 表
- id: 预警ID
- product_id: 产品ID
- type: 预警类型
- message: 预警信息
- is_read: 是否已读
- created_at: 创建时间

### categories 表
- id: 分类ID
- name: 分类名称
- description: 描述

## 错误处理

API返回统一的错误格式：

```json
{
  "error": "错误信息描述"
}
```

常见HTTP状态码：
- 200: 成功
- 201: 创建成功
- 400: 请求参数错误
- 401: 未授权
- 403: 无权限
- 404: 资源不存在
- 500: 服务器错误

## 安全性

- 密码使用bcrypt加密存储
- JWT令牌用于身份验证
- 支持CORS跨域配置
- 输入数据验证和清理
- SQL注入防护

## 许可证

MIT License
