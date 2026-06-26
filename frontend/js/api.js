const DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_API_KEY = 'sk-23c5aa3989c84640a0405aa26e9f700c';
const DEFAULT_SKINCARE_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_SKINCARE_MODEL = 'deepseek-chat';
const DEFAULT_SKINCARE_API_KEY = 'sk-4ce0019d2add44a689dac0774c0e1ab7';
const DEFAULT_CALORIE_API_KEY = 'sk-de20732cf8594de88fdc1bfc3fef754e';

function getApiKey() {
  return localStorage.getItem('health_tracker_api_key') || DEFAULT_API_KEY;
}

function setApiKey(key) {
  localStorage.setItem('health_tracker_api_key', key);
}

function getApiUrl() {
  return localStorage.getItem('health_tracker_api_url') || DEFAULT_API_URL;
}

function setApiUrl(url) {
  localStorage.setItem('health_tracker_api_url', url);
}

function getModel() {
  return localStorage.getItem('health_tracker_model') || DEFAULT_MODEL;
}

function setModel(model) {
  localStorage.setItem('health_tracker_model', model);
}

function getCalorieApiKey() {
  return localStorage.getItem('health_tracker_calorie_api_key') || DEFAULT_CALORIE_API_KEY;
}

function setCalorieApiKey(key) {
  localStorage.setItem('health_tracker_calorie_api_key', key);
}

function getCalorieApiUrl() {
  return localStorage.getItem('health_tracker_calorie_api_url') || DEFAULT_API_URL;
}

function setCalorieApiUrl(url) {
  localStorage.setItem('health_tracker_calorie_api_url', url);
}

function getCalorieModel() {
  return localStorage.getItem('health_tracker_calorie_model') || DEFAULT_MODEL;
}

function setCalorieModel(model) {
  localStorage.setItem('health_tracker_calorie_model', model);
}

function getSkincareApiKey() {
  return localStorage.getItem('health_tracker_skincare_api_key') || DEFAULT_SKINCARE_API_KEY;
}

function setSkincareApiKey(key) {
  localStorage.setItem('health_tracker_skincare_api_key', key);
}

function getSkincareApiUrl() {
  return localStorage.getItem('health_tracker_skincare_api_url') || DEFAULT_SKINCARE_API_URL;
}

function setSkincareApiUrl(url) {
  localStorage.setItem('health_tracker_skincare_api_url', url);
}

function getSkincareModel() {
  return localStorage.getItem('health_tracker_skincare_model') || DEFAULT_SKINCARE_MODEL;
}

function setSkincareModel(model) {
  localStorage.setItem('health_tracker_skincare_model', model);
}

function hasApiKey() {
  return !!getApiKey();
}

async function callDeepSeek(messages) {
  return await callChatApi({
    apiKey: getApiKey(),
    apiUrl: getApiUrl(),
    model: getModel(),
    messages,
    errorPrefix: 'DeepSeek',
    missingKeyError: '请先设置健康管理 API Key',
  });
}

async function callCalorieDeepSeek(messages) {
  return await callChatApi({
    apiKey: getCalorieApiKey(),
    apiUrl: getCalorieApiUrl(),
    model: getCalorieModel(),
    messages,
    errorPrefix: '热量计算',
    missingKeyError: '请先设置热量计算 API Key',
  });
}

async function callSkincareDeepSeek(messages) {
  return await callChatApi({
    apiKey: getSkincareApiKey(),
    apiUrl: getSkincareApiUrl(),
    model: getSkincareModel(),
    messages,
    errorPrefix: '护肤 DeepSeek',
    missingKeyError: '请先设置护肤 DeepSeek API Key',
  });
}

async function callChatApi({ apiKey, apiUrl, model, messages, errorPrefix, missingKeyError, temperature = 0.7, max_tokens = 2000 }) {
  if (!apiKey) {
    throw new Error(missingKeyError);
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 3000, 8000]; // 1s, 3s, 8s exponential-ish backoff
  const REQUEST_TIMEOUT = 30000; // 30s timeout per attempt

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // On retry, prepend a system hint so the AI knows this is a retry
    const attemptMessages = attempt > 0
      ? [{ role: 'system', content: '（注意：这是重试请求，请直接给出结果）' }, ...messages]
      : messages;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: attemptMessages,
          temperature,
          max_tokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 429 Too Many Requests / 5xx server errors → retry
      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        lastError = new Error(`${errorPrefix} 服务器繁忙 (${response.status})，正在重试...`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        let errMsg = `${errorPrefix} 请求失败 (${response.status})`;
        try {
          const errJson = JSON.parse(errBody);
          if (errJson.error && errJson.error.message) {
            errMsg = errJson.error.message;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (err) {
      lastError = err;

      // Network errors (fetch itself throws TypeError for network failures) → retry
      const isNetworkError = err.name === 'TypeError' && (
        err.message === 'Failed to fetch' ||
        err.message === 'NetworkError when attempting to fetch resource.' ||
        err.message.includes('fetch') ||
        err.message.includes('network')
      );
      const isTimeout = err.name === 'AbortError';
      const isRetryable = isNetworkError || isTimeout;

      if (isRetryable && attempt < MAX_RETRIES) {
        console.warn(`${errorPrefix} 网络不稳定 (尝试 ${attempt + 1}/${MAX_RETRIES + 1})：${err.message}，${RETRY_DELAYS[attempt]}ms 后重试...`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      // Last attempt failed, or non-retryable error → throw
      if (isTimeout && attempt >= MAX_RETRIES) {
        throw new Error(`${errorPrefix} 请求超时，已重试 ${MAX_RETRIES} 次仍未成功，请检查网络后重试`);
      }
      if (isNetworkError && attempt >= MAX_RETRIES) {
        throw new Error(`${errorPrefix} 网络连接失败，已重试 ${MAX_RETRIES} 次仍未成功，请检查网络连接`);
      }
      throw err;
    }
  }

  throw lastError || new Error(`${errorPrefix} 未知错误`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHealthPrompt(records) {
  if (!records || records.length === 0) {
    return null;
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const dateRange = `${sorted[0].date} 至 ${sorted[sorted.length - 1].date}`;

  const aggregated = aggregateByDate(records);
  const weights = aggregated.map(a => a.weight);
  if (weights.length === 0) {
    return `以下是我的健康数据，请像个贴心的朋友一样帮我看看：\n\n📅 数据时间范围：${dateRange}，共 ${records.length} 天\n\n⚖️ 体重情况：暂无体重记录\n\n😴 睡眠情况：\n暂无足够睡眠数据\n\n🏃 运动情况：\n暂无运动数据\n\n🍽️ 饮食情况：\n暂无饮食数据\n\n💊 补剂情况：\n暂无补剂数据\n\n每日明细：\n${sorted.map(r => `${r.date}：暂无体重记录`).join('\n')}\n`;
  }
  const weightFirst = weights[0];
  const weightLast = weights[weights.length - 1];
  const weightChange = weightLast - weightFirst;
  const weightMin = Math.min(...weights);
  const weightMax = Math.max(...weights);

  const sleepValues = records.map(r => computeTotalSleep(r)).filter(s => s > 0);
  const sleepAvg = sleepValues.length > 0
    ? (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1)
    : '无数据';

  const allExercises = records.flatMap(r => r.exercises || []);
  const totalExCalories = allExercises.reduce((sum, ex) => sum + (ex.calories || 0), 0);
  const exDays = new Set(records.filter(r => (r.exercises || []).length > 0).map(r => r.date)).size;

  const allDiet = records.flatMap(r => r.diet || []);
  const totalDietCalories = allDiet.reduce((sum, d) => sum + (d.calories || 0), 0);

  const allSupplements = records.flatMap(r => r.supplements || []);
  const suppDays = new Set(records.filter(r => (r.supplements || []).length > 0).map(r => r.date)).size;
  const suppCounts = {};
  allSupplements.forEach(s => {
    suppCounts[s.name] = (suppCounts[s.name] || 0) + 1;
  });
  const topSupps = Object.entries(suppCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const recordDays = records.length;

  let prompt = `以下是我的健康数据，请像个贴心的朋友一样帮我看看：\n\n`;
  prompt += `📅 数据时间范围：${dateRange}，共 ${recordDays} 天\n\n`;
  prompt += `⚖️ 体重情况：\n`;
  prompt += `从 ${weightFirst.toFixed(2)}kg 到 ${weightLast.toFixed(2)}kg，变化了 ${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(2)}kg\n`;
  prompt += `最低 ${weightMin}kg，最高 ${weightMax}kg\n\n`;
  prompt += `😴 睡眠情况：\n`;
  prompt += `平均每天睡 ${sleepAvg} 小时\n\n`;
  prompt += `🏃 运动情况：\n`;
  prompt += `${exDays} 天有运动，总共消耗了 ${totalExCalories} kcal\n\n`;
  prompt += `🍽️ 饮食情况：\n`;
  prompt += `记录的总摄入约 ${totalDietCalories} kcal\n\n`;
  prompt += `💊 补剂情况：\n`;
  prompt += `${suppDays} 天有补剂记录，共 ${allSupplements.length} 次\n`;
  if (topSupps.length > 0) {
    prompt += `常用补剂：${topSupps.map(([name, count]) => `${name}(${count}次)`).join('、')}\n`;
  }
  // Micronutrient summary — today + 7-day trend + health assessment
  try {
    if (typeof MICRO_KEYS !== 'undefined' && typeof getMicroCoverage === 'function') {
      const today = new Date().toISOString().split('T')[0];
      const todayCov = getMicroCoverage(records, today);
      const todayNames = {};
      MICRO_KEYS.forEach(k => { todayNames[k] = MICRONUTRIENT_RDA[k].name; });

      // Today's deficiencies (< 80% RDA, with percentage)
      const todayDef = MICRO_KEYS
        .map(k => ({ name: todayNames[k], pct: Math.round((todayCov[k] || 0) * 100) }))
        .filter(d => d.pct < 80)
        .sort((a, b) => a.pct - b.pct);
      const todayOk = MICRO_KEYS
        .map(k => ({ name: todayNames[k], pct: Math.round((todayCov[k] || 0) * 100) }))
        .filter(d => d.pct >= 80);

      // 7-day average
      let avg7dDef = [];
      if (typeof getMicroCoverageForRange === 'function') {
        const cov7d = getMicroCoverageForRange(records, 7);
        avg7dDef = MICRO_KEYS
          .map(k => {
            const vals = (cov7d.series[k] || []).filter(v => v != null);
            const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            return { name: todayNames[k], pct: Math.round(avg * 100) };
          })
          .filter(d => d.pct < 80)
          .sort((a, b) => a.pct - b.pct);
      }

      // Health assessment
      let healthAssess = '';
      if (typeof getHealthAssessment === 'function') {
        const deficientMap = {};
        todayDef.forEach(d => { const k = MICRO_KEYS.find(mk => todayNames[mk] === d.name); if (k) deficientMap[k] = true; });
        const assessments = getHealthAssessment(deficientMap);
        if (assessments.length > 0) {
          healthAssess = assessments.map(a =>
            `${a.level === 'high' ? '🔴高风险' : '🟡需关注'} ${a.system}：${a.desc}`
          ).join('\n');
        }
      }

      prompt += `\n🔬 微量营养素分析：\n`;
      prompt += `今日达标（≥80%RDA）：${todayOk.length > 0 ? todayOk.map(d => d.name + '(' + d.pct + '%)').join('、') : '无'}\n`;
      prompt += `今日不足（<80%RDA）：${todayDef.length > 0 ? todayDef.map(d => d.name + '(' + d.pct + '%)').join('、') : '无'}\n`;
      if (avg7dDef.length > 0) {
        prompt += `近7天持续偏低：${avg7dDef.map(d => d.name + '(均值' + d.pct + '%)').join('、')}\n`;
      }
      if (healthAssess) {
        prompt += `\n🩺 微量营养素角度的身体评估：\n${healthAssess}\n`;
      }
    }
  } catch (e) { /* ignore if nutrition module unavailable */ }

  prompt += `\n`;

  prompt += `每日明细：\n`;
  sorted.forEach(r => {
    const dietSum = (r.diet || []).reduce((s, d) => s + (d.calories || 0), 0);
    const exSum = (r.exercises || []).reduce((s, e) => s + (e.calories || 0), 0);
    const bmr = r.weight > 0 ? Math.round(calculateBMR(r.weight)) : 0;
    const deficit = bmr > 0 ? Math.round(bmr + exSum - dietSum) : 0;
    const dietList = (r.diet || []).map(d => {
      let s = `${d.description}(${d.calories}kcal`;
      if (d.protein) s += `,蛋白${d.protein}g`;
      if (d.carbs) s += `,碳水${d.carbs}g`;
      if (d.fat) s += `,脂肪${d.fat}g`;
      s += ')';
      return s;
    }).join('、');
    const exList = (r.exercises || []).map(e => `${e.type}${e.duration}分钟`).join('、');
    let line = `${r.date}：体重${r.weight.toFixed(2)}kg，BMI ${calculateBMI(r.weight).toFixed(1)}`;
    if (bmr) line += `，基础代谢${bmr}kcal`;
    if (deficit > 0) line += `，热量缺口-${deficit}kcal`;
    else if (deficit < 0) line += `，热量盈余+${Math.abs(deficit)}kcal`;
    let sleepInfo = '';
    if (r.sleep_segments && r.sleep_segments.length > 0) {
      r.sleep_segments.forEach((seg, i) => {
        if (seg.bedTime && seg.wakeTime) {
          const bedD = timeToDecimal(seg.bedTime);
          let wakeD = timeToDecimal(seg.wakeTime);
          if (wakeD <= bedD) wakeD += 24;
          const dur = +(Math.round((wakeD - bedD) * 60) / 60).toFixed(2);
          sleepInfo += (sleepInfo ? '；' : '') + `第${i + 1}段入睡${seg.bedTime} 醒来${seg.wakeTime} 睡${dur}h`;
        }
      });
    } else {
      if (r.bed_time) sleepInfo += `入睡${r.bed_time}`;
      if (r.wake_time) sleepInfo += (sleepInfo ? ' 醒来' : '醒来') + r.wake_time;
      if (r.sleep > 0) sleepInfo += (sleepInfo ? ' ' : '') + `睡${r.sleep}h`;
    }
    line += `\n  ${sleepInfo || '无睡眠数据'}`;
    if (dietList) line += `，吃了${dietList}`;
    if (exList) line += `，运动${exList}`;
    const suppList = (r.supplements || []).map(s => `${s.name}${s.dosage}${s.unit}${s.note ? '(' + s.note + ')' : ''}`).join('、');
    if (suppList) line += `，补剂${suppList}`;
    line += '\n';
    prompt += line;
  });

  return prompt;
}

const USER_BIRTHDAY = '2003-01-31';
const USER_HEIGHT = 172;

function getUserGender() {
  return localStorage.getItem('health_tracker_gender') || 'male';
}
function setUserGender(g) { localStorage.setItem('health_tracker_gender', g); }

function getUserAge() {
  const birth = new Date(USER_BIRTHDAY + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function setUserAge(a) {
  // Age is now auto-computed from USER_BIRTHDAY; kept for settings form compatibility.
}

function calculateBMI(weight) {
  const h = USER_HEIGHT / 100;
  return weight / (h * h);
}

function calculateBMR(weight) {
  const age = getUserAge();
  const gender = getUserGender();
  const activityFactor = 1.1;
  if (gender === 'male') {
    return (10 * weight + 6.25 * USER_HEIGHT - 5 * age + 5) * activityFactor;
  } else {
    return (10 * weight + 6.25 * USER_HEIGHT - 5 * age - 161) * activityFactor;
  }
}

// ===== Local Food Nutrition Calculator =====
// Per-unit nutrition for common foods. Used to get accurate, deterministic
// results when the user provides specific quantities.

const FOOD_DB = {
  // Eggs — whole / white / yolk split
  水煮蛋:    { calories: 75, protein: 6.5, carbs: 1,   fat: 5,
    micros: { vitaminA:88, vitaminD:1.1, vitaminE:0.7, vitaminK:0.3, vitaminB1:0.04, vitaminB2:0.15, vitaminB3:0.1, vitaminB6:0.07, folate:24, vitaminB12:0.5, vitaminC:0, calcium:28, iron:1.0, magnesium:6, zinc:0.7, selenium:15, potassium:69, iodine:15, lutein:0.13, omega3:37 }},
  煮鸡蛋:    { calories: 75, protein: 6.5, carbs: 1,   fat: 5,
    micros: { vitaminA:88, vitaminD:1.1, vitaminE:0.7, vitaminK:0.3, vitaminB1:0.04, vitaminB2:0.15, vitaminB3:0.1, vitaminB6:0.07, folate:24, vitaminB12:0.5, vitaminC:0, calcium:28, iron:1.0, magnesium:6, zinc:0.7, selenium:15, potassium:69, iodine:15, lutein:0.13, omega3:37 }},
  鸡蛋:      { calories: 75, protein: 6.5, carbs: 1,   fat: 5,
    micros: { vitaminA:88, vitaminD:1.1, vitaminE:0.7, vitaminK:0.3, vitaminB1:0.04, vitaminB2:0.15, vitaminB3:0.1, vitaminB6:0.07, folate:24, vitaminB12:0.5, vitaminC:0, calcium:28, iron:1.0, magnesium:6, zinc:0.7, selenium:15, potassium:69, iodine:15, lutein:0.13, omega3:37 }},
  蛋白:      { calories: 20, protein: 3.5, carbs: 0.3, fat: 0,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0, vitaminK:0, vitaminB1:0.01, vitaminB2:0.12, vitaminB3:0.03, vitaminB6:0, folate:1, vitaminB12:0.03, vitaminC:0, calcium:3, iron:0.03, magnesium:4, zinc:0.01, selenium:6, potassium:54, iodine:1, lutein:0, omega3:0 }},
  鸡蛋清:    { calories: 20, protein: 3.5, carbs: 0.3, fat: 0,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0, vitaminK:0, vitaminB1:0.01, vitaminB2:0.12, vitaminB3:0.03, vitaminB6:0, folate:1, vitaminB12:0.03, vitaminC:0, calcium:3, iron:0.03, magnesium:4, zinc:0.01, selenium:6, potassium:54, iodine:1, lutein:0, omega3:0 }},
  蛋黄:      { calories: 55, protein: 3,   carbs: 0.7, fat: 5,
    micros: { vitaminA:88, vitaminD:1.1, vitaminE:0.7, vitaminK:0.3, vitaminB1:0.03, vitaminB2:0.03, vitaminB3:0.07, vitaminB6:0.07, folate:23, vitaminB12:0.47, vitaminC:0, calcium:25, iron:0.97, magnesium:2, zinc:0.69, selenium:9, potassium:15, iodine:14, lutein:0.13, omega3:37 }},
  // Nuts
  杏仁:      { calories: 7,  protein: 0.3, carbs: 0.3, fat: 0.6,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0.26, vitaminK:0, vitaminB1:0, vitaminB2:0.01, vitaminB3:0.04, vitaminB6:0, folate:0.5, vitaminB12:0, vitaminC:0, calcium:3, iron:0.06, magnesium:3.5, zinc:0.04, selenium:0.1, potassium:9, iodine:0, lutein:0, omega3:0 }},
  腰果:      { calories: 9,  protein: 0.4, carbs: 0.5, fat: 0.7,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0.09, vitaminK:0, vitaminB1:0.01, vitaminB2:0.01, vitaminB3:0.1, vitaminB6:0.01, folate:3, vitaminB12:0, vitaminC:0, calcium:5, iron:0.3, magnesium:10, zinc:0.2, selenium:0.5, potassium:12, iodine:0, lutein:0, omega3:0 }},
  核桃:      { calories: 13, protein: 0.3, carbs: 0.3, fat: 1.3,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0.14, vitaminK:0.2, vitaminB1:0.01, vitaminB2:0.01, vitaminB3:0.1, vitaminB6:0.01, folate:4, vitaminB12:0, vitaminC:0, calcium:3, iron:0.15, magnesium:5, zinc:0.08, selenium:0.3, potassium:9, iodine:0, lutein:0, omega3:180 }},
  // Staples
  吐司:      { calories: 70, protein: 2.5, carbs: 13,  fat: 1,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0.1, vitaminK:0.5, vitaminB1:0.1, vitaminB2:0.08, vitaminB3:0.8, vitaminB6:0.02, folate:14, vitaminB12:0, vitaminC:0, calcium:15, iron:0.6, magnesium:6, zinc:0.2, selenium:4, potassium:30, iodine:1, lutein:0, omega3:0 }},
  牛奶:      { calories: 70, protein: 8,  carbs: 9.2, fat: 0,
    micros: { vitaminA:60, vitaminD:2.5, vitaminE:0.02, vitaminK:0.2, vitaminB1:0.04, vitaminB2:0.18, vitaminB3:0.1, vitaminB6:0.04, folate:5, vitaminB12:0.5, vitaminC:0, calcium:260, iron:0.04, magnesium:12, zinc:0.4, selenium:3, potassium:160, iodine:30, lutein:0, omega3:0 }},
	脱脂牛奶:  { calories: 35, protein: 4.0, carbs: 4.6, fat: 0,
	    micros: { vitaminA:30, vitaminD:1.25, vitaminE:0.01, vitaminK:0.1, vitaminB1:0.02, vitaminB2:0.09, vitaminB3:0.05, vitaminB6:0.02, folate:2.5, vitaminB12:0.25, vitaminC:0, calcium:130, iron:0.02, magnesium:6, zinc:0.2, selenium:1.5, potassium:80, iodine:15, lutein:0, omega3:0 }},
  鸡胸肉:    { calories: 110,protein: 23,  carbs: 0,   fat: 2.5,
    micros: { vitaminA:6, vitaminD:0.1, vitaminE:0.3, vitaminK:0.6, vitaminB1:0.07, vitaminB2:0.13, vitaminB3:13, vitaminB6:0.6, folate:1, vitaminB12:0.3, vitaminC:0, calcium:3, iron:0.4, magnesium:25, zinc:0.8, selenium:22, potassium:330, iodine:3, lutein:0, omega3:20 }},
  米饭:      { calories: 116,protein: 2.5, carbs: 26,  fat: 0.3,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0.04, vitaminK:0.1, vitaminB1:0.02, vitaminB2:0.01, vitaminB3:0.4, vitaminB6:0.03, folate:3, vitaminB12:0, vitaminC:0, calcium:3, iron:0.2, magnesium:10, zinc:0.4, selenium:3, potassium:30, iodine:1, lutein:0, omega3:0 }},
  燕麦片:    { calories: 412,protein: 12.2,carbs: 54.7, fat: 13.6,
    micros: { vitaminA:0, vitaminD:0, vitaminE:0, vitaminK:0, vitaminB1:0.26, vitaminB2:0, vitaminB3:0, vitaminB6:0, folate:0, vitaminB12:0, vitaminC:0, calcium:0, iron:3.9, magnesium:134, zinc:0, selenium:0, potassium:0, iodine:0, lutein:0, omega3:0 }}
};

// Units that indicate "per piece"
const PER_PIECE_UNITS = ['个', '粒', '片', '杯'];
// Units that indicate "per 100 g" — the DB values are already per-100 g
const PER_100G_UNITS = ['g', '克', 'ml', '毫升'];

/**
 * Try to parse a Chinese food description with specific quantities and
 * compute nutrition locally.  Returns { calories, protein, carbs, fat }
 * when the entire description can be handled locally; otherwise null
 * (caller should fall back to the AI).
 */
function localFoodEstimate(desc) {
  let total = { calories: 0, protein: 0, carbs: 0, fat: 0, micros: {} };
  MICRO_KEYS.forEach(k => { total.micros[k] = 0; });
  let matched = false;

  function addMicros(foodMicros, factor) {
    if (!foodMicros) return;
    for (const [k, v] of Object.entries(foodMicros)) {
      total.micros[k] = (total.micros[k] || 0) + v * factor;
    }
  }

  // ---- complex egg patterns (most specific first) ----

  // "X个水煮蛋，其中Y个全吃，Z个只吃蛋白"
  let m = desc.match(
    /(\d+)\s*个\s*(?:水煮蛋|煮鸡蛋|鸡蛋)[，,.\s]*其中[，,.\s]*(\d+)\s*个\s*全[吃部]?[，,.\s]*(\d+)\s*个?\s*(?:只[吃剥]?|只要?|仅|光)\s*(?:吃\s*)?蛋白/
  );
  if (m) {
    const whole = parseInt(m[2]);
    const whites = parseInt(m[3]);
    total.calories += whole * 75 + whites * 20;
    total.protein  += whole * 6.5 + whites * 3.5;
    total.carbs    += whole * 1   + whites * 0.3;
    total.fat      += whole * 5;
    addMicros(FOOD_DB['水煮蛋'].micros, whole);
    addMicros(FOOD_DB['蛋白'].micros, whites);
    matched = true;
    desc = desc.replace(m[0], '');
  }

  // "X个蛋，只吃蛋白" (all whites)
  if (!matched) {
    m = desc.match(
      /(\d+)\s*个\s*(?:水煮蛋|煮鸡蛋|鸡蛋)[，,.\s]*(?:只[吃剥]?|只要?|仅|光)\s*(?:吃\s*)?蛋白/
    );
    if (m) {
      const whites = parseInt(m[1]);
      total.calories += whites * 20;
      total.protein  += whites * 3.5;
      total.carbs    += whites * 0.3;
      addMicros(FOOD_DB['蛋白'].micros, whites);
      matched = true;
      desc = desc.replace(m[0], '');
    }
  }

  // "X个水煮蛋" (all whole, no mention of whites or yolks)
  if (!matched) {
    m = desc.match(/(\d+)\s*个\s*(?:水煮蛋|煮鸡蛋)/);
    if (m && !/[蛋白清]|蛋黄/.test(desc)) {
      const whole = parseInt(m[1]);
      total.calories += whole * 75;
      total.protein  += whole * 6.5;
      total.carbs    += whole * 1;
      total.fat      += whole * 5;
      addMicros(FOOD_DB['水煮蛋'].micros, whole);
      matched = true;
      desc = desc.replace(m[0], '');
    }
  }

  // ---- standalone egg parts ----

  // "X个蛋白" (no yolk context)
  m = desc.match(/(\d+)\s*个?\s*(?:蛋白|鸡蛋清)(?!.*蛋黄)/);
  if (m) {
    const whites = parseInt(m[1]);
    total.calories += whites * 20;
    total.protein  += whites * 3.5;
    total.carbs    += whites * 0.3;
    addMicros(FOOD_DB['蛋白'].micros, whites);
    matched = true;
    desc = desc.replace(m[0], '');
  }

  // "X个蛋黄"
  m = desc.match(/(\d+)\s*个?\s*蛋黄/);
  if (m) {
    const yolks = parseInt(m[1]);
    total.calories += yolks * 55;
    total.protein  += yolks * 3;
    total.carbs    += yolks * 0.7;
    total.fat      += yolks * 5;
    addMicros(FOOD_DB['蛋黄'].micros, yolks);
    matched = true;
    desc = desc.replace(m[0], '');
  }

  // ---- other common foods (simple per-piece patterns) ----

  for (const [name, nut] of Object.entries(FOOD_DB)) {
    // Skip egg entries — already handled above
    if (['水煮蛋','煮鸡蛋','鸡蛋','蛋白','鸡蛋清','蛋黄'].includes(name)) continue;

    // Per-piece: "X粒杏仁", "X片吐司", "X杯牛奶"
    for (const unit of PER_PIECE_UNITS) {
      const re = new RegExp(`(\\d+)\\s*${unit}\\s*${name}`, 'g');
      let pm;
      while ((pm = re.exec(desc)) !== null) {
        const qty = parseInt(pm[1]);
        total.calories += nut.calories * qty;
        total.protein  += nut.protein  * qty;
        total.carbs    += nut.carbs    * qty;
        total.fat      += nut.fat      * qty;
        addMicros(nut.micros, qty);
        matched = true;
      }
    }

    // Per-100g: "200g鸡胸肉", "300克米饭"
    for (const unit of PER_100G_UNITS) {
      const re = new RegExp(`(\\d+)\\s*${unit}\\s*${name}`, 'g');
      let pm;
      while ((pm = re.exec(desc)) !== null) {
        const grams = parseInt(pm[1]);
        const factor = grams / 100;
        total.calories += nut.calories * factor;
        total.protein  += nut.protein  * factor;
        total.carbs    += nut.carbs    * factor;
        total.fat      += nut.fat      * factor;
        addMicros(nut.micros, factor);
        matched = true;
      }
    }
  }

  if (!matched) return null;

  // Round micros to 2 decimals
  for (const k of MICRO_KEYS) {
    total.micros[k] = +total.micros[k].toFixed(2);
  }

  return {
    calories: Math.round(total.calories),
    protein:  Math.round(total.protein * 10) / 10,
    carbs:    Math.round(total.carbs * 10) / 10,
    fat:      Math.round(total.fat * 10) / 10,
    micros:   total.micros
  };
}

async function estimateFoodNutrition(foodDescription) {
  // Try local calculation first for deterministic results with known foods
  const local = localFoodEstimate(foodDescription);
  if (local) return local;

  if (!getCalorieApiKey()) {
    throw new Error('请先设置热量计算 API Key');
  }

  const messages = [
    {
      role: 'system',
      content: `你是食物营养查询助手。用户会描述吃了什么（含具体数量和做法），请务必根据用户描述的具体数量、食材和烹饪方式精确计算热量(kcal)、蛋白质(g)、碳水(g)、脂肪(g)以及全部微量营养素。

基础食材参考：水煮蛋1个75kcal（蛋黄55kcal+蛋白20kcal，只吃蛋白算20kcal，只吃蛋黄算55kcal）；1粒杏仁7kcal；1粒腰果9kcal；1粒核桃13kcal；100g鸡胸肉110kcal；100g米饭116kcal；1片吐司70kcal；1杯脱脂牛奶(200ml)70kcal（每100ml:146KJ≈35kcal、蛋白4.0g、碳水4.6g、脂肪0g、钙130mg）；100g燕麦片412kcal 蛋白12.2g 碳水54.7g 脂肪13.6g 膳食纤维10.4g 维生素B1 0.26mg 镁134mg 铁3.9mg。

烹饪方式对热量的影响（重要）：
- 清蒸/水煮/白灼：几乎不增加额外热量，脂肪按食材本身计算。水溶性维生素（B族、C）可能流失20-30%。
- 炒（少油）：食材热量 ×1.15，额外加3-5g脂肪
- 炒（正常油）：食材热量 ×1.25，额外加5-10g脂肪
- 煎：食材热量 ×1.3，额外加8-15g脂肪
- 炸：食材热量 ×1.5~2.0，额外加15-30g脂肪，热敏维生素大量破坏
- 红烧/炖：食材热量 ×1.1~1.2，看是否炒糖色和收汁浓度
- 烤：食材热量 ×1.1~1.3，看是否刷油腌制
- 凉拌：额外加油脂调料的，按描述估算油量
- 描述中提到"少油""清淡"则按低油版本计算
- 外卖/食堂通常比家庭做油多，适当上浮

返回严格的JSON格式（不要用markdown代码块包裹，直接返回纯JSON）：
{"calories":数字,"protein":数字,"carbs":数字,"fat":数字,"micros":{"vitaminA":数字,"vitaminD":数字,"vitaminE":数字,"vitaminK":数字,"vitaminB1":数字,"vitaminB2":数字,"vitaminB3":数字,"vitaminB6":数字,"folate":数字,"vitaminB12":数字,"vitaminC":数字,"calcium":数字,"iron":数字,"magnesium":数字,"zinc":数字,"selenium":数字,"potassium":数字,"iodine":数字,"lutein":数字,"omega3":数字}}

单位说明：macros热量用kcal，蛋白质/碳水/脂肪用g。micros：vitaminA用ug RAE，vitaminD用ug，vitaminE用mg a-TE，vitaminK用ug，vitaminB1/B2/B6用mg，vitaminB3用mg NE，folate用ug DFE，vitaminB12用ug，vitaminC用mg，calcium/magnesium/zinc用mg，iron用mg，selenium用ug，potassium用mg，iodine用ug，lutein用mg，omega3用mg。
如果某种微量营养素在此食物中几乎没有，填0。数值保留1位小数。`
    },
    {
      role: 'user',
      content: foodDescription
    }
  ];

  const result = await callCalorieDeepSeek(messages);

  // Try JSON parse first (new format)
  try {
    // Strip markdown code fences if the AI wraps it
    let jsonStr = result.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(jsonStr);
    const micros = parsed.micros || null;
    if (micros) {
      for (const k of MICRO_KEYS) {
        micros[k] = +(micros[k] || 0).toFixed(2);
      }
    }
    return {
      calories: parseInt(parsed.calories) || 0,
      protein: +(parseFloat(parsed.protein) || 0).toFixed(1),
      carbs: +(parseFloat(parsed.carbs) || 0).toFixed(1),
      fat: +(parseFloat(parsed.fat) || 0).toFixed(1),
      micros
    };
  } catch (e) {
    // Fallback to old regex format
    const calMatch = result.match(/热量[：:]\s*(\d+)/);
    const proMatch = result.match(/蛋白质[：:]\s*(\d+\.?\d*)/);
    const carbMatch = result.match(/碳水[：:]\s*(\d+\.?\d*)/);
    const fatMatch = result.match(/脂肪[：:]\s*(\d+\.?\d*)/);
    const calories = calMatch ? parseInt(calMatch[1]) : 0;
    const protein = proMatch ? Math.round(parseFloat(proMatch[1]) * 100) / 100 : 0;
    const carbs = carbMatch ? Math.round(parseFloat(carbMatch[1]) * 100) / 100 : 0;
    const fat = fatMatch ? Math.round(parseFloat(fatMatch[1]) * 100) / 100 : 0;
    if (!calMatch && calories === 0) {
      throw new Error('无法估算该食物的营养数据，请手动输入');
    }
    return { calories, protein, carbs, fat, micros: null };
  }
}

// ===== Chat History =====
const CHAT_HISTORY_KEY = 'health_tracker_chat_history';
const SKINCARE_CHAT_HISTORY_KEY = 'health_tracker_skincare_chat_history';
const MAX_HISTORY = 40;

function getChatHistory(key = CHAT_HISTORY_KEY) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveChatHistory(question, answer, key = CHAT_HISTORY_KEY) {
  const history = getChatHistory(key);
  history.push({ question, answer, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
  localStorage.setItem(key, JSON.stringify(history));
}

function clearChatHistory(key = CHAT_HISTORY_KEY) {
  localStorage.removeItem(key);
}

function buildHistoryContext(history) {
  if (!history || history.length === 0) return '';
  let ctx = '以下是你和用户之前的对话历史，请在回答当前问题时结合这些对话上下文，记得用户之前关心过什么、问过什么：\n\n';
  history.forEach((h, i) => {
    ctx += `[第${i + 1}次对话]\n用户问：${h.question}\n你回答：${h.answer}\n\n`;
  });
  return ctx;
}

async function getHealthAdvice(records, userQuestion) {
  const healthData = buildHealthPrompt(records);

  const question = userQuestion || '帮我看看我最近的健康状态怎么样？体重趋势好不好？睡眠够不够？运动和饮食有什么需要调整的？';

  const history = getChatHistory();
  const historyContext = buildHistoryContext(history);

  const messages = [
    {
      role: 'system',
      content: `你是一位温暖贴心的私人健康伙伴，就像一位懂营养学、运动科学和睡眠知识的好朋友。
你的任务是用亲切自然的语气，帮用户分析健康数据并给出鼓励和建议。

用户基本情况（这是你每次回答时都要牢记的背景信息）：
- ${getUserAge()}岁男性，身高${USER_HEIGHT}cm
- 脑力劳动者，工作需要长时间久坐
- 精神压力一点点大

基于以上背景，在给出建议时请注意：
- 针对久坐人群推荐工间活动、拉伸、站立办公等方案
- 关注颈椎、腰椎、视力等久坐常见问题的预防
- 饮食建议考虑脑力劳动者的需求（护眼、抗疲劳、稳定血糖的食物）
- 结合用户的补剂记录（鱼油、肌酸、维生素等），评估补剂搭配是否合理，给出调整建议
- 运动建议以缓解精神压力、改善体态为主
- 睡眠建议关注压力大导致入睡困难或睡眠质量差的情况
- 所有建议都要贴合"没时间去健身房、大多数时间在办公桌前"的现实

对话风格：
- 像朋友聊天一样自然，不要用 markdown 格式（不要出现 #、*、- 等符号）
- 可以适当使用 emoji 表情增加亲和力 😊
- 先肯定用户的努力和进步，再温和地指出可以改善的地方
- 用"你"来称呼，语言口语化，不要冷冰冰的数据罗列
- 引用具体数字时要自然地融入句子中，比如"你这周平均睡了7.2小时，比上周好多了呢"
- 如果数据不够充分，就诚实说"目前数据还不多，再记录几天我能给你更靠谱的建议哦"
- 建议要实用可操作，不要空泛地说"注意饮食"而是具体到"晚餐可以试试少吃米饭，换成杂粮或红薯"
- 绝对不要建议极端节食、危险运动或不科学的减肥方法
- 用中文回复，保持积极乐观的语气
- 微量营养素分析是你回答的重要依据。请在分析用户健康时重点参考「🔬 微量营养素分析」和「🩺 微量营养素角度的身体评估」中的数据：
  * 指出用户当前最缺乏的 3-5 种微量营养素，并结合缺乏后果（如维生素D缺乏→骨密度下降、免疫力降低）给出警示
  * 根据微量营养素身体评估，告诉用户当前最容易出现哪方面问题（如眼部健康、骨骼健康、免疫力等），并解释为什么
  * 对于近7天持续偏低的微量营养素，提醒用户这是长期问题需要重视，不是一天能补回来的
  * 给出的饮食建议要具体到食物名称和分量，优先推荐能同时补充多种缺乏微量营养素的食物（参考用户页面上的综合推荐）
  * 询问用户补剂使用情况，结合补剂记录评估是否需要调整剂量
- 重要：请结合对话历史来回答，如果用户之前问过类似问题或设立过目标，请提及并跟进`
    },
    {
      role: 'user',
      content: historyContext
        ? `${historyContext}\n--- 以下是当前最新的健康数据 ---\n${healthData || '暂无健康数据'}\n\n我的问题是：${question}`
        : `${healthData ? healthData + '\n\n' : ''}我的问题是：${question}`
    }
  ];

  const answer = await callDeepSeek(messages);
  saveChatHistory(question, answer);
  return answer;
}

// ===== Skincare AI =====
function buildSkincareHealthContext(records) {
  if (!records || records.length === 0) return '暂无健康数据';

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const dateRange = `${sorted[0].date} 至 ${sorted[sorted.length - 1].date}`;

  const aggregated = aggregateByDate(records);
  const weights = aggregated.map(a => a.weight);
  const weightTrend = weights.length >= 2
    ? (weights[weights.length - 1] - weights[0]).toFixed(2)
    : '数据不足';

  const sleepValues = records.map(r => computeTotalSleep(r)).filter(s => s > 0);
  const sleepAvg = sleepValues.length > 0
    ? (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1)
    : '无数据';

  const allDiet = records.flatMap(r => r.diet || []);
  const totalDietCalories = allDiet.reduce((sum, d) => sum + (d.calories || 0), 0);
  const waterRich = allDiet.filter(d => {
    const desc = (d.description || '').toLowerCase();
    return /水果|蔬菜|沙拉|汤|水|茶|奶|豆浆/.test(desc);
  }).length;
  const greasy = allDiet.filter(d => {
    const desc = (d.description || '').toLowerCase();
    return /炸|烤|辣|火锅|烧烤|甜食|奶茶|碳酸|酒精|啤酒|白酒/.test(desc);
  }).length;

  const allSupplements = records.flatMap(r => r.supplements || []);
  const suppDays = new Set(records.filter(r => (r.supplements || []).length > 0).map(r => r.date)).size;
  const suppCounts = {};
  allSupplements.forEach(s => {
    suppCounts[s.name] = (suppCounts[s.name] || 0) + 1;
  });
  const topSupps = Object.entries(suppCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const allExercises = records.flatMap(r => r.exercises || []);
  const exDays = new Set(records.filter(r => (r.exercises || []).length > 0).map(r => r.date)).size;
  const totalExMin = allExercises.reduce((sum, e) => sum + (e.duration || 0), 0);

  let ctx = `以下是与护肤相关的用户健康数据摘要：\n\n`;
  ctx += `📅 数据范围：${dateRange}，共 ${records.length} 天\n`;
  ctx += `⚖️ 体重趋势：变化 ${weightTrend}kg\n`;
  ctx += `😴 平均睡眠：${sleepAvg} 小时/天\n`;
  ctx += `🏃 运动情况：${exDays} 天有运动，共 ${totalExMin} 分钟\n`;
  ctx += `🍽️ 饮食记录：${allDiet.length} 餐，总摄入 ${totalDietCalories} kcal\n`;
  ctx += `  含水/清淡食物：${waterRich} 餐，油腻/辛辣/高糖食物：${greasy} 餐\n`;
  if (suppDays > 0) {
    ctx += `💊 补剂：${suppDays} 天有记录，${topSupps.map(([n, c]) => `${n}(${c}次)`).join('、')}\n`;
  }

  const recentDays = sorted.slice(-7);
  ctx += `\n最近7天每日概况：\n`;
  recentDays.forEach(r => {
    const sleepTotal = computeTotalSleep(r);
    const dietSum = (r.diet || []).reduce((s, d) => s + (d.calories || 0), 0);
    const dietDesc = (r.diet || []).map(d => d.description).join('、') || '无记录';
    ctx += `${r.date}：体重${r.weight > 0 ? r.weight.toFixed(2) + 'kg' : '未记录'}，睡眠${sleepTotal > 0 ? sleepTotal.toFixed(1) + 'h' : '未记录'}，饮食[${dietDesc}] ${dietSum}kcal\n`;
  });

  return ctx;
}

async function getSkincareAdvice(records, userQuestion) {
  const healthContext = buildSkincareHealthContext(records);

  const question = userQuestion || '帮我看看最近的皮肤状态应该注意什么？结合我的作息和饮食给点护肤建议吧。';

  const history = getChatHistory(SKINCARE_CHAT_HISTORY_KEY);
  const historyContext = buildHistoryContext(history);

  const messages = [
    {
      role: 'system',
      content: `你是一位专业又贴心的护肤顾问，同时也懂营养学、睡眠和运动对皮肤的影响。
你的任务是根据用户的生活习惯数据（睡眠、饮食、运动、体重等），给出针对性的护肤建议。

用户基本情况：
- ${getUserAge()}岁男性，身高${USER_HEIGHT}cm
- 脑力劳动者，长时间久坐面对屏幕
- 精神压力一点点大

护肤建议时请注意：
- 结合用户的作息（睡眠不足会导致皮肤暗沉、黑眼圈、长痘）
- 结合饮食（高糖高油会加重出油和痤疮，水果蔬菜有助于抗氧化）
- 结合运动（出汗排毒，但运动后清洁不到位会堵毛孔）
- 结合补剂记录（鱼油、维生素等补剂对皮肤状态有直接影响）
- 针对长时间面对屏幕的人群，关注蓝光损伤、眼部疲劳导致的眼周问题
- 建议要具体可操作，推荐成分、产品类型，而非具体品牌
- 了解常见的护肤流程：清洁→保湿→防晒（日间），清洁→精华→保湿（夜间）
- 关注用户近期的体重变化（快速减重可能导致皮肤松弛）

对话风格：
- 像朋友聊天一样自然，不要用 markdown 格式
- 可以适当使用 emoji 表情 🧴✨
- 先观察用户的生活习惯，再针对性地给建议
- 用"你"来称呼，语言口语化
- 建议要实用可操作
- 绝对不要推荐极端护肤方法或医美项目（除非用户主动询问）
- 用中文回复，保持温暖鼓励的语气
- 关注用户的微量营养素摄入对皮肤的影响（如维生素A/C/E抗氧化、锌控油修复、Omega-3抗炎、B族促进代谢），如果数据显示缺乏可在护肤建议中提及
- 重要：请结合对话历史来回答，如果用户之前问过类似问题或提到过皮肤问题，请跟进`
    },
    {
      role: 'user',
      content: historyContext
        ? `${historyContext}\n--- 以下是用户当前的健康数据 ---\n${healthContext}\n\n我的问题是：${question}`
        : `${healthContext}\n\n我的问题是：${question}`
    }
  ];

  const answer = await callSkincareDeepSeek(messages);
  saveChatHistory(question, answer, SKINCARE_CHAT_HISTORY_KEY);
  return answer;
}
