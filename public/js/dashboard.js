/* ============ Ticker ============ */
function renderTicker(){
  const track = document.getElementById('tickerTrack');
  const live = db.ipos.filter(i => i.status==='Open' || i.status==='Upcoming');
  if(live.length===0){
    track.classList.add('paused');
    track.innerHTML = '<span class="ticker-empty">No live IPOs tracked — add one in the IPOs tab to see GMP here.</span>';
    return;
  }
  track.classList.remove('paused');
  const items = live.map(i=>{
    const gp = gmpPct(i);
    const dir = gp >= 0 ? 'ticker-up' : 'ticker-down';
    const arrow = gp >= 0 ? '▲' : '▼';
    const gmpCell = Number(i.gmp)
      ? `GMP ₹${Number(i.gmp)} <span class="${dir}">${arrow} ${Math.abs(gp).toFixed(1)}%</span>`
      : `${i.status} · ${i.lotSize && i.priceMax ? '₹'+(i.lotSize*i.priceMax).toLocaleString('en-IN')+'/lot' : 'GMP n/a'}`;
    return `<span class="ticker-item"><b>${escapeHtml(i.name)}</b> ${gmpCell}</span>`;
  }).join('');
  track.innerHTML = items + items; // duplicate for seamless loop
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============ Dashboard ============ */
function renderDashboard(){
  const totals = db.applications.reduce((acc, app)=>{
    const m = appMetrics(app);
    acc.investment += m.investment;
    acc.currentValue += m.currentValue;
    return acc;
  }, {investment:0, currentValue:0});
  const profit = totals.currentValue - totals.investment;
  const returnPct = totals.investment ? (profit/totals.investment*100) : 0;
  const openCount = db.ipos.filter(i=>i.status==='Open').length;

  const kpis = [
    { label:'Total IPOs', value: db.ipos.length, cls:'' },
    { label:'Open IPOs', value: openCount, cls:'amber' },
    { label:'Total Investment', value: fmt(totals.investment), cls:'' },
    { label:'Current Value', value: fmt(totals.currentValue), cls:'' },
    { label:'Total P/L', value: (profit>=0?'+':'') + fmt(profit), cls: profit>=0?'green':'red' },
    { label:'Return', value: pct(returnPct), cls: returnPct>=0?'green':'red' },
  ];
  document.getElementById('kpiGrid').innerHTML = kpis.map(k=>
    `<div class="kpi"><div class="label">${k.label}</div><div class="value ${k.cls}">${k.value}</div></div>`
  ).join('');

  const movers = [...db.ipos].sort((a,b)=> gmpPct(b) - gmpPct(a)).slice(0,5);
  const maxAbs = Math.max(1, ...movers.map(i=>Math.abs(gmpPct(i))));
  document.getElementById('moversList').innerHTML = movers.length ? movers.map(i=>{
    const gp = gmpPct(i);
    const width = Math.min(100, Math.abs(gp)/maxAbs*100);
    const color = gp>=0 ? 'var(--green)' : 'var(--red)';
    return `<div class="mover-row">
      <div class="mover-name">${escapeHtml(i.name)}</div>
      <div class="mover-bar-track"><div class="mover-bar" style="width:${width}%;background:${color}"></div></div>
      <div class="mover-val" style="color:${color}">${pct(gp)}</div>
    </div>`;
  }).join('') : `<div class="empty-state">No IPOs yet — add one to see GMP movers.</div>`;
}

