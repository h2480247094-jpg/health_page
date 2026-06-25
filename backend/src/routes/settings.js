const express = require('express');
const db = require('../db/pool');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 获取用户设置
router.get('/', (req, res) => {
  try {
    const user = db.prepare(
      'SELECT gender, birthday, height_cm FROM users WHERE id = ?'
    ).get(req.userId);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      gender: user.gender,
      birthday: user.birthday,
      height_cm: user.height_cm,
    });
  } catch (err) {
    console.error('获取设置失败:', err);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 更新用户设置
router.put('/', (req, res) => {
  try {
    const { gender, birthday, height_cm } = req.body;

    const updates = [];
    const params = [];

    if (gender !== undefined) {
      if (!['male', 'female'].includes(gender)) {
        return res.status(400).json({ error: '性别值无效' });
      }
      updates.push('gender = ?');
      params.push(gender);
    }
    if (birthday !== undefined) {
      updates.push('birthday = ?');
      params.push(birthday);
    }
    if (height_cm !== undefined) {
      const h = parseInt(height_cm);
      if (isNaN(h) || h < 50 || h > 300) {
        return res.status(400).json({ error: '身高值无效（50-300cm）' });
      }
      updates.push('height_cm = ?');
      params.push(h);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.userId);

    db.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).run(...params);

    const user = db.prepare(
      'SELECT gender, birthday, height_cm FROM users WHERE id = ?'
    ).get(req.userId);

    res.json(user);
  } catch (err) {
    console.error('更新设置失败:', err);
    res.status(500).json({ error: '更新设置失败' });
  }
});

module.exports = router;
