let allRecords = [];
let currentDays = 30;

// ===== Range label helpers =====
function updateCalRangeLabel() {
  const span = parseInt(document.querySelector('.btn-cal-range.active')?.dataset?.days || 7);
  const range = getSpanDateRange(span, calOffset);
  document.getElementById('calRangeLabel').textContent = range.label;
  document.getElementById('calNext').disabled = calOffset <= 0;
  document.getElementById('calNextLarge').disabled = calOffset <= 0;
  updateJumpTitles('cal', span);
}

function updateBedRangeLabel() {
  const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="bed"].active')?.dataset?.days || 7);
  const range = getSpanDateRange(span, bedOffset);
  document.getElementById('bedRangeLabel').textContent = range.label;
  document.getElementById('bedNext').disabled = bedOffset <= 0;
  document.getElementById('bedNextLarge').disabled = bedOffset <= 0;
  updateJumpTitles('bed', span);
}

function updateWakeRangeLabel() {
  const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="wake"].active')?.dataset?.days || 7);
  const range = getSpanDateRange(span, wakeOffset);
  document.getElementById('wakeRangeLabel').textContent = range.label;
  document.getElementById('wakeNext').disabled = wakeOffset <= 0;
  document.getElementById('wakeNextLarge').disabled = wakeOffset <= 0;
  updateJumpTitles('wake', span);
}

function updateSleepDurRangeLabel() {
  const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="sleepDur"].active')?.dataset?.days || 7);
  const range = getSpanDateRange(span, sleepDurOffset);
  document.getElementById('sleepDurRangeLabel').textContent = range.label;
  document.getElementById('sleepDurNext').disabled = sleepDurOffset <= 0;
  document.getElementById('sleepDurNextLarge').disabled = sleepDurOffset <= 0;
  updateJumpTitles('sleepDur', span);
}

function updateJumpTitles(prefix, span) {
  const prevLarge = document.getElementById(prefix + 'PrevLarge');
  const nextLarge = document.getElementById(prefix + 'NextLarge');
  if (prevLarge) prevLarge.title = `向前跳${span}天`;
  if (nextLarge) nextLarge.title = `向后跳${span}天`;
}

function updateAllRangeLabels() {
  updateCalRangeLabel();
  updateBedRangeLabel();
  updateWakeRangeLabel();
  updateSleepDurRangeLabel();
  updateBalRangeLabel();
}

const app = {
  async init() {
    window.__app = this;

    // 认证检查：未登录跳转到登录页
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      window.location.href = '/login.html';
      return;
    }

    // 显示当前登录用户
    if (typeof updateHeaderUser === 'function') {
      updateHeaderUser();
    }

    // 加载用户设置（身高、生日、性别用于 BMI/BMR 计算）
    if (typeof loadUserSettings === 'function') {
      await loadUserSettings();
    }

    // Charts: weight on AI+录入, others only AI. Default tab is 录入.
    const wc = document.getElementById('weightChartSection');
    if (wc) wc.style.display = '';
    const cc = document.getElementById('chartsContainer');
    if (cc) cc.style.display = 'none';

    // Init quick-entry dates
    const today = new Date().toISOString().split('T')[0];
    setQuickDates(today);
    updateAiStatus();

    // Load data
    allRecords = await getAllRecords();

    // Init weight chart
    const ctx = document.getElementById('weightChart').getContext('2d');
    initChart(ctx);
    updateChart(allRecords, currentDays);

    // Init calorie chart
    let calSpan = 7;
    const calActive = document.querySelector('.btn-cal-range.active');
    if (calActive) calSpan = parseInt(calActive.dataset.days);
    initCalorieChart(document.getElementById('calorieChart').getContext('2d'));
    updateCalorieChart(allRecords, calSpan, calOffset);

    // Init sleep charts
    initBedTimeChart(document.getElementById('bedTimeChart').getContext('2d'));
    initWakeTimeChart(document.getElementById('wakeTimeChart').getContext('2d'));
    initSleepDurChart(document.getElementById('sleepDurChart').getContext('2d'));
    updateAllSleepCharts(allRecords);

    // Init calorie balance chart
    let balSpan = 7;
    const balActive = document.querySelector('.btn-bal-range.active');
    if (balActive) balSpan = parseInt(balActive.dataset.days);
    initCalBalanceChart(document.getElementById('calBalanceChart').getContext('2d'));
    updateCalBalanceChart(allRecords, balSpan, balOffset);

    // Update all range labels
    updateAllRangeLabels();

    // Render UI
    renderStats(allRecords);
    renderRecords(allRecords, '', 'desc');
    initSuppPresets();

    // Bind events
    this.bindEvents();
  },

  async refresh() {
    allRecords = await getAllRecords();
    updateChart(allRecords, currentDays);

    const calSpan = parseInt(document.querySelector('.btn-cal-range.active')?.dataset?.days || 7);
    updateCalorieChart(allRecords, calSpan, calOffset);

    updateAllSleepCharts(allRecords);

    const balSpan = parseInt(document.querySelector('.btn-bal-range.active')?.dataset?.days || 7);
    updateCalBalanceChart(allRecords, balSpan, balOffset);

    updateAllRangeLabels();

    renderStats(allRecords);
    const searchTerm = document.getElementById('searchInput').value;
    const sortOrder = document.getElementById('sortOrder').value;
    renderRecords(allRecords, searchTerm, sortOrder);

    // Refresh micro tab if it's currently active
    const microTab = document.getElementById('tabMicronutrients');
    if (microTab && microTab.classList.contains('active') && typeof updateMicroTab === 'function') {
      updateMicroTab(allRecords);
    }

  },

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
        if (tab.dataset.tab === 'tabAdd') {
          setQuickDates(new Date().toISOString().split('T')[0]);
        }
        if (tab.dataset.tab === 'tabSkincare') {
          initSkinTab();
        }
        if (tab.dataset.tab === 'tabMicronutrients') {
          if (typeof updateMicroTab === 'function') {
            updateMicroTab(allRecords);
          }
          if (typeof renderFoodSuggestions === 'function') {
            renderFoodSuggestions(allRecords);
          }
        } else {
          const sec = document.getElementById('foodSuggestSection');
          if (sec) sec.style.display = 'none';
        }
      });
    });

    // Weight chart range buttons
    document.querySelectorAll('.btn-range:not(.btn-sleep-range):not(.btn-cal-range):not(.btn-bal-range)').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-range:not(.btn-sleep-range):not(.btn-cal-range):not(.btn-bal-range)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDays = parseInt(btn.dataset.days);
        updateChart(allRecords, currentDays);
      });
    });

    // Calorie chart span buttons
    document.querySelectorAll('.btn-cal-range').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-cal-range').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        calOffset = 0;
        const span = parseInt(btn.dataset.days);
        updateCalorieChart(allRecords, span, calOffset);
        updateCalRangeLabel();
      });
    });

    // Calorie pagination
    document.getElementById('calPrevLarge').addEventListener('click', () => {
      const span = parseInt(document.querySelector('.btn-cal-range.active')?.dataset?.days || 7);
      calOffset += span;
      updateCalorieChart(allRecords, span, calOffset);
      updateCalRangeLabel();
    });
    document.getElementById('calPrev').addEventListener('click', () => {
      calOffset += 1;
      const span = parseInt(document.querySelector('.btn-cal-range.active')?.dataset?.days || 7);
      updateCalorieChart(allRecords, span, calOffset);
      updateCalRangeLabel();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      if (calOffset <= 0) return;
      calOffset = Math.max(0, calOffset - 1);
      const span = parseInt(document.querySelector('.btn-cal-range.active')?.dataset?.days || 7);
      updateCalorieChart(allRecords, span, calOffset);
      updateCalRangeLabel();
    });
    document.getElementById('calNextLarge').addEventListener('click', () => {
      if (calOffset <= 0) return;
      const span = parseInt(document.querySelector('.btn-cal-range.active')?.dataset?.days || 7);
      calOffset = Math.max(0, calOffset - span);
      updateCalorieChart(allRecords, span, calOffset);
      updateCalRangeLabel();
    });

    // Balance chart span buttons
    document.querySelectorAll('.btn-bal-range').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-bal-range').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        balOffset = 0;
        const span = parseInt(btn.dataset.days);
        updateCalBalanceChart(allRecords, span, balOffset);
        updateBalRangeLabel();
      });
    });

    // Balance pagination
    document.getElementById('balPrevLarge').addEventListener('click', () => {
      const span = parseInt(document.querySelector('.btn-bal-range.active')?.dataset?.days || 7);
      balOffset += span;
      updateCalBalanceChart(allRecords, span, balOffset);
      updateBalRangeLabel();
    });
    document.getElementById('balPrev').addEventListener('click', () => {
      balOffset += 1;
      const span = parseInt(document.querySelector('.btn-bal-range.active')?.dataset?.days || 7);
      updateCalBalanceChart(allRecords, span, balOffset);
      updateBalRangeLabel();
    });
    document.getElementById('balNext').addEventListener('click', () => {
      if (balOffset <= 0) return;
      balOffset = Math.max(0, balOffset - 1);
      const span = parseInt(document.querySelector('.btn-bal-range.active')?.dataset?.days || 7);
      updateCalBalanceChart(allRecords, span, balOffset);
      updateBalRangeLabel();
    });
    document.getElementById('balNextLarge').addEventListener('click', () => {
      if (balOffset <= 0) return;
      const span = parseInt(document.querySelector('.btn-bal-range.active')?.dataset?.days || 7);
      balOffset = Math.max(0, balOffset - span);
      updateCalBalanceChart(allRecords, span, balOffset);
      updateBalRangeLabel();
    });

    // Sleep chart span buttons
    document.querySelectorAll('.btn-sleep-range').forEach(btn => {
      btn.addEventListener('click', () => {
        const chart = btn.dataset.chart;
        document.querySelectorAll(`.btn-sleep-range[data-chart="${chart}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const span = parseInt(btn.dataset.days);

        if (chart === 'bed') {
          bedOffset = 0;
          updateBedTimeChart(allRecords, span, bedOffset);
          updateBedRangeLabel();
        } else if (chart === 'wake') {
          wakeOffset = 0;
          updateWakeTimeChart(allRecords, span, wakeOffset);
          updateWakeRangeLabel();
        } else if (chart === 'sleepDur') {
          sleepDurOffset = 0;
          updateSleepDurChart(allRecords, span, sleepDurOffset);
          updateSleepDurRangeLabel();
        }
      });
    });

    // Bed time pagination
    document.getElementById('bedPrevLarge').addEventListener('click', () => {
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="bed"].active')?.dataset?.days || 7);
      bedOffset += span;
      updateBedTimeChart(allRecords, span, bedOffset);
      updateBedRangeLabel();
    });
    document.getElementById('bedPrev').addEventListener('click', () => {
      bedOffset += 1;
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="bed"].active')?.dataset?.days || 7);
      updateBedTimeChart(allRecords, span, bedOffset);
      updateBedRangeLabel();
    });
    document.getElementById('bedNext').addEventListener('click', () => {
      if (bedOffset <= 0) return;
      bedOffset = Math.max(0, bedOffset - 1);
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="bed"].active')?.dataset?.days || 7);
      updateBedTimeChart(allRecords, span, bedOffset);
      updateBedRangeLabel();
    });
    document.getElementById('bedNextLarge').addEventListener('click', () => {
      if (bedOffset <= 0) return;
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="bed"].active')?.dataset?.days || 7);
      bedOffset = Math.max(0, bedOffset - span);
      updateBedTimeChart(allRecords, span, bedOffset);
      updateBedRangeLabel();
    });

    // Wake time pagination
    document.getElementById('wakePrevLarge').addEventListener('click', () => {
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="wake"].active')?.dataset?.days || 7);
      wakeOffset += span;
      updateWakeTimeChart(allRecords, span, wakeOffset);
      updateWakeRangeLabel();
    });
    document.getElementById('wakePrev').addEventListener('click', () => {
      wakeOffset += 1;
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="wake"].active')?.dataset?.days || 7);
      updateWakeTimeChart(allRecords, span, wakeOffset);
      updateWakeRangeLabel();
    });
    document.getElementById('wakeNext').addEventListener('click', () => {
      if (wakeOffset <= 0) return;
      wakeOffset = Math.max(0, wakeOffset - 1);
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="wake"].active')?.dataset?.days || 7);
      updateWakeTimeChart(allRecords, span, wakeOffset);
      updateWakeRangeLabel();
    });
    document.getElementById('wakeNextLarge').addEventListener('click', () => {
      if (wakeOffset <= 0) return;
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="wake"].active')?.dataset?.days || 7);
      wakeOffset = Math.max(0, wakeOffset - span);
      updateWakeTimeChart(allRecords, span, wakeOffset);
      updateWakeRangeLabel();
    });

    // Sleep duration pagination
    document.getElementById('sleepDurPrevLarge').addEventListener('click', () => {
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="sleepDur"].active')?.dataset?.days || 7);
      sleepDurOffset += span;
      updateSleepDurChart(allRecords, span, sleepDurOffset);
      updateSleepDurRangeLabel();
    });
    document.getElementById('sleepDurPrev').addEventListener('click', () => {
      sleepDurOffset += 1;
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="sleepDur"].active')?.dataset?.days || 7);
      updateSleepDurChart(allRecords, span, sleepDurOffset);
      updateSleepDurRangeLabel();
    });
    document.getElementById('sleepDurNext').addEventListener('click', () => {
      if (sleepDurOffset <= 0) return;
      sleepDurOffset = Math.max(0, sleepDurOffset - 1);
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="sleepDur"].active')?.dataset?.days || 7);
      updateSleepDurChart(allRecords, span, sleepDurOffset);
      updateSleepDurRangeLabel();
    });
    document.getElementById('sleepDurNextLarge').addEventListener('click', () => {
      if (sleepDurOffset <= 0) return;
      const span = parseInt(document.querySelector('.btn-sleep-range[data-chart="sleepDur"].active')?.dataset?.days || 7);
      sleepDurOffset = Math.max(0, sleepDurOffset - span);
      updateSleepDurChart(allRecords, span, sleepDurOffset);
      updateSleepDurRangeLabel();
    });

    // Quick-entry save buttons
    document.getElementById('btnSaveWeight').addEventListener('click', saveWeight);
    document.getElementById('btnSaveSleep').addEventListener('click', saveSleep);
    document.getElementById('btnSaveDiet').addEventListener('click', saveDiet);
    document.getElementById('btnSaveExercise').addEventListener('click', saveExercise);

    // Sleep segment management
    document.getElementById('btnAddSegment').addEventListener('click', addSegment);
    bindSegmentEvents();

    // AI estimate for diet
    document.getElementById('btnAiEstimate').addEventListener('click', handleAiEstimate);

    // Quick-entry: Enter key to save
    ['qeWeight', 'qeWeightDate'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') saveWeight();
      });
    });
    ['qeSleepDate'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') saveSleep();
      });
    });
    ['qeDietDesc', 'qeDietCal', 'qeDietProtein', 'qeDietCarbs', 'qeDietFat', 'qeDietDate'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); saveDiet(); }
      });
    });
    ['qeExType', 'qeExDuration', 'qeExCal', 'qeExDate'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') saveExercise();
      });
    });

    // Search & sort
    document.getElementById('searchInput').addEventListener('input', (e) => {
      const sortOrder = document.getElementById('sortOrder').value;
      renderRecords(allRecords, e.target.value, sortOrder);
    });

    document.getElementById('sortOrder').addEventListener('change', (e) => {
      const searchTerm = document.getElementById('searchInput').value;
      renderRecords(allRecords, searchTerm, e.target.value);
    });

    // AI Ask
    document.getElementById('btnAskAI').addEventListener('click', async () => {
      const question = document.getElementById('aiQuestion').value.trim();
      const responseEl = document.getElementById('aiResponse');
      const responseContent = document.getElementById('aiResponseContent');
      const loadingEl = document.getElementById('aiLoading');

      responseEl.style.display = 'none';
      loadingEl.style.display = 'flex';

      try {
        const result = await getAIAdvice(question);
        responseContent.textContent = result.answer;
        responseEl.style.display = 'block';
        document.getElementById('aiQuestion').value = '';
        updateChatHistoryStatus();
      } catch (err) {
        responseContent.textContent = `❌ 获取建议失败：${err.message}`;
        responseEl.style.display = 'block';
      } finally {
        loadingEl.style.display = 'none';
      }
    });

    // Clear chat history
    document.getElementById('btnClearHistory').addEventListener('click', async () => {
      if (confirm('确定要清除所有对话历史吗？AI 将不再记得之前的对话。')) {
        try {
          await clearChatHistory('health');
          showToast('对话历史已清除');
          updateChatHistoryStatus();
        } catch (err) {
          showToast('清除失败：' + err.message);
        }
      }
    });

    // Settings modal
    document.getElementById('btnSettings').addEventListener('click', async () => {
      showModal('modalSettings');
      document.getElementById('apiStatusText').textContent = '';
      document.getElementById('apiStatusText').className = 'api-status';
      try {
        await loadSettings();
      } catch (e) {
        console.error('加载设置失败:', e);
      }
    });

    // Auto-calc age when birthday changes
    const birthdayInput = document.getElementById('inputBirthday');
    if (birthdayInput) {
      birthdayInput.addEventListener('change', () => {
        const age = typeof calcAge === 'function' ? calcAge(birthdayInput.value) : '';
        document.getElementById('inputAge').value = age || '';
      });
    }

    // Logout button
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', logout);
    }

    document.getElementById('btnCloseModal').addEventListener('click', () => hideModal('modalSettings'));

    document.getElementById('modalSettings').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideModal('modalSettings');
    });

    document.getElementById('btnSaveApiKey').addEventListener('click', saveSettings);

    // Chart fullscreen
    document.querySelectorAll('.btn-expand').forEach(btn => {
      btn.addEventListener('click', () => {
        openChartFullscreen(btn.dataset.chart);
      });
    });
    document.getElementById('btnCloseFullscreen').addEventListener('click', closeChartFullscreen);
    document.getElementById('chartFullscreen').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeChartFullscreen();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeChartFullscreen();
    });

    // Zoom buttons
    document.getElementById('btnZoomIn').addEventListener('click', () => zoomFullscreenChart(0.7));
    document.getElementById('btnZoomOut').addEventListener('click', () => zoomFullscreenChart(1.4));
    document.getElementById('btnZoomReset').addEventListener('click', resetFullscreenZoom);

    // Enter key for AI question
    document.getElementById('aiQuestion').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnAskAI').click();
    });

    // ===== Supplement Events =====
    // Preset buttons are now bound dynamically in renderSuppPresets()

    // Save supplement
    document.getElementById('btnSaveSupplement').addEventListener('click', saveSupplement);

    // Preset management
    document.getElementById('btnManagePresets').addEventListener('click', () => {
      const panel = document.getElementById('suppPresetManage');
      const btn = document.getElementById('btnManagePresets');
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        btn.textContent = '▲ 收起管理';
        renderSuppPresetManageList();
      } else {
        panel.style.display = 'none';
        btn.textContent = '⚙️ 管理预设';
      }
    });

    document.getElementById('btnClosePresetManage').addEventListener('click', () => {
      document.getElementById('suppPresetManage').style.display = 'none';
      document.getElementById('btnManagePresets').textContent = '⚙️ 管理预设';
    });

    document.getElementById('btnAddPreset').addEventListener('click', () => {
      const name = document.getElementById('qeNewPresetName').value.trim();
      const dosage = parseFloat(document.getElementById('qeNewPresetDosage').value) || 1;
      const unit = document.getElementById('qeNewPresetUnit').value;
      if (!name) { showToast('请输入补剂名称'); return; }
      if (dosage <= 0) { showToast('请输入有效剂量'); return; }
      if (addSuppPreset(name, dosage, unit)) {
        document.getElementById('qeNewPresetName').value = '';
        document.getElementById('qeNewPresetDosage').value = '1';
      }
    });

    // Enter key for new preset
    ['qeNewPresetName', 'qeNewPresetDosage'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btnAddPreset').click(); }
      });
    });

    // Enter key for supplement inputs
    ['qeSuppName', 'qeSuppDosage', 'qeSuppNote', 'qeSuppDate'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); saveSupplement(); }
      });
    });

    // Set default date for supplement
    const suppDateInput = document.getElementById('qeSuppDate');
    if (!suppDateInput.value) suppDateInput.value = new Date().toISOString().split('T')[0];

    // ===== Skincare Events =====
    // PIN lock
    document.getElementById('btnSkinUnlock').addEventListener('click', handleSkinUnlock);
    document.getElementById('btnSkinResetPin').addEventListener('click', handleSkinPinReset);
    setupSkinPinInputs();

    // Photo upload (multi-photo)
    document.querySelectorAll('.btn-select-photo').forEach(btn => {
      btn.addEventListener('click', handleSelectPhoto);
    });
    document.querySelectorAll('.skin-photo-input').forEach(input => {
      input.addEventListener('change', handlePhotoFileChange);
    });
    document.getElementById('btnUploadPhoto').addEventListener('click', handleUploadPhoto);

    // Set default date for photo
    const today = new Date().toISOString().split('T')[0];
    const photoDateInput = document.getElementById('qePhotoDate');
    if (!photoDateInput.value) photoDateInput.value = today;

    // Photo gallery
    document.getElementById('btnToggleBlur').addEventListener('click', togglePhotoBlur);

    // Photo viewer
    document.getElementById('btnClosePhotoViewer').addEventListener('click', closePhotoViewer);
    document.getElementById('photoViewer').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closePhotoViewer();
    });
    document.getElementById('btnDeletePhotoViewer').addEventListener('click', handleDeletePhotoViewer);
    document.getElementById('btnDownloadPhoto').addEventListener('click', handleDownloadPhoto);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('photoViewer').style.display === 'flex') {
        closePhotoViewer();
      }
    });

    // Skincare AI
    document.getElementById('btnAskSkinAI').addEventListener('click', handleAskSkinAI);
    document.getElementById('btnClearSkinHistory').addEventListener('click', handleClearSkinHistory);
    document.getElementById('skinAiQuestion').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnAskSkinAI').click();
    });

  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
