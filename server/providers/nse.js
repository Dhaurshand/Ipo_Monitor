/* NSE India — the official source for band, lot size, dates, status
   and live subscription. Lot size only exists on the per-symbol
   detail endpoint, so each issue costs one extra request. */

const { httpGet, mapLimit } = require('../lib/fetch');
const { clean, num, priceBand, isoDate, statusFrom, pick } = require('../lib/normalize');

async function nseCookies() {
  // NSE hands out cookies on the HTML page and rejects bare API calls.
  const boot = await httpGet('https://www.nseindia.com/market-data/all-upcoming-issues-ipo', {
    as: 'text',
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });
  return (boot.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

/** Lot size, face value and registrar only exist on the per-symbol detail page. */
async function nseDetail(symbol, series, headers) {
  const { body } = await httpGet(
    `https://www.nseindia.com/api/ipo-detail?symbol=${encodeURIComponent(symbol)}&series=${encodeURIComponent(series || 'EQ')}`,
    { headers }
  );
  const info = {};
  for (const row of body?.issueInfo?.dataList || []) {
    if (row && row.title) info[clean(row.title).toLowerCase()] = clean(row.value);
  }
  // Mainboard issues label it "Bid Lot"; SME issues label it "Lot Size".
  const lotText =
    info['bid lot'] || info['lot size'] || info['market lot'] || info['minimum order quantity'] || '';
  // SME rows often omit the band and dates in the list feed; the detail page has both.
  const band = priceBand(info['price range'] || info['issue price'] || '');
  const period = (info['issue period'] || '').split(/\bto\b/i);
  return {
    lotSize: num(lotText),
    priceMin: band.min,
    priceMax: band.max,
    openDate: isoDate(period[0] || ''),
    closeDate: isoDate(period[1] || ''),
    faceValue: num(info['face value']),
    registrar: info['name of the registrar'] || '',
    issueType: info['issue type'] || '',
  };
}

async function fetchNSE() {
  const cookie = await nseCookies();
  const apiHeaders = {
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo',
    Cookie: cookie,
  };

  const [current, upcoming] = await Promise.allSettled([
    httpGet('https://www.nseindia.com/api/ipo-current-issue', { headers: apiHeaders }),
    httpGet('https://www.nseindia.com/api/all-upcoming-issues?category=ipo', { headers: apiHeaders }),
  ]);

  const rows = [];
  for (const r of [current, upcoming]) {
    if (r.status !== 'fulfilled') continue;
    const body = r.value.body;
    const list = Array.isArray(body) ? body : body?.data || [];
    rows.push(...list);
  }
  if (!rows.length) throw new Error('NSE returned no rows');

  // The current-issue feed repeats a symbol per bid category; keep the "Total" row.
  const bySymbol = new Map();
  for (const row of rows) {
    const symbol = clean(row.symbol);
    if (!symbol) continue;
    const prev = bySymbol.get(symbol);
    const isTotal = /total/i.test(clean(row.category));
    if (!prev || (isTotal && !/total/i.test(clean(prev.category)))) bySymbol.set(symbol, row);
  }

  const base = [...bySymbol.values()].map((row) => {
    const band = priceBand(pick(row, ['issueprice', 'priceband', 'pricerange', 'price']));
    const openDate = isoDate(pick(row, ['issuestartdate', 'ipostartdate', 'bidstartdate']));
    const closeDate = isoDate(pick(row, ['issueenddate', 'ipoenddate', 'bidenddate']));
    const listingDate = isoDate(pick(row, ['listingdate']));
    return {
      name: clean(pick(row, ['companyname', 'company', 'issuename', 'symbol'])),
      symbol: clean(row.symbol),
      series: clean(row.series) || 'EQ',
      priceMin: band.min,
      priceMax: band.max,
      lotSize: 0,
      openDate,
      closeDate,
      listingDate,
      status: statusFrom({ openDate, closeDate, listingDate }),
      gmp: 0,
      sharesOffered: num(pick(row, ['issuesize', 'noofsharesoffered'])),
      subscription: Number(num(pick(row, ['nooftime'])).toFixed(2)),
      exchange: /^sm/i.test(clean(row.series)) ? 'NSE SME' : 'NSE',
    };
  }).filter((i) => i.name);

  // Enrich with lot size etc. — one request per symbol, capped concurrency.
  const details = await mapLimit(base, 5, (i) => nseDetail(i.symbol, i.series, apiHeaders));
  details.forEach((d, idx) => {
    if (!d) return;
    const ipo = base[idx];
    Object.assign(ipo, {
      lotSize: d.lotSize || ipo.lotSize,
      priceMin: ipo.priceMin || d.priceMin,
      priceMax: ipo.priceMax || d.priceMax,
      openDate: ipo.openDate || d.openDate,
      closeDate: ipo.closeDate || d.closeDate,
      faceValue: d.faceValue || 0,
      registrar: d.registrar,
      issueType: d.issueType,
    });
    ipo.status = statusFrom(ipo);
  });

  return base;
}

module.exports = { fetchNSE };
