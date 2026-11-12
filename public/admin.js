const loginPanel = document.querySelector('#login-panel');
const historyPanel = document.querySelector('#history-panel');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const historyMessage = document.querySelector('#history-message');

function setAuthenticated(authenticated) {
  loginPanel.hidden = authenticated;
  historyPanel.hidden = !authenticated;
  if (authenticated) loadHistory();
}

async function checkSession() {
  try {
    const response = await fetch('/api/admin/session', { cache: 'no-store' });
    const payload = await response.json();
    setAuthenticated(payload.authenticated);
  } catch {
    loginMessage.textContent = '暂时无法连接服务器。';
  }
}

function buildTable(records) {
  const table = document.querySelector('#history-table');
  const head = table.querySelector('thead');
  const body = table.querySelector('tbody');
  const headerRow = document.createElement('tr');
  for (const label of ['记录', ...Array.from({ length: 12 }, (_, index) => `Q${index + 1}`), 'A权重', 'H权重', 'F权重', 'E权重']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    headerRow.append(cell);
  }
  head.replaceChildren(headerRow);

  const rows = records.map((record) => {
    const row = document.createElement('tr');
    const number = document.createElement('th');
    number.scope = 'row';
    number.textContent = String(record.number);
    row.append(number);
    for (let index = 1; index <= 12; index += 1) {
      const cell = document.createElement('td');
      cell.textContent = String(record.answers[`q${index}`]);
      row.append(cell);
    }
    for (const factor of ['A', 'H', 'F', 'E']) {
      const cell = document.createElement('td');
      cell.className = 'weight-cell';
      cell.textContent = Number(record.weights[factor]).toFixed(1);
      row.append(cell);
    }
    return row;
  });
  body.replaceChildren(...rows);
  document.querySelector('#record-count').textContent = `${records.length} 份答卷`;
}

async function loadHistory() {
  historyMessage.textContent = '';
  try {
    const response = await fetch('/api/admin/submissions', { cache: 'no-store' });
    const payload = await response.json();
    if (response.status === 401) return setAuthenticated(false);
    if (!response.ok) throw new Error(payload.error || '历史记录加载失败。');
    buildTable(payload.records);
  } catch (error) {
    historyMessage.textContent = error.message;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  loginMessage.textContent = '';
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.querySelector('#username').value,
        password: document.querySelector('#password').value,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '登录失败。');
    loginForm.reset();
    setAuthenticated(true);
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  document.querySelector('#history-table tbody').replaceChildren();
  setAuthenticated(false);
});

checkSession();
