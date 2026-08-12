/* Grey market premium. No exchange publishes this, so it comes from
   a tracker site; endpoints are tried in turn and the provider is
   allowed to fail without taking the NSE data down with it. */

const { httpGet } = require('../lib/fetch');
const { clean, num, priceBand, isoDate, statusFrom, pick } = require('../lib/normalize');

function financialYear(d = new Date()) {
  const y = d.getFullYear();
  const start = d.getMonth() + 1 >= 4 ? y : y - 1; // FY starts in April
  return `${start}-${String(start + 1).slice(2)}`;
}

/* GMP is not published by any exchange, so it comes from a grey-market
   tracker. These endpoints sit behind bot protection that some networks
   reject outright, so each candidate is tried in turn and the whole
   provider is allowed to fail without taking the NSE data down with it. */
function gmpCandidates() {
  const now = new Date();
  const stamp = `${now.getMonth() + 1}/${now.getFullYear()}/${financialYear(now)}/0/all`;
  return [
    {
      url: `https://webnodejs.investorgain.com/cloud/report/data-read/331/1/${stamp}`,
      referer: 'https://www.investorgain.com/report/live-ipo-gmp/331/',
    },
    {
      url: `https://webnodejs.chittorgarh.com/cloud/report/data-read/82/1/${stamp}`,
      referer: 'https://www.chittorgarh.com/report/latest-ipo-gmp-grey-market-premium/40/',
    },
  ];
}

async function fetchGMP() {
  const errors = [];
  let body = null;
  for (const cand of gmpCandidates()) {
    try {
      ({ body } = await httpGet(cand.url, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: cand.referer,
        },
      }));
      break;
    } catch (e) {
      errors.push(`${new URL(cand.url).hostname}: ${e.message}`);
      body = null;
    }
  }
  if (!body) throw new Error(errors.join(' | ') || 'No GMP endpoint reachable');

  const rows =
    body?.reportTableData ||
    body?.data ||
    (Array.isArray(body) ? body : []);
  if (!Array.isArray(rows) || !rows.length) throw new Error('GMP source returned no rows');

  return rows
    .map((row) => {
      const name = clean(pick(row, ['name', 'ipo', 'company']));
      const band = priceBand(pick(row, ['price', 'priceband', 'issueprice']));
      const openDate = isoDate(pick(row, ['open']));
      const closeDate = isoDate(pick(row, ['close']));
      const listingDate = isoDate(pick(row, ['listing', 'listdate']));
      return {
        name,
        priceMin: band.min,
        priceMax: band.max,
        lotSize: num(pick(row, ['lot', 'marketlot'])),
        openDate,
        closeDate,
        listingDate,
        status: statusFrom({ openDate, closeDate, listingDate }),
        gmp: num(pick(row, ['gmp', 'premium'])),
        estListing: num(pick(row, ['estlisting', 'estimatedlisting'])),
        issueSize: clean(pick(row, ['iposize', 'issuesize'])),
        exchange: /sme/i.test(clean(pick(row, ['name', 'type', 'exchange']))) ? 'SME' : '',
      };
    })
    .filter((i) => i.name && !/^total$/i.test(i.name));
}

module.exports = { fetchGMP };
