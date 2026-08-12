/* Text, number and date normalisation shared by the providers.
   Pure functions only — no network, no state. */

const stripTags = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ');

function clean(s) {
  return stripTags(s)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First number in a string, ignoring ₹ / commas / % / +. */
function num(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const m = clean(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/** "₹100 to ₹120" / "100-120" → { min, max }. */
function priceBand(v) {
  const s = clean(v).replace(/,/g, '');
  const nums = (s.match(/\d+(\.\d+)?/g) || []).map(Number);
  if (!nums.length) return { min: 0, max: 0 };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Accepts 2026-08-12, 12-Aug-2026, 12 Aug 2026, 12/08/2026 → ISO yyyy-mm-dd. */
function isoDate(v) {
  const s = clean(v);
  if (!s) return '';
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/](\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return ymd(fullYear(m[3]), mo, m[1]);
  }
  m = s.match(/([A-Za-z]{3,})[-\s/](\d{1,2})[,\s]+(\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return ymd(fullYear(m[3]), mo, m[2]);
  }
  m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/); // dd-mm-yyyy
  if (m) return ymd(fullYear(m[3]), m[2], m[1]);
  return '';
}
const fullYear = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y));
const pad = (n) => String(Number(n)).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Normalised match key: "Nova Industries Ltd." → "novaindustries". */
function slug(name) {
  return clean(name)
    .toLowerCase()
    .replace(/\b(limited|ltd|private|pvt|india|ipo|sme)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function statusFrom({ openDate, closeDate, listingDate }) {
  const t = todayISO();
  if (listingDate && listingDate <= t) return 'Listed';
  if (closeDate && closeDate < t) return 'Closed';
  if (openDate && openDate <= t && (!closeDate || closeDate >= t)) return 'Open';
  if (openDate && openDate > t) return 'Upcoming';
  return 'Upcoming';
}

/** Pick the first object key whose name loosely matches one of `wants`. */
function pick(row, wants) {
  const keys = Object.keys(row);
  for (const want of wants) {
    const hit = keys.find((k) => k.toLowerCase().replace(/[^a-z]/g, '').includes(want));
    if (hit && clean(row[hit])) return row[hit];
  }
  return '';
}

module.exports = { stripTags, clean, num, priceBand, isoDate, slug, statusFrom, pick, todayISO };
