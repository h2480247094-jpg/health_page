const express = require('express');
const db = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const { callChatApi, estimateFoodNutrition } = require('../services/ai');

const router = express.Router();
router.use(authMiddleware);

const MAX_HISTORY = 40;

// ---- 健康建议 ----
router.post('/health-advice', async (req, res) => {
  try {
    const { question } = req.body;

    // 获取用户信息
    const user = db.prepare('SELECT gender, birthday, height_cm FROM users WHERE id = ?').get(req.userId);

    // 获取健康数据
    const records = db.prepare(
      'SELECT * FROM health_records WHERE user_id = ? ORDER BY date DESC LIMIT 90'
    ).all(req.userId);

    // 获取对话历史
    const history = db.prepare(
      'SELECT question, answer FROM chat_histories WHERE user_id = ? AND chat_type = ? ORDER BY created_at DESC LIMIT ?'
    ).all(req.userId, 'health', MAX_HISTORY);

    // 构建消息
    const messages = [];
    messages.push({ role: 'system', content: buildHealthSystemPrompt(user, records) });

    // 最近的对话历史
    for (const h of history.reverse()) {
      messages.push({ role: 'user', content: h.question });
      messages.push({ role: 'assistant', content: h.answer });
    }

    messages.push({ role: 'user', content: question || '请根据我的健康数据给出今天的建议' });

    const answer = await callChatApi({ messages, max_tokens: 2000 });

    // 保存对话历史
    db.prepare(
      'INSERT INTO chat_histories (user_id, chat_type, question, answer) VALUES (?, ?, ?, ?)'
    ).run(req.userId, 'health', question || '综合分析', answer);

    // 清理旧记录
    const count = db.prepare(
      'SELECT COUNT(*) as c FROM chat_histories WHERE user_id = ? AND chat_type = ?'
    ).get(req.userId, 'health');
    if (count.c > MAX_HISTORY) {
      db.prepare(
        `DELETE FROM chat_histories WHERE id IN (
          SELECT id FROM chat_histories WHERE user_id = ? AND chat_type = ? ORDER BY created_at ASC LIMIT ?
        )`
      ).run(req.userId, 'health', count.c - MAX_HISTORY);
    }

    res.json({ answer });
  } catch (err) {
    console.error('AI 健康建议失败:', err);
    res.status(500).json({ error: 'AI 请求失败，请稍后重试' });
  }
});

// ---- 食物营养估算 ----
router.post('/food-estimate', async (req, res) => {
  try {
    const { foodDescription } = req.body;
    if (!foodDescription) {
      return res.status(400).json({ error: '请输入食物描述' });
    }

    const result = await estimateFoodNutrition(foodDescription);
    if (!result) {
      return res.status(500).json({ error: '估算失败，请重新描述' });
    }

    res.json(result);
  } catch (err) {
    console.error('食物估算失败:', err);
    res.status(500).json({ error: '估算失败，请稍后重试' });
  }
});

// ---- 护肤建议 ----
router.post('/skincare-advice', async (req, res) => {
  try {
    const { question } = req.body;

    const user = db.prepare('SELECT gender, birthday FROM users WHERE id = ?').get(req.userId);
    const records = db.prepare(
      'SELECT * FROM health_records WHERE user_id = ? ORDER BY date DESC LIMIT 30'
    ).all(req.userId);

    const history = db.prepare(
      'SELECT question, answer FROM chat_histories WHERE user_id = ? AND chat_type = ? ORDER BY created_at DESC LIMIT ?'
    ).all(req.userId, 'skincare', MAX_HISTORY);

    const messages = [];
    messages.push({ role: 'system', content: buildSkincareSystemPrompt(user, records) });

    for (const h of history.reverse()) {
      messages.push({ role: 'user', content: h.question });
      messages.push({ role: 'assistant', content: h.answer });
    }

    messages.push({ role: 'user', content: question || '请根据我的情况给出护肤建议' });

    const answer = await callChatApi({ messages, max_tokens: 2000 });

    db.prepare(
      'INSERT INTO chat_histories (user_id, chat_type, question, answer) VALUES (?, ?, ?, ?)'
    ).run(req.userId, 'skincare', question || '护肤建议', answer);

    // 清理旧记录
    const count = db.prepare(
      'SELECT COUNT(*) as c FROM chat_histories WHERE user_id = ? AND chat_type = ?'
    ).get(req.userId, 'skincare');
    if (count.c > MAX_HISTORY) {
      db.prepare(
        `DELETE FROM chat_histories WHERE id IN (
          SELECT id FROM chat_histories WHERE user_id = ? AND chat_type = ? ORDER BY created_at ASC LIMIT ?
        )`
      ).run(req.userId, 'skincare', count.c - MAX_HISTORY);
    }

    res.json({ answer });
  } catch (err) {
    console.error('AI 护肤建议失败:', err);
    res.status(500).json({ error: 'AI 请求失败，请稍后重试' });
  }
});

// ---- 对话历史 ----
router.get('/chat-history', (req, res) => {
  try {
    const { type } = req.query;
    const chatType = type === 'skincare' ? 'skincare' : 'health';

    const history = db.prepare(
      'SELECT question, answer, created_at FROM chat_histories WHERE user_id = ? AND chat_type = ? ORDER BY created_at ASC LIMIT ?'
    ).all(req.userId, chatType, MAX_HISTORY);

    res.json(history.map(h => ({
      question: h.question,
      answer: h.answer,
      timestamp: h.created_at,
    })));
  } catch (err) {
    console.error('获取对话历史失败:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

// 清除对话历史
router.delete('/chat-history', (req, res) => {
  try {
    const { type } = req.query;
    const chatType = type === 'skincare' ? 'skincare' : 'health';

    db.prepare(
      'DELETE FROM chat_histories WHERE user_id = ? AND chat_type = ?'
    ).run(req.userId, chatType);

    res.json({ ok: true });
  } catch (err) {
    console.error('清除对话历史失败:', err);
    res.status(500).json({ error: '清除失败' });
  }
});

// ---- 构建系统提示词 ----
function buildHealthSystemPrompt(user, records) {
  const age = calculateAge(user.birthday);
  let prompt = `你是一位专业的健康管理教练。用户信息：性别${user.gender === 'male' ? '男' : '女'}，年龄${age}岁，身高${user.height_cm}cm。`;

  if (records.length > 0) {
    prompt += '\n\n用户最近的健康数据：';
    const recent = records.slice(0, 30).reverse();
    for (const r of recent) {
      const parts = [`\n📅 ${r.date}:`];
      if (r.weight) parts.push(`体重${r.weight}kg`);
      const diet = JSON.parse(r.diet || '[]');
      if (diet.length > 0) {
        const totalCal = diet.reduce((s, d) => s + (d.calories || 0), 0);
        parts.push(`摄入${totalCal}kcal`);
      }
      const exercises = JSON.parse(r.exercises || '[]');
      if (exercises.length > 0) {
        const totalEx = exercises.reduce((s, e) => s + (e.calories || 0), 0);
        parts.push(`运动消耗${totalEx}kcal`);
      }
      if (r.sleep) parts.push(`睡眠${r.sleep}h`);
      prompt += parts.join('，');
    }
  }

  prompt += '\n\n请用中文回答，给出具体、可操作的建议。保持简洁友好，每条建议不超过3句话。';
  return prompt;
}

function buildSkincareSystemPrompt(user, records) {
  const age = calculateAge(user.birthday);
  let prompt = `你是一位专业的护肤顾问。用户：${user.gender === 'male' ? '男' : '女'}，${age}岁。`;

  if (records.length > 0) {
    const recent = records.slice(0, 14).reverse();
    let totalSleep = 0, sleepDays = 0;
    for (const r of recent) {
      if (r.sleep) { totalSleep += r.sleep; sleepDays++; }
    }
    if (sleepDays > 0) {
      prompt += `\n近期平均睡眠：${(totalSleep / sleepDays).toFixed(1)}小时/天。`;
    }
    const supplements = [];
    for (const r of recent) {
      const supps = JSON.parse(r.supplements || '[]');
      for (const s of supps) {
        if (!supplements.includes(s.name)) supplements.push(s.name);
      }
    }
    if (supplements.length > 0) {
      prompt += `\n在服用补剂：${supplements.join('、')}。`;
    }
  }

  prompt += '\n\n请从饮食、作息、护肤习惯、补剂等角度给出建议。用中文回答，简洁实用。';
  return prompt;
}

function calculateAge(birthday) {
  const today = new Date();
  const birth = new Date(birthday);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

module.exports = router;
