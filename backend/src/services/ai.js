const config = require('../config');

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

/**
 * 调用 DeepSeek Chat API
 * @param {string} userApiKey - 用户自己的 Key（可选，为空则用服务器 Key）
 */
async function callChatApi({ messages, temperature = 0.7, max_tokens = 2000, userApiKey = '' }) {
  const apiKey = userApiKey || config.deepseek.apiKey;
  const body = {
    model: config.deepseek.model,
    messages,
    temperature,
    max_tokens,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(config.deepseek.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('API 返回为空');
        return content;
      }

      if (res.status === 429) {
        console.warn(`DeepSeek API 429，重试 ${attempt + 1}/${MAX_RETRIES}`);
        const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
        await sleep(Math.min(retryAfter * 1000, 8000));
        continue;
      }

      if (res.status >= 500) {
        console.warn(`DeepSeek API ${res.status}，重试 ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      const errText = await res.text().catch(() => '');
      throw new Error(`API 错误 (${res.status}): ${errText}`);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`DeepSeek API 超时，重试 ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      if (attempt >= MAX_RETRIES) throw err;
    }
  }

  throw new Error('DeepSeek API 重试耗尽');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ====== 本地食物数据库 ======

const FOOD_DB = {
  '鸡蛋': { calories: 72, protein: 6.3, carbs: 0.8, fat: 4.8, micros: { vitaminA: 70, vitaminD: 1, vitaminE: 0.5, vitaminB1: 0.04, vitaminB2: 0.15, vitaminB3: 0.1, vitaminB6: 0.06, folate: 22, vitaminB12: 0.5, iron: 0.9, zinc: 0.5, selenium: 15, potassium: 70 } },
  '水煮蛋': { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, micros: { vitaminA: 70, vitaminD: 1, vitaminE: 0.5, vitaminB1: 0.04, vitaminB2: 0.15, vitaminB3: 0.1, vitaminB6: 0.06, folate: 22, vitaminB12: 0.5, iron: 0.9, zinc: 0.5, selenium: 15, potassium: 70 } },
  '煮鸡蛋': { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, micros: { vitaminA: 70, vitaminD: 1, vitaminE: 0.5, vitaminB1: 0.04, vitaminB2: 0.15, vitaminB3: 0.1, vitaminB6: 0.06, folate: 22, vitaminB12: 0.5, iron: 0.9, zinc: 0.5, selenium: 15, potassium: 70 } },
  '蛋白': { calories: 17, protein: 3.6, carbs: 0.2, fat: 0, micros: { vitaminB2: 0.15, potassium: 40 } },
  '鸡蛋清': { calories: 17, protein: 3.6, carbs: 0.2, fat: 0, micros: { vitaminB2: 0.15, potassium: 40 } },
  '蛋黄': { calories: 55, protein: 2.7, carbs: 0.6, fat: 4.5, micros: { vitaminA: 200, vitaminD: 1.5, vitaminE: 0.5, vitaminB1: 0.04, vitaminB2: 0.15, vitaminB3: 0.1, vitaminB6: 0.06, folate: 25, vitaminB12: 0.5, iron: 1, zinc: 0.5, selenium: 15 } },
  '杏仁': { calories: 579, protein: 21, carbs: 22, fat: 50, micros: { vitaminE: 26, vitaminB2: 1.1, vitaminB3: 3.6, magnesium: 270, calcium: 269, iron: 3.7, zinc: 3.1, potassium: 733 } },
  '腰果': { calories: 553, protein: 18, carbs: 30, fat: 44, micros: { vitaminE: 0.9, vitaminB1: 0.4, vitaminB6: 0.4, magnesium: 292, iron: 6.7, zinc: 5.8, selenium: 20 } },
  '核桃': { calories: 654, protein: 15, carbs: 14, fat: 65, micros: { vitaminE: 0.7, vitaminB6: 0.5, magnesium: 158, iron: 2.9, omega3: 9000 } },
  '吐司': { calories: 265, protein: 8, carbs: 49, fat: 3.2, gramsPerPiece: 28, micros: { vitaminB1: 0.4, vitaminB2: 0.3, vitaminB3: 4, iron: 2.5, calcium: 75 } },
  '全脂牛奶': { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, micros: { vitaminA: 28, vitaminD: 1.3, vitaminB2: 0.2, vitaminB12: 0.5, calcium: 120, potassium: 150, iodine: 15 } },
  '牛奶': { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, micros: { vitaminA: 28, vitaminD: 1.3, vitaminB2: 0.2, vitaminB12: 0.5, calcium: 120, potassium: 150, iodine: 15 } },
  '脱脂牛奶': { calories: 35, protein: 3.4, carbs: 5, fat: 0, micros: { vitaminA: 28, vitaminD: 1.3, vitaminB2: 0.2, vitaminB12: 0.5, calcium: 120, potassium: 150, iodine: 15 } },
  '鸡胸肉': { calories: 110, protein: 23, carbs: 0, fat: 1.2, micros: { vitaminB3: 10, vitaminB6: 0.6, vitaminB12: 0.3, iron: 0.4, zinc: 0.8, selenium: 22, potassium: 340, omega3: 30 } },
  '米饭': { calories: 116, protein: 2.6, carbs: 25, fat: 0.3, micros: { vitaminB1: 0.02, vitaminB3: 1.5, iron: 0.2, magnesium: 12, potassium: 35 } },
  '燕麦片': { calories: 379, protein: 14, carbs: 67, fat: 6.5, micros: { vitaminB1: 0.8, vitaminB2: 0.2, vitaminB3: 1, vitaminB6: 0.1, folate: 56, iron: 4.7, magnesium: 177, zinc: 3.6, selenium: 29, potassium: 429 } },
};

const PER_PIECE_UNITS = ['个', '粒', '片', '杯', '勺'];
const PER_100G_UNITS = ['g', '克', 'ml', '毫升'];

// 混合食物分隔词
const FOOD_SEPARATORS = /泡|加[入上]?|和|配|拌|炒|煮|蒸|煎|炖|烤|拌|搭配?|还有|以及|，|,|、/;

/**
 * 解析单个食物描述，返回 { quantity, unit, foodName } 或 null
 */
function parseOneFood(desc) {
  const text = desc.trim();
  if (!text) return null;

  const match = text.match(/^(\d+\.?\d*)\s*/);
  if (!match) {
    // 没数字，假定 1 份
    return { quantity: 1, unit: 'piece', foodName: text };
  }

  const quantity = parseFloat(match[1]);
  const afterNum = text.slice(match[0].length); // "ml脱脂牛奶" 或 "g燕麦片" 或 "个鸡蛋"

  // 检测紧跟在数字后面的单位
  let unit = 'piece'; // 默认按个算
  let foodName = afterNum;

  for (const u of PER_100G_UNITS) {
    if (afterNum.startsWith(u)) {
      unit = 'weight';
      break;
    }
  }
  for (const u of PER_PIECE_UNITS) {
    if (afterNum.startsWith(u)) {
      unit = 'piece';
      break;
    }
  }

  // 从 afterNum 开头去掉单位
  const allUnits = [...PER_100G_UNITS, ...PER_PIECE_UNITS];
  for (const u of allUnits) {
    if (foodName.startsWith(u)) {
      foodName = foodName.slice(u.length).trim();
      break;
    }
  }

  // 去掉"的"前缀
  if (foodName.startsWith('的')) {
    foodName = foodName.slice(1).trim();
  }

  return { quantity, unit, foodName };
}

/**
 * 从 FOOD_DB 中模糊匹配食物
 */
function findFoodEntry(foodName) {
  if (!foodName) return null;
  if (FOOD_DB[foodName]) return FOOD_DB[foodName];

  for (const key of Object.keys(FOOD_DB)) {
    if (key.includes(foodName) || foodName.includes(key)) {
      return FOOD_DB[key];
    }
  }
  return null;
}

/**
 * 计算单个食物营养
 */
function calcOneFood(parsed) {
  const { quantity, unit, foodName } = parsed;
  const entry = findFoodEntry(foodName);
  if (!entry) return null;

  let multiplier;
  if (unit === 'weight') {
    multiplier = quantity / 100;
  } else if (unit === 'piece' && entry.gramsPerPiece) {
    // 按个算但有克重的食物（如吐司 1片≈28g），折合成每100g比例
    multiplier = quantity * (entry.gramsPerPiece / 100);
  } else {
    multiplier = quantity;
  }

  const micros = {};
  if (entry.micros) {
    for (const [k, v] of Object.entries(entry.micros)) {
      micros[k] = Math.round(v * multiplier * 100) / 100;
    }
  }

  return {
    calories: Math.round(entry.calories * multiplier),
    protein: Math.round(entry.protein * multiplier * 100) / 100,
    carbs: Math.round(entry.carbs * multiplier * 100) / 100,
    fat: Math.round(entry.fat * multiplier * 100) / 100,
    micros: Object.keys(micros).length > 0 ? micros : null,
  };
}

function localFoodEstimate(foodDescription) {
  const text = foodDescription.trim();
  if (!text) return null;

  // 拆分混合食物
  const parts = text.split(FOOD_SEPARATORS).filter(s => s.trim());
  if (parts.length === 0) return null;

  // 分别估算每个部分
  const results = [];
  for (const part of parts) {
    const parsed = parseOneFood(part);
    if (!parsed) continue;
    const result = calcOneFood(parsed);
    if (result) results.push(result);
  }

  if (results.length === 0) return null;

  // 合并结果
  const merged = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    micros: {},
  };

  for (const r of results) {
    merged.calories += r.calories;
    merged.protein += r.protein;
    merged.carbs += r.carbs;
    merged.fat += r.fat;
    if (r.micros) {
      for (const [k, v] of Object.entries(r.micros)) {
        merged.micros[k] = (merged.micros[k] || 0) + v;
      }
    }
  }

  // 四舍五入
  merged.calories = Math.round(merged.calories);
  merged.protein = Math.round(merged.protein * 100) / 100;
  merged.carbs = Math.round(merged.carbs * 100) / 100;
  merged.fat = Math.round(merged.fat * 100) / 100;
  for (const k of Object.keys(merged.micros)) {
    merged.micros[k] = Math.round(merged.micros[k] * 100) / 100;
  }
  if (Object.keys(merged.micros).length === 0) merged.micros = null;

  return merged;
}

/**
 * 构建 AI 食物估算系统提示词
 */
function buildFoodEstimatePrompt() {
  return `你是一个食物营养查询助手。用户会描述吃了什么（含具体数量和做法），请根据具体数量、食材和烹饪方式精确计算热量和全部微量营养素。

【基础食材数据库（每100g或每份）】
- 鸡蛋1个(50g)：72kcal 蛋白6.3g 碳水0.8g 脂肪4.8g
- 水煮蛋/煮鸡蛋1个：78kcal 蛋白6.3g 碳水0.6g 脂肪5.3g
- 蛋白/鸡蛋清1个：17kcal 蛋白3.6g 碳水0.2g 脂肪0g
- 蛋黄1个：55kcal 蛋白2.7g 碳水0.6g 脂肪4.5g
- 鸡胸肉100g：110kcal 蛋白23g 碳水0g 脂肪1.2g
- 米饭(熟)100g：116kcal 蛋白2.6g 碳水25g 脂肪0.3g
- 吐司1片(28g)：约74kcal（每100g:265kcal 蛋白8g 碳水49g 脂肪3.2g）
- 全脂牛奶100ml：61kcal 蛋白3.2g 碳水4.8g 脂肪3.3g
- 脱脂牛奶100ml：35kcal 蛋白3.4g 碳水5g 脂肪0g（⚠️ 脂肪必须为0！）
- 燕麦片(干)100g：379kcal 蛋白14g 碳水67g 脂肪6.5g
- 杏仁100g：579kcal 蛋白21g 碳水22g 脂肪50g
- 腰果100g：553kcal 蛋白18g 碳水30g 脂肪44g
- 核桃100g：654kcal 蛋白15g 碳水14g 脂肪65g

【烹饪方式对热量和营养的影响（重要）】
- 清蒸/水煮/白灼：不增加额外热量。水溶性维生素（B族、C）流失20-30%
- 炒（少油）：食材热量×1.15，额外加3-5g脂肪
- 炒（正常油）：食材热量×1.25，额外加5-10g脂肪
- 煎：食材热量×1.3，额外加8-15g脂肪
- 炸：食材热量×1.5~2.0，额外加15-30g脂肪，热敏维生素大量破坏
- 红烧/炖：食材热量×1.1~1.2
- 烤：食材热量×1.1~1.3
- 凉拌：额外加油脂调料的按描述估算
- 描述中"少油""清淡"按低油版计算
- 外卖/食堂比家庭做油多，适当上浮

【牛奶重要规则】
- "牛奶"默认为全脂牛奶（脂肪3.3g/100ml）
- "脱脂牛奶"脂肪必须为0！热量35kcal/100ml
- "低脂牛奶"脂肪约1.5g/100ml

直接返回纯JSON（不要markdown代码块）：
{"calories":整数kcal,"protein":g,"carbs":g,"fat":g,"micros":{"vitaminA":ug,"vitaminD":ug,"vitaminE":mg,"vitaminK":ug,"vitaminB1":mg,"vitaminB2":mg,"vitaminB3":mg,"vitaminB6":mg,"folate":ug,"vitaminB12":ug,"vitaminC":mg,"calcium":mg,"iron":mg,"magnesium":mg,"zinc":mg,"selenium":ug,"potassium":mg,"iodine":ug,"lutein":mg,"omega3":mg}}

没有的微量营养素填0。数值保留1位小数。`;
}

/**
 * 调用 AI 估算食物营养
 */
async function estimateFoodNutrition(foodDescription, userApiKey = '') {
  // 先尝试本地数据库
  const local = localFoodEstimate(foodDescription);
  if (local) return local;

  // 调用 AI
  const answer = await callChatApi({
    messages: [
      { role: 'system', content: buildFoodEstimatePrompt() },
      { role: 'user', content: foodDescription },
    ],
    temperature: 0.3,
    max_tokens: 500,
    userApiKey,
  });

  try {
    const jsonStr = answer.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

module.exports = { callChatApi, estimateFoodNutrition, localFoodEstimate };
