// ====== 认证模块 ======

var API_BASE = window.location.origin + '/api';
let isRegisterMode = false;

// 存储 token 和用户信息
function saveAuth(token, user) {
  localStorage.setItem('health_token', token);
  localStorage.setItem('health_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('health_token');
  localStorage.removeItem('health_user');
}

function getToken() {
  return localStorage.getItem('health_token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('health_user'));
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return !!getToken();
}

// 切换登录/注册模式
function toggleMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('authTitle').textContent = isRegisterMode ? '注册' : '登录';
  document.getElementById('authBtn').textContent = isRegisterMode ? '注 册' : '登 录';
  document.getElementById('switchText').textContent = isRegisterMode ? '已有账号？' : '还没有账号？';
  document.getElementById('switchLink').textContent = isRegisterMode ? '登录' : '注册';
  document.getElementById('authError').textContent = '';
}

// 处理登录/注册
async function handleAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('authBtn');

  errorEl.textContent = '';

  if (!email) { errorEl.textContent = '请输入邮箱'; return; }
  if (!password) { errorEl.textContent = '请输入密码'; return; }
  if (password.length < 6) { errorEl.textContent = '密码至少6位'; return; }

  btn.disabled = true;
  btn.textContent = isRegisterMode ? '注册中...' : '登录中...';

  try {
    const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || '请求失败';
      return;
    }

    saveAuth(data.token, data.user);
    window.location.href = '/app.html';
  } catch (err) {
    errorEl.textContent = '网络错误，请检查网络连接';
    console.error('认证失败:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = isRegisterMode ? '注 册' : '登 录';
  }
}

// 更新 header 显示当前用户
async function updateHeaderUser() {
  const el = document.getElementById('headerUser');
  if (!el) return;

  // 优先从服务器获取最新的 username
  let displayName = '';
  const user = getUser();
  try {
    const settings = await getSettings();
    if (settings.username) {
      displayName = settings.username;
      // 同步到本地缓存
      if (user) { user.username = settings.username; localStorage.setItem('health_user', JSON.stringify(user)); }
    }
  } catch (e) { /* ignore */ }

  if (!displayName && user && user.username) {
    displayName = user.username;
  }
  if (!displayName && user && user.email) {
    displayName = user.email;
  }

  if (displayName) {
    el.textContent = displayName;
    el.title = '当前登录：' + (user?.email || displayName);
  }
}

// 退出登录
function logout() {
  if (!confirm('确定要退出登录吗？')) return;
  clearAuth();
  window.location.href = '/login.html';
}

// 页面加载时：如果已登录且不在 app.html，跳转到 app
if (window.location.pathname.includes('login.html')) {
  if (isLoggedIn()) {
    window.location.href = '/app.html';
  }

  // 回车键提交
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
  });
}
