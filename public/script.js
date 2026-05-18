const API_URL = "/api/analyse";

let macroDonutChart = null;

let state = {
  targets: { kcal: 2350, protein: 180, carbs: 235, fat: 70, steps: 8000, sleep: 8 },
  foods: [],
  steps: null,
  sleep: null,
  workout: '',
  activityNotes: ''
};

// ── Date helpers ───────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function todayDateStr() {
  const now = new Date();
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

let selectedDate = todayDateStr();

function isViewingToday() {
  return selectedDate === todayDateStr();
}

function getStorageKey(dateStr) {
  return 'trackerData-' + (dateStr || selectedDate);
}

// ── Storage ──────────────────────────────────────────────────────────────────

function loadDayData() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      const d = JSON.parse(raw);
      state.foods = d.foods || [];
      state.steps = d.steps ?? null;
      state.sleep = d.sleep ?? null;
      state.workout = d.workout || '';
      state.activityNotes = d.activityNotes || '';
    } else {
      state.foods = [];
      state.steps = null;
      state.sleep = null;
      state.workout = '';
      state.activityNotes = '';
    }
  } catch(e) {
    state.foods = [];
    state.steps = null;
    state.sleep = null;
    state.workout = '';
    state.activityNotes = '';
  }
  const si = document.getElementById('stepsInput');
  const sl = document.getElementById('sleepInput');
  const wt = document.getElementById('workoutType');
  const an = document.getElementById('activityNotes');
  if (si) si.value = state.steps != null ? state.steps : '';
  if (sl) sl.value = state.sleep != null ? state.sleep : '';
  if (wt) wt.value = state.workout || '';
  if (an) an.value = state.activityNotes || '';
}

function loadState() {
  try {
    const saved = localStorage.getItem('formTracker');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.targets) state.targets = { ...state.targets, ...parsed.targets };
    }
  } catch(e) {}
  loadDayData();
  loadTargetInputs();
  renderAll();
}

function saveState() {
  try {
    localStorage.setItem('formTracker', JSON.stringify({ targets: state.targets }));
  } catch(e) {}
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify({
      foods: state.foods,
      steps: state.steps,
      sleep: state.sleep,
      workout: state.workout,
      activityNotes: state.activityNotes
    }));
  } catch(e) {}
}

// ── Date navigation ────────────────────────────────────────────────────────────

function navigateDate(delta) {
  const d = new Date(selectedDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const newDate = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  if (newDate > todayDateStr()) return;
  selectedDate = newDate;
  loadDayData();
  renderAll();
  updateDateDisplay();
  syncWorkoutToDate();
}

function returnToToday() {
  selectedDate = todayDateStr();
  loadDayData();
  renderAll();
  updateDateDisplay();
  syncWorkoutToDate();
}

function syncWorkoutToDate() {
  const workoutTab = document.getElementById('tab-workout');
  if (!workoutTab || !workoutTab.classList.contains('active')) return;
  currentWorkoutType = '';
  document.querySelectorAll('.wo-type-btn').forEach(b => b.classList.remove('active'));
  const workouts = loadWorkouts();
  const saved = workouts[selectedDate];
  if (saved?.type && WORKOUT_PLANS[saved.type]) {
    currentWorkoutType = saved.type;
    document.querySelectorAll('.wo-type-btn').forEach(btn => {
      if (btn.textContent === saved.type) btn.classList.add('active');
    });
    renderExerciseList(saved.type);
  } else {
    document.getElementById('exerciseList').innerHTML = '<div class="wo-no-type">Select a workout type above</div>';
  }
}

function updateDateDisplay() {
  const d = new Date(selectedDate + 'T00:00:00');
  const isToday = isViewingToday();

  document.getElementById('dateDisplay').textContent = d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const nextBtn = document.getElementById('dateNext');
  if (nextBtn) nextBtn.disabled = isToday;

  const banner = document.getElementById('pastDateBanner');
  if (banner) {
    banner.style.display = isToday ? 'none' : 'flex';
    if (!isToday) {
      const bannerMsg = document.getElementById('bannerMsg');
      if (bannerMsg) bannerMsg.textContent = 'Viewing ' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    }
  }
}

// ── Targets ───────────────────────────────────────────────────────────────────

function loadTargetInputs() {
  const t = state.targets;
  document.getElementById('targetKcal').value = t.kcal;
  document.getElementById('targetP').value = t.protein;
  document.getElementById('targetC').value = t.carbs;
  document.getElementById('targetF').value = t.fat;
  document.getElementById('targetSteps').value = t.steps;
  document.getElementById('targetSleep').value = t.sleep;
}

function saveTargets() {
  state.targets = {
    kcal: parseInt(document.getElementById('targetKcal').value) || 2350,
    protein: parseInt(document.getElementById('targetP').value) || 180,
    carbs: parseInt(document.getElementById('targetC').value) || 235,
    fat: parseInt(document.getElementById('targetF').value) || 70,
    steps: parseInt(document.getElementById('targetSteps').value) || 8000,
    sleep: parseFloat(document.getElementById('targetSleep').value) || 8
  };
  saveState();
  renderAll();
  switchTab('food');
}

function saveActivity() {
  state.steps = parseInt(document.getElementById('stepsInput').value) || null;
  state.sleep = parseFloat(document.getElementById('sleepInput').value) || null;
  state.workout = document.getElementById('workoutType').value || 'Rest';
  state.activityNotes = document.getElementById('activityNotes').value || '';
  saveState();
  renderAll();
  switchTab('food');
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function getTotals() {
  return state.foods.reduce((acc, f) => {
    acc.kcal += f.kcal || 0;
    acc.protein += f.protein || 0;
    acc.carbs += f.carbs || 0;
    acc.fat += f.fat || 0;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function barPct(val, target) {
  return Math.min(100, Math.round((val / target) * 100));
}

function renderAll() {
  const t = getTotals();
  const tgt = state.targets;

  document.getElementById('totalKcal').textContent = Math.round(t.kcal);
  document.getElementById('totalP').innerHTML = Math.round(t.protein) + '<span style="font-size:1rem">g</span>';
  document.getElementById('tKcal').textContent = tgt.kcal;
  document.getElementById('tP').textContent = tgt.protein;
  document.getElementById('tSteps').textContent = tgt.steps.toLocaleString();
  document.getElementById('tSleep').textContent = tgt.sleep;

  document.getElementById('stepsDisplay').textContent = state.steps != null ? state.steps.toLocaleString() : '—';
  document.getElementById('sleepDisplay').innerHTML = (state.sleep != null ? state.sleep : tgt.sleep) + '<span style="font-size:1rem">h</span>';

  document.getElementById('pNums').textContent = Math.round(t.protein) + ' / ' + tgt.protein + 'g';
  document.getElementById('cNums').textContent = Math.round(t.carbs) + ' / ' + tgt.carbs + 'g';
  document.getElementById('fNums').textContent = Math.round(t.fat) + ' / ' + tgt.fat + 'g';
  document.getElementById('kNums').textContent = Math.round(t.kcal) + ' / ' + tgt.kcal;

  const remK = Math.max(0, tgt.kcal - Math.round(t.kcal));
  const remP = Math.max(0, tgt.protein - Math.round(t.protein));
  document.getElementById('remKcal').textContent = remK + ' kcal';
  document.getElementById('remP').textContent = remP + 'g';

  const stepsPct = state.steps != null ? barPct(state.steps, tgt.steps) : 0;
  document.getElementById('stepsBig').textContent = state.steps != null ? state.steps.toLocaleString() : '—';
  document.getElementById('stepsTargetDisp').textContent = tgt.steps.toLocaleString();
  document.getElementById('stepsFill').style.width = stepsPct + '%';

  document.getElementById('statKcalRemain').textContent = Math.max(0, tgt.kcal - Math.round(t.kcal));
  document.getElementById('statPRemain').innerHTML = Math.max(0, tgt.protein - Math.round(t.protein)) + '<span class="sc-unit">g</span>';
  document.getElementById('statStepsRemain').textContent = state.steps != null ? Math.max(0, tgt.steps - state.steps).toLocaleString() : tgt.steps.toLocaleString();
  document.getElementById('statSleepRemain').innerHTML = (state.sleep != null ? state.sleep : tgt.sleep) + '<span class="sc-unit">h</span>';
  document.getElementById('statKcalBar').style.width = barPct(Math.round(t.kcal), tgt.kcal) + '%';
  document.getElementById('statPBar').style.width = barPct(Math.round(t.protein), tgt.protein) + '%';
  document.getElementById('statStepsBar').style.width = (state.steps != null ? barPct(state.steps, tgt.steps) : 0) + '%';
  document.getElementById('statSleepBar').style.width = (state.sleep != null ? barPct(state.sleep, tgt.sleep) : 100) + '%';

  document.getElementById('workoutDisplay').textContent = state.workout || 'Rest';
  document.getElementById('activityNotesDisplay').textContent = state.activityNotes || '';

  const tpKcal = document.getElementById('tpKcal');
  const tpProtein = document.getElementById('tpProtein');
  const tpSteps = document.getElementById('tpSteps');
  const tpSleep = document.getElementById('tpSleep');
  if (tpKcal) tpKcal.textContent = tgt.kcal + ' kcal';
  if (tpProtein) tpProtein.textContent = tgt.protein + ' g';
  if (tpSteps) tpSteps.textContent = tgt.steps.toLocaleString();
  if (tpSleep) tpSleep.textContent = tgt.sleep + ' h';

  const ovKcalBar = document.getElementById('ovKcalBar');
  const ovProteinBar = document.getElementById('ovProteinBar');
  const ovKcalCount = document.getElementById('ovKcalCount');
  const ovProteinCount = document.getElementById('ovProteinCount');
  if (ovKcalBar) ovKcalBar.style.width = barPct(Math.round(t.kcal), tgt.kcal) + '%';
  if (ovProteinBar) ovProteinBar.style.width = barPct(Math.round(t.protein), tgt.protein) + '%';
  if (ovKcalCount) ovKcalCount.textContent = Math.round(t.kcal) + ' / ' + tgt.kcal + ' kcal';
  if (ovProteinCount) ovProteinCount.textContent = Math.round(t.protein) + ' / ' + tgt.protein + 'g';

  renderFoodLog();
  renderWeeklySummary();
  renderMacroDonut();
}

function renderMacroDonut() {
  const t = getTotals();
  const tgt = state.targets;

  const pPct = tgt.protein > 0 ? Math.min(100, (t.protein / tgt.protein) * 100) : 0;
  const cPct = tgt.carbs   > 0 ? Math.min(100, (t.carbs   / tgt.carbs)   * 100) : 0;
  const fPct = tgt.fat     > 0 ? Math.min(100, (t.fat     / tgt.fat)     * 100) : 0;
  const kPct = tgt.kcal    > 0 ? Math.min(100, (t.kcal    / tgt.kcal)    * 100) : 0;
  const overallPct = Math.round((pPct + cPct + fPct + kPct) / 4);

  const gapSize   = 3;
  const macroUnits = (100 - 4 * gapSize) / 4;

  const donutData = [
    pPct / 100 * macroUnits, (1 - pPct / 100) * macroUnits, gapSize,
    cPct / 100 * macroUnits, (1 - cPct / 100) * macroUnits, gapSize,
    fPct / 100 * macroUnits, (1 - fPct / 100) * macroUnits, gapSize,
    kPct / 100 * macroUnits, (1 - kPct / 100) * macroUnits, gapSize
  ];
  const donutColors = [
    '#9ee8a0', 'rgba(158,232,160,0.12)', 'rgba(0,0,0,0)',
    '#60c8f0', 'rgba(96,200,240,0.12)',  'rgba(0,0,0,0)',
    '#f0a060', 'rgba(240,160,96,0.12)',  'rgba(0,0,0,0)',
    '#c8f060', 'rgba(200,240,96,0.12)',  'rgba(0,0,0,0)'
  ];

  const canvas = document.getElementById('macroDonutCanvas');
  if (!canvas) return;

  if (macroDonutChart) {
    macroDonutChart._overallPct = overallPct;
    macroDonutChart.data.datasets[0].data = donutData;
    macroDonutChart.update();
    return;
  }

  const centerPlugin = {
    id: 'donutCenter',
    beforeDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top  + chartArea.bottom) / 2;
      ctx.save();
      ctx.font = '800 1.5rem Syne, sans-serif';
      ctx.fillStyle = '#f0ede8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((chart._overallPct ?? 0) + '%', cx, cy - 7);
      ctx.font = '400 0.52rem DM Mono, monospace';
      ctx.fillStyle = '#6b6b6b';
      ctx.textBaseline = 'top';
      ctx.fillText('of goals', cx, cy + 8);
      ctx.restore();
    }
  };

  macroDonutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: donutData,
        backgroundColor: donutColors,
        borderWidth: 0,
        hoverOffset: 0
      }]
    },
    options: {
      cutout: '70%',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      animation: { duration: 500 }
    },
    plugins: [centerPlugin]
  });
  macroDonutChart._overallPct = overallPct;
}

// ── Weekly summary ────────────────────────────────────────────────────────────

let weeklyMetric = 'kcal';

function setWeeklyMetric(metric, btn) {
  weeklyMetric = metric;
  document.querySelectorAll('.wtoggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWeeklySummary();
}

function getWeeklyData() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const isToday = i === 0;
    const isSelected = dateStr === selectedDate;

    let dayData = null;
    if (isSelected) {
      dayData = { foods: state.foods, steps: state.steps };
    } else {
      try {
        const raw = localStorage.getItem('trackerData-' + dateStr);
        if (raw) dayData = JSON.parse(raw);
      } catch(e) {}
    }

    let kcal = 0, protein = 0;
    if (dayData?.foods) {
      dayData.foods.forEach(f => { kcal += f.kcal || 0; protein += f.protein || 0; });
    }
    const steps = dayData?.steps ?? null;
    const hasData = !!dayData && (kcal > 0 || steps != null);

    days.push({
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      isToday,
      hasData,
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      steps: steps ?? 0
    });
  }
  return days;
}

function renderWeeklySummary() {
  const days = getWeeklyData();
  const metric = weeklyMetric;
  const colorMap = { kcal: 'var(--accent)', protein: '#9ee8a0', steps: 'var(--accent2)' };
  const color = colorMap[metric];

  const vals = days.map(d => d[metric]);
  const max = Math.max(...vals, 1);

  document.getElementById('weeklyChartArea').innerHTML = days.map(d => {
    const val = d[metric];
    const pct = val > 0 ? Math.max(3, Math.round((val / max) * 100)) : 2;
    const displayVal = val > 0
      ? (metric === 'steps' ? (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val) : val)
      : '';
    const opacity = d.isToday ? 1 : (d.hasData ? 0.5 : 0.12);
    return `
      <div class="chart-col">
        <div class="chart-val-label" style="color:${color};">${displayVal}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height:${pct}%;background:${color};opacity:${opacity};"></div>
        </div>
        <div class="chart-day-label ${d.isToday ? 'is-today' : ''}">${d.label}</div>
      </div>`;
  }).join('');

  const daysWithKcal = days.filter(d => d.kcal > 0);
  const daysWithP    = days.filter(d => d.protein > 0);
  const daysWithSteps = days.filter(d => d.steps > 0);
  const avg = (arr, key) => arr.length ? Math.round(arr.reduce((s, d) => s + d[key], 0) / arr.length) : null;

  const avgKcal  = avg(daysWithKcal, 'kcal');
  const avgP     = avg(daysWithP, 'protein');
  const avgSteps = avg(daysWithSteps, 'steps');
  const tgt = state.targets;

  document.getElementById('weeklyAvgs').innerHTML = `
    <div class="wavg-card">
      <div class="wavg-val" style="color:var(--accent);">${avgKcal != null ? avgKcal.toLocaleString() : '—'}</div>
      <div class="wavg-label">avg kcal / day</div>
      <div class="wavg-target">target ${tgt.kcal.toLocaleString()}</div>
    </div>
    <div class="wavg-card">
      <div class="wavg-val" style="color:#9ee8a0;">${avgP != null ? avgP + 'g' : '—'}</div>
      <div class="wavg-label">avg protein / day</div>
      <div class="wavg-target">target ${tgt.protein}g</div>
    </div>
    <div class="wavg-card">
      <div class="wavg-val" style="color:var(--accent2);">${avgSteps != null ? avgSteps.toLocaleString() : '—'}</div>
      <div class="wavg-label">avg steps / day</div>
      <div class="wavg-target">target ${tgt.steps.toLocaleString()}</div>
    </div>`;
}

function renderFoodLog() {
  const container = document.getElementById('foodEntries');
  if (state.foods.length === 0) {
    container.innerHTML = '<div class="empty-state">No food logged yet — add something above</div>';
    document.getElementById('mealTags').innerHTML = '';
    return;
  }

  const mealCounts = {};
  state.foods.forEach(f => { mealCounts[f.meal] = (mealCounts[f.meal] || 0) + 1; });
  document.getElementById('mealTags').innerHTML = Object.entries(mealCounts)
    .map(([meal, count]) => `<span class="tag good">${meal} ×${count}</span>`).join('');

  container.innerHTML = state.foods.map((f, i) => `
    <div class="food-entry">
      <div>
        <div class="food-name">${f.name}</div>
        <div class="food-meta">${f.meal}</div>
      </div>
      <div style="display:flex;align-items:center;">
        <div>
          <div class="food-kcal">${Math.round(f.kcal)} kcal</div>
          <div class="food-macros-right">P ${Math.round(f.protein)}g · C ${Math.round(f.carbs)}g · F ${Math.round(f.fat)}g</div>
        </div>
        <button class="delete-btn" onclick="deleteFood(${i})">✕</button>
      </div>
    </div>
  `).join('');
}

function deleteFood(idx) {
  state.foods.splice(idx, 1);
  saveState();
  renderAll();
}

function clearLog() {
  const msg = isViewingToday() ? 'Clear all food entries for today?' : 'Clear all food entries for this day?';
  if (confirm(msg)) {
    state.foods = [];
    saveState();
    renderAll();
  }
}

function addManual() {
  const desc = document.getElementById('foodDesc').value.trim();
  const kcal = parseFloat(document.getElementById('manualKcal').value) || 0;
  const p = parseFloat(document.getElementById('manualP').value) || 0;
  const c = parseFloat(document.getElementById('manualC').value) || 0;
  const f = parseFloat(document.getElementById('manualF').value) || 0;
  const meal = document.getElementById('mealType').value;

  if (!desc) { alert('Please enter a food description.'); return; }

  state.foods.push({ name: desc, meal, kcal, protein: p, carbs: c, fat: f });
  saveState();
  renderAll();
  clearFoodInputs();
}

function clearFoodInputs() {
  document.getElementById('foodDesc').value = '';
  document.getElementById('manualKcal').value = '';
  document.getElementById('manualP').value = '';
  document.getElementById('manualC').value = '';
  document.getElementById('manualF').value = '';
}

// ── AI food analysis ──────────────────────────────────────────────────────────

async function analyseFood() {
  const desc = document.getElementById('foodDesc').value.trim();
  if (!desc) { alert('Please describe the food first.'); return; }

  const dashLink = document.getElementById('navDashboard');
  if (dashLink) { switchToDashboard(); setNavActive(dashLink); }

  const loading = document.getElementById('aiLoading');
  const response = document.getElementById('aiResponse');
  loading.classList.add('visible');
  response.classList.remove('visible');
  response.innerHTML = '';

  const meal = document.getElementById('mealType').value;
  const totals = getTotals();
  const tgt = state.targets;

  const prompt = `You are a nutrition expert. Analyse this food and return a JSON object ONLY — no other text, no markdown, no explanation.

Food: "${desc}"
Meal type: ${meal}

Return exactly this JSON structure:
{
  "name": "short display name (max 50 chars)",
  "kcal": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fibre": number,
  "note": "one sentence tip about this food in context of a recomp diet targeting ${tgt.kcal}kcal and ${tgt.protein}g protein daily. Current totals today: ${Math.round(totals.kcal)}kcal, ${Math.round(totals.protein)}g protein."
}

All macros in grams, calories as a number. Be precise with portion sizes described.`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, max_tokens: 1000 })
    });

    const data = await res.json();
    const text = data.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    loading.classList.remove('visible');

    document.getElementById('manualKcal').value = Math.round(parsed.kcal);
    document.getElementById('manualP').value = Math.round(parsed.protein);
    document.getElementById('manualC').value = Math.round(parsed.carbs);
    document.getElementById('manualF').value = Math.round(parsed.fat);
    if (parsed.fibre) document.getElementById('manualFi').value = Math.round(parsed.fibre);

    response.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div style="text-align:center;"><div style="font-size:1.3rem;font-weight:800;color:var(--accent);">${Math.round(parsed.kcal)}</div><div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);">kcal</div></div>
        <div style="text-align:center;"><div style="font-size:1.3rem;font-weight:800;color:#9ee8a0;">${Math.round(parsed.protein)}g</div><div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);">protein</div></div>
        <div style="text-align:center;"><div style="font-size:1.3rem;font-weight:800;color:var(--accent2);">${Math.round(parsed.carbs)}g</div><div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);">carbs</div></div>
        <div style="text-align:center;"><div style="font-size:1.3rem;font-weight:800;color:var(--accent3);">${Math.round(parsed.fat)}g</div><div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);">fat</div></div>
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:0.75rem;color:var(--muted);line-height:1.6;padding:10px;background:var(--bg3);border-radius:8px;">${parsed.note}</div>
      <button class="primary" style="margin-top:10px;" onclick="addFromAI()">Add to log ↗</button>
    `;
    response.classList.add('visible');
    window._lastParsed = { ...parsed, meal };

  } catch(e) {
    loading.classList.remove('visible');
    response.innerHTML = `<div style="color:var(--red);font-family:'DM Mono',monospace;font-size:0.8rem;">Analysis failed — fill in macros manually and use "Add manually".</div>`;
    response.classList.add('visible');
  }
}

function addFromAI() {
  if (!window._lastParsed) return;
  const p = window._lastParsed;
  const desc = document.getElementById('foodDesc').value.trim();
  state.foods.push({
    name: p.name || desc,
    meal: document.getElementById('mealType').value,
    kcal: p.kcal,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat
  });
  saveState();
  renderAll();
  clearFoodInputs();
  document.getElementById('aiResponse').classList.remove('visible');
  document.getElementById('aiResponse').innerHTML = '';
  window._lastParsed = null;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function switchTab(id) {
  switchToOverview();
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  if (event && event.target && event.target.classList.contains('tab-btn')) {
    event.target.classList.add('active');
  } else {
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.textContent.trim().toLowerCase() === id) b.classList.add('active');
    });
  }
  if (id === 'workout') initWorkoutTab();
}

function goToTargets() {
  switchToOverview();
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('tab-targets');
  if (pane) pane.classList.add('active');
  document.querySelectorAll('.left-nav-link').forEach(l => {
    l.classList.remove('active');
    if (l.textContent.includes('Targets')) l.classList.add('active');
  });
}

// ── Calendar ──────────────────────────────────────────────────────────────────

let calYear, calMonth;

function openCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
  document.getElementById('calendarModal').classList.add('open');
  document.getElementById('dayDetail').style.display = 'none';
}

function closeCalendar() {
  document.getElementById('calendarModal').classList.remove('open');
}

function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
  document.getElementById('dayDetail').style.display = 'none';
}

function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
  document.getElementById('dayDetail').style.display = 'none';
}

function renderCalendar() {
  const now = new Date();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  document.getElementById('calMonthLabel').textContent = monthNames[calMonth] + ' ' + calYear;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(calYear, calMonth, d);
    const dateStr = dateObj.getFullYear() + '-' + pad(dateObj.getMonth() + 1) + '-' + pad(dateObj.getDate());
    const isToday = dateObj.toDateString() === now.toDateString();
    let hasData = false;
    try {
      const raw = localStorage.getItem('trackerData-' + dateStr);
      if (raw) {
        const data = JSON.parse(raw);
        hasData = (data.foods && data.foods.length > 0) || data.steps != null;
      }
    } catch(e) {}
    const classes = ['cal-day', hasData ? 'has-data' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    const dot = hasData ? '<div class="dot"></div>' : '';
    html += `<div class="${classes}" onclick="showDayDetail('${dateStr}')">${d}${dot}</div>`;
  }

  document.getElementById('calGrid').innerHTML = html;
}

function showDayDetail(dateStr) {
  let data = null;
  try {
    const raw = localStorage.getItem('trackerData-' + dateStr);
    if (raw) data = JSON.parse(raw);
  } catch(e) {}

  const d = new Date(dateStr + 'T00:00:00');
  const displayDate = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const detail = document.getElementById('dayDetail');

  if (!data || ((!data.foods || data.foods.length === 0) && data.steps == null && data.sleep == null)) {
    detail.style.display = 'block';
    detail.innerHTML = `<div class="day-detail-title">${displayDate}</div><div style="font-family:'DM Mono',monospace;font-size:0.8rem;color:var(--muted);">No data logged for this day.</div>`;
    return;
  }

  const foods = data.foods || [];
  const totals = foods.reduce((acc, f) => {
    acc.kcal += f.kcal || 0;
    acc.protein += f.protein || 0;
    acc.carbs += f.carbs || 0;
    acc.fat += f.fat || 0;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const statsHtml = `
    <div class="day-stats-grid">
      <div class="day-stat"><div class="day-stat-val">${Math.round(totals.kcal)}</div><div class="day-stat-label">kcal</div></div>
      <div class="day-stat"><div class="day-stat-val" style="color:#9ee8a0;">${Math.round(totals.protein)}g</div><div class="day-stat-label">protein</div></div>
      <div class="day-stat"><div class="day-stat-val" style="color:var(--accent2);">${data.steps != null ? data.steps.toLocaleString() : '—'}</div><div class="day-stat-label">steps</div></div>
      <div class="day-stat"><div class="day-stat-val" style="color:var(--accent3);">${data.sleep != null ? data.sleep + 'h' : '—'}</div><div class="day-stat-label">sleep</div></div>
    </div>
  `;

  const workoutHtml = data.workout ? `<div style="font-family:'DM Mono',monospace;font-size:0.75rem;color:var(--muted);margin-bottom:10px;">Workout: <span style="color:var(--accent2);">${data.workout}</span>${data.activityNotes ? ' — ' + data.activityNotes : ''}</div>` : '';

  const foodHtml = foods.length > 0 ? `
    <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Food log</div>
    <div class="day-food-list">
      ${foods.map(f => `
        <div class="day-food-item">
          <div>
            <div class="day-food-name">${f.name}</div>
            <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);">${f.meal} · P ${Math.round(f.protein)}g · C ${Math.round(f.carbs)}g · F ${Math.round(f.fat)}g</div>
          </div>
          <div class="day-food-kcal">${Math.round(f.kcal)} kcal</div>
        </div>
      `).join('')}
    </div>
  ` : '<div style="font-family:\'DM Mono\',monospace;font-size:0.75rem;color:var(--muted);">No food logged.</div>';

  detail.style.display = 'block';
  detail.innerHTML = `
    <div class="day-detail-title">${displayDate}</div>
    ${statsHtml}
    ${workoutHtml}
    ${foodHtml}
  `;
}

// ── Recommended meals ─────────────────────────────────────────────────────────

function openMeals() {
  document.getElementById('mealsModal').classList.add('open');
  fetchMealRecommendations();
}

function closeMeals() {
  document.getElementById('mealsModal').classList.remove('open');
}

async function fetchMealRecommendations() {
  const tgt = state.targets;
  const totals = getTotals();
  const remKcal = Math.max(0, tgt.kcal - Math.round(totals.kcal));
  const remP = Math.max(0, tgt.protein - Math.round(totals.protein));
  const remC = Math.max(0, tgt.carbs - Math.round(totals.carbs));
  const remF = Math.max(0, tgt.fat - Math.round(totals.fat));

  const content = document.getElementById('mealsContent');
  content.innerHTML = `
    <div class="meals-remaining">
      <div>Remaining today:</div>
      <div><span>${remKcal} kcal</span></div>
      <div><span style="color:#9ee8a0;">${remP}g protein</span></div>
      <div><span style="color:var(--accent2);">${remC}g carbs</span></div>
      <div><span style="color:var(--accent3);">${remF}g fat</span></div>
    </div>
    <div class="meals-loading">
      <div class="dot-pulse"><span></span><span></span><span></span></div>
      <span>Generating recommendations...</span>
    </div>
  `;

  const alreadyEaten = state.foods.map(f => f.name).join(', ') || 'nothing yet';

  const prompt = `You are a nutrition expert. Based on the user's remaining daily targets, suggest 4 meal options. Return JSON ONLY — no markdown, no explanation.

Daily targets: ${tgt.kcal} kcal, ${tgt.protein}g protein, ${tgt.carbs}g carbs, ${tgt.fat}g fat
Remaining today: ${remKcal} kcal, ${remP}g protein, ${remC}g carbs, ${remF}g fat
Already eaten today: ${alreadyEaten}

Return exactly this structure:
{
  "meals": [
    {
      "name": "Meal name",
      "description": "Brief description of ingredients and prep (1-2 sentences)",
      "kcal": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "fit": "why this fits the remaining targets (1 sentence)"
    }
  ]
}

Make meals practical, varied, and sized to fit the remaining macros well. Mix light and substantial options.`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, max_tokens: 1500 })
    });

    const data = await res.json();
    const text = data.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const mealsHtml = parsed.meals.map(m => `
      <div class="meal-card">
        <div class="meal-card-header">
          <div class="meal-card-name">${m.name}</div>
          <div class="meal-card-kcal">${Math.round(m.kcal)} kcal</div>
        </div>
        <div class="meal-card-macros">
          <span class="macro-chip chip-p">P ${Math.round(m.protein)}g</span>
          <span class="macro-chip chip-c">C ${Math.round(m.carbs)}g</span>
          <span class="macro-chip chip-f">F ${Math.round(m.fat)}g</span>
        </div>
        <div class="meal-card-desc">${m.description}</div>
        <div style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--accent);margin-top:6px;">${m.fit}</div>
      </div>
    `).join('');

    content.innerHTML = `
      <div class="meals-remaining">
        <div>Remaining today:</div>
        <div><span>${remKcal} kcal</span></div>
        <div><span style="color:#9ee8a0;">${remP}g protein</span></div>
        <div><span style="color:var(--accent2);">${remC}g carbs</span></div>
        <div><span style="color:var(--accent3);">${remF}g fat</span></div>
      </div>
      ${mealsHtml}
      <button class="secondary" style="margin-top:4px;" onclick="fetchMealRecommendations()">Regenerate ↺</button>
    `;

  } catch(e) {
    content.innerHTML = `
      <div class="meals-remaining">
        <div>Remaining today:</div>
        <div><span>${remKcal} kcal</span></div>
        <div><span style="color:#9ee8a0;">${remP}g protein</span></div>
      </div>
      <div class="meals-error">Failed to load recommendations — check your API key is set in the source, or try again.</div>
      <button class="secondary" style="margin-top:8px;" onclick="fetchMealRecommendations()">Retry</button>
    `;
  }
}

// ── Workout tab ───────────────────────────────────────────────────────────────

const WORKOUT_PLANS = {
  Push: [
    'Incline dumbbell press',
    'Seated overhead press (barbell)',
    'Chest fly (machine)',
    'Lateral raise (dumbbell)',
    'Triceps pushdown',
    'Overhead triceps extension (cable)'
  ],
  Pull: [
    'Pull-ups',
    'T-bar row',
    'Lat pulldown (cable)',
    'Seated cable row V-grip',
    'Rear delt reverse fly (machine)',
    'EZ bar curl',
    'Hammer curl (cable)'
  ],
  Legs: [
    'Pendulum squat',
    'Romanian deadlift (barbell)',
    'Leg extension (machine)',
    'Seated leg curl (machine)',
    'Hip adduction (machine)',
    'Crunch (machine)'
  ]
};

const ALL_EXERCISES = Object.values(WORKOUT_PLANS).flat();

function exSlug(name) {
  return 'ex_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function loadWorkouts() {
  try { return JSON.parse(localStorage.getItem('formTrackerWorkouts') || '{}'); } catch(e) { return {}; }
}

function saveWorkouts(data) {
  try { localStorage.setItem('formTrackerWorkouts', JSON.stringify(data)); } catch(e) {}
}

function epley(weight, reps) {
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
}

function getExerciseHistory(name) {
  const workouts = loadWorkouts();
  const rows = [];
  Object.entries(workouts).sort((a, b) => new Date(a[0]) - new Date(b[0])).forEach(([dateKey, session]) => {
    const sets = session.exercises?.[name];
    if (sets && sets.length > 0) {
      const best = Math.max(...sets.map(s => epley(s.weight, s.reps)));
      rows.push({ dateKey, date: new Date(dateKey), best1RM: best });
    }
  });
  return rows;
}

function getPR(name) {
  const hist = getExerciseHistory(name);
  return hist.length ? Math.max(...hist.map(h => h.best1RM)) : null;
}

function getLastLogged(name) {
  const workouts = loadWorkouts();
  const sorted = Object.keys(workouts).sort((a, b) => new Date(b) - new Date(a));
  for (const dateKey of sorted) {
    const sets = workouts[dateKey]?.exercises?.[name];
    if (sets && sets.length > 0) {
      const last = sets[sets.length - 1];
      return { weight: last.weight, reps: last.reps };
    }
  }
  return null;
}

function getTodayWo() {
  return loadWorkouts()[selectedDate] || { type: '', exercises: {} };
}

function addSet(name) {
  const s = exSlug(name);
  const wEl = document.getElementById('wi_' + s);
  const rEl = document.getElementById('ri_' + s);
  const weight = parseFloat(wEl.value);
  const reps   = parseInt(rEl.value);
  if (!weight || !reps || weight <= 0 || reps <= 0) { alert('Enter a valid weight and rep count.'); return; }

  const workouts = loadWorkouts();
  if (!workouts[selectedDate]) workouts[selectedDate] = { type: currentWorkoutType, exercises: {} };
  if (!workouts[selectedDate].exercises[name]) workouts[selectedDate].exercises[name] = [];
  workouts[selectedDate].exercises[name].push({ weight, reps });
  saveWorkouts(workouts);

  wEl.value = '';
  rEl.value = '';
  refreshExerciseCard(name);
}

function deleteSet(name, idx) {
  const workouts = loadWorkouts();
  const sets = workouts[selectedDate]?.exercises?.[name];
  if (!sets) return;
  sets.splice(idx, 1);
  saveWorkouts(workouts);
  refreshExerciseCard(name);
}

function refreshExerciseCard(name) {
  const s = exSlug(name);
  const today = getTodayWo();
  const sets  = today.exercises[name] || [];
  const pr    = getPR(name);

  const badge = document.getElementById('pr_' + s);
  if (badge) badge.textContent = pr ? 'PR ~' + pr + 'kg' : 'No PR';

  const container = document.getElementById('sets_' + s);
  if (!container) return;
  container.innerHTML = sets.map((set, i) => `
    <div class="set-log-row">
      <span class="set-log-num">${i + 1}</span>
      <span class="set-log-val">${set.weight}kg × ${set.reps}</span>
      <span class="set-log-1rm">~${epley(set.weight, set.reps)}kg</span>
      <button class="set-log-del" onclick="deleteSet('${name}', ${i})">✕</button>
    </div>`).join('');
}

let currentWorkoutType = '';

function selectWorkoutType(type, btn) {
  currentWorkoutType = type;
  document.querySelectorAll('.wo-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const workouts = loadWorkouts();
  if (!workouts[selectedDate]) workouts[selectedDate] = { type, exercises: {} };
  else workouts[selectedDate].type = type;
  saveWorkouts(workouts);

  renderExerciseList(type);
}

function renderExerciseList(type) {
  const container = document.getElementById('exerciseList');
  if (!type || !WORKOUT_PLANS[type]) {
    container.innerHTML = '<div class="wo-no-type">Select a workout type above</div>';
    return;
  }

  const today = getTodayWo();
  container.innerHTML = WORKOUT_PLANS[type].map(name => {
    const s    = exSlug(name);
    const pr   = getPR(name);
    const last = getLastLogged(name);
    const sets = today.exercises[name] || [];

    const setsHtml = sets.map((set, i) => `
      <div class="set-log-row">
        <span class="set-log-num">${i + 1}</span>
        <span class="set-log-val">${set.weight}kg × ${set.reps}</span>
        <span class="set-log-1rm">~${epley(set.weight, set.reps)}kg</span>
        <button class="set-log-del" onclick="deleteSet('${name}', ${i})">✕</button>
      </div>`).join('');

    return `
      <div class="exercise-card">
        <div class="exercise-header">
          <div class="exercise-name-text">${name}</div>
          <div class="pr-badge" id="pr_${s}">${pr ? 'PR ~' + pr + 'kg' : 'No PR'}</div>
        </div>
        <div class="ex-last">${last ? 'Last: ' + last.weight + 'kg × ' + last.reps + ' reps' : 'No previous data'}</div>
        <div class="set-row-input">
          <input type="number" id="wi_${s}" placeholder="kg" min="0" step="0.5">
          <input type="number" id="ri_${s}" placeholder="reps" min="1" step="1">
          <button class="set-add-btn" onclick="addSet('${name}')">+ Set</button>
        </div>
        <div class="sets-today" id="sets_${s}">${setsHtml}</div>
      </div>`;
  }).join('');
}

function populateProgressDropdown() {
  const sel = document.getElementById('progressExSelect');
  if (sel.querySelectorAll('optgroup').length > 0) return;
  Object.entries(WORKOUT_PLANS).forEach(([type, exercises]) => {
    const grp = document.createElement('optgroup');
    grp.label = type;
    exercises.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}

let progressChartInst = null;

function renderProgressChart() {
  const name    = document.getElementById('progressExSelect').value;
  const canvas  = document.getElementById('progressChartCanvas');
  const empty   = document.getElementById('progressEmpty');

  if (progressChartInst) { progressChartInst.destroy(); progressChartInst = null; }

  if (!name) {
    canvas.style.display = 'none';
    empty.style.display  = 'block';
    empty.textContent    = 'Select an exercise to see progress';
    return;
  }

  const history = getExerciseHistory(name);
  if (history.length === 0) {
    canvas.style.display = 'none';
    empty.style.display  = 'block';
    empty.textContent    = 'No data logged for ' + name + ' yet';
    return;
  }

  canvas.style.display = 'block';
  empty.style.display  = 'none';

  progressChartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels: history.map(h => h.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
      datasets: [{
        label: 'Est. 1RM (kg)',
        data: history.map(h => h.best1RM),
        borderColor: '#c8f060',
        backgroundColor: 'rgba(200,240,96,0.07)',
        borderWidth: 2,
        pointBackgroundColor: '#c8f060',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e1e1e',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#6b6b6b',
          bodyColor: '#f0ede8',
          titleFont: { family: 'DM Mono', size: 10 },
          bodyFont:  { family: 'DM Mono', size: 11 },
          callbacks: { label: ctx => '~' + ctx.parsed.y + 'kg est. 1RM' }
        }
      },
      scales: {
        x: {
          grid:  { color: '#2a2a2a' },
          ticks: { color: '#6b6b6b', font: { family: 'DM Mono', size: 9 }, maxRotation: 0 }
        },
        y: {
          grid:  { color: '#2a2a2a' },
          ticks: { color: '#6b6b6b', font: { family: 'DM Mono', size: 9 }, callback: v => v + 'kg' }
        }
      }
    }
  });
}

function initWorkoutTab() {
  populateProgressDropdown();
  initWorkoutTab = () => {};

  const workouts = loadWorkouts();
  const saved = workouts[selectedDate];
  if (saved?.type && WORKOUT_PLANS[saved.type]) {
    currentWorkoutType = saved.type;
    document.querySelectorAll('.wo-type-btn').forEach(btn => {
      if (btn.textContent === saved.type) btn.classList.add('active');
    });
    renderExerciseList(saved.type);
  }
}

// ── Meal templates ────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  { id: 1, name: 'Overnight oats',   meal: 'Breakfast', kcal: 565, protein: 56, carbs: 55, fat: 11 },
  { id: 2, name: 'Clear whey shake', meal: 'Snack',     kcal: 110, protein: 20, carbs: 2,  fat: 0  },
  { id: 3, name: 'Chicken and rice', meal: 'Lunch',     kcal: 490, protein: 55, carbs: 45, fat: 8  }
];

function loadTemplates() {
  try {
    const raw = localStorage.getItem('mealTemplates');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function saveTemplates(templates) {
  try { localStorage.setItem('mealTemplates', JSON.stringify(templates)); } catch(e) {}
}

function initTemplates() {
  if (loadTemplates() === null) saveTemplates(DEFAULT_TEMPLATES);
  renderTemplates();
}

function renderTemplates() {
  const templates = loadTemplates() || [];
  const container = document.getElementById('templatePills');
  const countEl = document.getElementById('templatesCount');
  if (!container) return;
  if (countEl) countEl.textContent = templates.length;
  if (templates.length === 0) {
    container.innerHTML = '<div class="templates-empty">No templates yet — save one above</div>';
    return;
  }
  container.innerHTML = templates.map(t => `
    <div class="template-card">
      <div class="template-card-top">
        <div>
          <div class="template-card-name">${t.name}</div>
          <span class="template-card-badge">${t.meal}</span>
        </div>
        <button class="template-card-del" onclick="deleteTemplate(${t.id})">✕</button>
      </div>
      <div class="template-card-macros">${t.kcal} kcal · P ${t.protein}g · C ${t.carbs}g · F ${t.fat}g</div>
      <button class="template-card-add" onclick="applyTemplate(${t.id})">Add to log</button>
    </div>
  `).join('');
}

function applyTemplate(id) {
  const templates = loadTemplates() || [];
  const t = templates.find(t => t.id === id);
  if (!t) return;
  state.foods.push({ name: t.name, meal: t.meal, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat });
  saveState();
  renderAll();
}

function deleteTemplate(id) {
  const templates = (loadTemplates() || []).filter(t => t.id !== id);
  saveTemplates(templates);
  renderTemplates();
}

function showSaveTemplate() {
  document.getElementById('saveTemplateBtn').style.display = 'none';
  const wrap = document.getElementById('templateSaveWrap');
  wrap.style.display = 'block';
  const nameInput = document.getElementById('templateNameInput');
  nameInput.value = document.getElementById('foodDesc').value.trim();
  nameInput.focus();
  nameInput.select();
}

function cancelSaveTemplate() {
  document.getElementById('templateSaveWrap').style.display = 'none';
  document.getElementById('saveTemplateBtn').style.display = '';
}

function confirmSaveTemplate() {
  const name = document.getElementById('templateNameInput').value.trim();
  if (!name) { document.getElementById('templateNameInput').focus(); return; }
  const kcal    = parseFloat(document.getElementById('manualKcal').value) || 0;
  const protein = parseFloat(document.getElementById('manualP').value)    || 0;
  const carbs   = parseFloat(document.getElementById('manualC').value)    || 0;
  const fat     = parseFloat(document.getElementById('manualF').value)    || 0;
  const meal    = document.getElementById('mealType').value;
  const templates = loadTemplates() || [];
  templates.push({ id: Date.now(), name, meal, kcal, protein, carbs, fat });
  saveTemplates(templates);
  renderTemplates();
  cancelSaveTemplate();
}

// ── Weight logging ────────────────────────────────────────────────────────────

function getWeightLog() {
  try {
    const raw = localStorage.getItem('weightLog');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveWeightLog(log) {
  try { localStorage.setItem('weightLog', JSON.stringify(log)); } catch(e) {}
}

let weightChartInst = null;

function switchToDashboard() {
  document.getElementById('dashboardPage').style.display = 'flex';
  document.getElementById('weightPage').style.display = 'none';
  document.getElementById('resellingPage').style.display = 'none';
  document.querySelector('.main').style.display = 'none';
  document.getElementById('pastDateBanner').style.display = 'none';
  if (macroDonutChart) macroDonutChart.resize();
  renderWeeklySummary();
}

function switchToWeightPage() {
  document.getElementById('weightPage').style.display = 'flex';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('resellingPage').style.display = 'none';
  document.querySelector('.main').style.display = 'none';
  document.getElementById('pastDateBanner').style.display = 'none';
  const dateInput = document.getElementById('weightDate');
  if (dateInput && !dateInput.value) dateInput.value = todayDateStr();
  renderWeightChart();
  renderWeightStats();
}

function switchToOverview() {
  document.getElementById('weightPage').style.display = 'none';
  document.getElementById('resellingPage').style.display = 'none';
  document.getElementById('dashboardPage').style.display = 'none';
  document.querySelector('.main').style.display = '';
  updateDateDisplay();
}

function saveWeight() {
  const dateEl = document.getElementById('weightDate');
  const weightEl = document.getElementById('weightInput');
  const date = dateEl.value;
  const weight = parseFloat(weightEl.value);

  if (!date || !weight || weight <= 0) { alert('Please enter a valid weight and date.'); return; }

  const log = getWeightLog();
  const idx = log.findIndex(e => e.date === date);
  if (idx >= 0) {
    log[idx].weight = weight;
  } else {
    log.push({ date, weight });
    log.sort((a, b) => a.date.localeCompare(b.date));
  }

  saveWeightLog(log);
  weightEl.value = '';
  renderWeightChart();
  renderWeightStats();
  renderWeightWidget();
}

function saveWeightQuick() {
  const input = document.getElementById('weightQuickInput');
  if (!input) return;
  const weight = parseFloat(input.value);
  if (!weight || weight <= 0) { input.focus(); return; }

  const log = getWeightLog();
  const todayStr = todayDateStr();
  const idx = log.findIndex(e => e.date === todayStr);
  if (idx >= 0) {
    log[idx].weight = weight;
  } else {
    log.push({ date: todayStr, weight });
    log.sort((a, b) => a.date.localeCompare(b.date));
  }

  saveWeightLog(log);
  input.value = '';
  renderWeightWidget();
  if (document.getElementById('weightPage').style.display !== 'none') {
    renderWeightChart();
    renderWeightStats();
  }
}

function renderWeightChart() {
  const log = getWeightLog();
  const canvas = document.getElementById('weightChartCanvas');
  const emptyEl = document.getElementById('weightChartEmpty');
  const wrapEl = document.getElementById('weightChartWrap');
  if (!canvas) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 29);
  const cutoffStr = cutoff.getFullYear() + '-' + pad(cutoff.getMonth() + 1) + '-' + pad(cutoff.getDate());

  const entries = log.filter(e => e.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length === 0) {
    if (wrapEl) wrapEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    if (weightChartInst) { weightChartInst.destroy(); weightChartInst = null; }
    return;
  }

  if (wrapEl) wrapEl.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  const labels = entries.map(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
  const weights = entries.map(e => e.weight);

  const ma7 = weights.map((_, i) => {
    const slice = weights.slice(Math.max(0, i - 6), i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });

  const allLog = log.sort((a, b) => a.date.localeCompare(b.date));
  const startWeight = allLog.length > 0 ? allLog[0].weight : null;

  if (weightChartInst) { weightChartInst.destroy(); weightChartInst = null; }

  const datasets = [
    {
      label: 'Weight',
      data: weights,
      borderColor: 'rgba(232,160,74,0.45)',
      backgroundColor: 'rgba(232,160,74,0.05)',
      borderWidth: 1.5,
      pointBackgroundColor: 'rgba(232,160,74,0.7)',
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: false,
      order: 2
    },
    {
      label: '7-day avg',
      data: ma7,
      borderColor: '#e8a04a',
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.4,
      fill: false,
      order: 1
    }
  ];

  if (startWeight !== null) {
    datasets.push({
      label: 'Start weight',
      data: Array(entries.length).fill(startWeight),
      borderColor: 'rgba(154,122,82,0.5)',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0,
      fill: false,
      order: 3
    });
  }

  weightChartInst = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(45,32,16,0.92)',
          borderColor: '#ecdcc8',
          borderWidth: 1,
          titleColor: '#9a7a52',
          bodyColor: '#fdf8f2',
          titleFont: { family: 'DM Mono', size: 10 },
          bodyFont: { family: 'DM Mono', size: 11 },
          callbacks: {
            label: ctx => {
              if (ctx.dataset.label === 'Start weight') return 'Start: ' + ctx.parsed.y + ' kg';
              if (ctx.dataset.label === '7-day avg') return '7d avg: ' + ctx.parsed.y + ' kg';
              return 'Weight: ' + ctx.parsed.y + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(236,220,200,0.25)' },
          ticks: { color: '#9a7a52', font: { family: 'DM Mono', size: 9 }, maxRotation: 45, maxTicksLimit: 10 }
        },
        y: {
          grid: { color: 'rgba(236,220,200,0.25)' },
          ticks: { color: '#9a7a52', font: { family: 'DM Mono', size: 9 }, callback: v => v + ' kg' }
        }
      }
    }
  });
}

function calc7DayTrend(log) {
  if (log.length < 2) return null;
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.getFullYear() + '-' + pad(cutoff.getMonth() + 1) + '-' + pad(cutoff.getDate());

  let recent = sorted.filter(e => e.date >= cutoffStr);
  if (recent.length < 2) recent = sorted.slice(-Math.min(sorted.length, 7));
  if (recent.length < 2) return null;

  const first = recent[0];
  const last = recent[recent.length - 1];
  const days = (new Date(last.date + 'T00:00:00') - new Date(first.date + 'T00:00:00')) / 86400000;
  if (days === 0) return null;
  return ((last.weight - first.weight) / days) * 7;
}

function renderWeightStats() {
  const log = getWeightLog().sort((a, b) => a.date.localeCompare(b.date));

  const currentEl = document.getElementById('wStatCurrent');
  const startEl = document.getElementById('wStatStart');
  const changeEl = document.getElementById('wStatChange');
  const trendEl = document.getElementById('wStat7Day');

  if (log.length === 0) {
    [currentEl, startEl, changeEl, trendEl].forEach(el => { if (el) { el.textContent = '—'; el.style.color = ''; } });
    return;
  }

  const current = log[log.length - 1].weight;
  const start = log[0].weight;
  const change = Math.round((current - start) * 10) / 10;

  if (currentEl) currentEl.textContent = current;
  if (startEl) startEl.textContent = start;

  if (changeEl) {
    changeEl.textContent = (change > 0 ? '+' : '') + change;
    changeEl.style.color = change < 0 ? '#4ade80' : change > 0 ? 'var(--red)' : 'var(--accent)';
  }

  if (trendEl) {
    const trend = calc7DayTrend(log);
    if (trend === null) {
      trendEl.textContent = '—';
      trendEl.style.color = '';
    } else {
      const r = Math.round(trend * 10) / 10;
      trendEl.textContent = (r > 0 ? '+' : '') + r;
      trendEl.style.color = r < 0 ? '#4ade80' : r > 0 ? 'var(--red)' : 'var(--accent)';
    }
  }
}

function renderWeightWidget() {
  const container = document.getElementById('weightWidgetContent');
  if (!container) return;

  const log = getWeightLog().sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = todayDateStr();
  const todayEntry = log.find(e => e.date === todayStr);

  if (todayEntry) {
    container.innerHTML = `
      <div class="weight-today-val">${todayEntry.weight}<span style="font-size:1rem;font-weight:400;margin-left:2px;">kg</span></div>
      <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);margin-top:3px;">logged today</div>
      <div class="weight-quick-form">
        <input type="number" id="weightQuickInput" placeholder="Update kg" step="0.1" min="1">
        <button class="weight-quick-btn" onclick="saveWeightQuick()">Save</button>
      </div>`;
  } else {
    const lastEntry = log.length > 0 ? log[log.length - 1] : null;
    const lastText = lastEntry
      ? 'Last: ' + lastEntry.weight + ' kg on ' + new Date(lastEntry.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : 'No entries yet — log below';
    container.innerHTML = `
      <div style="font-family:'DM Mono',monospace;font-size:0.75rem;color:var(--muted);margin-bottom:8px;">${lastText}</div>
      <div class="weight-quick-form">
        <input type="number" id="weightQuickInput" placeholder="Today's weight (kg)" step="0.1" min="1">
        <button class="weight-quick-btn" onclick="saveWeightQuick()">Log</button>
      </div>`;
  }
}

// ── eBay OAuth connection ─────────────────────────────────────────────────────

function initEbayConnection() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('ebayAccessToken');
  const urlRefresh = params.get('ebayRefreshToken');

  if (urlToken) {
    localStorage.setItem('ebayAccessToken', urlToken);
    if (urlRefresh) localStorage.setItem('ebayRefreshToken', urlRefresh);
    localStorage.setItem('ebayConnectedAt', new Date().toISOString());
    window.history.replaceState({}, '', window.location.pathname);
  }

  renderEbayConnectionCard();
}

function renderEbayConnectionCard() {
  const card = document.getElementById('ebayConnectCard');
  if (!card) return;

  const token = localStorage.getItem('ebayAccessToken');

  if (!token) {
    card.innerHTML = `
      <div class="ebay-connect-disconnected">
        <div class="ebay-logo-placeholder">
          <span class="ebay-logo-e">e</span><span class="ebay-logo-b">b</span><span class="ebay-logo-a">a</span><span class="ebay-logo-y">y</span>
        </div>
        <div class="ebay-connect-msg">Connect your eBay account to sync listings automatically</div>
        <button class="ebay-connect-btn" onclick="connectEbay()">Connect eBay</button>
      </div>`;
  } else {
    const connectedAt = localStorage.getItem('ebayConnectedAt');
    let syncedText = 'Last synced: never';
    if (connectedAt) {
      const d = new Date(connectedAt);
      syncedText = 'Connected ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    card.innerHTML = `
      <div class="ebay-connect-connected">
        <div class="ebay-connect-info">
          <div class="ebay-connect-dot"></div>
          <div class="ebay-connect-details">
            <div class="ebay-connect-name">eBay Account</div>
            <div class="ebay-connect-synced">${syncedText}</div>
          </div>
        </div>
        <button class="ebay-disconnect-btn" onclick="disconnectEbay()">Disconnect</button>
      </div>`;
  }
}

async function connectEbay() {
  try {
    const res = await fetch('/api/ebay-auth');
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Failed to generate eBay authorisation URL.');
    }
  } catch(e) {
    alert('Could not reach the eBay auth endpoint.');
  }
}

function disconnectEbay() {
  localStorage.removeItem('ebayAccessToken');
  localStorage.removeItem('ebayRefreshToken');
  localStorage.removeItem('ebayConnectedAt');
  renderEbayConnectionCard();
}

// ── Reselling tracker ─────────────────────────────────────────────────────────

function switchToReselling() {
  document.getElementById('resellingPage').style.display = 'flex';
  document.getElementById('weightPage').style.display = 'none';
  document.getElementById('dashboardPage').style.display = 'none';
  document.querySelector('.main').style.display = 'none';
  document.getElementById('pastDateBanner').style.display = 'none';
  const dateInput = document.getElementById('resellingDatePurchased');
  if (dateInput && !dateInput.value) dateInput.value = todayDateStr();
  const feesToggle = document.getElementById('ebayFeesToggle');
  if (feesToggle) feesToggle.checked = localStorage.getItem('ebayFeesToggle') === 'true';
  renderEbayConnectionCard();
  renderResellingInventory();
}

function getResellingInventory() {
  try {
    const raw = localStorage.getItem('resellingInventory');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveResellingInventory(inv) {
  try { localStorage.setItem('resellingInventory', JSON.stringify(inv)); } catch(e) {}
}

async function searchEbayPrices() {
  const itemName = document.getElementById('resellingItemName').value.trim();
  if (!itemName) { alert('Please enter an item name first.'); return; }

  const resultEl = document.getElementById('ebaySearchResult');
  const btn = document.getElementById('ebaySearchBtn');

  btn.disabled = true;
  btn.textContent = 'Searching…';
  resultEl.innerHTML = `
    <div class="ebay-loading">
      <div class="dot-pulse"><span></span><span></span><span></span></div>
      <span>Searching eBay...</span>
    </div>`;

  try {
    const res = await fetch('/api/ebay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName })
    });
    const data = await res.json();

    if (data.error) {
      resultEl.innerHTML = `<div class="ebay-error">⚠ ${data.error}</div>`;
      window._lastEbayAverage = null;
      return;
    }

    if (!data.prices || data.prices.length === 0) {
      resultEl.innerHTML = `<div class="ebay-no-results">${data.message || 'No results found on eBay.'}</div>`;
      window._lastEbayAverage = null;
      return;
    }

    window._lastEbayAverage = data.average;

    const pricesHtml = data.prices.map(p => `
      <div class="ebay-price-item">
        <span class="ebay-price-title">${p.title}</span>
        <span class="ebay-price-val">£${p.price.toFixed(2)}</span>
      </div>`).join('');

    resultEl.innerHTML = `
      <div class="ebay-prices-list">${pricesHtml}</div>
      ${data.average != null ? `
        <div class="ebay-avg-banner">
          <span class="ebay-avg-label">Average of ${data.prices.length} listing${data.prices.length !== 1 ? 's' : ''}</span>
          <span class="ebay-avg-val">£${data.average.toFixed(2)}</span>
        </div>` : ''}`;

  } catch(e) {
    resultEl.innerHTML = `<div class="ebay-error">⚠ Failed to reach the eBay API — check your server credentials.</div>`;
    window._lastEbayAverage = null;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Search eBay prices';
  }
}

function addResellingItem() {
  const name = document.getElementById('resellingItemName').value.trim();
  const purchasePrice = parseFloat(document.getElementById('resellingPurchasePrice').value);

  if (!name) { alert('Please enter an item name.'); return; }
  if (!purchasePrice || purchasePrice <= 0) { alert('Please enter a valid purchase price.'); return; }

  const size = document.getElementById('resellingSize').value.trim();
  const condition = document.getElementById('resellingCondition').value;
  const platform = document.getElementById('resellingPlatform').value;
  const datePurchased = document.getElementById('resellingDatePurchased').value || todayDateStr();

  const rawListed = parseFloat(document.getElementById('resellingListedPrice').value);
  const rawSold   = parseFloat(document.getElementById('resellingSoldPrice').value);
  const listedPrice = rawListed > 0 ? rawListed : null;
  const soldPrice   = rawSold   > 0 ? rawSold   : null;

  let status = 'Holding';
  if (soldPrice != null) status = 'Sold';
  else if (listedPrice != null) status = 'Listed';

  const inv = getResellingInventory();
  inv.unshift({
    id: Date.now(),
    name,
    purchasePrice,
    size,
    condition,
    platform,
    datePurchased,
    dateAdded: new Date().toISOString(),
    ebayAvgPrice: window._lastEbayAverage != null ? window._lastEbayAverage : null,
    listedPrice,
    soldPrice,
    status
  });

  saveResellingInventory(inv);

  document.getElementById('resellingItemName').value = '';
  document.getElementById('resellingPurchasePrice').value = '';
  document.getElementById('resellingSize').value = '';
  document.getElementById('resellingListedPrice').value = '';
  document.getElementById('resellingSoldPrice').value = '';
  document.getElementById('ebaySearchResult').innerHTML = '';
  window._lastEbayAverage = null;

  renderResellingInventory();
}

function updateResellingStatus(id, status) {
  const inv = getResellingInventory();
  const item = inv.find(i => i.id === id);
  if (item) {
    item.status = status;
    saveResellingInventory(inv);
  }
}

function applyStatusStyle(sel, status) {
  sel.className = 'inv-status-select';
  if (status === 'Listed') sel.classList.add('status-listed');
  else if (status === 'Sold') sel.classList.add('status-sold');
}

function deleteResellingItem(id) {
  if (!confirm('Delete this item from your inventory?')) return;
  saveResellingInventory(getResellingInventory().filter(i => i.id !== id));
  renderResellingInventory();
}

async function fetchEbayPriceForItem(id) {
  const inv = getResellingInventory();
  const item = inv.find(i => i.id === id);
  if (!item) return;

  const cell = document.getElementById('ebay-cell-' + id);
  if (cell) cell.innerHTML = '<span style="font-family:\'DM Mono\',monospace;font-size:0.7rem;color:var(--muted);">…</span>';

  try {
    const res = await fetch('/api/ebay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: item.name })
    });
    const data = await res.json();

    if (data.average != null) {
      item.ebayAvgPrice = data.average;
      saveResellingInventory(inv);
      renderResellingInventory();
    } else {
      const msg = data.error || data.message || 'No prices found.';
      if (cell) cell.innerHTML = `<button class="inv-ebay-fetch" onclick="fetchEbayPriceForItem(${id})">Fetch</button>`;
      alert(msg);
    }
  } catch(e) {
    if (cell) cell.innerHTML = `<button class="inv-ebay-fetch" onclick="fetchEbayPriceForItem(${id})">Fetch</button>`;
    alert('Failed to fetch eBay prices.');
  }
}

function calcItemProfit(item, feesOn) {
  const mult = feesOn ? (1 - 0.128) : 1;
  if (item.soldPrice != null)   return { profit: item.soldPrice   * mult - item.purchasePrice, source: 'sold' };
  if (item.listedPrice != null) return { profit: item.listedPrice * mult - item.purchasePrice, source: 'listed' };
  if (item.ebayAvgPrice != null) return { profit: item.ebayAvgPrice * mult - item.purchasePrice, source: 'ebay' };
  return { profit: null, source: null };
}

function toggleEbayFees(el) {
  localStorage.setItem('ebayFeesToggle', el.checked ? 'true' : 'false');
  renderResellingInventory();
}

function saveResellingField(id, field, rawValue) {
  const inv = getResellingInventory();
  const item = inv.find(i => i.id === id);
  if (!item) return;
  const val = rawValue === '' ? null : parseFloat(rawValue);
  item[field] = (val != null && !isNaN(val) && val > 0) ? val : null;
  if (field === 'soldPrice' && item.soldPrice != null) item.status = 'Sold';
  saveResellingInventory(inv);
  renderResellingInventory();
}

function startEditCell(id, field, spanEl) {
  const inv = getResellingInventory();
  const item = inv.find(i => i.id === id);
  if (!item) return;
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.01';
  input.min = '0';
  input.value = item[field] != null ? item[field] : '';
  input.className = 'inv-inline-edit';
  let saved = false;
  const save = () => {
    if (saved) return;
    saved = true;
    saveResellingField(id, field, input.value);
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { saved = true; spanEl.style.display = ''; input.remove(); }
  });
  spanEl.style.display = 'none';
  spanEl.parentElement.appendChild(input);
  input.focus();
  input.select();
}

function renderResellingInventory() {
  const wrap = document.getElementById('resellingInventoryWrap');
  if (!wrap) return;

  const inv = getResellingInventory();

  if (inv.length === 0) {
    wrap.innerHTML = '<div class="inventory-empty">No items yet — add your first item above</div>';
    return;
  }

  const feesOn = localStorage.getItem('ebayFeesToggle') === 'true';
  const totalItems = inv.length;
  const totalInvested = inv.reduce((s, i) => s + i.purchasePrice, 0);

  const profitItems = inv.map(i => ({ item: i, ...calcItemProfit(i, feesOn) })).filter(x => x.profit !== null);
  const totalProfit = profitItems.reduce((s, x) => s + x.profit, 0);
  const avgMargin = profitItems.length > 0
    ? profitItems.reduce((s, x) => s + (x.item.purchasePrice > 0 ? (x.profit / x.item.purchasePrice) * 100 : 0), 0) / profitItems.length
    : null;

  const profitColor = totalProfit >= 0 ? '#4ade80' : 'var(--red)';
  const marginColor = avgMargin != null ? (avgMargin >= 0 ? '#4ade80' : 'var(--red)') : 'var(--muted)';

  const summaryHtml = `
    <div class="inventory-summary">
      <div class="inv-stat">
        <div class="inv-stat-val">${totalItems}</div>
        <div class="inv-stat-label">Total items</div>
      </div>
      <div class="inv-stat">
        <div class="inv-stat-val">£${totalInvested.toFixed(2)}</div>
        <div class="inv-stat-label">Total invested</div>
      </div>
      <div class="inv-stat">
        <div class="inv-stat-val" style="color:${profitItems.length > 0 ? profitColor : 'var(--muted)'};">
          ${profitItems.length > 0 ? (totalProfit >= 0 ? '+' : '') + '£' + totalProfit.toFixed(2) : '—'}
        </div>
        <div class="inv-stat-label">Est. profit</div>
      </div>
      <div class="inv-stat">
        <div class="inv-stat-val" style="color:${marginColor};">
          ${avgMargin != null ? (avgMargin >= 0 ? '+' : '') + avgMargin.toFixed(1) + '%' : '—'}
        </div>
        <div class="inv-stat-label">Avg margin</div>
      </div>
    </div>`;

  const rowsHtml = inv.map(item => {
    const { profit, source } = calcItemProfit(item, feesOn);
    const margin = profit != null && item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : null;
    const profitClass = profit != null ? (profit >= 0 ? 'positive' : 'negative') : '';
    const profitDisplay = profit != null ? `${profit >= 0 ? '+' : ''}£${profit.toFixed(2)}` : '—';
    const marginDisplay = margin != null ? `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%` : '—';
    const marginCol = margin != null ? (margin >= 0 ? '#4ade80' : 'var(--red)') : 'var(--muted)';

    const listedDisplay = item.listedPrice != null ? `£${item.listedPrice.toFixed(2)}` : '—';
    const soldDisplay   = item.soldPrice   != null ? `£${item.soldPrice.toFixed(2)}`   : '—';

    const ebayDisplay = item.ebayAvgPrice != null
      ? `£${item.ebayAvgPrice.toFixed(2)}`
      : `<button class="inv-ebay-fetch" onclick="fetchEbayPriceForItem(${item.id})">Fetch</button>`;

    const statusClass = item.status === 'Listed' ? 'status-listed' : item.status === 'Sold' ? 'status-sold' : '';

    return `
      <tr>
        <td><span class="inv-item-name" title="${item.name}">${item.name}</span></td>
        <td>${item.size || '—'}</td>
        <td>${item.condition}</td>
        <td class="inv-price">£${item.purchasePrice.toFixed(2)}</td>
        <td class="inv-price" id="listed-cell-${item.id}">
          <span class="editable-cell" onclick="startEditCell(${item.id},'listedPrice',this)">${listedDisplay}</span>
        </td>
        <td class="inv-price" id="sold-cell-${item.id}">
          <span class="editable-cell" onclick="startEditCell(${item.id},'soldPrice',this)">${soldDisplay}</span>
        </td>
        <td class="inv-price" id="ebay-cell-${item.id}">${ebayDisplay}</td>
        <td class="inv-profit ${profitClass}">${profitDisplay}</td>
        <td class="inv-margin" style="color:${marginCol};">${marginDisplay}</td>
        <td>${item.platform}</td>
        <td>
          <select class="inv-status-select ${statusClass}"
            onchange="updateResellingStatus(${item.id}, this.value); applyStatusStyle(this, this.value);">
            <option${item.status === 'Holding' ? ' selected' : ''}>Holding</option>
            <option${item.status === 'Listed'  ? ' selected' : ''}>Listed</option>
            <option${item.status === 'Sold'    ? ' selected' : ''}>Sold</option>
          </select>
        </td>
        <td><button class="inv-del-btn" onclick="deleteResellingItem(${item.id})">✕</button></td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    ${summaryHtml}
    <div class="inventory-table-wrap">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Size</th>
            <th>Condition</th>
            <th>Paid</th>
            <th>Listed</th>
            <th>Sold</th>
            <th>eBay avg</th>
            <th>Profit</th>
            <th>Margin</th>
            <th>Platform</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

// ── Close modals on overlay click ─────────────────────────────────────────────

document.getElementById('calendarModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeCalendar();
});
document.getElementById('mealsModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeMeals();
});

// ── Init ──────────────────────────────────────────────────────────────────────

updateDateDisplay();
loadState();
initTemplates();
populateProgressDropdown();
initEbayConnection();
renderWeightWidget();
