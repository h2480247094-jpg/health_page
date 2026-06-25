// ====== API 客户端 ======
// 代替 db.js — 所有数据请求通过 fetch 发往后端
// API_BASE 由 auth.js 声明，此处直接使用

function getToken() {
  return localStorage.getItem('health_token');
}

/**
 * 统一 fetch 封装
 */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  // 非 FormData 请求默认加 Content-Type
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('health_token');
    localStorage.removeItem('health_user');
    window.location.href = '/login.html';
    throw new Error('登录已过期');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败 (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('image') || contentType.includes('octet-stream')) {
    return res.blob();
  }
  return res.json();
}

// ====== 健康记录 ======

async function getAllRecords() {
  const records = await apiFetch('/records');
  // 后端已经 parse 了 JSON 字段，直接返回
  return records;
}

async function getRecord(date) {
  return apiFetch(`/records/${encodeURIComponent(date)}`);
}

async function deleteRecord(id) {
  return apiFetch(`/records/${id}`, { method: 'DELETE' });
}

// 保存体重
async function saveWeight(date, weight) {
  return apiFetch(`/records/${encodeURIComponent(date)}/weight`, {
    method: 'PUT',
    body: JSON.stringify({ weight }),
  });
}

// 保存睡眠
async function saveSleep(date, sleepSegments, bedTime, wakeTime) {
  return apiFetch(`/records/${encodeURIComponent(date)}/sleep`, {
    method: 'PUT',
    body: JSON.stringify({ sleep_segments: sleepSegments, bed_time: bedTime, wake_time: wakeTime }),
  });
}

// 添加饮食
async function addDiet(date, dietEntry) {
  return apiFetch(`/records/${encodeURIComponent(date)}/diet`, {
    method: 'POST',
    body: JSON.stringify(dietEntry),
  });
}

// 删除饮食
async function deleteDiet(date, index) {
  return apiFetch(`/records/${encodeURIComponent(date)}/diet/${index}`, { method: 'DELETE' });
}

// 添加运动
async function addExercise(date, exerciseEntry) {
  return apiFetch(`/records/${encodeURIComponent(date)}/exercise`, {
    method: 'POST',
    body: JSON.stringify(exerciseEntry),
  });
}

// 删除运动
async function deleteExercise(date, index) {
  return apiFetch(`/records/${encodeURIComponent(date)}/exercise/${index}`, { method: 'DELETE' });
}

// 添加补剂
async function addSupplement(date, supplementEntry) {
  return apiFetch(`/records/${encodeURIComponent(date)}/supplement`, {
    method: 'POST',
    body: JSON.stringify(supplementEntry),
  });
}

// 删除补剂
async function deleteSupplement(date, index) {
  return apiFetch(`/records/${encodeURIComponent(date)}/supplement/${index}`, { method: 'DELETE' });
}

// ====== 用户设置 ======

async function getSettings() {
  return apiFetch('/settings');
}

async function updateSettings(data) {
  return apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) });
}

// ====== 补剂预设 ======

async function getPresets() {
  return apiFetch('/presets');
}

async function addPreset(preset) {
  return apiFetch('/presets', { method: 'POST', body: JSON.stringify(preset) });
}

async function deletePreset(id) {
  return apiFetch(`/presets/${id}`, { method: 'DELETE' });
}

// ====== 护肤照片 ======

async function getAllPhotos(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch('/photos' + query);
}

async function uploadPhoto(formData) {
  return apiFetch('/photos', { method: 'POST', body: formData });
}

async function deletePhoto(id) {
  return apiFetch(`/photos/${id}`, { method: 'DELETE' });
}

// ====== AI ======

async function getAIAdvice(question) {
  return apiFetch('/ai/health-advice', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

async function estimateFood(foodDescription) {
  return apiFetch('/ai/food-estimate', {
    method: 'POST',
    body: JSON.stringify({ foodDescription }),
  });
}

async function getSkincareAdvice(question) {
  return apiFetch('/ai/skincare-advice', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

async function getChatHistory(type) {
  return apiFetch(`/ai/chat-history?type=${type || 'health'}`);
}

async function clearChatHistory(type) {
  return apiFetch(`/ai/chat-history?type=${type || 'health'}`, { method: 'DELETE' });
}

// ====== 计算工具函数（原在 api.js 中） ======

let _userHeight = 172;
let _userBirthday = '2003-01-31';
let _userGender = 'male';
let _settingsLoaded = false;

async function loadUserSettings() {
  try {
    const s = await getSettings();
    if (s.height_cm) _userHeight = s.height_cm;
    if (s.birthday) _userBirthday = s.birthday;
    if (s.gender) _userGender = s.gender;
    _settingsLoaded = true;
  } catch (err) {
    console.warn('加载用户设置失败，使用默认值:', err.message);
  }
}

function getUserAge() {
  const today = new Date();
  const birth = new Date(_userBirthday);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function calculateBMI(weight) {
  const h = _userHeight / 100;
  return weight / (h * h);
}

function calculateBMR(weight) {
  const age = getUserAge();
  const h = _userHeight;
  const activityFactor = 1.1;
  let bmr;
  if (_userGender === 'female') {
    bmr = 10 * weight + 6.25 * h - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * h - 5 * age + 5;
  }
  return bmr * activityFactor;
}
