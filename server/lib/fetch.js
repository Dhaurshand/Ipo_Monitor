/* Thin fetch wrapper (timeout, browser-ish headers, JSON parsing)
   plus a small concurrency cap for fan-out requests. */

const FETCH_TIMEOUT_MS = 12000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function httpGet(url, { headers = {}, as = 'json' } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (as === 'text') return { body: text, setCookie };
    try {
      return { body: JSON.parse(text), setCookie };
    } catch {
      throw new Error(`Non-JSON response from ${url}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Run `worker` over `items` with a small concurrency cap. */
async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = await worker(items[i]);
        } catch {
          out[i] = null;
        }
      }
    })
  );
  return out;
}

module.exports = { httpGet, mapLimit, UA, FETCH_TIMEOUT_MS };
