// ===== Weight Chart (unchanged) =====
let weightChart = null;

function initChart(ctx) {
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: '体重 (kg)',
        data: [],
        borderColor: '#2ecc71',
        backgroundColor: 'rgba(46, 204, 113, 0.08)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#2ecc71',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: true,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2c3e50',
          titleFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 13 },
          bodyFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: ctx => `体重: ${ctx.parsed.y.toFixed(2)} kg`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
            color: '#95a5a6',
            maxTicksLimit: 12
          }
        },
        y: {
          grid: { color: '#ecf0f1' },
          ticks: {
            font: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
            color: '#95a5a6',
            stepSize: 0.01,
            callback: v => parseFloat(v.toFixed(2)) + ' kg'
          },
          beginAtZero: false
        }
      }
    }
  });
}

function aggregateByDate(records) {
  const map = new Map();
  records.forEach(r => {
    if (r.weight == null || r.weight <= 0) return;
    if (!map.has(r.date)) {
      map.set(r.date, []);
    }
    map.get(r.date).push(r.weight);
  });
  const result = [];
  map.forEach((weights, date) => {
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
    result.push({ date, weight: Math.round(avg * 100) / 100, count: weights.length });
  });
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

function updateChart(allRecords, days) {
  if (!weightChart) return;

  let filtered = allRecords;
  let startDate;

  if (days && days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    startDate = new Date(cutoff);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    filtered = allRecords.filter(r => r.date >= cutoffStr);
  }

  const aggregated = aggregateByDate(filtered);
  const dataMap = new Map();
  aggregated.forEach(a => dataMap.set(a.date, a.weight));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!startDate) {
    const allDates = aggregated.map(a => a.date).sort();
    startDate = allDates.length > 0 ? new Date(allDates[0] + 'T00:00:00') : new Date(today);
  }

  const dates = [];
  const d = new Date(startDate);
  while (d <= today) {
    dates.push(fmtDate(d));
    d.setDate(d.getDate() + 1);
  }

  const data = dates.map(date => dataMap.get(date) ?? null);

  weightChart.data.labels = dates;
  weightChart.data.datasets[0].data = data;
  weightChart.update('none');
}

function destroyChart() {
  if (weightChart) {
    weightChart.destroy();
    weightChart = null;
  }
}

// ===== Shared Utilities =====

function timeToDecimal(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}

function decimalToTimeLabel(d) {
  const h = Math.floor(d);
  const m = Math.round((d - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatBedTimeLabel(d) {
  if (d >= 24) return decimalToTimeLabel(d - 24) + '(次日)';
  return decimalToTimeLabel(d);
}

function formatSleepHours(h) {
  if (!h || h <= 0) return '--';
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function filterByDays(records, days) {
  if (!days || days <= 0) return records;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return records.filter(r => r.date >= cutoffStr);
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getSpanDateRange(span, offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setDate(today.getDate() - offset);
  const start = new Date(end);
  start.setDate(end.getDate() - span + 1);

  const dates = [];
  const d = new Date(start);
  while (d <= end) {
    dates.push(fmtDate(d));
    d.setDate(d.getDate() + 1);
  }

  return {
    start: fmtDate(start),
    end: fmtDate(end),
    dates,
    label: `${fmtDate(start)} ~ ${fmtDate(end)}`
  };
}

// ===== Shared Average Label Plugin =====
const avgLabelPlugin = {
  id: 'avgLabel',
  afterDraw(chart) {
    const ds = chart.data.datasets[1];
    if (!ds || !ds.data || ds.data.length === 0) return;
    const avg = ds.data[0];
    if (avg === null || avg === undefined || avg === 0) return;
    const label = ds.label || '';
    if (label === '平均') return;

    const ctx = chart.ctx;
    const chartArea = chart.chartArea;

    ctx.save();
    ctx.font = 'bold 12px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = ds.borderColor || '#999';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, chartArea.left + 6, chartArea.top + 4);
    ctx.restore();
  }
};

// ===== Pagination State =====
let calOffset = 0;
let bedOffset = 0;
let wakeOffset = 0;
let sleepDurOffset = 0;
let balOffset = 0;

// ===== Weight Interpolation =====
function interpolateWeight(allRecords, date) {
  const weightRecords = allRecords
    .filter(r => r.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (weightRecords.length === 0) return 0;

  let before = null, after = null;
  for (const wr of weightRecords) {
    if (wr.date < date) before = wr;
    else if (wr.date > date) { after = wr; break; }
  }

  if (before && after) {
    return (before.weight + after.weight) / 2;
  } else if (before) {
    return before.weight;
  } else {
    return after.weight;
  }
}

// ===== Calorie Chart =====
let calorieChart = null;

function initCalorieChart(ctx) {
  calorieChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: '运动消耗 (kcal)',
          data: [],
          backgroundColor: '#ff6b6b',
          borderRadius: 6,
          borderSkipped: false,
          order: 0
        },
        {
          type: 'line',
          label: '平均',
          data: [],
          borderColor: '#e74c3c',
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 1
        }
      ]
    },
    plugins: [avgLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2c3e50',
          titleFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 13 },
          bodyFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 1) return `平均消耗: ${ctx.parsed.y} kcal`;
              return `运动消耗: ${ctx.parsed.y} kcal`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
            color: '#95a5a6',
            maxTicksLimit: 12
          }
        },
        y: {
          min: 0,
          grid: { color: '#ecf0f1' },
          ticks: {
            font: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
            color: '#95a5a6',
            callback: v => v + ' kcal'
          }
        }
      }
    }
  });
}

function updateCalorieChart(records, span, offset) {
  if (!calorieChart) return;
  const range = getSpanDateRange(span, offset);
  const dataMap = new Map();
  records.forEach(r => {
    const exSum = (r.exercises || []).reduce((s, e) => s + (e.calories || 0), 0);
    dataMap.set(r.date, exSum);
  });

  const data = range.dates.map(d => dataMap.get(d) || 0);
  const nonZero = data.filter(v => v > 0);
  const avg = nonZero.length > 0 ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;

  calorieChart.data.labels = range.dates;
  calorieChart.data.datasets[0].data = data;
  calorieChart.data.datasets[1].data = range.dates.map(() => avg);
  calorieChart.data.datasets[1].label = avg > 0 ? `平均 ${avg} kcal` : '平均';
  calorieChart.update('none');
}

// ===== Bed Time Chart =====
let bedTimeChart = null;

function initBedTimeChart(ctx) {
  bedTimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: '入睡时间',
          data: [],
          borderColor: '#8e44ad',
          backgroundColor: 'rgba(142, 68, 173, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#8e44ad',
          tension: 0.3,
          fill: true,
          spanGaps: true,
          order: 0
        },
        {
          label: '平均',
          data: [],
          borderColor: '#6c3483',
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          spanGaps: true,
          fill: false,
          order: 1
        }
      ]
    },
    plugins: [avgLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2c3e50',
          titleFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
          bodyFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 10 },
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              if (ctx.datasetIndex === 1) return `平均入睡: ${decimalToTimeLabel(v)}`;
              return `入睡: ${decimalToTimeLabel(v)}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
        y: {
          min: 20,
          max: 26,
          ticks: {
            font: { size: 10 },
            stepSize: 1,
            callback: v => {
              if (v >= 24) return decimalToTimeLabel(v - 24) + '(次日)';
              return decimalToTimeLabel(v);
            }
          },
          grid: { color: '#ecf0f1' }
        }
      }
    }
  });
}

function getFirstBedTime(record) {
  if (record.sleepSegments && record.sleepSegments.length > 0) {
    const first = record.sleepSegments.find(s => s.bedTime);
    return first ? first.bedTime : record.bedTime;
  }
  return record.bedTime;
}

function getFirstWakeTime(record) {
  if (record.sleepSegments && record.sleepSegments.length > 0) {
    const first = record.sleepSegments.find(s => s.wakeTime);
    return first ? first.wakeTime : record.wakeTime;
  }
  return record.wakeTime;
}

function updateBedTimeChart(records, span, offset) {
  if (!bedTimeChart) return;
  const range = getSpanDateRange(span, offset);
  const dataMap = new Map();
  records.forEach(r => {
    const bt = getFirstBedTime(r);
    if (bt) {
      let decimal = timeToDecimal(bt);
      // Normalize after-midnight bed times to the same scale as evening times.
      // "02:00" → 26.0 so it's on the same scale as "23:00" → 23.0 (only 3h apart, not 21h).
      if (decimal !== null && decimal < 18) decimal += 24;
      dataMap.set(r.date, decimal);
    }
  });

  const data = range.dates.map(d => dataMap.has(d) ? dataMap.get(d) : null);
  const valid = data.filter(v => v !== null);
  const avg = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null;

  bedTimeChart.data.labels = range.dates;
  bedTimeChart.data.datasets[0].data = data;
  bedTimeChart.data.datasets[1].data = range.dates.map(() => avg);
  bedTimeChart.data.datasets[1].label = avg !== null ? `平均 ${formatBedTimeLabel(avg)}` : '平均';
  bedTimeChart.update('none');
}

// ===== Wake Time Chart =====
let wakeTimeChart = null;

function initWakeTimeChart(ctx) {
  wakeTimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: '醒来时间',
          data: [],
          borderColor: '#e67e22',
          backgroundColor: 'rgba(230, 126, 34, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#e67e22',
          tension: 0.3,
          fill: true,
          spanGaps: true,
          order: 0
        },
        {
          label: '平均',
          data: [],
          borderColor: '#d35400',
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          spanGaps: true,
          fill: false,
          order: 1
        }
      ]
    },
    plugins: [avgLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2c3e50',
          titleFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
          bodyFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 10 },
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              if (ctx.datasetIndex === 1) return `平均醒来: ${decimalToTimeLabel(v)}`;
              return `醒来: ${decimalToTimeLabel(v)}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
        y: {
          min: 4,
          max: 12,
          ticks: { font: { size: 10 }, stepSize: 1, callback: v => decimalToTimeLabel(v) },
          grid: { color: '#ecf0f1' }
        }
      }
    }
  });
}

function updateWakeTimeChart(records, span, offset) {
  if (!wakeTimeChart) return;
  const range = getSpanDateRange(span, offset);
  const dataMap = new Map();
  records.forEach(r => {
    const wt = getFirstWakeTime(r);
    if (wt) dataMap.set(r.date, timeToDecimal(wt));
  });

  const data = range.dates.map(d => dataMap.has(d) ? dataMap.get(d) : null);
  const valid = data.filter(v => v !== null);
  const avg = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null;

  wakeTimeChart.data.labels = range.dates;
  wakeTimeChart.data.datasets[0].data = data;
  wakeTimeChart.data.datasets[1].data = range.dates.map(() => avg);
  wakeTimeChart.data.datasets[1].label = avg !== null ? `平均 ${decimalToTimeLabel(avg)}` : '平均';
  wakeTimeChart.update('none');
}

// ===== Sleep Duration Chart =====
let sleepDurChart = null;

function initSleepDurChart(ctx) {
  sleepDurChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: '睡眠时长',
          data: [],
          backgroundColor: '#3498db',
          borderRadius: 6,
          borderSkipped: false,
          order: 0
        },
        {
          type: 'line',
          label: '平均',
          data: [],
          borderColor: '#2980b9',
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          spanGaps: true,
          fill: false,
          order: 1
        }
      ]
    },
    plugins: [avgLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2c3e50',
          titleFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
          bodyFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 10 },
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 1) return `平均时长: ${formatSleepHours(ctx.parsed.y)}`;
              return `睡眠: ${formatSleepHours(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
        y: {
          min: 0,
          ticks: { font: { size: 10 }, callback: v => formatSleepHours(v) },
          grid: { color: '#ecf0f1' }
        }
      }
    }
  });
}

function updateSleepDurChart(records, span, offset) {
  if (!sleepDurChart) return;
  const range = getSpanDateRange(span, offset);
  const dataMap = new Map();
  records.forEach(r => {
    const total = computeTotalSleep(r);
    if (total > 0) dataMap.set(r.date, total);
  });

  const data = range.dates.map(d => dataMap.has(d) ? dataMap.get(d) : null);
  const valid = data.filter(v => v !== null && v > 0);
  const avg = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null;

  sleepDurChart.data.labels = range.dates;
  sleepDurChart.data.datasets[0].data = data;
  sleepDurChart.data.datasets[1].data = range.dates.map(() => avg);
  sleepDurChart.data.datasets[1].label = avg !== null ? `平均 ${formatSleepHours(avg)}` : '平均';
  sleepDurChart.update('none');
}

function updateAllSleepCharts(records) {
  const bedSpan = parseInt(document.querySelector('.btn-sleep-range[data-chart="bed"].active')?.dataset?.days || 7);
  const wakeSpan = parseInt(document.querySelector('.btn-sleep-range[data-chart="wake"].active')?.dataset?.days || 7);
  const durSpan = parseInt(document.querySelector('.btn-sleep-range[data-chart="sleepDur"].active')?.dataset?.days || 7);
  updateBedTimeChart(records, bedSpan, bedOffset);
  updateWakeTimeChart(records, wakeSpan, wakeOffset);
  updateSleepDurChart(records, durSpan, sleepDurOffset);
}

// ===== Zero Line Plugin =====
const zeroLinePlugin = {
  id: 'zeroLine',
  afterDraw(chart) {
    const yScale = chart.scales.y;
    if (yScale.min >= 0 || yScale.max <= 0) return;
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    const y = yScale.getPixelForValue(0);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
  }
};

// ===== Balance Average Label Plugin =====
const balAvgLabelPlugin = {
  id: 'balAvgLabel',
  afterDraw(chart) {
    const avg = chart._balAvg;
    if (avg === null || avg === undefined) return;
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    const label = `平均 ${avg > 0 ? '+' : ''}${avg} kcal`;

    ctx.save();
    ctx.font = 'bold 12px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#7f8c8d';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, chartArea.left + 6, chartArea.top + 4);
    ctx.restore();
  }
};

// ===== Calorie Balance Chart =====
let calBalanceChart = null;

function initCalBalanceChart(ctx) {
  calBalanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: '热量平衡 (kcal)',
          data: [],
          backgroundColor: ctx => {
            const v = ctx.raw ?? 0;
            return v > 0 ? 'rgba(255, 107, 107, 0.7)' : v < 0 ? 'rgba(46, 204, 113, 0.7)' : 'rgba(180, 180, 180, 0.5)';
          },
          borderRadius: 6,
          borderSkipped: false,
          order: 0
        }
      ]
    },
    plugins: [zeroLinePlugin, balAvgLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2c3e50',
          titleFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 13 },
          bodyFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              return v < 0 ? `热量缺口: ${v} kcal` : v > 0 ? `热量盈余: +${v} kcal` : `能量平衡: 0 kcal`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
            color: '#95a5a6',
            maxTicksLimit: 12
          }
        },
        y: {
          grid: { color: '#ecf0f1' },
          ticks: {
            font: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 11 },
            color: '#95a5a6',
            callback: v => (v > 0 ? '+' : '') + Math.round(v) + ' kcal'
          }
        }
      }
    }
  });
}

function updateCalBalanceChart(records, span, offset) {
  if (!calBalanceChart) return;
  const range = getSpanDateRange(span, offset);
  const dataMap = new Map();
  records.forEach(r => {
    const dietSum = (r.diet || []).reduce((s, d) => s + (d.calories || 0), 0);
    const exSum = (r.exercises || []).reduce((s, e) => s + (e.calories || 0), 0);
    const weight = r.weight > 0 ? r.weight : interpolateWeight(records, r.date);
    const bmr = weight > 0 ? Math.round(calculateBMR(weight)) : 0;
    const balance = Math.round(bmr + exSum - dietSum);
    dataMap.set(r.date, -balance);
  });

  const data = range.dates.map(d => dataMap.has(d) ? dataMap.get(d) : null);
  const valid = data.filter(v => v !== null);
  const avg = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;

  calBalanceChart.data.labels = range.dates;
  calBalanceChart.data.datasets[0].data = data;
  calBalanceChart._balAvg = avg;
  calBalanceChart.update('none');
}

function updateBalRangeLabel() {
  const span = parseInt(document.querySelector('.btn-bal-range.active')?.dataset?.days || 7);
  const range = getSpanDateRange(span, balOffset);
  document.getElementById('balRangeLabel').textContent = range.label;
  document.getElementById('balNext').disabled = balOffset <= 0;
  document.getElementById('balNextLarge').disabled = balOffset <= 0;
}

// ===== Chart Fullscreen =====
let fullscreenChart = null;
let fullscreenPanState = null;
let fullscreenInitRange = null; // { xMin, xMax, yMin, yMax }

const FULLSCREEN_TITLES = {
  bed: '🌙 入睡时间',
  wake: '☀️ 醒来时间',
  weight: '📈 体重变化曲线',
  calBalance: '⚖️ 热量平衡'
};

function openChartFullscreen(type) {
  const overlay = document.getElementById('chartFullscreen');
  const title = document.getElementById('chartFullscreenTitle');
  const canvas = document.getElementById('chartFullscreenCanvas');
  const sourceChart = type === 'weight' ? weightChart : (type === 'bed' ? bedTimeChart : (type === 'wake' ? wakeTimeChart : calBalanceChart));
  if (!sourceChart) return;

  if (fullscreenChart) {
    fullscreenChart.destroy();
    fullscreenChart = null;
  }

  title.textContent = FULLSCREEN_TITLES[type] || '';

  overlay.style.display = 'flex';
  overlay.offsetHeight;

  const ctx = canvas.getContext('2d');
  const srcData = sourceChart.data;

  // Compute auto ranges from data
  const dataVals = srcData.datasets[0].data.filter(v => v !== null && v !== undefined);
  let yMin, yMax;
  if (dataVals.length > 0) {
    const dMin = Math.min(...dataVals);
    const dMax = Math.max(...dataVals);
    if (type === 'calBalance') {
      const pad = Math.max((dMax - dMin) * 0.3, 100);
      yMin = Math.floor((dMin - pad) / 100) * 100;
      yMax = Math.ceil((dMax + pad) / 100) * 100;
      if (yMax - yMin < 400) { yMin -= 200; yMax += 200; }
    } else {
      const pad = Math.max((dMax - dMin) * 0.25, type === 'weight' ? 1 : 1);
      yMin = type === 'weight' ? Math.floor((dMin - pad) * 2) / 2 : Math.floor(dMin - pad);
      yMax = type === 'weight' ? Math.ceil((dMax + pad) * 2) / 2 : Math.ceil(dMax + pad);
      if (yMax - yMin < (type === 'weight' ? 2 : 3)) { yMin -= 1; yMax += 1; }
    }
  } else {
    if (type === 'bed') { yMin = 20; yMax = 26; }
    else if (type === 'wake') { yMin = 4; yMax = 12; }
    else if (type === 'calBalance') { yMin = -500; yMax = 500; }
    else { yMin = 50; yMax = 100; }
  }

  const yTickCb = type === 'bed'
    ? v => { if (v >= 24) return decimalToTimeLabel(v - 24) + '(次日)'; return decimalToTimeLabel(v); }
    : type === 'wake'
      ? v => decimalToTimeLabel(v)
      : type === 'calBalance'
        ? v => (v > 0 ? '+' : '') + Math.round(v) + ' kcal'
        : v => parseFloat(v.toFixed(2)) + ' kg';

  // Tooltip callback
  const tooltipLabelCb = type === 'weight'
    ? ctx => { const v = ctx.parsed.y; return `体重: ${v.toFixed(2)} kg`; }
    : type === 'bed'
      ? ctx => {
          const v = ctx.parsed.y;
          if (ctx.datasetIndex === 1) return `平均入睡: ${formatBedTimeLabel(v)}`;
          return `入睡: ${formatBedTimeLabel(v)}`;
        }
      : type === 'wake'
        ? ctx => {
            const v = ctx.parsed.y;
            if (ctx.datasetIndex === 1) return `平均醒来: ${decimalToTimeLabel(v)}`;
            return `醒来: ${decimalToTimeLabel(v)}`;
          }
        : ctx => {
            const v = ctx.parsed.y;
            if (ctx.datasetIndex === 1) return `平均: ${v > 0 ? '+' : ''}${v} kcal`;
            return v < 0 ? `热量缺口: ${v} kcal` : v > 0 ? `热量盈余: +${v} kcal` : `能量平衡: 0 kcal`;
          };

  const isBalance = type === 'calBalance';
  const hasAvgLine = type !== 'weight';
  const datasets = [
    isBalance ? {
      label: srcData.datasets[0].label,
      data: [...srcData.datasets[0].data],
      backgroundColor: ctx => {
        const v = ctx.raw ?? 0;
        return v > 0 ? 'rgba(255, 107, 107, 0.7)' : v < 0 ? 'rgba(46, 204, 113, 0.7)' : 'rgba(180, 180, 180, 0.5)';
      },
      borderRadius: 6,
      borderSkipped: false,
      order: 0
    } : {
      label: srcData.datasets[0].label,
      data: [...srcData.datasets[0].data],
      borderColor: srcData.datasets[0].borderColor,
      backgroundColor: srcData.datasets[0].backgroundColor,
      borderWidth: 2.5,
      pointRadius: 5,
      pointBackgroundColor: srcData.datasets[0].borderColor,
      tension: 0.3,
      fill: true,
      spanGaps: true,
      order: 0
    }
  ];
  if (hasAvgLine && srcData.datasets.length > 1) {
    datasets.push({
      label: srcData.datasets[1].label,
      data: [...srcData.datasets[1].data],
      borderColor: srcData.datasets[1].borderColor,
      backgroundColor: 'transparent',
      borderDash: [6, 3],
      borderWidth: 2,
      pointRadius: 0,
      spanGaps: true,
      fill: false,
      order: 1
    });
  }

  fullscreenChart = new Chart(ctx, {
    type: isBalance ? 'bar' : 'line',
    data: { labels: [...srcData.labels], datasets },
    plugins: isBalance ? [zeroLinePlugin, balAvgLabelPlugin] : (hasAvgLine ? [avgLabelPlugin] : []),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: (type === 'weight' || isBalance) ? { intersect: false, mode: 'index' } : {},
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2c3e50',
          titleFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 13 },
          bodyFont: { family: 'PingFang SC, Microsoft YaHei, sans-serif', size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: { label: tooltipLabelCb }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 }, maxTicksLimit: 12 } },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            font: { size: 11 },
            stepSize: isBalance ? 1 : (type === 'weight' ? undefined : 1),
            callback: yTickCb
          },
          grid: { color: '#ecf0f1' }
        }
      }
    }
  });

  if (isBalance) {
    fullscreenChart._balAvg = sourceChart._balAvg;
  }

  // Save initial ranges for reset
  fullscreenInitRange = {
    xMin: 0,
    xMax: srcData.labels.length - 1,
    yMin,
    yMax
  };

  // Setup 2D drag-to-pan
  fullscreenPanState = { dragging: false, lastX: 0, lastY: 0 };
  canvas.style.cursor = 'grab';

  canvas.addEventListener('mousedown', onFullscreenPanStart);
  canvas.addEventListener('mousemove', onFullscreenPanMove);
  canvas.addEventListener('mouseup', onFullscreenPanEnd);
  canvas.addEventListener('mouseleave', onFullscreenPanEnd);
  canvas.addEventListener('touchstart', onFullscreenPanStart, { passive: false });
  canvas.addEventListener('touchmove', onFullscreenPanMove, { passive: false });
  canvas.addEventListener('touchend', onFullscreenPanEnd);
}

function onFullscreenPanStart(e) {
  if (!fullscreenChart) return;
  e.preventDefault();
  const pt = e.touches ? e.touches[0] : e;
  fullscreenPanState.dragging = true;
  fullscreenPanState.lastX = pt.clientX;
  fullscreenPanState.lastY = pt.clientY;
  document.getElementById('chartFullscreenCanvas').style.cursor = 'grabbing';
}

function onFullscreenPanMove(e) {
  if (!fullscreenChart || !fullscreenPanState.dragging) return;
  e.preventDefault();
  const pt = e.touches ? e.touches[0] : e;
  const deltaX = fullscreenPanState.lastX - pt.clientX;
  const deltaY = fullscreenPanState.lastY - pt.clientY;
  fullscreenPanState.lastX = pt.clientX;
  fullscreenPanState.lastY = pt.clientY;

  const chartArea = fullscreenChart.chartArea;
  if (!chartArea || chartArea.height === 0 || chartArea.width === 0) return;

  const yRange = fullscreenChart.options.scales.y.max - fullscreenChart.options.scales.y.min;
  const py = chartArea.height / yRange;
  fullscreenChart.options.scales.y.min += deltaY / py;
  fullscreenChart.options.scales.y.max += deltaY / py;

  fullscreenChart.update('none');
}

function onFullscreenPanEnd(e) {
  if (fullscreenPanState) fullscreenPanState.dragging = false;
  document.getElementById('chartFullscreenCanvas').style.cursor = 'grab';
}

function zoomFullscreenChart(factor) {
  if (!fullscreenChart) return;
  const yScale = fullscreenChart.options.scales.y;
  const center = (yScale.min + yScale.max) / 2;
  const halfRange = (yScale.max - yScale.min) / 2;
  const newHalf = halfRange * factor;
  yScale.min = center - newHalf;
  yScale.max = center + newHalf;
  fullscreenChart.update('none');
}

function resetFullscreenZoom() {
  if (!fullscreenChart || !fullscreenInitRange) return;
  fullscreenChart.options.scales.y.min = fullscreenInitRange.yMin;
  fullscreenChart.options.scales.y.max = fullscreenInitRange.yMax;
  fullscreenChart.update('none');
}

function closeChartFullscreen() {
  const overlay = document.getElementById('chartFullscreen');
  if (overlay.style.display === 'none') return;

  const canvas = document.getElementById('chartFullscreenCanvas');
  canvas.removeEventListener('mousedown', onFullscreenPanStart);
  canvas.removeEventListener('mousemove', onFullscreenPanMove);
  canvas.removeEventListener('mouseup', onFullscreenPanEnd);
  canvas.removeEventListener('mouseleave', onFullscreenPanEnd);
  canvas.removeEventListener('touchstart', onFullscreenPanStart);
  canvas.removeEventListener('touchmove', onFullscreenPanMove);
  canvas.removeEventListener('touchend', onFullscreenPanEnd);
  fullscreenPanState = null;
  fullscreenInitRange = null;

  overlay.classList.add('closing');
  overlay.addEventListener('animationend', function handler() {
    overlay.removeEventListener('animationend', handler);
    if (fullscreenChart) {
      fullscreenChart.destroy();
      fullscreenChart = null;
    }
    overlay.style.display = 'none';
    overlay.classList.remove('closing');
  }, { once: true });
}
