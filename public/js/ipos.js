/* ============ IPOs ============ */
let ipoFilter = 'all';
let gmpSortDir = 0; // 0 none, 1 asc, -1 desc
function setIpoFilter(status){
  ipoFilter = status;
  document.querySelectorAll('#view-ipos .chip[data-status]').forEach(c=>c.classList.toggle('active', c.dataset.status===status));
  renderIPOs();
}
function toggleGmpSort(){
  gmpSortDir = gmpSortDir === -1 ? 1 : (gmpSortDir === 1 ? 0 : -1);
  const chip = document.getElementById('gmpSortChip');
  chip.classList.toggle('active', gmpSortDir!==0);
  chip.textContent = gmpSortDir===0 ? 'Sort by GMP ↕' : (gmpSortDir===-1 ? 'GMP: High → Low' : 'GMP: Low → High');
  renderIPOs();
}
function renderIPOs(){
  const q = document.getElementById('ipoSearch').value.trim().toLowerCase();
  let list = db.ipos.filter(i => (ipoFilter==='all' || i.status===ipoFilter) && i.name.toLowerCase().includes(q));
  if(gmpSortDir!==0) list = [...list].sort((a,b)=> gmpSortDir * (gmpPct(a)-gmpPct(b)));
  const grid = document.getElementById('ipoGrid');
  if(list.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No IPOs match. <button class="btn" onclick="openIpoModal()">+ Add IPO</button></div>`;
    return;
  }
  grid.innerHTML = list.map(i=>{
    const gp = gmpPct(i);
    const gpColor = gp>=0 ? 'var(--green)' : 'var(--red)';
    const badgeCls = 'badge-' + i.status.toLowerCase();
    return `<div class="ipo-card">
      <div class="ipo-card-top">
        <div class="ipo-name">${escapeHtml(i.name)}${i.source==='live' ? '<span class="badge badge-live">live</span>' : ''}</div>
        <span class="badge ${badgeCls}">${i.status}</span>
      </div>
      <div class="ipo-meta">
        <div><span>Price band</span>${fmt(i.priceMin)}–${fmt(i.priceMax)}</div>
        <div><span>Lot size</span>${i.lotSize || '—'}</div>
        <div><span>Open date</span>${i.openDate || '—'}</div>
        <div><span>Close date</span>${i.closeDate || '—'}</div>
        ${i.lotSize && i.priceMax ? `<div><span>Per lot</span>${fmt(i.lotSize * i.priceMax)}</div>` : ''}
        ${i.subscription ? `<div><span>Subscribed</span>${Number(i.subscription).toFixed(2)}×</div>` : ''}
        ${i.exchange ? `<div><span>Exchange</span>${escapeHtml(i.exchange)}</div>` : ''}
        ${i.estListing ? `<div><span>Est. listing</span>${fmt(i.estListing)}</div>` : ''}
      </div>
      <div class="gmp-row">
        <div><span style="display:block;font-size:9.5px;color:var(--text-faint);text-transform:uppercase;">GMP</span><span class="gmp-val">${i.gmp ? fmt(i.gmp) : '—'}</span></div>
        <div style="color:${i.gmp ? gpColor : 'var(--text-faint)'};font-family:var(--mono);font-weight:700;">${i.gmp ? pct(gp) : 'not available'}</div>
      </div>
      <div class="card-actions">
        <button class="btn-icon" onclick="applyToIpo('${i.id}')" title="Record an application for this IPO">+ Apply</button>
        <button class="btn-icon" onclick="openIpoModal('${i.id}')">Edit</button>
        <button class="btn-icon btn-danger" onclick="deleteIpo('${i.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}
function openIpoModal(id){
  document.getElementById('ipoForm').reset();
  document.getElementById('ipoId').value = id || '';
  document.getElementById('ipoModalTitle').textContent = id ? 'Edit IPO' : 'Add IPO';
  if(id){
    const i = getIpo(id);
    document.getElementById('ipoName').value = i.name;
    document.getElementById('ipoPriceMin').value = i.priceMin;
    document.getElementById('ipoPriceMax').value = i.priceMax;
    document.getElementById('ipoLotSize').value = i.lotSize;
    document.getElementById('ipoStatus').value = i.status;
    document.getElementById('ipoOpenDate').value = i.openDate || '';
    document.getElementById('ipoCloseDate').value = i.closeDate || '';
    document.getElementById('ipoListingDate').value = i.listingDate || '';
    document.getElementById('ipoGmp').value = i.gmp;
    document.getElementById('ipoCurrentPrice').value = i.currentPrice || '';
  }
  openModal('ipoOverlay');
}
function saveIpo(e){
  e.preventDefault();
  const id = document.getElementById('ipoId').value;
  const data = {
    name: document.getElementById('ipoName').value.trim(),
    priceMin: Number(document.getElementById('ipoPriceMin').value),
    priceMax: Number(document.getElementById('ipoPriceMax').value),
    lotSize: Number(document.getElementById('ipoLotSize').value),
    status: document.getElementById('ipoStatus').value,
    openDate: document.getElementById('ipoOpenDate').value,
    closeDate: document.getElementById('ipoCloseDate').value,
    listingDate: document.getElementById('ipoListingDate').value,
    gmp: Number(document.getElementById('ipoGmp').value) || 0,
    currentPrice: Number(document.getElementById('ipoCurrentPrice').value) || 0,
  };
  if(id){
    Object.assign(getIpo(id), data);
  } else {
    db.ipos.push({ id: uid(), ...data });
  }
  saveData(); closeModal('ipoOverlay'); renderAll();
}
function deleteIpo(id){
  if(db.applications.some(a=>a.ipoId===id)){
    if(!confirm('This IPO has linked applications. Delete it and its applications?')) return;
    db.applications = db.applications.filter(a=>a.ipoId!==id);
  } else if(!confirm('Delete this IPO?')) return;
  db.ipos = db.ipos.filter(i=>i.id!==id);
  saveData(); renderAll();
}

