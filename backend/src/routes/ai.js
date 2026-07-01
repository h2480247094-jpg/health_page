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

    const answer = await callChatApi({ messages, max_tokens: 4000, userApiKey });

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

    const answer = await callChatApi({ messages, max_tokens: 3000, userApiKey });

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

  let prompt = `你是一位经验丰富的私人健康顾问，精通营养学、运动科学、睡眠医学和行为心理学。你的任务是基于用户的长期健康数据，给出深入、具体、可操作的个性化建议。用户：${genderLabel}，${age}岁，身高${user.height_cm}cm。`;

  // 注入用户偏好
  const prefLines = buildPreferencePrompt(prefs);
  if (prefLines) prompt += '\n\n' + prefLines;

  // ---- 构建详细的历史数据分析 ----
  if (records.length > 0) {
    const recent = records.slice(0, 30).reverse(); // 最近30天，按时间正序
    prompt += '\n\n━━━━━━━━━━━━━━━━━━━━';
    prompt += '\n📊 用户健康数据（最近30天详细记录）';
    prompt += '\n━━━━━━━━━━━━━━━━━━━━';

    // 汇总统计变量
    let weightValues = [];
    let allCalories = [];
    let allProtein = [];
    let allCarbs = [];
    let allFat = [];
    let allSleep = [];
    let allExerciseCal = [];
    let allSupplementNames = new Set();
    let totalDaysWithData = 0;

    // 逐日详细数据
    for (const r of recent) {
      const diet = parseJsonArray(r.diet);
      const exercises = parseJsonArray(r.exercises);
      const supplements = parseJsonArray(r.supplements);

      const totalCal = diet.reduce((s, d) => s + (d.calories || 0), 0);
      const totalProtein = diet.reduce((s, d) => s + (d.protein || 0), 0);
      const totalCarbs = diet.reduce((s, d) => s + (d.carbs || 0), 0);
      const totalFat = diet.reduce((s, d) => s + (d.fat || 0), 0);
      const totalExCal = exercises.reduce((s, e) => s + (e.calories || 0), 0);

      const hasData = r.weight || totalCal > 0 || totalExCal > 0 || r.sleep > 0;
      if (!hasData) continue; // 跳过完全空白天

      totalDaysWithData++;

      const parts = [`📅 ${r.date}`];

      if (r.weight) {
        parts.push(`体重${r.weight}kg`);
        weightValues.push(r.weight);
      }

      if (diet.length > 0) {
        // 列出每餐食物
        const foodList = diet.map(d => {
          let foodStr = `${d.description || '未知食物'}`;
          if (d.calories) foodStr += `(${d.calories}kcal`;
          if (d.protein) foodStr += ` P:${d.protein}g`;
          if (d.carbs) foodStr += ` C:${d.carbs}g`;
          if (d.fat) foodStr += ` F:${d.fat}g`;
          if (d.calories) foodStr += ')';
          return foodStr;
        }).join('、');
        parts.push(`\n   🍽️ ${foodList}`);
        parts.push(`[总计: ${totalCal}kcal 蛋白${totalProtein.toFixed(1)}g 碳水${totalCarbs.toFixed(1)}g 脂肪${totalFat.toFixed(1)}g]`);
        allCalories.push(totalCal);
        allProtein.push(totalProtein);
        allCarbs.push(totalCarbs);
        allFat.push(totalFat);
      }

      if (exercises.length > 0) {
        const exList = exercises.map(e => `${e.type || '运动'}${e.duration || ''}分钟(${e.calories || 0}kcal)`).join('、');
        parts.push(`\n   🏃 ${exList}`);
        allExerciseCal.push(totalExCal);
      }

      if (r.sleep > 0) {
        parts.push(`\n   😴 睡眠${r.sleep}h`);
        if (r.bed_time) parts.push(`(${r.bed_time}入睡`);
        if (r.wake_time) parts.push(`${r.wake_time}起床)`);
        allSleep.push(r.sleep);
      }

      if (supplements.length > 0) {
        const suppList = supplements.map(s => `${s.name || ''}${s.dosage || ''}${s.unit || ''}`).filter(Boolean).join('、');
        if (suppList) {
          parts.push(`\n   💊 补剂: ${suppList}`);
          supplements.forEach(s => { if (s.name) allSupplementNames.add(s.name); });
        }
      }

      prompt += '\n' + parts.join('');
    }

    // ---- 趋势与汇总分析 ----
    prompt += '\n\n📈 数据趋势汇总：';

    if (weightValues.length >= 2) {
      const firstWeight = weightValues[0];
      const lastWeight = weightValues[weightValues.length - 1];
      const weightChange = (lastWeight - firstWeight).toFixed(1);
      const trend = weightChange > 0 ? '↑ 上升' : weightChange < 0 ? '↓ 下降' : '→ 稳定';
      prompt += `\n• 体重趋势(${weightValues.length}次记录): ${firstWeight}kg → ${lastWeight}kg，变化 ${weightChange > 0 ? '+' : ''}${weightChange}kg ${trend}`;
    } else if (weightValues.length === 1) {
      prompt += `\n• 体重: ${weightValues[0]}kg（仅1次记录，无法分析趋势）`;
    }

    if (allCalories.length > 0) {
      const avgCal = (allCalories.reduce((a, b) => a + b, 0) / allCalories.length).toFixed(0);
      const avgProtein = allProtein.length > 0 ? (allProtein.reduce((a, b) => a + b, 0) / allProtein.length).toFixed(1) : 0;
      const avgCarbs = allCarbs.length > 0 ? (allCarbs.reduce((a, b) => a + b, 0) / allCarbs.length).toFixed(1) : 0;
      const avgFat = allFat.length > 0 ? (allFat.reduce((a, b) => a + b, 0) / allFat.length).toFixed(1) : 0;
      prompt += `\n• 饮食(${allCalories.length}天): 日均摄入${avgCal}kcal，蛋白${avgProtein}g、碳水${avgCarbs}g、脂肪${avgFat}g`;

      // 热量趋势
      if (allCalories.length >= 5) {
        const firstHalf = allCalories.slice(0, Math.floor(allCalories.length / 2));
        const secondHalf = allCalories.slice(Math.floor(allCalories.length / 2));
        const firstAvg = (firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length).toFixed(0);
        const secondAvg = (secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length).toFixed(0);
        const calTrend = secondAvg > firstAvg ? '上升' : secondAvg < firstAvg ? '下降' : '稳定';
        prompt += `\n  热量趋势: 前期日均${firstAvg}kcal → 近期日均${secondAvg}kcal (${calTrend})`;
      }
    }

    if (allExerciseCal.length > 0) {
      const avgEx = (allExerciseCal.reduce((a, b) => a + b, 0) / allExerciseCal.length).toFixed(0);
      const totalExDays = allExerciseCal.length;
      prompt += `\n• 运动(${totalExDays}天): 日均消耗${avgEx}kcal`;
    }

    // 净能量平衡
    if (allCalories.length > 0 && allExerciseCal.length > 0) {
      const avgCal = allCalories.reduce((a, b) => a + b, 0) / allCalories.length;
      const avgEx = allExerciseCal.reduce((a, b) => a + b, 0) / allExerciseCal.length;
      const netBalance = (avgCal - avgEx).toFixed(0);
      prompt += `\n• 净能量平衡: 日均摄入${avgCal.toFixed(0)} - 消耗${avgEx.toFixed(0)} = 净${netBalance > 0 ? '+' : ''}${netBalance}kcal`;
    }

    if (allSleep.length > 0) {
      const avgSleep = (allSleep.reduce((a, b) => a + b, 0) / allSleep.length).toFixed(1);
      const minSleep = Math.min(...allSleep);
      const maxSleep = Math.max(...allSleep);
      prompt += `\n• 睡眠(${allSleep.length}天): 平均${avgSleep}h，范围${minSleep}h~${maxSleep}h`;
      if (allSleep.length >= 5) {
        const firstHalf = allSleep.slice(0, Math.floor(allSleep.length / 2));
        const secondHalf = allSleep.slice(Math.floor(allSleep.length / 2));
        const firstAvg = (firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length).toFixed(1);
        const secondAvg = (secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length).toFixed(1);
        const sleepTrend = secondAvg > firstAvg ? '改善' : secondAvg < firstAvg ? '变差' : '稳定';
        prompt += `\n  睡眠趋势: 前期${firstAvg}h → 近期${secondAvg}h (${sleepTrend})`;
      }
    }

    if (allSupplementNames.size > 0) {
      prompt += `\n• 服用补剂: ${[...allSupplementNames].join('、')}`;
    }

    if (totalDaysWithData === 0) {
      prompt += '\n（暂无有效数据记录）';
    }
  } else {
    prompt += '\n\n用户暂无健康数据记录，请根据用户偏好给出通用建议，并鼓励用户开始记录数据。';
  }

  // ---- 强化建议要求 ----
  prompt += `\n\n━━━━━━━━━━━━━━━━━━━━
📋 分析要求（必须严格遵守）：
━━━━━━━━━━━━━━━━━━━━

1. 【趋势分析】基于用户历史数据，分析体重、摄入、运动、睡眠的变化趋势，指出积极变化和需要关注的问题。对比前期和近期的差异，说明趋势背后的可能原因。

2. 【营养评估】分析宏量营养素（蛋白质/碳水/脂肪）的比例是否合理。参考标准：蛋白质占15-25%总热量，碳水45-65%，脂肪20-35%。如数据允许，指出是否存在某种营养素过多或不足的问题。

3. 【能量平衡】如有摄入和消耗数据，计算净能量平衡，结合体重趋势判断用户是处于热量盈余还是缺口，并据此给出调整建议。

4. 【睡眠分析】分析睡眠时长和规律性。如果提供了入睡/起床时间，评估作息是否规律。指出睡眠问题对健康和体重管理的潜在影响。

5. 【运动评估】评估运动频率和强度是否匹配用户的活动水平设置和目标。给出具体的运动类型和强度建议。

6. 【补剂评估】如果用户有服用补剂，分析搭配是否合理、剂量是否合适、是否存在相互作用风险。结合用户的饮食数据，判断哪些营养素可能从食物中已足够，哪些确实需要补充。

7. 【饮食质量】不只关注热量，还要关注食物多样性、加工程度。评价用户的饮食结构是否均衡，是否存在明显的食物种类缺失（如蔬菜、水果、优质蛋白等）。

8. 【目标对齐】将用户的实际数据与其设定的目标（减脂/增肌/维持等）进行对比，判断当前行为是否在向目标前进，如偏离则给出纠偏建议。

━━━━━━━━━━━━━━━━━━━━
✍️ 回复风格要求：
━━━━━━━━━━━━━━━━━━━━
- 用中文回答，像专业健康顾问一样细致但亲切，不要用 markdown 格式
- 适当使用 emoji 表情增加亲和力
- 先总览数据概况，再做深入分析，最后给出具体建议
- 分析要有数据支撑，引用具体的日均值、趋势变化
- 所有建议必须基于用户的实际偏好和数据，不做身份假设（如默认用户是上班族、学生等）
- 饮食建议必须避开用户的过敏/禁忌和饮食偏好
- 运动建议匹配用户的活动水平
- 建议要分点给出，每一条都具体可操作，包括"做什么""做多少""什么时候做"
- 能量化尽量量化：给出具体数值参考，而不是笼统的"多吃""少吃"
- 不推荐极端方法（如极低热量饮食、断食等）
- 如果数据不足（如记录天数<3天），诚实告知数据有限，建议用户坚持记录
- 对于用户关注的领域，给予2-3倍的篇幅深入分析
- 结尾给出1个本周最优先的改进建议（一个最关键的、一行动就能见效的改变）`;

  return prompt;
}

function parseJsonArray(str) {
  try { const arr = JSON.parse(str || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}

function buildSkincareSystemPrompt(user, records) {
  const age = calculateAge(user.birthday);
  const prefs = parsePreferences(user.preferences);
  const genderLabel = user.gender === 'male' ? '男' : '女';

  let prompt = `你是一位资深护肤顾问，同时精通营养学、睡眠科学和运动生理学对皮肤健康的影响。你的任务是基于用户的综合健康数据，从内调外养的角度给出深度护肤建议。用户：${genderLabel}，${age}岁。`;

  // 注入用户偏好
  const prefLines = buildPreferencePrompt(prefs);
  if (prefLines) prompt += '\n\n' + prefLines;

  if (records.length > 0) {
    const recent = records.slice(0, 30).reverse();
    prompt += '\n\n━━━━━━━━━━━━━━━━━━━━';
    prompt += '\n📊 用户综合数据（最近30天，用于护肤分析）';
    prompt += '\n━━━━━━━━━━━━━━━━━━━━';

    // 睡眠数据
    let totalSleep = 0, sleepDays = 0;
    const sleepValues = [];
    for (const r of recent) {
      if (r.sleep > 0) {
        totalSleep += r.sleep;
        sleepDays++;
        sleepValues.push(r.sleep);
      }
    }
    if (sleepDays > 0) {
      const avgSleep = (totalSleep / sleepDays).toFixed(1);
      prompt += `\n😴 睡眠(${sleepDays}天): 平均${avgSleep}h`;
      if (sleepValues.length >= 5) {
        const firstHalf = sleepValues.slice(0, Math.floor(sleepValues.length / 2));
        const secondHalf = sleepValues.slice(Math.floor(sleepValues.length / 2));
        const firstAvg = (firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length).toFixed(1);
        const secondAvg = (secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length).toFixed(1);
        const trend = secondAvg > firstAvg ? '改善' : secondAvg < firstAvg ? '变差' : '稳定';
        prompt += `，趋势: ${firstAvg}h→${secondAvg}h (${trend})`;
      }
      if (sleepValues.length >= 3) {
        const minS = Math.min(...sleepValues);
        const maxS = Math.max(...sleepValues);
        const variance = maxS - minS;
        if (variance > 2) prompt += `\n  ⚠️ 睡眠波动较大(范围${minS}h~${maxS}h)，不规律的作息会影响皮肤修复`;
      }
    }

    // 饮食数据（护肤相关）
    const allDietItems = [];
    for (const r of recent) {
      const diet = parseJsonArray(r.diet);
      for (const d of diet) {
        allDietItems.push(d);
      }
    }
    if (allDietItems.length > 0) {
      const avgDailyCal = (allDietItems.reduce((s, d) => s + (d.calories || 0), 0) / recent.length).toFixed(0);
      const avgDailyProtein = (allDietItems.reduce((s, d) => s + (d.protein || 0), 0) / recent.length).toFixed(1);
      const avgDailyFat = (allDietItems.reduce((s, d) => s + (d.fat || 0), 0) / recent.length).toFixed(1);
      prompt += `\n🍽️ 饮食: 日均${avgDailyCal}kcal，蛋白${avgDailyProtein}g，脂肪${avgDailyFat}g`;
      // 统计高频食物
      const foodCount = {};
      for (const d of allDietItems) {
        const name = (d.description || '').trim();
        if (name) foodCount[name] = (foodCount[name] || 0) + 1;
      }
      const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (topFoods.length > 0) {
        prompt += `\n  高频食物: ${topFoods.map(([k, v]) => `${k}(${v}次)`).join('、')}`;
      }
      // 分析可能影响皮肤的食物
      const skinConcernFoods = [];
      for (const [name, count] of topFoods) {
        if (/奶|牛乳|芝士|黄油|奶油/.test(name)) skinConcernFoods.push(`${name}(乳制品，可能致痘)`);
        if (/糖|甜|巧克力|蛋糕|奶茶|饮料|冰淇淋/.test(name)) skinConcernFoods.push(`${name}(高糖，可能加重炎症)`);
        if (/辣|火锅|烧烤|炸|油/.test(name)) skinConcernFoods.push(`${name}(可能刺激皮肤)`);
      }
      if (skinConcernFoods.length > 0) {
        prompt += `\n  ⚠️ 可能影响皮肤的食物: ${skinConcernFoods.join('、')}`;
      }
    }

    // 运动数据
    let totalExDays = 0;
    for (const r of recent) {
      const exercises = parseJsonArray(r.exercises);
      if (exercises.length > 0) totalExDays++;
    }
    if (totalExDays > 0) {
      prompt += `\n🏃 运动: ${totalExDays}/${recent.length}天有运动（运动促进皮肤血液循环）`;
    }

    // 补剂数据（护肤相关）
    const supplementMap = {};
    for (const r of recent) {
      const supps = parseJsonArray(r.supplements);
      for (const s of supps) {
        const name = s.name || '';
        if (!name) continue;
        if (!supplementMap[name]) supplementMap[name] = { count: 0, dosage: s.dosage, unit: s.unit };
        supplementMap[name].count++;
      }
    }
    const suppNames = Object.keys(supplementMap);
    if (suppNames.length > 0) {
      prompt += `\n💊 补剂: ${suppNames.map(n => {
        const s = supplementMap[n];
        let str = `${n}(服用${s.count}天`;
        if (s.dosage) str += `，${s.dosage}${s.unit || ''}`;
        str += ')';
        return str;
      }).join('、')}`;
      // 标记护肤相关补剂
      const skinSupps = suppNames.filter(n => /维C|VC|维E|VE|胶原|锌|硒|omega|鱼油|生物素|biotin|辅酶Q10|虾青素|葡萄籽|玻尿酸/i.test(n));
      if (skinSupps.length > 0) {
        prompt += `\n  ✨ 其中护肤相关: ${skinSupps.join('、')}`;
      }
    }

    // 水分提示
    const waterRelatedFoods = allDietItems.filter(d => /水|茶|汤|粥/.test(d.description || ''));
    if (waterRelatedFoods.length === 0 && allDietItems.length > 0) {
      prompt += `\n💧 未检测到明显的汤水类食物，水分摄入可能不足（影响皮肤水合）`;
    }
  }

  prompt += `\n\n━━━━━━━━━━━━━━━━━━━━
📋 分析要求（必须严格遵守）：
━━━━━━━━━━━━━━━━━━━━

1. 【睡眠与皮肤】深度分析用户的睡眠时长和质量对皮肤的影响。睡眠不足会导致皮质醇升高、胶原蛋白分解加速、皮肤屏障修复受阻。结合用户的入睡/起床时间评估作息是否规律，给出改善建议。

2. 【饮食与皮肤】分析高频食物中哪些有益皮肤（如富含抗氧化物的食物、优质蛋白），哪些可能加重皮肤问题（高糖、高油、乳制品等）。给出具体的替换和优化建议。

3. 【补剂与皮肤】评估补剂搭配对皮肤的综合影响。指出哪些补剂对皮肤有直接益处，哪些组合有协同效应（如VC+胶原蛋白），是否存在过量或冲突风险。

4. 【运动与皮肤】分析运动频率对皮肤血液循环和新陈代谢的影响。运动后清洁不当可能致痘，适度运动则有益皮肤。

5. 【综合方案】从内调（饮食/补剂/作息）和外养（护肤流程/产品建议）两个维度给出综合方案。内调建议要具体到食物和补剂，外养建议要给出清晰的护肤步骤逻辑。

6. 【历史趋势】对比前期和近期的变化趋势，分析皮肤状况可能是在改善还是恶化，用数据支持判断。

━━━━━━━━━━━━━━━━━━━━
✍️ 回复风格要求：
━━━━━━━━━━━━━━━━━━━━
- 用中文回答，专业但不冰冷，不要用 markdown 格式
- 适当使用 emoji 表情
- 所有建议基于用户实际数据和个人偏好，不做身份假设
- 如果用户填写了过敏/禁忌，推荐产品时必须避开
- 如果用户有关注领域（如皮肤），优先深入分析
- 建议要具体可操作：护肤品要具体到成分类型，补剂要具体到剂量
- 能量化尽量量化（如"每天饮水1.5-2L""每周3次有氧运动"）
- 如果数据不足，诚实告知并给出基于现有信息的有限建议
- 结尾给出1个本周最优先的护肤改善行动`;

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
