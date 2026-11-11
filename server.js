const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Cloud platforms expose the service through 0.0.0.0 and inject PORT.
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 4173);
const publicDir = path.join(__dirname, 'public');
// Set DATA_DIR to the mount point of a persistent disk in production.
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'responses.json');
const adminUsername = process.env.ADMIN_USERNAME || 'Administrator';
const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'admin123456');
if (!adminPassword) {
  throw new Error('ADMIN_PASSWORD must be set in production.');
}
const passwordSalt = crypto.randomBytes(16);
const adminPasswordHash = crypto.scryptSync(adminPassword, passwordSalt, 64);
const sessions = new Map();
let writeQueue = Promise.resolve();

const factorOrder = ['A', 'H', 'F', 'E'];
const factorQuestions = {
  A: ['q1', 'q2', 'q3'],
  H: ['q4', 'q5', 'q6'],
  F: ['q7', 'q8', 'q9'],
  E: ['q10', 'q11', 'q12'],
};

function setHeaders(res, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
}

function sendJson(res, status, payload, extraHeaders = {}) {
  setHeaders(res, 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.writeHead(status);
  res.end(JSON.stringify(payload));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8192) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sessionFor(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)survey_admin=([a-f0-9]+)/);
  if (!match) return null;
  const expiry = sessions.get(match[1]);
  if (!expiry || expiry <= Date.now()) {
    sessions.delete(match[1]);
    return null;
  }
  return match[1];
}

function requireAdmin(req, res) {
  if (sessionFor(req)) return true;
  sendJson(res, 401, { error: '请先登录管理员账号。' });
  return false;
}

function calculateWeights(answers) {
  const averages = {};
  for (const factor of factorOrder) {
    const ids = factorQuestions[factor];
    averages[factor] = ids.reduce((sum, id) => sum + answers[id], 0) / ids.length;
  }

  const total = factorOrder.reduce((sum, factor) => sum + averages[factor], 0);
  const exactTenths = factorOrder.map((factor) => (averages[factor] / total) * 100);
  const tenths = exactTenths.map(Math.floor);
  let remaining = 100 - tenths.reduce((sum, value) => sum + value, 0);
  const order = exactTenths
    .map((value, index) => ({ index, remainder: value - tenths[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; i < remaining; i += 1) tenths[order[i].index] += 1;

  return {
    averages: Object.fromEntries(factorOrder.map((factor) => [factor, Number(averages[factor].toFixed(2))])),
    weights: Object.fromEntries(factorOrder.map((factor, index) => [factor, tenths[index] / 10])),
  };
}

async function readSubmissions() {
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveSubmission(record) {
  const operation = writeQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const records = await readSubmissions();
    records.push(record);
    const temporaryFile = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(records, null, 2), 'utf8');
    await fs.rename(temporaryFile, dataFile);
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath)
    .then((content) => {
      setHeaders(res, contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(200);
      res.end(content);
    })
    .catch(() => {
      sendJson(res, 404, { error: '页面不存在。' });
    });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return serveFile(res, path.join(publicDir, 'index.html'), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/admin') {
    return serveFile(res, path.join(publicDir, 'admin.html'), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/styles.css') {
    return serveFile(res, path.join(publicDir, 'styles.css'), 'text/css; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/survey.js') {
    return serveFile(res, path.join(publicDir, 'survey.js'), 'text/javascript; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/admin.js') {
    return serveFile(res, path.join(publicDir, 'admin.js'), 'text/javascript; charset=utf-8');
  }

  if (req.method === 'POST' && url.pathname === '/api/submissions') {
    try {
      const body = await requestBody(req);
      const answers = body.answers;
      const expected = Object.values(factorQuestions).flat().sort();
      if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        return sendJson(res, 400, { error: '请完成全部题目后再提交。' });
      }
      if (Object.keys(answers).sort().join(',') !== expected.join(',')) {
        return sendJson(res, 400, { error: '答卷题目不完整，请检查后重试。' });
      }
      for (const value of Object.values(answers)) {
        if (!Number.isInteger(value) || value < 1 || value > 5) {
          return sendJson(res, 400, { error: '每题请选择1到5分。' });
        }
      }

      const { averages, weights } = calculateWeights(answers);
      await saveSubmission({ answers, weights });
      return sendJson(res, 201, { averages, weights });
    } catch (error) {
      console.error('Submission failed:', error.message);
      return sendJson(res, 500, { error: '提交未成功，请稍后重试。' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/session') {
    return sendJson(res, 200, { authenticated: Boolean(sessionFor(req)) });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    try {
      const body = await requestBody(req);
      const suppliedHash = crypto.scryptSync(String(body.password || ''), passwordSalt, 64);
      const valid = safeEqual(body.username || '', adminUsername) && crypto.timingSafeEqual(suppliedHash, adminPasswordHash);
      if (!valid) return sendJson(res, 401, { error: '账号或密码不正确。' });

      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
      return sendJson(res, 200, { authenticated: true }, {
        'Set-Cookie': `survey_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
      });
    } catch {
      return sendJson(res, 400, { error: '登录信息格式不正确。' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    const token = sessionFor(req);
    if (token) sessions.delete(token);
    return sendJson(res, 200, { authenticated: false }, {
      'Set-Cookie': 'survey_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/submissions') {
    if (!requireAdmin(req, res)) return;
    try {
      const records = await readSubmissions();
      const latestFirst = records.slice().reverse().map((record, index) => ({
        number: records.length - index,
        answers: record.answers,
        weights: record.weights,
      }));
      return sendJson(res, 200, { records: latestFirst });
    } catch (error) {
      console.error('History read failed:', error.message);
      return sendJson(res, 500, { error: '历史记录暂时无法读取。' });
    }
  }

  sendJson(res, 404, { error: '页面不存在。' });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用。请通过 PORT 环境变量指定其他端口。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Teen city survey is running at http://${host}:${port}`);
  console.log(`Admin username: ${adminUsername}`);
});
