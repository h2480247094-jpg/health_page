const express = require('express');
const db = require('../db/pool');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 获取补剂预设
router.get('/', (req, res) => {
  try {
    const presets = db.prepare(
      'SELECT id, name, dosage, unit, emoji FROM supplement_presets WHERE user_id = ? ORDER BY sort_order'
    ).all(req.userId);

    res.json(presets);
  } catch (err) {
    console.error('获取补剂预设失败:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

// 添加补剂预设
router.post('/', (req, res) => {
  try {
    const { name, dosage, unit, emoji } = req.body;
    if (!name) {
      return res.status(400).json({ error: '请输入补剂名称' });
    }

    // 获取当前最大 sort_order
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as m FROM supplement_presets WHERE user_id = ?'
    ).get(req.userId);

    const result = db.prepare(
      'INSERT OR IGNORE INTO supplement_presets (user_id, name, dosage, unit, emoji, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.userId, name, dosage || 1, unit || '粒', emoji || '💊', (maxOrder.m || 0) + 1);

    const preset = db.prepare(
      'SELECT id, name, dosage, unit, emoji FROM supplement_presets WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.json(preset);
  } catch (err) {
    console.error('添加补剂预设失败:', err);
    res.status(500).json({ error: '添加失败' });
  }
});

// 删除补剂预设
router.delete('/:id', (req, res) => {
  try {
    const preset = db.prepare(
      'SELECT id FROM supplement_presets WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.userId);

    if (!preset) {
      return res.status(404).json({ error: '预设不存在' });
    }

    db.prepare('DELETE FROM supplement_presets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('删除补剂预设失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
