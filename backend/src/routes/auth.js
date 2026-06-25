const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/pool');
const config = require('../config');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', (req, res) => {
  try {
    const { email, password } = req.body;

    // 验证
    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    // 检查邮箱是否已注册
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: '该邮箱已注册' });
    }

    // 创建用户
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    ).run(email, passwordHash);

    const userId = result.lastInsertRowid;

    // 插入默认补剂预设
    insertDefaultPresets(userId);

    // 生成 token
    const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: userId, email, username: '' },
    });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 登录
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username || '' },
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, username, gender, birthday, height_cm, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({ user });
});

// 插入默认补剂预设
function insertDefaultPresets(userId) {
  const defaults = [
    ['鱼油', 2, '粒', '🐟'],
    ['肌酸', 5, 'g', '💪'],
    ['维生素D', 1, '粒', '☀️'],
    ['维生素C', 1, '粒', '🍊'],
    ['蛋白粉', 1, '勺', '🥛'],
    ['镁', 1, '粒', '🧂'],
    ['锌', 1, '粒', '🔋'],
    ['维生素B族', 1, '粒', '⚡'],
  ];
  const insert = db.prepare(
    'INSERT OR IGNORE INTO supplement_presets (user_id, name, dosage, unit, emoji, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction(() => {
    for (let i = 0; i < defaults.length; i++) {
      const [name, dosage, unit, emoji] = defaults[i];
      insert.run(userId, name, dosage, unit, emoji, i);
    }
  });
  insertMany();
}

module.exports = router;
