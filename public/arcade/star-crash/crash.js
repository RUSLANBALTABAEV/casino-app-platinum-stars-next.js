const root = document.getElementById('crash-root');
const toast = document.getElementById('crash-toast');
const toastMessage = document.getElementById('crash-toast-message');

const elements = {
  balance: document.getElementById('crash-balance'),
  betDisplay: document.getElementById('crash-bet-display'),
  multiplierLabel: document.getElementById('multiplier-label'),
  statusBadge: document.getElementById('round-status'),
  history: document.getElementById('crash-history'),
  canvas: document.getElementById('crash-canvas'),
  betInput: document.getElementById('bet-input')
};

const buttons = {
  start: document.getElementById('btn-start-round'),
  cashout: document.getElementById('btn-cashout'),
  clearHistory: document.getElementById('btn-clear-history'),
  chips: document.querySelectorAll('.chip-btn')
};

const defaultConfig = {
  baseBet: 50,
  maxMultiplier: 12,
  autoCashout: 0,
  roundDelay: 4
};

const state = {
  config: { ...defaultConfig },
  balance: 300,
  bet: 50,
  running: false,
  awaitingStart: false,
  multiplier: 1,
  crashPoint: 2.4,
  history: [],
  animationFrame: null,
  startTime: 0,
  elapsed: 0,
  serverSynced: false,
  initDataRaw: null,
  balancePollId: null,
  path: []
};

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function formatMultiplier(value) {
  return `x${value.toFixed(2)}`;
}

function updateBalanceDisplay() {
  elements.balance.textContent = `${Math.max(0, Math.round(state.balance))} ★`;
}

async function fetchBalance() {
  if (!state.initDataRaw) {
    return;
  }
  try {
    const response = await fetch('/api/mini-app/balance', {
      headers: {
        Accept: 'application/json',
        'x-telegram-init-data': state.initDataRaw
      }
    });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    if (payload?.balance?.available !== undefined) {
      state.balance = Math.max(0, Math.round(payload.balance.available));
      state.serverSynced = true;
      updateBalanceDisplay();
    }
  } catch (error) {
    // ignore
  }
}

function startBalancePolling() {
  if (state.balancePollId) {
    clearInterval(state.balancePollId);
  }
  state.balancePollId = setInterval(fetchBalance, 15000);
}

function updateBetDisplay() {
  elements.betDisplay.textContent = `${Math.round(state.bet)} ★`;
  elements.betInput.value = Math.round(state.bet);
}

function setStatus(label, variant) {
  elements.statusBadge.textContent = label;
  elements.statusBadge.dataset.variant = variant || '';
}

function updateMultiplierDisplay() {
  elements.multiplierLabel.textContent = formatMultiplier(state.multiplier);
}

function setControlsEnabled(isEnabled) {
  buttons.start.disabled = !isEnabled;
  buttons.cashout.disabled = isEnabled;
  elements.betInput.disabled = !isEnabled;
  buttons.chips.forEach((button) => {
    button.disabled = !isEnabled;
  });
}

function updateHistory() {
  if (!state.history.length) {
    elements.history.innerHTML =
      '<p class="history-placeholder">Запустите раунд, чтобы увидеть результаты.</p>';
    return;
  }

  elements.history.innerHTML = '';
  state.history.slice(-8).reverse().forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <span>${formatMultiplier(entry.crash)}</span>
      <span>${entry.result}</span>
      <span>${entry.payout > 0 ? `+${entry.payout} ★` : '—'}</span>
    `;
    elements.history.appendChild(row);
  });
}

const ctx = elements.canvas.getContext('2d');

function resizeCanvas() {
  const { width, height } = elements.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  elements.canvas.width = Math.round(width * dpr);
  elements.canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawChart() {
  const { width, height } = elements.canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 214, 10, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const points = state.path;
  if (!points.length) {
    ctx.stroke();
    return;
  }
  points.forEach((point, index) => {
    const x = (point.t / 12) * width;
    const y = height - (point.mult / state.config.maxMultiplier) * (height - 12) - 6;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function generateCrashPoint(maxMultiplier) {
  const roll = Math.random();
  const weighted = 1 / Math.max(0.08, roll);
  return Math.min(maxMultiplier, Math.max(1.1, weighted));
}

function stopAnimation() {
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
}

function finalizeRound(result, payout) {
  state.history.push({
    crash: state.multiplier,
    result,
    payout
  });
  updateHistory();
  setControlsEnabled(true);
  state.running = false;
  state.awaitingStart = false;
  state.elapsed = 0;
  state.path = [];
  updateBalanceDisplay();
  setStatus('Ожидание', 'idle');
}

function crashRound() {
  stopAnimation();
  setStatus('Обрушение', 'crash');
  showToast('Множитель обрушился!');
  finalizeRound('Crash', 0);
  updateMultiplierDisplay();
  drawChart();
}

function tickFrame(timestamp) {
  if (!state.running) {
    return;
  }
  if (!state.startTime) {
    state.startTime = timestamp;
  }
  const elapsedSeconds = (timestamp - state.startTime) / 1000;
  state.elapsed = elapsedSeconds;
  const growth = 1 + elapsedSeconds * 0.7 + Math.pow(elapsedSeconds, 1.3) * 0.22;
  state.multiplier = Math.min(state.config.maxMultiplier, growth);
  state.path.push({ t: elapsedSeconds, mult: state.multiplier });
  updateMultiplierDisplay();
  drawChart();

  if (state.multiplier >= state.crashPoint) {
    crashRound();
    return;
  }

  if (state.config.autoCashout && state.multiplier >= state.config.autoCashout) {
    handleCashout();
    return;
  }

  state.animationFrame = requestAnimationFrame(tickFrame);
}

function handleStart() {
  if (state.running || state.awaitingStart) {
    showToast('Раунд уже готовится');
    return;
  }
  if (state.bet <= 0 || state.bet > state.balance) {
    showToast('Недостаточно звёзд для ставки');
    return;
  }

  if (!state.serverSynced) {
    state.balance -= state.bet;
  }
  updateBalanceDisplay();
  setControlsEnabled(false);
  setStatus('Подготовка', 'waiting');
  state.awaitingStart = true;
  showToast('Готовим запуск...');

  setTimeout(() => {
    state.awaitingStart = false;
    state.running = true;
    state.multiplier = 1;
    state.crashPoint = generateCrashPoint(state.config.maxMultiplier);
    state.path = [];
    state.startTime = 0;
    setStatus('Режим x', 'running');
    state.animationFrame = requestAnimationFrame(tickFrame);
  }, Math.max(1, state.config.roundDelay) * 1000);
}

function handleCashout() {
  if (!state.running) {
    showToast('Раунд ещё не запущен');
    return;
  }
  stopAnimation();
  const payout = Math.max(0, Math.round(state.bet * state.multiplier));
  if (!state.serverSynced) {
    state.balance += payout;
  }
  showToast(`Вы забрали ${payout} ★`);
  finalizeRound('Cashout', payout);
  updateMultiplierDisplay();
  drawChart();
}

function setBet(value) {
  const sanitized = Math.max(1, Math.round(value));
  state.bet = sanitized;
  updateBetDisplay();
}

function applyConfig(nextConfig) {
  state.config = { ...state.config, ...nextConfig };
  if (state.config.baseBet) {
    setBet(state.config.baseBet);
  }
  updateMultiplierDisplay();
}

buttons.start.addEventListener('click', handleStart);
buttons.cashout.addEventListener('click', handleCashout);
buttons.clearHistory.addEventListener('click', () => {
  state.history = [];
  updateHistory();
});
elements.betInput.addEventListener('change', (event) => {
  const value = Number.parseInt(event.target.value, 10);
  if (Number.isFinite(value)) {
    setBet(value);
  }
});
buttons.chips.forEach((button) => {
  button.addEventListener('click', () => {
    const value = Number.parseInt(button.dataset.bet || '0', 10);
    if (value) {
      setBet(value);
    }
  });
});

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'STAR_CRASH_CONFIG' && data.payload) {
    applyConfig(data.payload);
  }
  if (data.type === 'STAR_CRASH_BALANCE' && typeof data.payload?.available === 'number') {
    state.balance = Math.max(0, Math.round(data.payload.available));
    state.serverSynced = true;
    updateBalanceDisplay();
  }
  if (data.type === 'STAR_CRASH_AUTH' && data.payload?.initDataRaw) {
    state.initDataRaw = data.payload.initDataRaw;
    fetchBalance();
    startBalancePolling();
  }
});

resizeCanvas();
updateBalanceDisplay();
updateBetDisplay();
updateMultiplierDisplay();
updateHistory();
setStatus('Ожидание', 'idle');

window.addEventListener('resize', () => {
  resizeCanvas();
  drawChart();
});
