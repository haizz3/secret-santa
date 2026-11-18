const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PARTICIPANTS_FILE = path.join(__dirname, 'participants.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading data.json:', e);
    }
  }
  let participants = [];
  if (fs.existsSync(PARTICIPANTS_FILE)) {
    try {
      participants = JSON.parse(fs.readFileSync(PARTICIPANTS_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading participants.json:', e);
    }
  }
  return {
    event: {
      title: "Secret Santa 2026",
      date: "Saturday, 19 December 2026",
      time: "6:30 PM",
      place: "Rooftop garden, 123 Lê Lợi, District 1, HCMC",
      budget: "200,000 VND",
      note: "Wrap it, label it with the receiver's name, and keep it a secret until the party!"
    },
    participants,
    organizerPasscode: "512435",
    forced: [],
    excl: [],
    loop: true,
    drawn: false,
    matches: {}
  };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function solveDraw(list, forcedPairs, exclPairs, loop) {
  const n = list.length, set = new Set(list);
  if (n < 3) return { ok: false, reason: "You need at least 3 people for a Secret Santa." };
  const forced = new Map(), targets = new Map();
  for (const [g, r] of (forcedPairs || [])) {
    if (!set.has(g) || !set.has(r)) continue;
    if (g === r) return { ok: false, reason: `${g} cannot give to themselves.` };
    forced.set(g, r); targets.set(r, g);
  }
  const ex = new Set((exclPairs || []).filter(([a, b]) => set.has(a) && set.has(b)).map(([a, b]) => a + "\0" + b));
  const allowed = (g, r) => g !== r && !ex.has(g + "\0" + r) && (forced.has(g) ? forced.get(g) === r : !targets.has(r));
  let steps = 0; const BUDGET = 250000;

  if (loop) {
    const start = list[Math.floor(Math.random() * n)];
    const path = [start], used = new Set([start]);
    const dfs = cur => {
      if (++steps > BUDGET) return false;
      if (path.length === n) return allowed(cur, start);
      for (const r of shuffle(list.filter(x => !used.has(x) && allowed(cur, x)))) {
        used.add(r); path.push(r);
        if (dfs(r)) return true;
        path.pop(); used.delete(r);
      }
      return false;
    };
    if (dfs(start)) {
      const map = {};
      path.forEach((g, i) => map[g] = path[(i + 1) % n]);
      return { ok: true, map };
    }
  }

  // Fallback to regular draw
  const givers = shuffle(list).sort((a, b) => list.filter(r => allowed(a, r)).length - list.filter(r => allowed(b, r)).length);
  const map = {}, used = new Set();
  const bt = i => {
    if (++steps > BUDGET) return false;
    if (i === givers.length) return true;
    const g = givers[i];
    for (const r of shuffle(list.filter(x => !used.has(x) && allowed(g, x)))) {
      map[g] = r; used.add(r);
      if (bt(i + 1)) return true;
      used.delete(r); delete map[g];
    }
    return false;
  };
  if (bt(0)) return { ok: true, map, fallback: true };
  return { ok: false, reason: "Unable to find valid pairing with current rules." };
}

let dataState = loadData();

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const reqPath = decodeURI(parsedUrl.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  // API Routes
  if (reqPath.startsWith('/api/')) {
    if (reqPath === '/api/data' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        event: dataState.event,
        drawn: !!dataState.drawn,
        participants: (dataState.participants || []).map(p => ({
          name: p.name,
          hasWish: !!(p.wishlist && p.wishlist.trim())
        })),
        names: (dataState.participants || []).map(p => p.name)
      });
    }

    if (reqPath === '/api/login' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const name = (body.name || '').trim();
        const passcode = (body.passcode || '').trim();

        if (!name || !passcode) {
          return sendJson(res, 400, { ok: false, error: 'Please choose your name and enter your passcode.' });
        }

        const person = (dataState.participants || []).find(p => p.name.toLowerCase() === name.toLowerCase());
        if (!person) {
          return sendJson(res, 404, { ok: false, error: 'Name not found in the participants list.' });
        }

        if (person.passcode.trim() !== passcode) {
          return sendJson(res, 401, { ok: false, error: 'Incorrect passcode. Please check the passcode from the form.' });
        }

        const isOrganizer = (person.name === 'ad' || passcode === dataState.organizerPasscode);

        if (!dataState.drawn || !dataState.matches || !dataState.matches[person.name]) {
          return sendJson(res, 200, {
            ok: true,
            drawn: false,
            isOrganizer,
            user: {
              name: person.name,
              wishlist: person.wishlist,
              fb: person.fb
            }
          });
        }

        const targetName = dataState.matches[person.name];
        const target = (dataState.participants || []).find(p => p.name === targetName) || { name: targetName, wishlist: '' };

        return sendJson(res, 200, {
          ok: true,
          drawn: true,
          isOrganizer,
          user: {
            name: person.name,
            wishlist: person.wishlist,
            fb: person.fb
          },
          match: {
            name: target.name,
            wishlist: target.wishlist,
            fb: target.fb
          }
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: 'Internal server error.' });
      }
    }

    if (reqPath === '/api/draw' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const passcode = (body.passcode || '').trim();
        if (passcode !== dataState.organizerPasscode) {
          return sendJson(res, 403, { ok: false, error: 'Organizer passcode required to draw names.' });
        }

        const names = (dataState.participants || []).map(p => p.name);
        const resDraw = solveDraw(names, dataState.forced, dataState.excl, dataState.loop);
        if (!resDraw.ok) {
          return sendJson(res, 400, { ok: false, error: resDraw.reason });
        }

        dataState.drawn = true;
        dataState.matches = resDraw.map;
        dataState.fallback = !!resDraw.fallback;
        dataState.drawnAt = Date.now();
        saveData(dataState);

        return sendJson(res, 200, { ok: true, count: names.length, fallback: dataState.fallback });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: 'Error drawing names.' });
      }
    }

    if (reqPath === '/api/update-wishlist' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const name = (body.name || '').trim();
        const passcode = (body.passcode || '').trim();
        const wishlist = (body.wishlist || '').trim();

        const person = (dataState.participants || []).find(p => p.name.toLowerCase() === name.toLowerCase());
        if (!person || person.passcode.trim() !== passcode) {
          return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
        }

        person.wishlist = wishlist;
        saveData(dataState);
        return sendJson(res, 200, { ok: true, wishlist: person.wishlist });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: 'Failed to update wishlist.' });
      }
    }

    if (reqPath === '/api/admin' && req.method === 'GET') {
      const passcode = (parsedUrl.query.passcode || '').trim();
      if (passcode !== dataState.organizerPasscode) {
        return sendJson(res, 403, { ok: false, error: 'Unauthorized.' });
      }
      return sendJson(res, 200, {
        ok: true,
        data: dataState
      });
    }

    if (reqPath === '/api/admin/rules' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if ((body.passcode || '').trim() !== dataState.organizerPasscode) {
          return sendJson(res, 403, { ok: false, error: 'Unauthorized.' });
        }
        if (body.forced !== undefined) dataState.forced = body.forced;
        if (body.excl !== undefined) dataState.excl = body.excl;
        if (body.loop !== undefined) dataState.loop = !!body.loop;
        saveData(dataState);
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: 'Failed to save rules.' });
      }
    }

    if (reqPath === '/api/admin/event' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if ((body.passcode || '').trim() !== dataState.organizerPasscode) {
          return sendJson(res, 403, { ok: false, error: 'Unauthorized.' });
        }
        if (body.event) dataState.event = Object.assign({}, dataState.event, body.event);
        saveData(dataState);
        return sendJson(res, 200, { ok: true, event: dataState.event });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: 'Failed to update event.' });
      }
    }

    return sendJson(res, 404, { ok: false, error: 'API endpoint not found.' });
  }

  // Static file serving
  let targetPath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(__dirname, targetPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
