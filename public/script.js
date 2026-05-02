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

// ── Storage ──────────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toDateString();
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('formTrackerHistory') || '{}'); } catch(e) { return {}; }
}

function saveHistory(history) {
  try { localStorage.setItem('formTrackerHistory', JSON.stringify(history)); } catch(e) {}
}

function saveToHistory() {
  const history = loadHistory();
  const snapshot = {
    foods: state.foods,
    steps: state.steps,
    sleep: state.sleep,
    workout: state.workout,
    activityNotes: state.activityNotes
  };
  history[todayKey()] = snapshot;
  saveHistory(history);
  // Keep a rolling "prev" snapshot so rollover logic can commit it
  // if the date changes while the page stays open.
  try { localStorage.setItem('formTrackerPrev', JSON.stringify(snapshot)); } catch(e) {}
}

function loadState() {
  try {
    // Rollover: if the app was open yesterday and data was logged, ensure it's
    // committed to history under the correct date key before we start today.
    const lastActive = localStorage.getItem('formTrackerLastDate');
    if (lastActive && lastActive !== todayKey()) {
      // Load yesterday's in-flight state and persist it, then start fresh.
      const history = loadHistory();
      if (!history[lastActive]) {
        const prev = localStorage.getItem('formTrackerPrev');
        if (prev) {
          try { history[lastActive] = JSON.parse(prev); saveHistory(history); } catch(e) {}
        }
      }
      // Clear the in-flight prev snapshot now that it's committed.
      localStorage.removeItem('formTrackerPrev');
    }
    localStorage.setItem('formTrackerLastDate', todayKey());

    const saved = localStorage.getItem('formTracker');
    const today = todayKey();
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.targets) state.targets = { ...state.targets, ...parsed.targets };
      // migrate old per-day data into history if it's from today
      if (parsed.date === today && parsed.foods) {
        state.foods = parsed.foods || [];
        state.steps = parsed.steps ?? null;
        state.sleep = parsed.sleep ?? null;
        state.workout = parsed.workout || '';
        state.activityNotes = parsed.activityNotes || '';
        saveToHistory();
      }
    }
    // load today from history
    const history = loadHistory();
    if (history[today]) {
      const d = history[today];
      state.foods = d.foods || [];
      state.steps = d.steps ?? null;
      state.sleep = d.sleep ?? null;
      state.workout = d.workout || '';
      state.activityNotes = d.activityNotes || '';
    }
  } catch(e) {}
  loadTargetInputs();
  renderAll();
}

function saveState() {
  try {
    localStorage.setItem('formTracker', JSON.stringify({
      date: todayKey(),
      targets: state.targets
    }));
  } catch(e) {}
  saveToHistory();
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
  document.getElementById('sleepDisplay').innerHTML = state.sleep != null ? state.sleep + '<span style="font-size:1rem">h</span>' : '—<span style="font-size:1rem">h</span>';

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
  document.getElementById('statSleepRemain').innerHTML = (state.sleep != null ? Math.max(0, tgt.sleep - state.sleep) : tgt.sleep) + '<span class="sc-unit">h</span>';
  document.getElementById('statKcalBar').style.width = barPct(Math.round(t.kcal), tgt.kcal) + '%';
  document.getElementById('statPBar').style.width = barPct(Math.round(t.protein), tgt.protein) + '%';
  document.getElementById('statStepsBar').style.width = (state.steps != null ? barPct(state.steps, tgt.steps) : 0) + '%';
  document.getElementById('statSleepBar').style.width = (state.sleep != null ? barPct(state.sleep, tgt.sleep) : 0) + '%';

  document.getElementById('workoutDisplay').textContent = state.workout || 'Rest';
  document.getElementById('activityNotesDisplay').textContent = state.activityNotes || '';

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
  const macroUnits = (100 - 4 * gapSize) / 4; // 22 units per macro

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
  const history = loadHistory();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const isToday = i === 0;
    const dayData = isToday
      ? { foods: state.foods, steps: state.steps }
      : (history[key] || null);

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
  if (confirm('Clear all food entries for today?')) {
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
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  event.target.classList.add('active');
  if (id === 'workout') initWorkoutTab();
}

// ── Date display ──────────────────────────────────────────────────────────────

function updateDate() {
  const now = new Date();
  document.getElementById('dateDisplay').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
  const history = loadHistory();
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
    const dateKey = dateObj.toDateString();
    const isToday = dateKey === now.toDateString();
    const hasData = !!history[dateKey] && (
      (history[dateKey].foods && history[dateKey].foods.length > 0) ||
      history[dateKey].steps != null
    );
    const classes = ['cal-day', hasData ? 'has-data' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    const dot = hasData ? '<div class="dot"></div>' : '';
    html += `<div class="${classes}" onclick="showDayDetail('${dateKey}')">${d}${dot}</div>`;
  }

  document.getElementById('calGrid').innerHTML = html;
}

function showDayDetail(dateKey) {
  const history = loadHistory();
  const data = history[dateKey];
  const detail = document.getElementById('dayDetail');

  if (!data || ((!data.foods || data.foods.length === 0) && data.steps == null && data.sleep == null)) {
    detail.style.display = 'block';
    detail.innerHTML = `<div class="day-detail-title">${dateKey}</div><div style="font-family:'DM Mono',monospace;font-size:0.8rem;color:var(--muted);">No data logged for this day.</div>`;
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
    <div class="day-detail-title">${dateKey}</div>
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
  return loadWorkouts()[todayKey()] || { type: '', exercises: {} };
}

function addSet(name) {
  const s = exSlug(name);
  const wEl = document.getElementById('wi_' + s);
  const rEl = document.getElementById('ri_' + s);
  const weight = parseFloat(wEl.value);
  const reps   = parseInt(rEl.value);
  if (!weight || !reps || weight <= 0 || reps <= 0) { alert('Enter a valid weight and rep count.'); return; }

  const workouts = loadWorkouts();
  const today = todayKey();
  if (!workouts[today]) workouts[today] = { type: currentWorkoutType, exercises: {} };
  if (!workouts[today].exercises[name]) workouts[today].exercises[name] = [];
  workouts[today].exercises[name].push({ weight, reps });
  saveWorkouts(workouts);

  wEl.value = '';
  rEl.value = '';
  refreshExerciseCard(name);
}

function deleteSet(name, idx) {
  const workouts = loadWorkouts();
  const sets = workouts[todayKey()]?.exercises?.[name];
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
  const today = todayKey();
  if (!workouts[today]) workouts[today] = { type, exercises: {} };
  else workouts[today].type = type;
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
  if (sel.querySelectorAll('optgroup').length > 0) return; // already populated
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
  initWorkoutTab = () => {}; // run once; dropdown is already populated after first call

  const workouts = loadWorkouts();
  const saved = workouts[todayKey()];
  if (saved?.type && WORKOUT_PLANS[saved.type]) {
    currentWorkoutType = saved.type;
    document.querySelectorAll('.wo-type-btn').forEach(btn => {
      if (btn.textContent === saved.type) btn.classList.add('active');
    });
    renderExerciseList(saved.type);
  }
}

// ── Close modals on overlay click ─────────────────────────────────────────────

document.getElementById('calendarModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeCalendar();
});
document.getElementById('mealsModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeMeals();
});

// ── Init ──────────────────────────────────────────────────────────────────────

updateDate();
loadState();
populateProgressDropdown();
