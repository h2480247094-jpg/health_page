const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const pool = require('./db/pool');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 静态文件（上传的照片 + 前端页面）
app.use('/uploads', express.static(path.resolve(config.uploadDir)));
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 启动函数
async function start() {
  // 初始化数据库
  await pool.initDB();
  console.log('✅ 数据库初始化完成');

  // 导入 schema
  const initSchema = require('./db/init');
  initSchema();

  // 挂载路由（在 db 初始化之后）
  const authRoutes = require('./routes/auth');
  const recordsRoutes = require('./routes/records');
  const settingsRoutes = require('./routes/settings');
  const supplementsRoutes = require('./routes/supplements');
  const photosRoutes = require('./routes/photos');
  const aiRoutes = require('./routes/ai');

  app.use('/api/auth', authRoutes);
  app.use('/api/records', recordsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/presets', supplementsRoutes);
  app.use('/api/photos', photosRoutes);
  app.use('/api/ai', aiRoutes);

  // 前端 SPA fallback（所有非 /api 的 GET 请求返回 app.html）
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'app.html'));
    }
  });

  app.listen(config.port, () => {
    console.log(`🚀 服务已启动: http://localhost:${config.port}`);
    console.log(`📋 健康检查: http://localhost:${config.port}/api/health`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
