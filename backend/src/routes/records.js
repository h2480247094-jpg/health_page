const express = require('express');
const db = require('../db/pool');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 所有路由都需要登录
router.use(authMiddleware);

// ---- 辅助函数 ----

// 获取或创建某天的记录
function getOrCreateRecord(userId, date) {
  let record = db.prepare(
    'SELECT * FROM health_records WHERE user_id = ? AND date = ?'
  ).get(userId, date);

  if (!record) {
    db.prepare(
      `INSERT INTO health_records (user_id, date) VALUES (?, ?)`
    ).run(userId, date);
    record = db.prepare(
      'SELECT * FROM health_records WHERE user_id = ? AND date = ?'
    ).get(userId, date);
  }

  return record;
}

// 解析 JSON 字段
function parseRecord(record) {
  if (!record) return null;
  return {
    ...record,
    sleep_segments: JSON.parse(record.sleep_segments || '[]'),
    diet: JSON.parse(record.diet || '[]'),
    exercises: JSON.parse(record.exercises || '[]'),
    supplements: JSON.parse(record.supplements || '[]'),
  };
}

// ---- 获取记录 ----

// 获取所有记录 / 按日期范围查询
router.get('/', (req, res) => {
  try {
    const { start, end } = req.query;
    let records;

    if (start && end) {
      records = db.prepare(
        'SELECT * FROM health_records WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC'
      ).all(req.userId, start, end);
    } else if (start) {
      records = db.prepare(
        'SELECT * FROM health_records WHERE user_id = ? AND date >= ? ORDER BY date DESC'
      ).all(req.userId, start);
    } else {
      records = db.prepare(
        'SELECT * FROM health_records WHERE user_id = ? ORDER BY date DESC'
      ).all(req.userId);
    }

    res.json(records.map(parseRecord));
  } catch (err) {
    console.error('获取记录失败:', err);
    res.status(500).json({ error: '获取记录失败' });
  }
});

// 获取单条记录（按日期）
router.get('/:date', (req, res) => {
  try {
    const record = db.prepare(
      'SELECT * FROM health_records WHERE user_id = ? AND date = ?'
    ).get(req.userId, req.params.date);

    res.json(parseRecord(record) || null);
  } catch (err) {
    console.error('获取记录失败:', err);
    res.status(500).json({ error: '获取记录失败' });
  }
});

// 删除记录
router.delete('/:id', (req, res) => {
  try {
    const record = db.prepare(
      'SELECT id FROM health_records WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.userId);

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    db.prepare('DELETE FROM health_records WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('删除记录失败:', err);
    res.status(500).json({ error: '删除记录失败' });
  }
});

// ---- 体重 ----
router.put('/:date/weight', (req, res) => {
  try {
    const { weight } = req.body;
    const { date } = req.params;
    getOrCreateRecord(req.userId, date);

    db.prepare(
      'UPDATE health_records SET weight = ?, updated_at = datetime(\'now\') WHERE user_id = ? AND date = ?'
    ).run(weight, req.userId, date);

    res.json({ ok: true });
  } catch (err) {
    console.error('保存体重失败:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

// ---- 睡眠 ----
router.put('/:date/sleep', (req, res) => {
  try {
    const { sleep_segments, bed_time, wake_time } = req.body;
    const { date } = req.params;
    getOrCreateRecord(req.userId, date);

    const segments = sleep_segments || [];
    const totalSleep = segments.reduce((sum, s) => {
      const bed = timeToHours(s.bedTime);
      const wake = timeToHours(s.wakeTime);
      if (wake < bed) return sum + (wake + 24 - bed);
      return sum + (wake - bed);
    }, 0);

    const firstSeg = segments[0] || {};
    db.prepare(
      `UPDATE health_records SET sleep_segments = ?, sleep = ?, bed_time = ?, wake_time = ?, updated_at = datetime('now')
       WHERE user_id = ? AND date = ?`
    ).run(
      JSON.stringify(segments),
      Math.round(totalSleep * 100) / 100,
      bed_time || firstSeg.bedTime || null,
      wake_time || firstSeg.wakeTime || null,
      req.userId, date
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('保存睡眠失败:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

// ---- 饮食 ----
router.post('/:date/diet', (req, res) => {
  try {
    const { date } = req.params;
    const record = getOrCreateRecord(req.userId, date);
    const diet = JSON.parse(record.diet || '[]');
    diet.push(req.body);

    db.prepare(
      'UPDATE health_records SET diet = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(JSON.stringify(diet), record.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('保存饮食失败:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

router.delete('/:date/diet/:index', (req, res) => {
  try {
    const { date } = req.params;
    const idx = parseInt(req.params.index);
    const record = getOrCreateRecord(req.userId, date);
    const diet = JSON.parse(record.diet || '[]');
    diet.splice(idx, 1);

    db.prepare(
      'UPDATE health_records SET diet = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(JSON.stringify(diet), record.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('删除饮食失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// ---- 运动 ----
router.post('/:date/exercise', (req, res) => {
  try {
    const { date } = req.params;
    const record = getOrCreateRecord(req.userId, date);
    const exercises = JSON.parse(record.exercises || '[]');
    exercises.push(req.body);

    db.prepare(
      'UPDATE health_records SET exercises = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(JSON.stringify(exercises), record.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('保存运动失败:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

router.delete('/:date/exercise/:index', (req, res) => {
  try {
    const { date } = req.params;
    const idx = parseInt(req.params.index);
    const record = getOrCreateRecord(req.userId, date);
    const exercises = JSON.parse(record.exercises || '[]');
    exercises.splice(idx, 1);

    db.prepare(
      'UPDATE health_records SET exercises = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(JSON.stringify(exercises), record.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('删除运动失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// ---- 补剂 ----
router.post('/:date/supplement', (req, res) => {
  try {
    const { date } = req.params;
    const record = getOrCreateRecord(req.userId, date);
    const supplements = JSON.parse(record.supplements || '[]');
    supplements.push(req.body);

    db.prepare(
      'UPDATE health_records SET supplements = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(JSON.stringify(supplements), record.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('保存补剂失败:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

router.delete('/:date/supplement/:index', (req, res) => {
  try {
    const { date } = req.params;
    const idx = parseInt(req.params.index);
    const record = getOrCreateRecord(req.userId, date);
    const supplements = JSON.parse(record.supplements || '[]');
    supplements.splice(idx, 1);

    db.prepare(
      'UPDATE health_records SET supplements = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(JSON.stringify(supplements), record.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('删除补剂失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// ---- 工具函数 ----
function timeToHours(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}

module.exports = router;
