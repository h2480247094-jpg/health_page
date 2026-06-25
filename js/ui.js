const MEAL_LABELS = {
  breakfast: '🌅早餐',
  lunch: '☀️午餐',
  dinner: '🌙晚餐',
  snack: '🍪加餐'
};

// ===== Toast =====
let toastTimer = null;

function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// ===== Modal =====
function showModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function hideModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ===== Tab Switching =====
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');

  // Weight chart: AI + data entry
  const wc = document.getElementById('weightChartSection');
  if (wc) wc.style.display = (tabName === 'tabAI' || tabName === 'tabAdd') ? '' : 'none';
  // Other charts: only AI
  const charts = document.getElementById('chartsContainer');
  if (charts) charts.style.display = (tabName === 'tabAI') ? '' : 'none';
}

// ===== Stats Cards =====
function renderStats(records) {
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter(r => r.date === today);
  const todayWeightRecords = todayRecords.filter(r => r.weight != null && r.weight > 0);
  const todayWeight = todayWeightRecords.length > 0
    ? (todayWeightRecords.reduce((s, r) => s + r.weight, 0) / todayWeightRecords.length).toFixed(2)
    : null;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split('T')[0];
  const weekRecords = records.filter(r => r.date >= weekStr);
  const weekWeights = aggregateByDate(weekRecords).map(a => a.weight);
  const weekAvg = weekWeights.length > 0
    ? (weekWeights.reduce((a, b) => a + b, 0) / weekWeights.length).toFixed(2)
    : null;

  const prevWeekAgo = new Date();
  prevWeekAgo.setDate(prevWeekAgo.getDate() - 14);
  const prevWeekStr = prevWeekAgo.toISOString().split('T')[0];
  const prevWeekRecords = records.filter(r => r.date >= prevWeekStr && r.date < weekStr);
  const prevWeekWeights = aggregateByDate(prevWeekRecords).map(a => a.weight);
  const prevWeekAvg = prevWeekWeights.length > 0
    ? (prevWeekWeights.reduce((a, b) => a + b, 0) / prevWeekWeights.length)
    : null;

  document.getElementById('statWeight').textContent = todayWeight ? `${todayWeight} kg` : '-- kg';

  const bmiEl = document.getElementById('statBMI');
  if (todayWeight) {
    const bmi = calculateBMI(parseFloat(todayWeight));
    let bmiLabel = '';
    if (bmi < 18.5) bmiLabel = '偏瘦';
    else if (bmi < 24) bmiLabel = '正常';
    else if (bmi < 28) bmiLabel = '偏重';
    else bmiLabel = '肥胖';
    bmiEl.textContent = `BMI ${bmi.toFixed(1)} (${bmiLabel})`;
  } else {
    bmiEl.textContent = '';
  }

  const changeEl = document.getElementById('statWeightChange');
  if (todayWeight && prevWeekAvg) {
    const diff = todayWeight - prevWeekAvg;
    const sign = diff >= 0 ? '+' : '';
    changeEl.textContent = `较上周 ${sign}${diff.toFixed(2)} kg`;
    changeEl.className = 'stat-sub ' + (diff > 0 ? 'positive' : 'negative');
  } else {
    changeEl.textContent = '';
    changeEl.className = 'stat-sub';
  }

  // Calorie deficit
  if (todayRecords.length > 0 && todayWeight) {
    const r = todayRecords[0];
    const dietSum = (r.diet || []).reduce((s, d) => s + (d.calories || 0), 0);
    const exSum = (r.exercises || []).reduce((s, e) => s + (e.calories || 0), 0);
    const bmr = Math.round(calculateBMR(parseFloat(todayWeight)));
    const balance = bmr + exSum - dietSum;
    const defEl = document.getElementById('statDeficit');
    if (balance > 0) {
      defEl.textContent = `-${balance} kcal`;
      defEl.className = 'stat-value stat-deficit';
    } else if (balance < 0) {
      defEl.textContent = `+${Math.abs(balance)} kcal`;
      defEl.className = 'stat-value stat-surplus';
    } else {
      defEl.textContent = '0 kcal';
      defEl.className = 'stat-value';
    }
  } else {
    document.getElementById('statDeficit').textContent = '-- kcal';
    document.getElementById('statDeficit').className = 'stat-value';
  }

  const todaySleep = computeTotalSleep(todayRecords.length > 0 ? todayRecords[0] : null);
  const lastSleep = records.length > 0 ? computeTotalSleep(records[records.length - 1]) : null;
  document.getElementById('statSleep').textContent = todaySleep > 0 ? formatSleepHours(todaySleep) : (lastSleep > 0 ? formatSleepHours(lastSleep) : '--');

  const sleepSub = document.getElementById('statSleepSub');
  if (weekRecords.length > 0) {
    const weekSleepVals = weekRecords.map(r => computeTotalSleep(r)).filter(s => s > 0);
    const weekSleepAvg = weekSleepVals.length > 0
      ? (weekSleepVals.reduce((a, b) => a + b, 0) / weekSleepVals.length).toFixed(1)
      : null;
    sleepSub.textContent = weekSleepAvg ? `近7天均值 ${formatSleepHours(weekSleepAvg)}` : '';
  } else {
    sleepSub.textContent = '';
  }

  const todayExCal = todayRecords.reduce((sum, r) =>
    sum + (r.exercises || []).reduce((s, e) => s + (e.calories || 0), 0), 0
  );
  document.getElementById('statCalories').textContent = todayExCal > 0 ? `${todayExCal} kcal` : '-- kcal';
}

// ===== Quick Entry =====
async function upsertDailyRecord(date, updateFn) {
  const existing = await getRecordsByDateRange(date, date);
  if (existing.length > 0) {
    const record = { ...existing[0] };
    updateFn(record);
    await updateRecord(record.id, record);
  } else {
    const record = { date, weight: null, sleep: 0, diet: [], exercises: [], supplements: [] };
    updateFn(record);
    await addRecord(record);
  }
}

function showQuickFeedback(elId, msg, type) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.className = 'qe-feedback ' + type;
  setTimeout(() => { el.textContent = ''; el.className = 'qe-feedback'; }, 5000);
}

function setQuickDates(dateStr) {
  ['qeWeightDate', 'qeSleepDate', 'qeDietDate', 'qeExDate', 'qeSuppDate'].forEach(id => {
    document.getElementById(id).value = dateStr;
  });
}

async function saveWeight() {
  const date = document.getElementById('qeWeightDate').value;
  const weight = parseFloat(document.getElementById('qeWeight').value);
  if (!date) { showQuickFeedback('fbWeight', '请选择日期', 'error'); return; }
  if (!weight || weight < 30 || weight > 300) {
    showQuickFeedback('fbWeight', '请输入合理体重（30-300 kg）', 'error'); return;
  }
  await upsertDailyRecord(date, r => { r.weight = Math.round(weight * 100) / 100; });
  showQuickFeedback('fbWeight', `已保存 ${date} 体重 ${weight.toFixed(2)} kg ✓`, 'success');
  document.getElementById('qeWeight').value = '';
  window.__app && window.__app.refresh();
}

async function saveSleep() {
  const date = document.getElementById('qeSleepDate').value;
  if (!date) { showQuickFeedback('fbSleep', '请选择日期', 'error'); return; }

  // Collect all segments
  const segmentEls = document.querySelectorAll('#sleepSegments .sleep-segment');
  const segments = [];
  segmentEls.forEach(el => {
    const bed = el.querySelector('.seg-bed').value;
    const wake = el.querySelector('.seg-wake').value;
    if (bed && wake) {
      const bedD = timeToDecimal(bed);
      let wakeD = timeToDecimal(wake);
      if (wakeD <= bedD) wakeD += 24;
      const dur = Math.round((wakeD - bedD) * 60) / 60;
      segments.push({ bedTime: bed, wakeTime: wake });
    } else if (bed || wake) {
      segments.push({ bedTime: bed || '', wakeTime: wake || '' });
    }
  });

  if (segments.length === 0) {
    showQuickFeedback('fbSleep', '请至少填写一段睡眠的入睡和醒来时间', 'error'); return;
  }

  const totalSleep = segments.reduce((sum, seg) => {
    if (seg.bedTime && seg.wakeTime) {
      const bedD = timeToDecimal(seg.bedTime);
      let wakeD = timeToDecimal(seg.wakeTime);
      if (wakeD <= bedD) wakeD += 24;
      return sum + Math.round((wakeD - bedD) * 60) / 60;
    }
    return sum;
  }, 0);

  await upsertDailyRecord(date, r => {
    r.sleepSegments = segments;
    if (totalSleep > 0) r.sleep = Math.round(totalSleep * 100) / 100;
    // Keep backward-compatible bedTime/wakeTime from first/last segment
    const validSegs = segments.filter(s => s.bedTime && s.wakeTime);
    if (validSegs.length > 0) {
      r.bedTime = validSegs[0].bedTime;
      r.wakeTime = validSegs[0].wakeTime;
    }
  });

  let msg = `已保存 ${date}`;
  segments.forEach((seg, i) => {
    if (seg.bedTime && seg.wakeTime) {
      const bedD = timeToDecimal(seg.bedTime);
      let wakeD = timeToDecimal(seg.wakeTime);
      if (wakeD <= bedD) wakeD += 24;
      const dur = Math.round((wakeD - bedD) * 60) / 60;
      msg += ` 第${i + 1}段 ${seg.bedTime}→${seg.wakeTime}(${formatSleepHours(dur)})`;
    }
  });
  msg += ' ✓';
  showQuickFeedback('fbSleep', msg, 'success');

  // Reset form
  resetSleepForm();
  window.__app && window.__app.refresh();
}

function resetSleepForm() {
  const container = document.getElementById('sleepSegments');
  container.innerHTML = `
    <div class="sleep-segment" data-seg="0">
      <div class="seg-header">
        <span class="seg-label">第1段</span>
        <button class="btn-sm btn-remove-seg" data-seg="0" title="删除此段" disabled>✕</button>
      </div>
      <div class="qe-row">
        <input type="time" class="qe-input seg-bed" placeholder="入睡时间" title="入睡时间">
        <span class="seg-arrow">→</span>
        <input type="time" class="qe-input seg-wake" placeholder="醒来时间" title="醒来时间">
      </div>
      <div class="seg-duration">--</div>
    </div>
  `;
  document.getElementById('sleepTotal').textContent = '总计：--';
  bindSegmentEvents();
}

function bindSegmentEvents() {
  document.querySelectorAll('.seg-bed, .seg-wake').forEach(input => {
    input.removeEventListener('change', onSegmentTimeChange);
    input.addEventListener('change', onSegmentTimeChange);
  });
  document.querySelectorAll('.btn-remove-seg').forEach(btn => {
    btn.removeEventListener('click', onRemoveSegment);
    btn.addEventListener('click', onRemoveSegment);
  });
}

function onSegmentTimeChange() {
  updateSegmentDurations();
}

function onRemoveSegment(e) {
  const segEl = e.target.closest('.sleep-segment');
  if (!segEl) return;
  const container = document.getElementById('sleepSegments');
  if (container.querySelectorAll('.sleep-segment').length <= 1) return;
  segEl.remove();
  renumberSegments();
  updateSegmentDurations();
}

function addSegment() {
  const container = document.getElementById('sleepSegments');
  const count = container.querySelectorAll('.sleep-segment').length;
  const div = document.createElement('div');
  div.className = 'sleep-segment';
  div.dataset.seg = count;
  div.innerHTML = `
    <div class="seg-header">
      <span class="seg-label">第${count + 1}段</span>
      <button class="btn-sm btn-remove-seg" data-seg="${count}" title="删除此段">✕</button>
    </div>
    <div class="qe-row">
      <input type="time" class="qe-input seg-bed" placeholder="入睡时间" title="入睡时间">
      <span class="seg-arrow">→</span>
      <input type="time" class="qe-input seg-wake" placeholder="醒来时间" title="醒来时间">
    </div>
    <div class="seg-duration">--</div>
  `;
  container.appendChild(div);
  bindSegmentEvents();
}

function renumberSegments() {
  const container = document.getElementById('sleepSegments');
  const segs = container.querySelectorAll('.sleep-segment');
  segs.forEach((seg, i) => {
    seg.dataset.seg = i;
    seg.querySelector('.seg-label').textContent = `第${i + 1}段`;
    const btn = seg.querySelector('.btn-remove-seg');
    btn.dataset.seg = i;
    btn.disabled = segs.length <= 1;
  });
}

function updateSegmentDurations() {
  const segs = document.querySelectorAll('#sleepSegments .sleep-segment');
  let total = 0;
  segs.forEach(seg => {
    const bed = seg.querySelector('.seg-bed').value;
    const wake = seg.querySelector('.seg-wake').value;
    const durEl = seg.querySelector('.seg-duration');
    if (bed && wake) {
      const bedD = timeToDecimal(bed);
      let wakeD = timeToDecimal(wake);
      if (wakeD <= bedD) wakeD += 24;
      const dur = Math.round((wakeD - bedD) * 60) / 60;
      durEl.textContent = formatSleepHours(dur);
      total += dur;
    } else {
      durEl.textContent = '--';
    }
  });
  document.getElementById('sleepTotal').textContent = total > 0 ? `总计：${formatSleepHours(Math.round(total * 100) / 100)}` : '总计：--';
}

function computeTotalSleep(record) {
  if (!record) return 0;
  if (record.sleepSegments && record.sleepSegments.length > 0) {
    return record.sleepSegments.reduce((sum, seg) => {
      if (seg.bedTime && seg.wakeTime) {
        const bedD = timeToDecimal(seg.bedTime);
        let wakeD = timeToDecimal(seg.wakeTime);
        if (wakeD <= bedD) wakeD += 24;
        return sum + Math.round((wakeD - bedD) * 60) / 60;
      }
      return sum;
    }, 0);
  }
  return record.sleep || 0;
}

async function saveDiet() {
  const date = document.getElementById('qeDietDate').value;
  const mealType = document.getElementById('qeMealType').value;
  const desc = document.getElementById('qeDietDesc').value.trim();
  const cal = parseInt(document.getElementById('qeDietCal').value) || 0;
  const protein = Math.round((parseFloat(document.getElementById('qeDietProtein').value) || 0) * 100) / 100;
  const carbs = Math.round((parseFloat(document.getElementById('qeDietCarbs').value) || 0) * 100) / 100;
  const fat = Math.round((parseFloat(document.getElementById('qeDietFat').value) || 0) * 100) / 100;
  if (!date) { showQuickFeedback('fbDiet', '请选择日期', 'error'); return; }
  if (!desc) { showQuickFeedback('fbDiet', '请输入食物描述', 'error'); return; }
  await upsertDailyRecord(date, r => {
    if (!r.diet) r.diet = [];
    const existing = r.diet.find(d => d.mealType === mealType);
    if (existing) {
      existing.description += '、' + desc;
      existing.calories += cal;
      existing.protein = Math.round(((existing.protein || 0) + protein) * 100) / 100;
      existing.carbs = Math.round(((existing.carbs || 0) + carbs) * 100) / 100;
      existing.fat = Math.round(((existing.fat || 0) + fat) * 100) / 100;
      // Merge micros if both have them
      if (_lastEstimateResult && _lastEstimateResult.micros) {
        if (!existing.micros) existing.micros = {};
        for (const [k, v] of Object.entries(_lastEstimateResult.micros)) {
          existing.micros[k] = +((existing.micros[k] || 0) + (v || 0)).toFixed(2);
        }
      }
    } else {
      const entry = { mealType, description: desc, calories: cal, protein, carbs, fat };
      if (_lastEstimateResult && _lastEstimateResult.micros) {
        entry.micros = _lastEstimateResult.micros;
      }
      r.diet.push(entry);
    }
  });
  _lastEstimateResult = null;
  const mealName = MEAL_LABELS[mealType] || '餐';
  showQuickFeedback('fbDiet', `已记录${mealName}：${desc} ${cal > 0 ? cal + 'kcal' : ''}${protein > 0 ? ' 蛋白' + protein + 'g' : ''}${carbs > 0 ? ' 碳水' + carbs + 'g' : ''} ✓`, 'success');
  document.getElementById('qeDietDesc').value = '';
  document.getElementById('qeDietCal').value = '';
  document.getElementById('qeDietProtein').value = '';
  document.getElementById('qeDietCarbs').value = '';
  document.getElementById('qeDietFat').value = '';
  window.__app && window.__app.refresh();
}

async function saveExercise() {
  const date = document.getElementById('qeExDate').value;
  const type = document.getElementById('qeExType').value.trim();
  const duration = parseInt(document.getElementById('qeExDuration').value) || 0;
  const calories = parseInt(document.getElementById('qeExCal').value) || 0;
  if (!date) { showQuickFeedback('fbExercise', '请选择日期', 'error'); return; }
  if (!type) { showQuickFeedback('fbExercise', '请输入运动类型', 'error'); return; }
  await upsertDailyRecord(date, r => {
    if (!r.exercises) r.exercises = [];
    r.exercises.push({ type, duration, calories });
  });
  showQuickFeedback('fbExercise', `已记录${type} ${duration}分钟 ${calories > 0 ? calories + 'kcal' : ''} ✓`, 'success');
  document.getElementById('qeExType').value = '';
  document.getElementById('qeExDuration').value = '';
  document.getElementById('qeExCal').value = '';
  window.__app && window.__app.refresh();
}

// Holds the last AI estimate result so saveDiet can attach micros
let _lastEstimateResult = null;

async function handleAiEstimate() {
  const descInput = document.getElementById('qeDietDesc');
  const calInput = document.getElementById('qeDietCal');
  const proteinInput = document.getElementById('qeDietProtein');
  const carbsInput = document.getElementById('qeDietCarbs');
  const fatInput = document.getElementById('qeDietFat');
  const btn = document.getElementById('btnAiEstimate');
  const food = descInput.value.trim();
  if (!food) { showToast('请先输入食物描述'); return; }
  if (!getCalorieApiKey()) { showToast('请先在 ⚙️ 设置中配置热量计算 API Key'); return; }
  btn.disabled = true;
  btn.textContent = '⏳ 估算中...';
  try {
    const result = await estimateFoodNutrition(food);
    _lastEstimateResult = result;
    calInput.value = result.calories;
    if (result.protein > 0) proteinInput.value = Math.round(result.protein * 100) / 100;
    if (result.carbs > 0) carbsInput.value = Math.round(result.carbs * 100) / 100;
    if (result.fat > 0) fatInput.value = Math.round(result.fat * 100) / 100;
    let microSummary = '';
    if (result.micros) {
      microSummary = ' | 微量已估算';
    }
    showQuickFeedback('fbDiet', `估算结果：${result.calories}kcal 蛋白${result.protein}g 碳水${result.carbs}g 脂肪${result.fat}g${microSummary}，可手动调整`, 'success');
  } catch (err) {
    showToast(`估算失败：${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 估算';
  }
}

// ===== Supplements =====

const SUPP_PRESETS_KEY = 'health_tracker_supp_presets';

const DEFAULT_SUPP_PRESETS = [
  { name: '鱼油', dosage: 2, unit: '粒', emoji: '🐟' },
  { name: '肌酸', dosage: 5, unit: 'g', emoji: '💪' },
  { name: '维生素D', dosage: 1, unit: '粒', emoji: '☀️' },
  { name: '维生素C', dosage: 1, unit: '粒', emoji: '🍊' },
  { name: '蛋白粉', dosage: 1, unit: '勺', emoji: '🥛' },
  { name: '镁', dosage: 1, unit: '粒', emoji: '🧂' },
  { name: '锌', dosage: 1, unit: '粒', emoji: '🔬' },
  { name: '维生素B族', dosage: 1, unit: '粒', emoji: '⚡' }
];

function getSuppPresets() {
  try {
    const data = localStorage.getItem(SUPP_PRESETS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { /* ignore */ }
  return [...DEFAULT_SUPP_PRESETS];
}

function saveSuppPresets(presets) {
  localStorage.setItem(SUPP_PRESETS_KEY, JSON.stringify(presets));
}

function addSuppPreset(name, dosage, unit) {
  const presets = getSuppPresets();
  if (presets.some(p => p.name === name)) {
    showToast('该补剂已存在');
    return false;
  }
  presets.push({ name, dosage, unit, emoji: '💊' });
  saveSuppPresets(presets);
  renderSuppPresets();
  renderSuppPresetManageList();
  showToast(`已添加「${name}」`);
  return true;
}

function deleteSuppPreset(name) {
  let presets = getSuppPresets();
  presets = presets.filter(p => p.name !== name);
  saveSuppPresets(presets);
  renderSuppPresets();
  renderSuppPresetManageList();
  showToast(`已删除「${name}」`);
}

function renderSuppPresets() {
  const container = document.getElementById('suppPresets');
  if (!container) return;
  const presets = getSuppPresets();

  container.innerHTML = presets.map(p =>
    `<button class="supp-preset" data-name="${escapeHtml(p.name)}" data-dosage="${p.dosage}" data-unit="${escapeHtml(p.unit)}">${p.emoji || '💊'} ${escapeHtml(p.name)}</button>`
  ).join('') + `<button class="supp-preset supp-preset-custom" id="btnCustomSupp">✏️ 自定义</button>`;

  // Re-bind preset click events
  container.querySelectorAll('.supp-preset:not(.supp-preset-custom)').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.supp-preset').forEach(b => b.classList.remove('active-preset'));
      btn.classList.add('active-preset');
      document.getElementById('qeSuppName').value = btn.dataset.name;
      document.getElementById('qeSuppDosage').value = btn.dataset.dosage;
      document.getElementById('qeSuppUnit').value = btn.dataset.unit;
      document.getElementById('qeSuppName').focus();
    });
  });

  // Re-bind custom button
  const customBtn = document.getElementById('btnCustomSupp');
  if (customBtn) {
    customBtn.addEventListener('click', () => {
      container.querySelectorAll('.supp-preset').forEach(b => b.classList.remove('active-preset'));
      document.getElementById('qeSuppName').value = '';
      document.getElementById('qeSuppDosage').value = '1';
      document.getElementById('qeSuppName').focus();
    });
  }
}

function renderSuppPresetManageList() {
  const container = document.getElementById('suppPresetManageList');
  if (!container) return;
  const presets = getSuppPresets();

  if (presets.length === 0) {
    container.innerHTML = '<span style="color:#999;font-size:0.8rem;">暂无预设</span>';
    return;
  }

  container.innerHTML = presets.map(p =>
    `<button class="supp-preset supp-preset-deletable" title="点击删除">
      ${p.emoji || '💊'} ${escapeHtml(p.name)} ${p.dosage}${escapeHtml(p.unit)}
      <span class="supp-preset-delete" data-name="${escapeHtml(p.name)}">✕</span>
    </button>`
  ).join('');

  container.querySelectorAll('.supp-preset-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.dataset.name;
      if (confirm(`确定要删除预设「${name}」吗？（不会删除已有记录）`)) {
        deleteSuppPreset(name);
      }
    });
  });
}

function initSuppPresets() {
  renderSuppPresets();
  renderSuppPresetManageList();
}

async function saveSupplement() {
  const date = document.getElementById('qeSuppDate').value;
  const name = document.getElementById('qeSuppName').value.trim();
  const dosage = parseFloat(document.getElementById('qeSuppDosage').value) || 0;
  const unit = document.getElementById('qeSuppUnit').value;
  const note = document.getElementById('qeSuppNote').value.trim();

  if (!date) { showQuickFeedback('fbSupplement', '请选择日期', 'error'); return; }
  if (!name) { showQuickFeedback('fbSupplement', '请输入补剂名称', 'error'); return; }
  if (dosage <= 0) { showQuickFeedback('fbSupplement', '请输入有效剂量', 'error'); return; }

  await upsertDailyRecord(date, r => {
    if (!r.supplements) r.supplements = [];
    r.supplements.push({ name, dosage, unit, note });
  });

  showQuickFeedback('fbSupplement', `已记录 ${name} ${dosage}${unit} ✓`, 'success');
  document.getElementById('qeSuppName').value = '';
  document.getElementById('qeSuppDosage').value = '1';
  document.getElementById('qeSuppNote').value = '';
  document.querySelectorAll('.supp-preset').forEach(b => b.classList.remove('active-preset'));
  window.__app && window.__app.refresh();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Records List =====
function interpolateWeightWithSource(allRecords, date) {
  const w = interpolateWeight(allRecords, date);
  if (w > 0) {
    const weightRecords = allRecords.filter(r => r.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
    let before = null, after = null;
    for (const wr of weightRecords) {
      if (wr.date < date) before = wr;
      else if (wr.date > date) { after = wr; break; }
    }
    if (before && after && w === (before.weight + after.weight) / 2) return { weight: w, source: '（前后均值估算）' };
    if (before && w === before.weight) return { weight: w, source: '（前值估算）' };
    if (after && w === after.weight) return { weight: w, source: '（后值估算）' };
    return { weight: w, source: '（估算）' };
  }
  return { weight: 0, source: '' };
}

function renderMacroDonut(proteinG, carbsG, fatG) {
  const pCal = proteinG * 4;
  const cCal = carbsG * 4;
  const fCal = fatG * 9;
  const total = pCal + cCal + fCal;
  if (total === 0) return '';
  const pPct = pCal / total;
  const cPct = cCal / total;
  const fPct = fCal / total;

  const R = 52, CX = 62, CY = 62, SW = 14;
  const C = 2 * Math.PI * R;
  const gap = C * 0.015;
  const usable = C - gap * 3;
  const fLen = usable * fPct;
  const cLen = usable * cPct;
  const pLen = usable * pPct;

  function arc(color, len, offset) {
    return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${color}" stroke-width="${SW}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${CX} ${CY})" stroke-linecap="butt"/>`;
  }
  const fatArc  = arc('#f0a060', fLen + gap, 0);
  const carbArc = arc('#e74c3c', cLen + gap, fLen + gap);
  const protArc = arc('#27ae60', pLen + gap, fLen + cLen + gap * 2);

  const items = [];
  if (fPct > 0.005) items.push({ cls: 'macro-fat',     label: '脂肪',   pct: fPct });
  if (cPct > 0.005) items.push({ cls: 'macro-carbs',   label: '碳水',   pct: cPct });
  if (pPct > 0.005) items.push({ cls: 'macro-protein', label: '蛋白质', pct: pPct });
  items.sort((a, b) => b.pct - a.pct);
  const legend = items.map(i => `<span class="macro-legend ${i.cls}">${i.label} ${Math.round(i.pct * 100)}%</span>`).join('');

  return `<div class="macro-donut-wrap">
    <svg class="macro-donut" width="124" height="124" viewBox="0 0 124 124">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#eee" stroke-width="${SW}"/>
      ${fatArc}${carbArc}${protArc}
      <text x="${CX}" y="${CY - 7}" text-anchor="middle" class="macro-donut-total">${Math.round(total)}</text>
      <text x="${CX}" y="${CY + 15}" text-anchor="middle" class="macro-donut-unit">kcal</text>
    </svg>
    <div class="macro-legend-wrap">${legend}</div>
  </div>`;
}

function renderRecords(records, searchTerm, sortOrder) {
  const container = document.getElementById('recordsList');

  if (!records || records.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无记录，快去录入数据吧！</p>';
    return;
  }

  let filtered = records;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(r => {
      if (r.date.includes(term)) return true;
      if ((r.diet || []).some(d => (d.description || '').toLowerCase().includes(term))) return true;
      if ((r.exercises || []).some(e => (e.type || '').toLowerCase().includes(term))) return true;
      return false;
    });
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'asc') return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });

  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-hint">没有匹配的记录</p>';
    return;
  }

  container.innerHTML = sorted.map(r => {
    const dietSum = (r.diet || []).reduce((s, d) => s + (d.calories || 0), 0);
    const proteinSum = (r.diet || []).reduce((s, d) => s + (d.protein || 0), 0);
    const carbsSum = (r.diet || []).reduce((s, d) => s + (d.carbs || 0), 0);
    const fatSum = (r.diet || []).reduce((s, d) => s + (d.fat || 0), 0);
    const exSum = (r.exercises || []).reduce((s, e) => s + (e.calories || 0), 0);
    const exDur = (r.exercises || []).reduce((s, e) => s + (e.duration || 0), 0);
    const exList = (r.exercises || []).map(e => `${e.type} ${e.calories > 0 ? e.calories + 'kcal' : ''}`);
    const bmi = r.weight > 0 ? calculateBMI(r.weight) : 0;
    const { weight: interpW, source: interpSrc } = r.weight > 0 ? { weight: r.weight, source: '' } : interpolateWeightWithSource(records, r.date);
    const effectiveWeight = r.weight > 0 ? r.weight : interpW;
    const bmr = effectiveWeight > 0 ? Math.round(calculateBMR(effectiveWeight)) : 0;
    const balance = Math.round(bmr + exSum - dietSum);
    const hasData = bmr > 0 || exSum > 0 || dietSum > 0;

    return `
      <div class="record-card" data-id="${r.id}">
        <div class="record-header">
          <span class="record-date">📅 ${r.date}</span>
          ${hasData ? `<span class="deficit-badge ${balance > 0 ? 'green' : balance < 0 ? 'orange' : 'neutral'}">${balance > 0 ? '🔥 热量缺口 -' + balance : balance < 0 ? '💪 热量盈余 +' + Math.abs(balance) : '⚖️ 能量平衡 0'} kcal</span>` : ''}
          <div class="record-actions">
            <button class="btn-sm btn-add btn-edit-record" data-id="${r.id}">编辑</button>
            <button class="btn-sm btn-remove btn-delete-record" data-id="${r.id}">删除</button>
          </div>
        </div>
        <div class="record-body">
          <div class="record-field">
            <div class="field-label">体重</div>
            <div class="field-value">${r.weight > 0 ? r.weight.toFixed(2) + ' kg' : (effectiveWeight > 0 ? effectiveWeight.toFixed(2) + ' kg <small>' + interpSrc + '</small>' : '--')} ${bmi > 0 ? '<small>BMI ' + bmi.toFixed(1) + '</small>' : ''}</div>
            ${renderMacroDonut(proteinSum, carbsSum, fatSum)}
          </div>
          <div class="record-field">
            <div class="field-label">睡眠</div>
            <div class="field-value">
              ${(r.sleepSegments && r.sleepSegments.length > 0) ? r.sleepSegments.map((seg, i) => {
                const bed = seg.bedTime;
                const wake = seg.wakeTime;
                let durStr = '';
                if (bed && wake) {
                  const bedD = timeToDecimal(bed);
                  let wakeD = timeToDecimal(wake);
                  if (wakeD <= bedD) wakeD += 24;
                  durStr = formatSleepHours(Math.round((wakeD - bedD) * 60) / 60);
                }
                return `<div class="sleep-seg-line">${bed && wake ? '🌙' + bed + ' → ☀️' + wake + ' ' + durStr : (bed ? '🌙' + bed : '') + (wake ? '☀️' + wake : '')}</div>`;
              }).join('') : (
                r.bedTime || r.wakeTime || r.sleep > 0
                  ? `${r.bedTime ? '🌙' + r.bedTime : ''}${r.bedTime && r.wakeTime ? ' → ' : ''}${r.wakeTime ? '☀️' + r.wakeTime : ''} ${r.sleep > 0 ? formatSleepHours(r.sleep) : ''}`
                  : '--'
              )}
            </div>
          </div>
          <div class="record-field">
            <div class="field-label">饮食摄入</div>
            <div class="field-value">${dietSum > 0 || proteinSum > 0 || carbsSum > 0 || fatSum > 0 ? `<div><span class="nutrient-val">${dietSum || 0}</span> <span class="nutrient-unit">kcal</span>${proteinSum > 0 ? `  <span class="nutrient-sep">|</span>  蛋白质 <span class="nutrient-val">${proteinSum.toFixed(0)}</span> <span class="nutrient-unit">g</span>` : ''}</div><div>${carbsSum > 0 ? `碳水 <span class="nutrient-val">${carbsSum.toFixed(0)}</span> <span class="nutrient-unit">g</span>` : ''}${carbsSum > 0 && fatSum > 0 ? `  <span class="nutrient-sep">|</span>  ` : ''}${fatSum > 0 ? `脂肪 <span class="nutrient-val">${fatSum.toFixed(0)}</span> <span class="nutrient-unit">g</span>` : ''}</div>` : '--'}</div>
            ${(r.diet || []).length > 0 ? `<div class="diet-tags">${(() => {
              const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
              const sorted = (r.diet || []).map((d, i) => ({ ...d, _origIdx: i }))
                .sort((a, b) => (MEAL_ORDER[a.mealType] ?? 4) - (MEAL_ORDER[b.mealType] ?? 4));
              return sorted.map((d, idx) => {
                // Calories — always visible inline
                let calLine = d.calories ? ` 热量 <span class="nutrient-val">${d.calories}</span> <span class="nutrient-unit">kcal</span>` : '';

                // Build expandable rows with specific grouping
                const rows = [];
                const sep = '  <span class="nutrient-sep">|</span>  ';
                function fmtMicro(k, v) {
                  const info = MICRONUTRIENT_RDA[k];
                  const name = info ? info.name : k;
                  const unit = info ? info.unit : '';
                  return `${name} <span class="nutrient-val">${+v.toFixed(1)}</span> <span class="nutrient-unit">${unit}</span>`;
                }
                function row(arr) { if (arr.length) rows.push(`<div class="diet-expand-row">${arr.join(sep)}</div>`); }
                const micros = (d.micros && typeof MICRO_KEYS !== 'undefined') ? d.micros : {};

                // Each nutrient its own row
                if (d.protein) row([`蛋白质 <span class="nutrient-val">${Math.round(d.protein * 100) / 100}</span> <span class="nutrient-unit">g</span>`]);
                if (d.carbs) row([`碳水 <span class="nutrient-val">${Math.round(d.carbs * 100) / 100}</span> <span class="nutrient-unit">g</span>`]);
                if (d.fat) row([`脂肪 <span class="nutrient-val">${Math.round(d.fat * 100) / 100}</span> <span class="nutrient-unit">g</span>`]);
                for (const k of MICRO_KEYS) {
                  if (micros[k] > 0) row([fmtMicro(k, micros[k])]);
                }

                const hasExpand = rows.length > 0;
                const uid = `diet-expand-${r.id}-${idx}`;
                let expandToggle = '';
                let expandBlock = '';
                if (hasExpand) {
                  expandToggle = `<button class="btn-toggle-micro" onclick="var b=document.getElementById('${uid}');var s=b.style.display==='none'?'block':'none';b.style.display=s;this.innerHTML=s==='block'?'▾ 明细':'▸ 明细';event.stopPropagation()">▸ 明细</button>`;
                  expandBlock = `<div class="diet-expand-block" id="${uid}" style="display:none">${rows.join('')}</div>`;
                }

                return `<span class="diet-tag tag-${d.mealType || 'breakfast'}"><span class="diet-tag-label">${MEAL_LABELS[d.mealType] || '早餐'} ${escapeHtml(d.description)}</span>${calLine || expandToggle ? `<div class="diet-macro-line">${calLine}${expandToggle}<button class="btn-del-item" data-record-id="${r.id}" data-diet-idx="${d._origIdx}" title="删除这一餐">✕</button></div>` : `<button class="btn-del-item" data-record-id="${r.id}" data-diet-idx="${d._origIdx}" title="删除这一餐">✕</button>`}${expandBlock}</span>`;
              }).join('');
            })()}</div>` : ''}
          </div>
          <div class="record-field">
            <div class="field-label">运动消耗</div>
            <div class="field-value"><span class="nutrient-val">${exSum}</span> <span class="nutrient-unit" style="font-weight:700;color:#555;">kcal</span>${exDur > 0 ? `  <span class="ex-dur-inline">${exDur}分钟</span>` : ''}</div>
            ${exList.length > 0 ? `<div class="ex-tags">${(r.exercises || []).map((e, i) => `<span class="ex-tag"><span class="ex-tag-type">${escapeHtml(e.type)}</span>${e.calories > 0 ? `<span class="ex-tag-cal"><strong>消耗 ${e.calories} kcal</strong><button class="btn-del-item" data-record-id="${r.id}" data-ex-idx="${i}" title="删除这条运动">✕</button></span>` : ''}</span>`).join('')}</div>` : ''}
          </div>
          ${(r.supplements || []).length > 0 ? `
          <div class="record-field">
            <div class="field-label">补剂</div>
            <div class="supp-tags">${[...(r.supplements || [])].sort((a, b) => a.name.localeCompare(b.name, 'zh')).map((s, i) => {
              const origIdx = (r.supplements || []).indexOf(s);
              return `<span class="supp-tag">${escapeHtml(s.name)} ${s.dosage}${s.unit}${s.note ? ' (' + escapeHtml(s.note) + ')' : ''}<button class="btn-del-item" data-record-id="${r.id}" data-supp-idx="${origIdx}" title="删除这个补剂">✕</button></span>`;
            }).join('')}</div>
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-record').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const record = await getRecordById(id);
      if (record) {
        setQuickDates(record.date);
        switchTab('tabAdd');
        showToast(`已切换到 ${record.date}，使用上方卡片添加或覆盖数据`);
      }
    });
  });

  container.querySelectorAll('.btn-delete-record').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定要删除这条记录吗？')) return;
      const id = parseInt(btn.dataset.id);
      await deleteRecord(id);
      showToast('记录已删除');
      const app = window.__app;
      if (app) app.refresh();
    });
  });

  container.querySelectorAll('.btn-del-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const recordId = parseInt(btn.dataset.recordId);
      const dietIdx = btn.dataset.dietIdx !== undefined ? parseInt(btn.dataset.dietIdx) : null;
      const exIdx = btn.dataset.exIdx !== undefined ? parseInt(btn.dataset.exIdx) : null;
      const suppIdx = btn.dataset.suppIdx !== undefined ? parseInt(btn.dataset.suppIdx) : null;

      const record = await getRecordById(recordId);
      if (!record) return;

      let label = '';
      if (dietIdx !== null && record.diet && record.diet[dietIdx]) {
        label = record.diet[dietIdx].description || '这餐';
      } else if (exIdx !== null && record.exercises && record.exercises[exIdx]) {
        label = record.exercises[exIdx].type || '这条运动';
      } else if (suppIdx !== null && record.supplements && record.supplements[suppIdx]) {
        const s = record.supplements[suppIdx];
        label = `${s.name} ${s.dosage}${s.unit}`;
      }

      if (!confirm(`确定要删除「${label}」吗？`)) return;

      if (dietIdx !== null) {
        record.diet.splice(dietIdx, 1);
      } else if (exIdx !== null) {
        record.exercises.splice(exIdx, 1);
      } else if (suppIdx !== null) {
        record.supplements.splice(suppIdx, 1);
      }

      await updateRecord(recordId, record);
      showToast(`已删除「${label}」`);
      const app = window.__app;
      if (app) app.refresh();
    });
  });
}

// ===== AI Panel =====
function updateAiStatus() {
  const statusEl = document.getElementById('aiStatus');
  const statusText = document.getElementById('aiStatusText');
  const askBtn = document.getElementById('btnAskAI');
  const questionInput = document.getElementById('aiQuestion');

  if (hasApiKey()) {
    statusEl.className = 'ai-status configured';
    statusText.textContent = '✅ 已配置健康管理 API Key，可以开始提问';
    askBtn.disabled = false;
    if (questionInput) questionInput.disabled = false;
  } else {
    statusEl.className = 'ai-status unconfigured';
    statusText.textContent = '🔒 先去右上角 ⚙️ 配置健康管理 API Key，才能获取建议';
    askBtn.disabled = true;
    if (questionInput) questionInput.disabled = true;
  }

  updateChatHistoryStatus();
}

function updateChatHistoryStatus() {
  const history = getChatHistory();
  const btn = document.getElementById('btnClearHistory');
  if (btn) {
    if (history.length > 0) {
      btn.textContent = `🗑️ 清除对话历史（${history.length}条）`;
      btn.style.display = '';
    } else {
      btn.textContent = '🗑️ 清除对话历史';
      btn.style.display = 'none';
    }
  }
}

// ===== Settings Modal =====
function loadSettings() {
  document.getElementById('inputApiKey').value = getApiKey();
  document.getElementById('inputApiUrl').value = getApiUrl();
  document.getElementById('inputModel').value = getModel();
  document.getElementById('inputCalorieApiKey').value = getCalorieApiKey();
  document.getElementById('inputCalorieApiUrl').value = getCalorieApiUrl();
  document.getElementById('inputCalorieModel').value = getCalorieModel();
  const skincareKey = getSkincareApiKey();
  document.getElementById('inputSkincareApiKey').value = skincareKey;
  document.getElementById('inputSkincareApiUrl').value = getSkincareApiUrl();
  document.getElementById('inputSkincareModel').value = getSkincareModel();
  document.getElementById('inputGender').value = getUserGender();
  const ageInput = document.getElementById('inputAge');
  ageInput.value = getUserAge();
  ageInput.readOnly = true;
  ageInput.title = '年龄根据生日自动计算';
}

function saveSettings() {
  const key = document.getElementById('inputApiKey').value.trim();
  const url = document.getElementById('inputApiUrl').value.trim();
  const model = document.getElementById('inputModel').value.trim();
  const calorieKey = document.getElementById('inputCalorieApiKey').value.trim();
  const calorieUrl = document.getElementById('inputCalorieApiUrl').value.trim();
  const calorieModel = document.getElementById('inputCalorieModel').value.trim();
  const skincareKey = document.getElementById('inputSkincareApiKey').value.trim();
  const skincareUrl = document.getElementById('inputSkincareApiUrl').value.trim();
  const skincareModel = document.getElementById('inputSkincareModel').value.trim();
  const gender = document.getElementById('inputGender').value;
  const age = parseInt(document.getElementById('inputAge').value) || 30;

  setApiKey(key);
  if (url) setApiUrl(url);
  if (model) setModel(model);
  if (calorieKey) setCalorieApiKey(calorieKey);
  if (calorieUrl) setCalorieApiUrl(calorieUrl);
  if (calorieModel) setCalorieModel(calorieModel);
  if (skincareKey) setSkincareApiKey(skincareKey);
  if (skincareUrl) setSkincareApiUrl(skincareUrl);
  if (skincareModel) setSkincareModel(skincareModel);
  setUserGender(gender);
  setUserAge(age);

  const statusEl = document.getElementById('apiStatusText');
  if (key) {
    statusEl.textContent = '✅ 设置已保存';
    statusEl.className = 'api-status success';
  } else {
    statusEl.textContent = '⚠️ 健康管理 API Key 为空，AI 建议功能将不可用';
    statusEl.className = 'api-status error';
  }

  updateAiStatus();
  hideModal('modalSettings');
  showToast('设置已保存');
  window.__app && window.__app.refresh();
}

// ===== Skincare =====
const SKIN_PIN_KEY = 'health_tracker_skin_pin';
let skinUnlocked = false;
let skinPinAttempts = 0;
let selectedPhotoFiles = { left: null, front: null, right: null };
const PHOTO_TYPE_LABELS = { left: '👈 左脸', front: '🧑 正脸', right: '👉 右脸' };
const PHOTO_TYPE_SHORT = { left: '左', front: '正', right: '右' };

function getSkinPin() {
  return localStorage.getItem(SKIN_PIN_KEY) || '';
}

function setSkinPin(pin) {
  localStorage.setItem(SKIN_PIN_KEY, pin);
}

function initSkinTab() {
  const lockPanel = document.getElementById('skinPinLock');
  const panel = document.getElementById('skinPanel');
  const photosSection = document.getElementById('skinPhotoSection');
  const photosGallerySection = document.getElementById('skinPhotoGallerySection');
  const savedPin = getSkinPin();

  panel.style.display = 'flex';
  updateSkinAiStatus();
  if (photosSection) photosSection.style.display = 'none';
  if (photosGallerySection) photosGallerySection.style.display = 'none';

  if (savedPin) {
    lockPanel.style.display = 'flex';
    document.getElementById('skinPinTitle').textContent = '请输入 4 位数字密码查看护肤照片';
    document.getElementById('skinPinHint').textContent = 'AI 建议不用密码，只有照片会被保护';
    document.getElementById('btnSkinUnlock').textContent = '解锁';
    document.getElementById('btnSkinResetPin').style.display = 'block';
    skinPinAttempts = 0;
    document.getElementById('skinPinError').style.display = 'none';
    clearPinInputs();
    document.getElementById('skinPinInputs').querySelectorAll('input')[0].focus();
  } else {
    lockPanel.style.display = 'flex';
    skinUnlocked = true;
    document.getElementById('skinPinTitle').textContent = '请设置 4 位数字密码保护护肤照片';
    document.getElementById('skinPinHint').textContent = '设好密码后，照片上传区和照片画廊才会出现';
    document.getElementById('btnSkinUnlock').textContent = '设置密码';
    document.getElementById('btnSkinResetPin').style.display = 'none';
    skinPinAttempts = 0;
    document.getElementById('skinPinError').style.display = 'none';
    clearPinInputs();
    document.getElementById('skinPinInputs').querySelectorAll('input')[0].focus();
  }

  if (!savedPin) renderPhotoGallery();
}

function clearPinInputs() {
  document.querySelectorAll('.skin-pin-digit').forEach(input => {
    input.value = '';
  });
}

function setupSkinPinInputs() {
  const inputs = document.querySelectorAll('.skin-pin-digit');
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (!/^\d$/.test(val)) {
        e.target.value = '';
        return;
      }
      const idx = parseInt(e.target.dataset.idx);
      if (idx < 3) {
        const next = document.querySelector(`.skin-pin-digit[data-idx="${idx + 1}"]`);
        if (next) next.focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        const prev = document.querySelector(`.skin-pin-digit[data-idx="${idx - 1}"]`);
        if (prev) { prev.value = ''; prev.focus(); }
      }
      if (e.key === 'Enter') {
        document.getElementById('btnSkinUnlock').click();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      const digits = pasted.replace(/\D/g, '').slice(0, 4);
      if (digits.length === 0) return;
      inputs.forEach((inp, i) => {
        inp.value = digits[i] || '';
      });
      if (digits.length >= 4) {
        inputs[3].focus();
        document.getElementById('btnSkinUnlock').click();
      } else {
        inputs[digits.length - 1].focus();
      }
    });
  });
}

function handleSkinUnlock() {
  const inputs = document.querySelectorAll('.skin-pin-digit');
  const pin = Array.from(inputs).map(i => i.value).join('');

  if (pin.length !== 4) {
    showPinError('请输入完整的 4 位数字密码');
    return;
  }

  const savedPin = getSkinPin();

  if (!savedPin) {
    setSkinPin(pin);
    skinUnlocked = true;
    showToast('密码已设置，请牢记');
    document.getElementById('skinPinLock').style.display = 'none';
    const photosSection = document.getElementById('skinPhotoSection');
    const photosGallerySection = document.getElementById('skinPhotoGallerySection');
    if (photosSection) photosSection.style.display = 'block';
    if (photosGallerySection) photosGallerySection.style.display = 'block';
    renderPhotoGallery();
    return;
  }

  if (pin === savedPin) {
    skinUnlocked = true;
    skinPinAttempts = 0;
    document.getElementById('skinPinLock').style.display = 'none';
    const photosSection = document.getElementById('skinPhotoSection');
    const photosGallerySection = document.getElementById('skinPhotoGallerySection');
    if (photosSection) photosSection.style.display = 'block';
    if (photosGallerySection) photosGallerySection.style.display = 'block';
    renderPhotoGallery();
  } else {
    skinPinAttempts++;
    const remaining = 3 - skinPinAttempts;
    if (remaining > 0) {
      showPinError(`密码错误，还剩 ${remaining} 次机会`);
      clearPinInputs();
      inputs[0].focus();
    } else {
      showPinError('已锁定，请稍后再试');
      document.getElementById('btnSkinUnlock').disabled = true;
      setTimeout(() => {
        document.getElementById('btnSkinUnlock').disabled = false;
        skinPinAttempts = 0;
        document.getElementById('skinPinError').style.display = 'none';
        clearPinInputs();
        inputs[0].focus();
      }, 30000);
    }
  }
}

function showPinError(msg) {
  const el = document.getElementById('skinPinError');
  el.textContent = msg;
  el.style.display = 'block';
}

function handleSkinPinReset() {
  if (confirm('确定要重置密码吗？照片数据不会丢失，但需要重新设置密码。')) {
    localStorage.removeItem(SKIN_PIN_KEY);
    clearPinInputs();
    document.getElementById('skinPinTitle').textContent = '请设置 4 位数字密码';
    document.getElementById('skinPinHint').textContent = '用于保护你的护肤照片隐私';
    document.getElementById('btnSkinResetPin').style.display = 'none';
    document.getElementById('skinPinError').style.display = 'none';
    skinPinAttempts = 0;
    document.querySelector('.skin-pin-digit[data-idx="0"]').focus();
    showToast('密码已重置，请设置新密码');
  }
}

// ===== Photo Management =====
function handleSelectPhoto(e) {
  const targetId = e.currentTarget.getAttribute('data-target');
  document.getElementById(targetId).click();
}

function handlePhotoFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('照片大小不能超过 10MB');
    e.target.value = '';
    return;
  }
  const type = e.target.getAttribute('data-type');
  selectedPhotoFiles[type] = file;
  const labelMap = { left: 'photoFileNameLeft', front: 'photoFileNameFront', right: 'photoFileNameRight' };
  document.getElementById(labelMap[type]).textContent = file.name;
}

function generateThumbnail(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 200;
      const scale = maxW / img.width;
      canvas.width = maxW;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error('缩略图生成失败'));
      }, 'image/jpeg', 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
    img.src = url;
  });
}

async function handleUploadPhoto() {
  const types = ['left', 'front', 'right'];
  const hasAny = types.some(t => selectedPhotoFiles[t]);
  if (!hasAny) {
    showToast('请至少选择一张照片');
    return;
  }

  const date = document.getElementById('qePhotoDate').value || new Date().toISOString().split('T')[0];
  const note = document.getElementById('qePhotoNote').value.trim();
  const btn = document.getElementById('btnUploadPhoto');

  btn.disabled = true;
  btn.textContent = '上传中...';
  let uploaded = 0;

  try {
    for (const type of types) {
      const file = selectedPhotoFiles[type];
      if (!file) continue;

      const thumbnail = await generateThumbnail(file);
      await addPhoto({
        data: file,
        thumbnail,
        date,
        note,
        type
      });
      uploaded++;
    }

    showToast(`已保存 ${uploaded} 张照片`);
    selectedPhotoFiles = { left: null, front: null, right: null };
    document.querySelectorAll('.skin-photo-input').forEach(input => { input.value = ''; });
    document.getElementById('photoFileNameLeft').textContent = '未选择';
    document.getElementById('photoFileNameFront').textContent = '未选择';
    document.getElementById('photoFileNameRight').textContent = '未选择';
    document.getElementById('qePhotoNote').value = '';
    renderPhotoGallery();
  } catch (err) {
    showToast(`保存失败：${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '上传全部';
  }
}

async function renderPhotoGallery() {
  const container = document.getElementById('photoGallery');
  try {
    const photos = await getAllPhotos();
    if (!photos || photos.length === 0) {
      container.innerHTML = '<p class="empty-hint">还没有照片，拍摄第一张自拍吧！</p>';
      return;
    }

    const sorted = photos.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const isBlurred = !document.getElementById('btnToggleBlur').classList.contains('active');
    const oldUrls = container.querySelectorAll('img[data-object-url]');
    oldUrls.forEach(img => {
      if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
    });

    container.innerHTML = sorted.map(p => {
      const thumbUrl = URL.createObjectURL(p.thumbnail);
      const cls = isBlurred ? 'photo-card blurred' : 'photo-card';
      const typeLabel = PHOTO_TYPE_SHORT[p.type] || '';
      const typeCls = p.type ? `type-${p.type}` : '';
      return `
        <div class="${cls}" data-photo-id="${p.id}" onclick="viewPhoto(${p.id})">
          <img class="photo-card-thumb" src="${thumbUrl}" alt="photo" loading="lazy" data-object-url="${thumbUrl}">
          <div class="photo-card-overlay">
            <span class="photo-card-overlay-icon">👁️</span>
            <span class="photo-card-overlay-text">点击查看</span>
          </div>
          ${typeLabel ? `<div class="photo-card-type ${typeCls}">${typeLabel}</div>` : ''}
          <div class="photo-card-date">${p.date}</div>
          ${p.note ? `<div class="photo-card-note">${escapeHtml(p.note)}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="empty-hint">加载照片失败</p>';
  }
}

function togglePhotoBlur() {
  const btn = document.getElementById('btnToggleBlur');
  btn.classList.toggle('active');
  if (btn.classList.contains('active')) {
    btn.textContent = '🙈 隐藏全部';
    document.querySelectorAll('.photo-card').forEach(card => {
      card.classList.remove('blurred');
    });
  } else {
    btn.textContent = '👁️ 显示全部';
    document.querySelectorAll('.photo-card').forEach(card => {
      card.classList.add('blurred');
    });
  }
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片转码失败'));
    reader.readAsDataURL(blob);
  });
}

async function loadSkinPhotosForDate(dateStr) {
  const photos = await getAllPhotos();
  const matched = photos.filter(p => p.date === dateStr);
  const byType = { left: null, front: null, right: null };
  matched.forEach(p => {
    if (p.type && byType[p.type] == null) byType[p.type] = p;
  });

  const ordered = ['left', 'front', 'right'];
  const result = [];
  for (const type of ordered) {
    if (!byType[type]) continue;
    const dataUrl = await blobToDataUrl(byType[type].data);
    result.push({
      ...byType[type],
      dataUrl
    });
  }
  return result;
}

let currentViewPhotoId = null;

async function viewPhoto(id) {
  try {
    const photos = await getAllPhotos();
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    currentViewPhotoId = id;
    const viewer = document.getElementById('photoViewer');
    const img = document.getElementById('photoViewerImg');
    const info = document.getElementById('photoViewerInfo');
    const title = document.getElementById('photoViewerTitle');

    const url = URL.createObjectURL(photo.data);
    img.src = url;
    const typeLabel = PHOTO_TYPE_LABELS[photo.type] || '';
    title.textContent = photo.date + (typeLabel ? ' ' + typeLabel : '') + (photo.note ? ' — ' + photo.note : '');
    info.textContent = `记录日期：${photo.date}` + (typeLabel ? ' · ' + typeLabel : '') + (photo.note ? ' · 备注：' + photo.note : '');

    viewer.style.display = 'flex';
  } catch (err) {
    showToast('加载照片失败');
  }
}

function closePhotoViewer() {
  document.getElementById('photoViewer').style.display = 'none';
  const img = document.getElementById('photoViewerImg');
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = '';
  currentViewPhotoId = null;
}

async function handleDeletePhotoViewer() {
  if (!currentViewPhotoId) return;
  if (!confirm('确定要删除这张照片吗？此操作不可撤销。')) return;
  try {
    await deletePhoto(currentViewPhotoId);
    showToast('照片已删除');
    closePhotoViewer();
    renderPhotoGallery();
  } catch (err) {
    showToast(`删除失败：${err.message}`);
  }
}

function handleDownloadPhoto() {
  const img = document.getElementById('photoViewerImg');
  if (!img.src) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = `selfie_${document.getElementById('photoViewerTitle').textContent.replace(/[\/:*?"<>|]/g, '_')}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===== Skincare AI =====
function updateSkinAiStatus() {
  const statusEl = document.getElementById('skinAiStatus');
  const statusText = document.getElementById('skinAiStatusText');
  const askBtn = document.getElementById('btnAskSkinAI');
  const questionInput = document.getElementById('skinAiQuestion');

  if (hasApiKey()) {
    statusEl.className = 'ai-status configured';
    statusText.textContent = '✅ 已配置护肤 API Key，可以开始提问';
    if (askBtn) askBtn.disabled = false;
    if (questionInput) questionInput.disabled = false;
  } else {
    statusEl.className = 'ai-status unconfigured';
    statusText.textContent = '🔒 先去设置里配置护肤 API Key，才能获取建议';
    if (askBtn) askBtn.disabled = true;
    if (questionInput) questionInput.disabled = true;
  }

  updateSkinChatHistoryStatus();
}

function updateSkinPhotoAnalysisStatus() {
}

function updateSkinChatHistoryStatus() {
  const history = getChatHistory(SKINCARE_CHAT_HISTORY_KEY);
  const btn = document.getElementById('btnClearSkinHistory');
  if (btn) {
    if (history.length > 0) {
      btn.textContent = `🗑️ 清除对话历史（${history.length}条）`;
      btn.style.display = '';
    } else {
      btn.textContent = '🗑️ 清除对话历史';
      btn.style.display = 'none';
    }
  }
}

async function handleAskSkinAI() {
  if (!getSkincareApiKey()) {
    showToast('请先在 ⚙️ 设置中配置护肤 API Key');
    return;
  }

  const question = document.getElementById('skinAiQuestion').value.trim();
  const responseEl = document.getElementById('skinAiResponse');
  const responseContent = document.getElementById('skinAiResponseContent');
  const loadingEl = document.getElementById('skinAiLoading');

  if (!question) {
    showToast('请输入你的护肤问题');
    return;
  }

  responseEl.style.display = 'none';
  loadingEl.style.display = 'flex';

  try {
    const allRecords = window.__app ? window.__app.allRecords || await getAllRecords() : await getAllRecords();
    const advice = await getSkincareAdvice(allRecords, question);
    responseContent.textContent = advice;
    responseEl.style.display = 'block';
    document.getElementById('skinAiQuestion').value = '';
    updateSkinChatHistoryStatus();
  } catch (err) {
    responseContent.textContent = `❌ 获取建议失败：${err.message}`;
    responseEl.style.display = 'block';
  } finally {
    loadingEl.style.display = 'none';
  }
}

function handleClearSkinHistory() {
  if (confirm('确定要清除所有护肤 AI 对话历史吗？AI 将不再记得之前的护肤话题。')) {
    clearChatHistory(SKINCARE_CHAT_HISTORY_KEY);
    showToast('护肤对话历史已清除');
    updateSkinChatHistoryStatus();
  }
}

// ===== Food Suggestion Section =====
function renderFoodSuggestions(records) {
  try {
  const section = document.getElementById('foodSuggestSection');
  const grid = document.getElementById('foodSuggestGrid');
  if (!section || !grid) return;

  const today = new Date().toISOString().split('T')[0];
  const coverage = typeof getMicroCoverage === 'function' ? getMicroCoverage(records, today) : {};

  // Find deficiencies (coverage < 0.8), sorted by worst first
  const deficient = [];
  for (const k of MICRO_KEYS) {
    const cov = coverage[k] || 0;
    if (cov < 0.8) {
      const info = MICRONUTRIENT_RDA[k];
      const suggestions = typeof MICRO_FOOD_SUGGESTIONS !== 'undefined' ? (MICRO_FOOD_SUGGESTIONS[k] || []) : [];
      deficient.push({ key: k, name: info.name, cov, suggestions });
    }
  }
  deficient.sort((a, b) => a.cov - b.cov);

  if (deficient.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  // Food cards
  grid.innerHTML = deficient.slice(0, 6).map(d => `
    <div class="food-suggest-card">
      <div class="food-suggest-target">
        <span class="food-suggest-name">${d.name}</span>
        <span class="food-suggest-gap">当前 ${Math.round(d.cov * 100)}%</span>
      </div>
      <div class="food-suggest-items">
        ${d.suggestions.slice(0, 5).map(s => `
          <div class="food-suggest-item">
            <span class="food-suggest-food">🍽️ ${s.food}</span>
            <span class="food-suggest-amount">${s.amount}</span>
            <span class="food-suggest-contrib">${s.contributes}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Top picks — best overall foods that cover multiple deficiencies
  const topPicksPanel = document.getElementById('foodTopPicks');
  const topPicksList = document.getElementById('foodTopPicksList');
  const deficientKeys = deficient.map(d => d.key);
  if (topPicksPanel && topPicksList && typeof getTopFoodPicks === 'function') {
    const picks = getTopFoodPicks(deficientKeys);
    if (picks.length > 0) {
      topPicksPanel.style.display = 'block';
      topPicksList.innerHTML = picks.map((p, i) => {
        const coverNames = p.covers.map(k => MICRONUTRIENT_RDA[k] ? MICRONUTRIENT_RDA[k].name : k);
        return `
          <div class="food-top-pick-item">
            <span class="food-top-pick-rank">${i + 1}</span>
            <span class="food-top-pick-food">${p.food}</span>
            <span class="food-top-pick-covers">覆盖 ${p.coversCount} 项：${coverNames.join('、')}</span>
          </div>
        `;
      }).join('');
    } else {
      topPicksPanel.style.display = 'none';
    }
  }

  // Deficiency warnings — individual nutrient alerts with consequences
  const warnPanel = document.getElementById('deficiencyWarnings');
  const warnList = document.getElementById('deficiencyWarningsList');
  if (warnPanel && warnList) {
    // Build consecutive-days tracker
    const today = new Date().toISOString().split('T')[0];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const recent = (records || []).filter(r => r.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));

    const warnItems = [];
    for (const d of deficient.slice(0, 8)) {
      // Count consecutive days below 80% for this micro
      let maxConsecutive = 0, current = 0;
      for (const r of recent) {
        const cov = typeof getMicroCoverage === 'function' ? (getMicroCoverage([r], r.date)[d.key] || 0) : 0;
        if (cov < 0.8) { current++; if (current > maxConsecutive) maxConsecutive = current; }
        else { current = 0; }
      }
      if (maxConsecutive >= 1) {
        const consequence = typeof MICRO_CONSEQUENCES !== 'undefined' ? (MICRO_CONSEQUENCES[d.key] || '') : '';
        warnItems.push({ ...d, consecutiveDays: maxConsecutive, consequence });
      }
    }

    if (warnItems.length > 0) {
      warnPanel.style.display = 'block';
      warnList.innerHTML = warnItems.map(w => `
        <div class="def-warn-item">
          <span class="def-warn-icon">${w.consecutiveDays >= 14 ? '🔴' : w.consecutiveDays >= 7 ? '🟡' : '🟠'}</span>
          <div class="def-warn-content">
            <span class="def-warn-title">${w.name} 缺乏 · 已持续 ${w.consecutiveDays} 天 · 当前覆盖率 ${Math.round(w.cov * 100)}%</span>
            <span class="def-warn-consequence">⚠ ${w.consequence}</span>
          </div>
        </div>
      `).join('');
    } else {
      warnPanel.style.display = 'none';
    }
  }

  // Health assessment — holistic body evaluation
  const assessPanel = document.getElementById('healthAssessment');
  const assessBody = document.getElementById('healthAssessmentBody');
  if (assessPanel && assessBody && typeof getHealthAssessment === 'function') {
    const deficientMap = {};
    deficient.forEach(d => { deficientMap[d.key] = true; });
    const assessments = getHealthAssessment(deficientMap);
    if (assessments.length > 0) {
      assessPanel.style.display = 'block';
      assessBody.innerHTML = `
        <p class="health-assess-intro">根据你目前的微量营养素缺乏情况，综合分析如下：</p>
        ${assessments.map((a, i) => `
          <div class="health-assess-item">
            <span class="health-assess-rank">${a.level === 'high' ? '🔴' : '🟡'} ${a.system}</span>
            <span class="health-assess-missing">缺乏：${a.lacking.map(k => MICRONUTRIENT_RDA[k] ? MICRONUTRIENT_RDA[k].name : k).join('、')}</span>
            <span class="health-assess-desc">${a.desc}</span>
          </div>
        `).join('')}
        <p class="health-assess-tip">💡 上述食物建议中的「综合最推荐」食物可同时覆盖多个系统，优先选择。</p>
      `;
    } else {
      assessPanel.style.display = 'none';
    }
    // Recent picks — based on 7-day average deficiencies
    const recentPanel = document.getElementById('foodRecentPicks');
    const recentList = document.getElementById('foodRecentPicksList');
    if (recentPanel && recentList && typeof getTopFoodPicks === 'function' && typeof getMicroCoverageForRange === 'function') {
      const cov7d = getMicroCoverageForRange(records || [], 7);
      const recentDeficient = [];
      for (const k of MICRO_KEYS) {
        const vals = (cov7d.series[k] || []).filter(v => v != null && v > 0);
        const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        if (avg < 0.8) { recentDeficient.push({ key: k, avg }); }
      }
      recentDeficient.sort((a, b) => a.avg - b.avg);
      const recentKeys = recentDeficient.map(d => d.key);
      if (recentKeys.length > 0) {
        const recentPicks = getTopFoodPicks(recentKeys);
        if (recentPicks.length > 0) {
          recentPanel.style.display = 'block';
          recentList.innerHTML = recentPicks.map((p, i) => {
            const coverNames = p.covers.map(k => MICRONUTRIENT_RDA[k] ? MICRONUTRIENT_RDA[k].name : k);
            return `<div class="food-top-pick-item"><span class="food-top-pick-rank rank-recent">${i + 1}</span><span class="food-top-pick-food">${p.food}</span><span class="food-top-pick-covers">覆盖 ${p.coversCount} 项：${coverNames.join('、')}</span></div>`;
          }).join('');
        } else { recentPanel.style.display = 'none'; }
      } else { recentPanel.style.display = 'none'; }
    }
  }
  } catch(e) {
    console.error('renderFoodSuggestions:', e);
  }
}

// ===== Micronutrient UI =====

function renderMicroGrid(coverage, records) {
  const grid = document.getElementById('microGrid');
  if (!grid) { console.warn('renderMicroGrid: #microGrid not found'); return; }

  const okList = [];
  const warnList = [];
  const today = new Date().toISOString().split('T')[0];

  MICRO_KEYS.forEach(k => {
    const info = MICRONUTRIENT_RDA[k];
    const cov = coverage[k] != null ? coverage[k] : 0;
    const intakeVal = typeof getDayMicroTotals === 'function'
      ? (getDayMicroTotals(records || [], today)[k] || 0)
      : 0;
    const fn = info.fn || '';
    const suggestion = typeof MICRO_SUGGESTIONS !== 'undefined' ? (MICRO_SUGGESTIONS[k] || '') : '';

    const card = `
      <div class="micro-item-card">
        <div class="micro-item-name">${info.name}</div>
        <div class="micro-item-intake">${intakeVal.toFixed(1)} / ${info.rda} ${info.unit}</div>
        <div class="micro-item-fn">💡 ${fn}</div>
        <div class="micro-item-source">🥗 ${suggestion}</div>
      </div>
    `;

    if (cov >= 0.8) {
      okList.push(card);
    } else {
      warnList.push(card);
    }
  });

  grid.innerHTML = `
    <div class="micro-col micro-col-ok">
      <div class="micro-col-title">✅ 已达标（${okList.length}项）</div>
      ${okList.join('') || '<div class="micro-item-card" style="color:#999">暂无达标项</div>'}
    </div>
    <div class="micro-col micro-col-warn">
      <div class="micro-col-title">⚠️ 未达标（${warnList.length}项）</div>
      ${warnList.join('') || '<div class="micro-item-card" style="color:#999">暂无未达标项</div>'}
    </div>
  `;
}

function updateMicroTab(records) {
  try {
  const today = new Date().toISOString().split('T')[0];
  const coverage = typeof getMicroCoverage === 'function' ? getMicroCoverage(records, today) : {};

  // Summary
  const summaryEl = document.getElementById('microSummaryText');
  if (summaryEl) {
    let okCount = 0, warnCount = 0;
    for (const k of MICRO_KEYS) {
      if ((coverage[k] || 0) >= 0.8) okCount++;
      else warnCount++;
    }
    summaryEl.innerHTML = warnCount === 0
      ? '👍 全部 20 项微量营养素均已达标'
      : `<span class="micro-ok">✅ ${okCount} 项已达标</span>　<span class="micro-warn">⚠️ ${warnCount} 项未达标</span>`;
  }

  renderMicroGrid(coverage, records);
  } catch(e) {
    console.error('updateMicroTab error:', e);
    const grid = document.getElementById('microGrid');
    if (grid) grid.innerHTML = '<p style="color:red">渲染出错：' + e.message + '</p>';
  }
}
