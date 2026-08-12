/* ============ Portfolio ============ */
function renderPortfolio(){
  const rows = db.accounts.map(acct=>{
    const apps = db.applications.filter(a=>a.accountId===acct.id);
    const totals = apps.reduce((acc,app)=>{
      const m = appMetrics(app);
      acc.investment += m.investment; acc.currentValue += m.currentValue;
      return acc;
    }, {investment:0, currentValue:0});
    const profit = totals.currentValue - totals.investment;
    const returnPct = totals.investment ? profit/totals.investment*100 : 0;
    return { name: acct.name, ...totals, profit, returnPct };
  });
  const body = document.getElementById('portfolioBody');
  body.innerHTML = rows.length ? rows.map(r=>`<tr>
    <td class="strong">${escapeHtml(r.name)}</td>
    <td class="num">${fmt(r.investment)}</td>
    <td class="num">${fmt(r.currentValue)}</td>
    <td class="num ${r.profit>=0?'pl-pos':'pl-neg'}">${fmt(r.profit)}</td>
    <td class="num ${r.returnPct>=0?'pl-pos':'pl-neg'}">${pct(r.returnPct)}</td>
  </tr>`).join('') : `<tr><td colspan="5"><div class="empty-state">Add accounts and applications to see portfolio totals.</div></td></tr>`;

  const grand = rows.reduce((acc,r)=>{acc.investment+=r.investment;acc.currentValue+=r.currentValue;acc.profit+=r.profit;return acc;},{investment:0,currentValue:0,profit:0});
  const grandReturn = grand.investment ? grand.profit/grand.investment*100 : 0;
  document.getElementById('portfolioFoot').innerHTML = rows.length ? `<tr>
    <td>TOTAL</td><td class="num">${fmt(grand.investment)}</td><td class="num">${fmt(grand.currentValue)}</td>
    <td class="num">${fmt(grand.profit)}</td><td class="num">${pct(grandReturn)}</td>
  </tr>` : '';

  const maxProfit = Math.max(1, ...rows.map(r=>Math.abs(r.profit)));
  document.getElementById('portfolioBars').innerHTML = rows.length ? rows.map(r=>{
    const width = Math.min(100, Math.abs(r.profit)/maxProfit*100);
    const color = r.profit>=0 ? 'var(--green)' : 'var(--red)';
    return `<div class="mover-row">
      <div class="mover-name">${escapeHtml(r.name)}</div>
      <div class="mover-bar-track"><div class="mover-bar" style="width:${width}%;background:${color}"></div></div>
      <div class="mover-val" style="color:${color}">${fmt(r.profit)}</div>
    </div>`;
  }).join('') : `<div class="empty-state">No data yet.</div>`;
}

