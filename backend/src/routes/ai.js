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
    const user = db.prepare('SELECT gender, birthday, height_cm, api_key, preferences FROM users WHERE id = ?').get(req.userId);
    const userApiKey = (user.api_key || '').trim();

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

    const answer = await callChatApi({ messages, max_tokens: 2000, userApiKey });

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

    const user = db.prepare('SELECT api_key FROM users WHERE id = ?').get(req.userId);
    const userApiKey = (user.api_key || '').trim();
    const result = await estimateFoodNutrition(foodDescription, userApiKey);
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

    const user = db.prepare('SELECT gender, birthday, api_key, preferences FROM users WHERE id = ?').get(req.userId);
    const userApiKey = (user.api_key || '').trim();
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

    const answer = await callChatApi({ messages, max_tokens: 2000, userApiKey });

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
  const prefs = parsePreferences(user.preferences);
  const genderLabel = user.gender === 'male' ? '男' : '女';

  let prompt = `你是一位温暖贴心的私人健康伙伴，懂营养学、运动科学和睡眠知识。用户：${genderLabel}，${age}岁，身高${user.height_cm}cm。`;

  // 注入用户偏好
  const prefLines = buildPreferencePrompt(prefs);
  if (prefLines) prompt += '\n\n' + prefLines;

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

  prompt += `\n\n要求：
  - 用中文回答，像朋友聊天一样自然，不要用 markdown 格式
  - 可以适当使用 emoji 表情增加亲和力
  - 先肯定用户的努力和进步，再温和地指出可以改善的地方
  - 所有建议必须基于用户的实际偏好和数据，不做任何身份假设
  - 如果用户设置了活动水平，运动建议要匹配
  - 如果用户有关注领域，优先深入分析
  - 饮食建议必须避开用户的过敏/禁忌和饮食偏好
  - 如果数据不够充分，诚实告知
  - 建议要实用可操作，不空泛，不推荐极端方法
  - 结合补剂记录评估搭配是否合理`;

  return prompt;
}

function buildSkincareSystemPrompt(user, records) {
  const age = calculateAge(user.birthday);
  const prefs = parsePreferences(user.preferences);
  const genderLabel = user.gender === 'male' ? '男' : '女';

  let prompt = `你是一位专业贴心的护肤顾问，同时懂营养学、睡眠和运动对皮肤的影响。用户：${genderLabel}，${age}岁。`;

  // 注入用户偏好
  const prefLines = buildPreferencePrompt(prefs);
  if (prefLines) prompt += '\n\n' + prefLines;

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

  prompt += `\n\n要求：
  - 用中文回答，像朋友聊天一样自然，不要用 markdown 格式
  - 可以适当使用 emoji 表情
  - 所有建议基于用户实际数据和个人偏好，不做任何身份假设
  - 结合作息、饮食、运动、补剂等数据综合给出护肤建议
  - 如果用户填写了过敏/禁忌，推荐产品时需避开
  - 如果用户有关注领域（如皮肤），优先深入分析
  - 建议要具体可操作，不空泛`;

  return prompt;
}

// 偏好标签映射
const PREF_LABELS = {
  goals:    { label: '🎯 目标', values: { '减脂':'减脂','增肌':'增肌','维持':'维持体重','改善睡眠':'改善睡眠' } },
  diet:     { label: '🍽️ 饮食偏好', values: { '不吃辣':'不吃辣','不吃猪肉':'不吃猪肉','偏好清淡':'偏好清淡','低碳水':'低碳水','重口味':'重口味' } },
  activity: { label: '🏃 活动水平', values: { '久坐':'久坐','轻度活动':'轻度活动','中高强度训练':'中高强度训练' } },
  allergies:{ label: '🚫 过敏/禁忌', values: { '海鲜过敏':'海鲜过敏','乳糖不耐受':'乳糖不耐受' } },
  concerns: { label: '📝 关注领域', values: { '护眼':'护眼','护肝':'护肝','关节':'关节','皮肤':'皮肤' } },
};

function parsePreferences(prefsJson) {
  try { return JSON.parse(prefsJson || '{}'); } catch { return {}; }
}

function buildPreferencePrompt(prefs) {
  const lines = ['【用户偏好与背景】'];
  let hasPref = false;

  if (prefs.goals && prefs.goals.length > 0) {
    lines.push(`目标：${prefs.goals.join('、')}`);
    hasPref = true;
  }
  if (prefs.diet && prefs.diet.length > 0) {
    lines.push(`饮食偏好：${prefs.diet.join('、')}`);
    hasPref = true;
  }
  if (prefs.activity) {
    lines.push(`活动水平：${prefs.activity}`);
    hasPref = true;
  }
  if (prefs.allergies && prefs.allergies.length > 0) {
    lines.push(`过敏/禁忌：${prefs.allergies.join('、')}`);
    hasPref = true;
  }
  if (prefs.concerns && prefs.concerns.length > 0) {
    lines.push(`关注领域：${prefs.concerns.join('、')}`);
    hasPref = true;
  }
  if (prefs.improve && prefs.improve.trim()) {
    lines.push(`特别想改善：${prefs.improve.trim()}`);
    hasPref = true;
  }

  if (!hasPref) return '';

  lines.push('\n请严格根据以上偏好给出建议。饮食推荐必须避开过敏和饮食禁忌；运动建议必须匹配用户的活动水平；关注领域的建议要详细；特别想改善的问题要优先回应。');
  return lines.join('\n');
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
