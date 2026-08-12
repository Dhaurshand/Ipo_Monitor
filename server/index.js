/* ============================================================
   IPO Monitor — local server

     • serves the app from ../public
     • exposes /api/ipos, which merges the live IPO sources

   The browser cannot call NSE directly (no CORS headers, and NSE
   requires a cookie handshake), so fetching happens here.

   Run:  npm start   →  http://localhost:5173
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const { slug } = require('./lib/normalize');
const { fetchNSE } = require('./providers/nse');
const { fetchGMP } = require('./providers/gmp');

const PORT = Number(process.env.PORT) || 5173;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CACHE_TTL_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------
   Merge — NSE is authoritative for facts, the GMP source fills the rest
   ------------------------------------------------------------ */

function mergeSources(lists) {
  const byKey = new Map();
  for (const list of lists) {
    for (const ipo of list) {
      const key = slug(ipo.name);
      if (!key) continue;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, { key, ...ipo });
        continue;
      }
      // Keep whichever value is actually populated; first source wins ties.
      for (const [field, value] of Object.entries(ipo)) {
        const empty = prev[field] === undefined || prev[field] === '' || prev[field] === 0;
        if (empty && value !== '' && value !== 0 && value !== undefined) prev[field] = value;
      }
      if (ipo.gmp) prev.gmp = ipo.gmp; // GMP always comes from the GMP source
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const rank = { Open: 0, Upcoming: 1, Closed: 2, Listed: 3 };
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) ||
      (a.closeDate || '9999').localeCompare(b.closeDate || '9999');
  });
}

/* ------------------------------------------------------------
   Aggregation + cache
   ------------------------------------------------------------ */

let cache = { at: 0, payload: null };

async function loadIpos({ force = false } = {}) {
  if (!force && cache.payload && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ...cache.payload, cached: true };
  }

  const providers = [
    { name: 'NSE India', run: fetchNSE },
    { name: 'GMP (InvestorGain)', run: fetchGMP },
  ];

  const settled = await Promise.allSettled(providers.map((p) => p.run()));
  const sources = [];
  const lists = [];

  settled.forEach((res, idx) => {
    const name = providers[idx].name;
    if (res.status === 'fulfilled') {
      sources.push({ name, ok: true, count: res.value.length });
      lists.push(res.value);
    } else {
      sources.push({ name, ok: false, error: String((res.reason && res.reason.message) || res.reason) });
    }
  });

  if (!lists.length) {
    // Every provider failed — serve the last good payload rather than nothing.
    if (cache.payload) return { ...cache.payload, stale: true, sources };
    const err = new Error('All IPO sources failed');
    err.sources = sources;
    throw err;
  }

  const payload = {
    ok: true,
    fetchedAt: new Date().toISOString(),
    sources,
    ipos: mergeSources(lists),
  };
  cache = { at: Date.now(), payload };
  return payload;
}

/* ------------------------------------------------------------
   HTTP
   ------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/ipos') {
    try {
      const payload = await loadIpos({ force: url.searchParams.get('refresh') === '1' });
      return sendJson(res, 200, payload);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e.message, sources: e.sources || [] });
    }
  }

  if (url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      cachedAt: cache.at ? new Date(cache.at).toISOString() : null,
      ipos: cache.payload ? cache.payload.ipos.length : 0,
    });
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`IPO Monitor running →  http://localhost:${PORT}`);
  console.log(`Live IPO feed        →  http://localhost:${PORT}/api/ipos`);
});

module.exports = { server, loadIpos, mergeSources };
