/* ============ Helpers ============ */
const $ = (id) => document.getElementById(id);

/* Money that has actually come back. While an application is Pending the
   amount is blocked with the bank, not refunded — the refund only exists
   once the allotment is known. */
function refundOf(app){
  if(!app || app.status === 'Pending') return 0;
  return Math.max(0, (Number(app.amountGiven)||0) - (Number(app.amountUsed)||0));
}
/* Money still held by the bank awaiting the allotment result. Once the IPO
   has listed nothing can still be blocked — such a row is stale, not blocked. */
function blockedOf(app){
  if(!app || app.status !== 'Pending') return 0;
  if(isStalePending(app)) return 0;
  return Number(app.amountGiven) || 0;
}
/* Still marked Pending even though the IPO has listed — the user needs to
   record what actually happened. */
function isStalePending(app){
  const ipo = app && getIpo(app.ipoId);
  return !!(ipo && ipo.status === 'Listed' && app.status === 'Pending');
}

function fmt(n){
  n = Number(n) || 0;
  return '₹' + n.toLocaleString('en-IN', {maximumFractionDigits:0});
}
function pct(n){ return (n>=0?'+':'') + n.toFixed(1) + '%'; }
function getIpo(id){ return db.ipos.find(i=>i.id===id); }
function getAccount(id){ return db.accounts.find(a=>a.id===id); }

function appMetrics(app){
  const ipo = getIpo(app.ipoId);
  const investment = Number(app.amountUsed) || 0;
  const price = ipo && ipo.currentPrice ? Number(ipo.currentPrice) : (ipo ? Number(ipo.priceMax) : 0);
  const currentValue = (Number(app.lotsAllotted)||0) * (ipo ? Number(ipo.lotSize)||0 : 0) * price;
  const profit = currentValue - investment;
  const returnPct = investment > 0 ? (profit/investment*100) : 0;
  return { investment, currentValue, profit, returnPct };
}

function gmpPct(ipo){
  const base = Number(ipo.priceMax) || Number(ipo.priceMin) || 0;
  if(!base) return 0;
  return (Number(ipo.gmp)||0) / base * 100;
}

