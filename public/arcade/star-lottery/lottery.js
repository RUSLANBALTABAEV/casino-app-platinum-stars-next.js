/**
 * Star Lottery — Pure JavaScript (порт с lottery.py)
 * Убран Pyodide/Python, вся логика на ванильном JS
 */

const toast = document.getElementById('lottery-toast');
const toastMsg = document.getElementById('lottery-toast-message');

function showToast(msg) {
  toastMsg.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

const el = {
  balance:          document.getElementById('lottery-balance'),
  pot:              document.getElementById('lottery-pot'),
  participantCount: document.getElementById('participant-count'),
  progressFill:     document.getElementById('progress-fill'),
  ticketList:       document.getElementById('ticket-list'),
  history:          document.getElementById('lottery-history'),
  winnerName:       document.getElementById('winner-name'),
  winnerMeta:       document.getElementById('winner-meta'),
  subtitle:         document.getElementById('lottery-subtext'),
  poolSelector:     document.getElementById('lottery-pools'),
};

const btn = {
  buyTicket:    document.getElementById('btn-buy-ticket'),
  simulate:     document.getElementById('btn-simulate'),
  clearHistory: document.getElementById('btn-clear-history'),
};

// ─── Конфиг по умолчанию ────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  pools: [
    {
      id: 'nova-10', name: 'Nova 10', participantLimit: 10, ticketCost: 5, prizePercent: 0.82,
      distribution: [{ place: 1, share: 0.7 }, { place: 2, share: 0.3 }]
    },
    {
      id: 'quantum-15', name: 'Quantum 15', participantLimit: 15, ticketCost: 9, prizePercent: 0.88,
      distribution: [{ place: 1, share: 0.6 }, { place: 2, share: 0.25 }, { place: 3, share: 0.15 }]
    },
    {
      id: 'apex-25', name: 'Apex 25', participantLimit: 25, ticketCost: 12, prizePercent: 0.90,
      distribution: [{ place: 1, share: 0.5 }, { place: 2, share: 0.25 }, { place: 3, share: 0.15 }, { place: 4, share: 0.1 }]
    },
  ]
};

const NAMES = ['Astra','Nova','Zenith','Lyra','Altair','Orion','Vega','Phoenix','Kest','Mira',
               'Seren','Onyx','Aria','Lumos','Quill','Vesper','Helix','Styx','Echo','Nyx'];
const SUFFIXES = ['', ' X', ' Prime', ' Nova', ' Zero'];

const state = {
  balance: 120,
  pools: {},    // id → config
  order: [],
  selectedPool: '',
  poolStates: {}, // id → { tickets, history, drawCounter, lastWinners }
};

// ─── Утилиты ─────────────────────────────────────────────────────────────────
function fmtStars(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)] +
         SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
}

function getPoolState(id) {
  if (!state.poolStates[id]) {
    state.poolStates[id] = { tickets: [], history: [], drawCounter: 1, lastWinners: [] };
  }
  return state.poolStates[id];
}

function currentCtx() {
  const id = state.selectedPool;
  return { id, cfg: state.pools[id], ps: getPoolState(id) };
}

// ─── Применить конфиг ────────────────────────────────────────────────────────
function applyConfig(cfg) {
  const pools = (cfg && cfg.pools) ? cfg.pools : DEFAULT_CONFIG.pools;
  state.pools = {};
  state.order = [];
  state.poolStates = {};

  for (const p of pools) {
    const id = String(p.id || p.name || `pool-${state.order.length}`).toLowerCase();
    state.pools[id] = { ...p, id };
    state.order.push(id);
    getPoolState(id);
  }

  if (!state.pools[state.selectedPool]) {
    state.selectedPool = state.order[0];
  }

  buildPoolSelector();
  refreshUI();
  updateBalance();
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateBalance() {
  el.balance.textContent = `${fmtStars(state.balance)} ★`;
}

function buildPoolSelector() {
  el.poolSelector.innerHTML = '';
  for (const id of state.order) {
    const cfg = state.pools[id];
    const btn = document.createElement('button');
    btn.className = 'pool-chip' + (id === state.selectedPool ? ' is-active' : '');
    btn.dataset.poolId = id;
    btn.innerHTML = `
      <span class="pool-chip__title">${cfg.name}</span>
      <span class="pool-chip__meta">${cfg.participantLimit} мест • ${cfg.ticketCost} ★</span>`;
    btn.addEventListener('click', () => selectPool(id));
    el.poolSelector.appendChild(btn);
  }
}

function highlightActivePool() {
  el.poolSelector.querySelectorAll('.pool-chip').forEach(b => {
    b.classList.toggle('is-active', b.dataset.poolId === state.selectedPool);
  });
}

function selectPool(id) {
  if (!state.pools[id]) return;
  state.selectedPool = id;
  highlightActivePool();
  refreshUI();
}

function refreshUI() {
  const { cfg, ps } = currentCtx();
  if (!cfg || !ps) return;

  const pct = Math.round(cfg.prizePercent * 100);
  el.subtitle.textContent =
    `${cfg.name} • ${cfg.participantLimit} участников • Билет ${cfg.ticketCost} ★ • ${pct}% банка в призах`;

  btn.buyTicket.textContent = `Купить билет за ${cfg.ticketCost} ★`;
  btn.simulate.textContent  = `Заполнить до ${cfg.participantLimit} участников`;

  updatePot();
  updateProgress();
  rerenderTickets();
  renderHistory();
  updateWinnerCard();
  updateBalance();
  highlightActivePool();
}

function updatePot() {
  const { cfg, ps } = currentCtx();
  el.pot.textContent = cfg ? `${fmtStars(ps.tickets.length * cfg.ticketCost)} ★` : '0 ★';
}

function updateProgress() {
  const { cfg, ps } = currentCtx();
  if (!cfg) { el.participantCount.textContent = '0 / 0'; el.progressFill.style.width = '0%'; return; }
  const count = ps.tickets.length;
  el.participantCount.textContent = `${count} / ${cfg.participantLimit}`;
  el.progressFill.style.width = `${(count / cfg.participantLimit) * 100}%`;
}

function rerenderTickets() {
  const { ps } = currentCtx();
  el.ticketList.innerHTML = '';
  const last8 = ps.tickets.slice(-8).reverse();
  for (const t of last8) {
    const tile = document.createElement('div');
    tile.className = 'ticket-item';
    tile.innerHTML = `<span class="ticket-id">#${t.id}</span><span class="ticket-owner">${t.owner}</span>`;
    el.ticketList.appendChild(tile);
  }
}

function renderHistory() {
  const { ps } = currentCtx();
  el.history.innerHTML = '';
  if (!ps.history.length) {
    el.history.innerHTML = '<p class="history-placeholder">Участвуйте в розыгрыше, чтобы увидеть результаты.</p>';
    return;
  }
  for (const entry of ps.history) {
    const card = document.createElement('div');
    card.className = 'history-entry';
    card.innerHTML = `
      <strong>${entry.title}</strong>
      <span style="font-size:12px;color:rgba(244,244,245,.6)">${entry.subtitle}</span>`;
    el.history.appendChild(card);
  }
}

function updateWinnerCard() {
  const { ps } = currentCtx();
  if (!ps.lastWinners.length) {
    el.winnerName.textContent = 'Победитель ещё не определён';
    el.winnerMeta.textContent = 'Покупайте билеты, чтобы стать первым победителем!';
    return;
  }
  const w = ps.lastWinners[0];
  el.winnerName.textContent = w.owner;
  el.winnerMeta.textContent = `Выплата: ${fmtStars(w.reward)} ★`;
}

// ─── Игровая логика ──────────────────────────────────────────────────────────
function drawWinner() {
  const { cfg, ps } = currentCtx();
  if (!cfg || ps.tickets.length < cfg.participantLimit) return;

  const pot = ps.tickets.length * cfg.ticketCost;
  const shuffled = [...ps.tickets].sort(() => Math.random() - 0.5);
  const winners = [];

  if (cfg.distribution && cfg.distribution.length) {
    let available = [...shuffled];
    for (const dist of cfg.distribution) {
      if (!available.length) break;
      const ticket = available.pop();
      const reward = Math.floor(pot * dist.share);
      winners.push({ place: dist.place, owner: ticket.owner, reward });
    }
  } else {
    const ticket = shuffled[0];
    winners.push({ place: 1, owner: ticket.owner, reward: Math.floor(pot * cfg.prizePercent) });
  }

  const userWin = winners.filter(w => w.owner === 'Вы').reduce((s, w) => s + w.reward, 0);
  if (userWin > 0) {
    state.balance += userWin;
    showToast(`Вы выиграли ${fmtStars(userWin)} ★!`);
  } else {
    showToast(`Победители: ${winners.slice(0, 2).map(w => w.owner).join(', ')}`);
  }

  const summary = winners.map(w => `${w.owner} — ${fmtStars(w.reward)} ★`).join(' • ');
  ps.history.unshift({ title: `Тираж #${ps.drawCounter}`, subtitle: summary });
  ps.history = ps.history.slice(0, 6);
  ps.drawCounter++;
  ps.tickets = [];
  ps.lastWinners = winners;

  updateWinnerCard();
  updatePot();
  updateProgress();
  rerenderTickets();
  renderHistory();
}

function handleBuyTicket() {
  const { cfg, ps } = currentCtx();
  if (!cfg) return;

  if (ps.tickets.length >= cfg.participantLimit) {
    showToast('Тираж уже сформирован. Дождитесь розыгрыша.'); return;
  }
  if (state.balance < cfg.ticketCost) {
    showToast('Недостаточно звёзд для покупки билета.'); return;
  }

  state.balance -= cfg.ticketCost;
  const id = String(ps.tickets.length + 1).padStart(2, '0');
  ps.tickets.push({ id, owner: 'Вы' });

  updateBalance(); updatePot(); updateProgress(); rerenderTickets();
  showToast('Билет приобретён!');

  if (ps.tickets.length >= cfg.participantLimit) drawWinner();
}

function handleSimulate() {
  const { cfg, ps } = currentCtx();
  if (!cfg) return;

  if (ps.tickets.length >= cfg.participantLimit) {
    showToast('Тираж заполнен. Покупайте билеты в следующем.'); return;
  }

  const remaining = cfg.participantLimit - ps.tickets.length;
  const add = Math.min(remaining, Math.floor(Math.random() * (remaining - 4)) + 5);
  for (let i = 0; i < add; i++) {
    const id = String(ps.tickets.length + 1).padStart(2, '0');
    ps.tickets.push({ id, owner: randomName() });
  }

  updatePot(); updateProgress(); rerenderTickets();
  if (ps.tickets.length >= cfg.participantLimit) drawWinner();
  else showToast('Добавлены новые участники.');
}

function handleClearHistory() {
  const { ps } = currentCtx();
  ps.history = []; ps.lastWinners = []; ps.drawCounter = 1;
  renderHistory(); updateWinnerCard();
  showToast('История очищена');
}

// ─── postMessage от Next.js ───────────────────────────────────────────────────
window.addEventListener('message', (event) => {
  if (!event?.data?.type) return;
  const { type, payload } = event.data;
  if (type === 'STAR_LOTTERY_CONFIG') {
    try { applyConfig(payload); } catch (e) { showToast('Ошибка конфигурации'); }
  }
  if (type === 'STAR_LOTTERY_BALANCE' && typeof payload?.available === 'number') {
    state.balance = payload.available;
    updateBalance();
  }
});

// ─── Инициализация ───────────────────────────────────────────────────────────
btn.buyTicket.addEventListener('click', handleBuyTicket);
btn.simulate.addEventListener('click', handleSimulate);
btn.clearHistory.addEventListener('click', handleClearHistory);
applyConfig(DEFAULT_CONFIG);
