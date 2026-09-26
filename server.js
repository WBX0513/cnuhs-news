/* cnuhs-news Node.js 服务器（零依赖，只用内置模块）
   - 静态托管整个网站文件夹
   - API：
     GET  /api/list        全部文章（按日期倒序）
     POST /api/save        保存文章 { article } → 写 data/<id>.json + 更新 index.json
     POST /api/delete      删除文章 { id }     → 删 data/<id>.json + 更新 index.json
   - 监听 0.0.0.0，局域网内其他电脑也可通过 http://<本机IP>:8000 访问 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// 打包成 exe（pkg）后 __dirname 指向虚拟快照，需改用 exe 实际所在目录
const ROOT = process.pkg ? path.dirname(process.execPath) : __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 8000;

/* ---------- 工具 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2'
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > (limit || 10 * 1024 * 1024)) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

/* ---------- data/ 文件夹操作 ---------- */
function listArticles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter(f => /\.json$/i.test(f) && f !== 'index.json')
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      } catch (e) { return null; }
    })
    .filter(a => a && a.id)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function rebuildIndex() {
  const ids = listArticles().map(a => a.id);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(ids, null, 2) + '\n');
  return ids;
}

function saveArticle(a) {
  if (!a || !safeId(a.id)) throw new Error('invalid article id');
  if (!a.title || typeof a.title !== 'string') throw new Error('missing title');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, a.id + '.json'), JSON.stringify(a, null, 2) + '\n');
  rebuildIndex();
}

function deleteArticle(id) {
  if (!safeId(id)) throw new Error('invalid id');
  const f = path.join(DATA_DIR, id + '.json');
  if (fs.existsSync(f)) fs.unlinkSync(f);
  rebuildIndex();
}

/* ---------- 静态文件 ---------- */
function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { // 防目录穿越
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': ext === '.html' ? 'no-store' : 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- 服务器 ---------- */
const server = http.createServer(async (req, res) => {
  const urlPath = req.url || '/';

  try {
    if (urlPath.startsWith('/api/')) {
      if (req.method === 'GET' && urlPath === '/api/list') {
        return sendJson(res, 200, listArticles());
      }
      if (req.method === 'POST' && (urlPath === '/api/save' || urlPath === '/api/delete')) {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        if (urlPath === '/api/save') {
          saveArticle(body.article || body);
          return sendJson(res, 200, { ok: true, list: listArticles() });
        } else {
          deleteArticle(body.id);
          return sendJson(res, 200, { ok: true, list: listArticles() });
        }
      }
      return sendJson(res, 404, { error: 'unknown api' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end(); return;
    }
    serveStatic(req, res, urlPath);
  } catch (e) {
    sendJson(res, 400, { error: e.message || String(e) });
  }
});

server.on('error', err => {
  if (err.code !== 'EADDRINUSE') {
    console.error('服务器启动失败：', err.message);
    process.exit(1);
  }
  // 端口被占：先看是不是本站已在运行（是则提示后正常退出）
  const probe = http.get({ host: 'localhost', port: PORT, path: '/api/list', timeout: 1500 }, r => {
    if (r.statusCode === 200) {
      console.log('检测到新闻站服务器已经在运行：http://localhost:' + PORT + '/');
      console.log('无需重复启动，直接用浏览器访问上面的地址即可。');
      openBrowser(PORT);
      setTimeout(() => process.exit(0), 200);
    } else {
      tryNextPort();
    }
  });
  probe.on('error', tryNextPort);
  probe.on('timeout', () => { probe.destroy(); tryNextPort(); });
});

// 被其它程序占用时自动换端口（8001~8020）
let portTry = PORT;
function tryNextPort() {
  portTry++;
  if (portTry > PORT + 20) {
    console.error('端口 ' + PORT + ' ~ ' + (PORT + 20) + ' 都被占用，无法启动。');
    process.exit(1);
  }
  console.log('端口 ' + (portTry - 1) + ' 被其它程序占用，改用 ' + portTry + ' …');
  server.listen(portTry, '0.0.0.0');
}

// 启动成功后自动打开浏览器（Windows）
function openBrowser(port) {
  if (process.platform !== 'win32') return;
  try {
    require('child_process').exec('start "" http://localhost:' + port + '/');
  } catch (e) {}
}

server.listen(PORT, '0.0.0.0', () => {
  const port = server.address().port;
  console.log('============================================');
  console.log('  cnuhs-news 校园新闻站服务器已启动');
  console.log('============================================');
  console.log('  本机访问:   http://localhost:' + port + '/');
  try {
    const os = require('os');
    const nets = os.networkInterfaces();
    Object.values(nets).flat().forEach(n => {
      if (n && n.family === 'IPv4' && !n.internal) {
        console.log('  局域网访问: http://' + n.address + ':' + port + '/');
      }
    });
  } catch (e) {}
  console.log('--------------------------------------------');
  console.log('  按 Ctrl+C 停止服务器');
  console.log('  保存/删除文章会直接写入 data/ 文件夹');
  console.log('============================================');
  openBrowser(port);
});
