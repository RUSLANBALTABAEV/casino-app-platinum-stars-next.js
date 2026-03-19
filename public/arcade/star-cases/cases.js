/**
 * Star Cases — Pure JavaScript (порт с cases.py)
 * Убран Pyodide/Python, вся логика на ванильном JS
 */

const toast = document.getElementById('cases-toast');
const toastMsg = document.getElementById('cases-toast-message');

function showToast(msg) {
  toastMsg.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

const el = {
  grid:             document.getElementById('cases-grid'),
  balance:          document.getElementById('cases-balance'),
  inventory:        document.getElementById('cases-inventory'),
  balanceMobile:    document.getElementById('cases-balance-mobile'),
  inventoryMobile:  document.getElementById('cases-inventory-mobile'),
  previewTitle:     document.getElementById('preview-title'),
  previewPrice:     document.getElementById('preview-price'),
  previewDesc:      document.getElementById('preview-description'),
  previewLoot:      document.getElementById('preview-loot'),
  history:          document.getElementById('history-feed'),
};

const btn = {
  openCase:     document.getElementById('btn-open-case'),
  clearHistory: document.getElementById('btn-clear-history'),
};

// ─── Конфиг по умолчанию ────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  cases: [
    {
      id: 'astro', name: 'Astro Explorer', price: 120,
      description: 'Соберите экипировку первооткрывателя и найдите легендарные артефакты галактики.',
      items: [
        { name: 'Шлем пионера',     rarity: 'Эпический',    chance: 6,  weight: 6,  color: '#c084fc' },
        { name: 'Плащ кометы',      rarity: 'Редкий',       chance: 14, weight: 14, color: '#38bdf8' },
        { name: 'Карманный магнитар',rarity: 'Легендарный', chance: 2,  weight: 2,  color: '#fbbf24' },
        { name: 'Астро-компас',     rarity: 'Необычный',    chance: 22, weight: 22, color: '#60a5fa' },
        { name: 'Пыль звёзд',       rarity: 'Обычный',      chance: 56, weight: 56, color: '#f4f4f5' },
      ]
    },
    {
      id: 'nova', name: 'Nova Elite', price: 220,
      description: 'Премиум-набор для лидеров сезонов. Бонусы и увеличенные шансы на звёзды.',
      items: [
        { name: 'Знак Новы',       rarity: 'Легендарный', chance: 4,  weight: 4,  color: '#f97316' },
        { name: 'Звёздный бустер', rarity: 'Эпический',   chance: 10, weight: 10, color: '#c084fc' },
        { name: '500 ★',           rarity: 'Редкий',      chance: 16, weight: 16, color: '#facc15', stars: 500 },
        { name: '200 ★',           rarity: 'Необычный',   chance: 28, weight: 28, color: '#fde68a', stars: 200 },
        { name: '95 ★',            rarity: 'Обычный',     chance: 42, weight: 42, color: '#fff7ed', stars: 95  },
      ]
    },
    {
      id: 'guardian', name: 'Guardian Arsenal', price: 160,
      description: 'Снаряжение защитника спонсорских арен. Усилители защиты и редкие жетоны.',
      items: [
        { name: 'Щит света',    rarity: 'Эпический', chance: 8,  weight: 8,  color: '#22d3ee' },
        { name: 'Армейский дрон',rarity: 'Редкий',   chance: 18, weight: 18, color: '#38bdf8' },
        { name: 'Жетон арены',  rarity: 'Редкий',    chance: 20, weight: 20, color: '#a5b4fc' },
        { name: 'Боевой стим',  rarity: 'Необычный', chance: 24, weight: 24, color: '#f4f4f5' },
        { name: '75 ★',         rarity: 'Обычный',   chance: 30, weight: 30, color: '#fde68a', stars: 75 },
      ]
    },
    {
      id: 'starlounge', name: 'Star Lounge', price: 90,
      description: 'Кейс для быстрого пополнения коллекции. Бонусы для ежедневных миссий.',
      items: [
        { name: 'Аватар премиум', rarity: 'Редкий',    chance: 12, weight: 12, color: '#fbbf24' },
        { name: 'Билет лотереи', rarity: 'Необычный',  chance: 20, weight: 20, color: '#60a5fa' },
        { name: '45 ★',          rarity: 'Обычный',    chance: 40, weight: 40, color: '#fde68a', stars: 45 },
        { name: '25 ★',          rarity: 'Обычный',    chance: 28, weight: 28, color: '#fef3c7', stars: 25 },
      ]
    },
  ]
};

// ─── Состояние ───────────────────────────────────────────────────────────────
const state = {
  cases: {},       // id → config
  order: [],       // порядок id
  selected: 'astro',
  balance: 1500,
  inventory: {},
  history: [],
};

// ─── Утилиты ─────────────────────────────────────────────────────────────────
function fmtStars(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ─── Применить конфиг ────────────────────────────────────────────────────────
function applyConfig(cfg) {
  const cases = (cfg && cfg.cases) ? cfg.cases : DEFAULT_CONFIG.cases;
  state.cases = {};
  state.order = [];
  state.inventory = {};
  state.history = [];

  for (const c of cases) {
    const id = String(c.id || c.name || `case-${state.order.length}`).toLowerCase();
    state.cases[id] = { ...c, id };
    state.order.push(id);
  }

  if (!state.cases[state.selected]) {
    state.selected = state.order[0];
  }

  el.history.innerHTML = '<p class="history-placeholder">Откройте кейс, чтобы увидеть результаты.</p>';
  renderGrid();
  renderPreview();
  updateBalanceDisplay();
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateBalanceDisplay() {
  const totalItems = Object.values(state.inventory).reduce((s, n) => s + n, 0);
  const balText = `${fmtStars(state.balance)} ★`;
  const invText = totalItems ? `${totalItems} предметов` : '0 предметов';
  el.balance.textContent = balText;
  if (el.balanceMobile) el.balanceMobile.textContent = balText;
  el.inventory.textContent = invText;
  if (el.inventoryMobile) el.inventoryMobile.textContent = invText;
}

function renderGrid() {
  el.grid.innerHTML = '';
  for (const id of state.order) {
    const c = state.cases[id];
    const card = document.createElement('button');
    card.className = 'case-card' + (id === state.selected ? ' is-active' : '');
    card.dataset.caseId = id;
    card.innerHTML = `
      <p class="case-name">${c.name}</p>
      <p class="case-description">${c.description || ''}</p>
      <div class="case-meta"><span>Стоимость</span><span>${c.price} ★</span></div>`;
    card.addEventListener('click', () => selectCase(id));
    el.grid.appendChild(card);
  }
}

function renderPreview() {
  const c = state.cases[state.selected];
  if (!c) return;

  el.previewTitle.textContent = c.name;
  el.previewPrice.textContent = `Стоимость: ${c.price} ★`;
  el.previewDesc.textContent = c.description || '';
  el.previewLoot.innerHTML = '';

  for (const item of c.items) {
    const div = document.createElement('div');
    div.className = 'loot-item';
    div.style.borderColor = `${item.color}40`;
    div.innerHTML = `
      <div class="loot-name">${item.name}</div>
      <div class="loot-rarity">${item.rarity}</div>
      <div class="loot-chance">Шанс ~ ${item.chance}%</div>`;
    el.previewLoot.appendChild(div);
  }

  // обновляем активную карточку
  el.grid.querySelectorAll('.case-card').forEach(card => {
    card.classList.toggle('is-active', card.dataset.caseId === state.selected);
  });
}

function selectCase(id) {
  state.selected = id;
  renderPreview();
}

function appendHistory(entry) {
  const placeholder = el.history.querySelector('.history-placeholder');
  if (placeholder) placeholder.remove();

  const item = document.createElement('div');
  item.className = 'history-entry';
  item.innerHTML = `
    <strong>${entry.name}</strong>
    <span style="color:${entry.color};font-size:12px;text-transform:uppercase;letter-spacing:.12em">${entry.rarity}</span>
    <span class="history-meta">${entry.description}</span>`;
  el.history.prepend(item);

  state.history.unshift(entry);
  if (state.history.length > 6) {
    state.history.pop();
    const last = el.history.lastElementChild;
    if (last) last.remove();
  }
}

function handleOpenCase() {
  const c = state.cases[state.selected];
  if (!c) return;

  if (state.balance < c.price) {
    showToast('Недостаточно звёзд для открытия кейса');
    return;
  }

  state.balance -= c.price;
  const reward = weightedRandom(c.items);
  state.inventory[reward.name] = (state.inventory[reward.name] || 0) + 1;

  if (reward.stars) state.balance += reward.stars;

  updateBalanceDisplay();
  appendHistory({
    name: reward.name,
    rarity: reward.rarity,
    color: reward.color,
    description: `Шанс ${reward.chance}% • ${c.name}`,
  });

  showToast(reward.stars ? `Получено ${reward.stars} ★!` : `Получено: ${reward.name}`);
}

function handleClearHistory() {
  state.history = [];
  el.history.innerHTML = '<p class="history-placeholder">Откройте кейс, чтобы увидеть результаты.</p>';
  showToast('История очищена');
}

// ─── Обработчики postMessage от Next.js ──────────────────────────────────────
window.addEventListener('message', (event) => {
  if (!event?.data?.type) return;
  const { type, payload } = event.data;
  if (type === 'STAR_CASES_CONFIG') {
    try { applyConfig(payload); } catch (e) { showToast('Ошибка конфигурации'); }
  }
  if (type === 'STAR_CASES_BALANCE' && typeof payload?.available === 'number') {
    state.balance = payload.available;
    updateBalanceDisplay();
  }
});

// ─── Инициализация ───────────────────────────────────────────────────────────
btn.openCase.addEventListener('click', handleOpenCase);
btn.clearHistory.addEventListener('click', handleClearHistory);
applyConfig(DEFAULT_CONFIG);
