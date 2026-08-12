/* ============ Applications ============ */

/* Retail applies at the cut-off price, i.e. the top of the band. */
function cutoffPrice(ipo){ return Number(ipo && ipo.priceMax) || Number(ipo && ipo.priceMin) || 0; }
function lotValue(ipo){ return cutoffPrice(ipo) * (Number(ipo && ipo.lotSize) || 0); }

function populateSelects(){
  const ipoSel = $('appIpo'), acctSel = $('appAccount');
  // Group by status so the IPO you're applying to is near the top.
  const order = ['Open','Upcoming','Closed','Listed'];
  const groups = order.map(status=>{
    const list = db.ipos.filter(i=>i.status===status);
    if(!list.length) return '';
    const opts = list.map(i=>{
      const lv = lotValue(i);
      const label = escapeHtml(i.name) + (lv ? ` · ${fmt(lv)}/lot` : '');
      return `<option value="${i.id}">${label}</option>`;
    }).join('');
    return `<optgroup label="${status}">${opts}</optgroup>`;
  }).join('');
  ipoSel.innerHTML = groups || '<option value="">No IPOs — add one first</option>';
  acctSel.innerHTML = db.accounts.map(a=>
    `<option value="${a.id}">${escapeHtml(a.name)}${a.type==='own'?' (mine)':''}</option>`
  ).join('') || '<option value="">No accounts — add one first</option>';
}

/* Amounts follow from lot size × cut-off price, so they're filled in for you.
   A field you type into yourself is marked `touched` and left alone after that. */
function markTouched(e){ e.target.dataset.touched = '1'; }
function untouchAppFields(){
  ['appGiven','appUsed','appStatus'].forEach(id => delete $(id).dataset.touched);
}
function recalcAppForm(){
  const ipo = getIpo($('appIpo').value);
  const perLot = lotValue(ipo);
  const lots = Math.max(0, Number($('appLots').value) || 0);
  let allotted = Math.max(0, Number($('appAllotted').value) || 0);

  const openNow = ipo && (ipo.status === 'Upcoming' || ipo.status === 'Open');
  $('appLotHint').innerHTML = ipo
    ? (perLot
        ? `1 lot = <b>${ipo.lotSize}</b> shares × <b>${fmt(cutoffPrice(ipo))}</b> = <b>${fmt(perLot)}</b> · ${lots} lot(s) = <b>${fmt(perLot*lots)}</b>` +
          (openNow ? `<br>Issue is <b>${ipo.status}</b>${ipo.closeDate ? ` until <b>${ipo.closeDate}</b>` : ''} — allotment isn't out yet, so this stays <b>Pending</b>.` : '')
        : `<b>${escapeHtml(ipo.name)}</b> has no lot size / price yet — enter the amounts manually or fetch live data.`)
    : 'Pick an IPO to see its lot value.';

  $('appAllotted').max = lots || '';

  /* Which statuses make sense depends on where the IPO is:
       Upcoming / Open → the allotment isn't declared yet, so Pending only.
       Closed          → basis of allotment lands a day or two later, so anything.
       Listed          → the result is long settled, so Pending is no longer valid. */
  const resultOut = !ipo || ipo.status === 'Closed' || ipo.status === 'Listed';
  const mustBeResolved = ipo && ipo.status === 'Listed';
  const allow = (s) => s === 'Pending' ? !mustBeResolved : resultOut;
  [...$('appStatus').options].forEach(opt=>{
    opt.disabled = !allow(opt.value);
    opt.hidden = !allow(opt.value);
  });
  if(!resultOut){
    if($('appStatus').value !== 'Pending'){ $('appStatus').value = 'Pending'; delete $('appStatus').dataset.touched; }
    $('appAllotted').value = 0;
    allotted = 0;
  } else if(mustBeResolved && $('appStatus').value === 'Pending'){
    $('appStatus').value = allotted > 0 ? 'Allotted' : 'Not Allotted';
    delete $('appStatus').dataset.touched;
  }
  $('appAllotted').disabled = !resultOut;

  // Picking "Not Allotted" / "Refunded" means nothing was taken: no lots, no
  // money used, so the whole blocked amount comes back.
  const status = $('appStatus').value;
  const nothingAllotted = status === 'Not Allotted' || status === 'Refunded';
  if(nothingAllotted && allotted > 0){
    $('appAllotted').value = 0;
    return recalcAppForm();
  }

  if(perLot){
    if(!$('appGiven').dataset.touched) $('appGiven').value = lots * perLot;
    if(!$('appUsed').dataset.touched)  $('appUsed').value  = allotted * perLot;
  }
  if(nothingAllotted) $('appUsed').value = 0;   // refund is the full amount given

  const given = Number($('appGiven').value) || 0;
  const used  = Number($('appUsed').value) || 0;
  // Pending → nothing is back yet; the money sits blocked with the bank.
  const pending = status === 'Pending';
  $('appRefund').value = pending ? 0 : Math.max(0, given - used);
  $('appRefundNote').textContent = pending
    ? (given ? fmt(given) + ' blocked until the allotment is out' : '')
    : '';

  if(!$('appStatus').dataset.touched){
    const closed = ipo && (ipo.status === 'Closed' || ipo.status === 'Listed');
    $('appStatus').value = allotted > 0 ? 'Allotted' : (closed ? 'Not Allotted' : 'Pending');
  }
  $('appUsed').readOnly = nothingAllotted;
  showAppWarning(validateAppForm({ lots, allotted, given, used, status }));
}

function validateAppForm({ lots, allotted, given, used, status }){
  if(allotted > lots) return `Lots allotted (${allotted}) is more than lots applied (${lots}).`;
  if(used > given && given > 0) return `Amount used (${fmt(used)}) is more than amount given (${fmt(given)}).`;
  if(status === 'Allotted' && allotted === 0) return 'Status is Allotted but no lots are allotted — set the lots, or pick Not Allotted.';
  const dup = db.applications.find(a =>
    a.ipoId === $('appIpo').value && a.accountId === $('appAccount').value && a.id !== $('appId').value);
  if(dup) return 'This account already has an application for this IPO — saving adds a second one.';
  return '';
}
function showAppWarning(msg){
  const el = $('appWarn');
  el.style.display = msg ? 'block' : 'none';
  el.className = 'form-hint warn';
  el.textContent = msg ? '⚠ ' + msg : '';
}

let appFilter = 'all';
function setAppFilter(status){
  appFilter = status;
  document.querySelectorAll('#view-applications .chip[data-appstatus]')
    .forEach(c=>c.classList.toggle('active', c.dataset.appstatus===status));
  renderApplications();
}

function renderApplications(){
  const body = $('appTableBody'), foot = $('appTableFoot');

  // Keep the account filter in sync with the accounts that exist.
  const accSel = $('appAccountFilter');
  const chosen = accSel.value || 'all';
  accSel.innerHTML = '<option value="all">All accounts</option>' +
    db.accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  accSel.value = db.accounts.some(a=>a.id===chosen) ? chosen : 'all';

  const q = $('appSearch').value.trim().toLowerCase();
  const rows = db.applications.filter(app=>{
    const ipo = getIpo(app.ipoId), acct = getAccount(app.accountId);
    if(appFilter !== 'all' && app.status !== appFilter) return false;
    if(accSel.value !== 'all' && app.accountId !== accSel.value) return false;
    if(!q) return true;
    return ((ipo && ipo.name) || '').toLowerCase().includes(q) ||
           ((acct && acct.name) || '').toLowerCase().includes(q);
  });

  if(!rows.length){
    body.innerHTML = `<tr><td colspan="10"><div class="empty-state">${
      db.applications.length ? 'No applications match this filter.'
                             : 'No applications recorded yet.'
    }<br><button class="btn" onclick="openAppModal()">+ Add Application</button></div></td></tr>`;
    foot.innerHTML = '';
    return;
  }

  body.innerHTML = rows.map(app=>{
    const ipo = getIpo(app.ipoId), acct = getAccount(app.accountId);
    const m = appMetrics(app);
    const badge = 'badge-' + String(app.status).toLowerCase().replace(/\s+/g,'');
    // Pending money is blocked with the bank, not refunded — unless the IPO has
    // already listed, in which case the row was never updated.
    const stale = isStalePending(app);
    const refundCell = stale
      ? `<span style="color:var(--amber)" title="This IPO has listed — record whether it was allotted">update needed</span>`
      : app.status === 'Pending'
        ? `<span style="color:var(--amber)" title="Blocked until the allotment is out">${fmt(app.amountGiven)} blocked</span>`
        : fmt(refundOf(app));
    return `<tr>
      <td class="strong">${ipo ? escapeHtml(ipo.name) : '<span style="color:var(--red)">deleted IPO</span>'}</td>
      <td>${acct ? escapeHtml(acct.name) : '<span style="color:var(--red)">deleted account</span>'}</td>
      <td class="num">${app.lotsApplied}</td>
      <td class="num">${fmt(app.amountGiven)}</td>
      <td class="num">${app.lotsAllotted}</td>
      <td class="num">${fmt(app.amountUsed)}</td>
      <td class="num">${refundCell}</td>
      <td><span class="badge ${badge}">${escapeHtml(app.status)}</span>${stale ? '<span title="IPO has listed — update this row" style="color:var(--amber);margin-left:5px;">&#9888;</span>' : ''}</td>
      <td class="num ${m.profit>=0?'pl-pos':'pl-neg'}">${app.lotsAllotted ? fmt(m.profit) : '—'}</td>
      <td>
        <button class="btn-icon" onclick="openAppModal('${app.id}')">Edit</button>
        <button class="btn-icon btn-danger" onclick="deleteApplication('${app.id}')">Del</button>
      </td>
    </tr>`;
  }).join('');

  const t = rows.reduce((acc,app)=>{
    const m = appMetrics(app);
    acc.given += Number(app.amountGiven)||0;
    acc.used  += Number(app.amountUsed)||0;
    acc.refund += refundOf(app);
    acc.blocked += blockedOf(app);
    acc.lots  += Number(app.lotsApplied)||0;
    acc.allot += Number(app.lotsAllotted)||0;
    if(app.lotsAllotted) acc.profit += m.profit;
    return acc;
  }, {given:0, used:0, lots:0, allot:0, profit:0, refund:0, blocked:0});
  foot.innerHTML = `<tr>
    <td colspan="2">TOTAL · ${rows.length} application${rows.length>1?'s':''}</td>
    <td class="num">${t.lots}</td><td class="num">${fmt(t.given)}</td>
    <td class="num">${t.allot}</td><td class="num">${fmt(t.used)}</td>
    <td class="num">${fmt(t.refund)}${t.blocked ? `<div style="color:var(--amber);font-size:10px;">${fmt(t.blocked)} blocked</div>` : ''}</td>
    <td></td>
    <td class="num ${t.profit>=0?'pl-pos':'pl-neg'}">${fmt(t.profit)}</td>
    <td></td>
  </tr>`;
}

/* "+ Apply" on an IPO card jumps straight into a pre-filled application. */
function applyToIpo(ipoId){
  if(!db.accounts.length){ alert('Add an account first (Accounts tab).'); return; }
  switchView('applications');
  openAppModal(null, ipoId);
}

function openAppModal(id, presetIpoId){
  populateSelects();
  $('appForm').reset();
  untouchAppFields();
  $('appId').value = id || '';
  $('appModalTitle').textContent = id ? 'Edit Application' : 'Add Application';
  showAppWarning('');

  if(id){
    const a = db.applications.find(x=>x.id===id);
    $('appIpo').value = a.ipoId;
    $('appAccount').value = a.accountId;
    $('appLots').value = a.lotsApplied;
    $('appGiven').value = a.amountGiven;
    $('appAllotted').value = a.lotsAllotted;
    $('appUsed').value = a.amountUsed;
    $('appStatus').value = a.status;
    // Saved figures are the user's own — never silently recompute them.
    ['appGiven','appUsed','appStatus'].forEach(f => $(f).dataset.touched = '1');
  } else if(presetIpoId){
    $('appIpo').value = presetIpoId;
    $('appLots').value = 1;
  }
  recalcAppForm();
  openModal('appOverlay');
}

function saveApplication(e){
  e.preventDefault();
  const id = $('appId').value;
  const data = {
    ipoId: $('appIpo').value,
    accountId: $('appAccount').value,
    lotsApplied: Math.max(0, Number($('appLots').value)||0),
    amountGiven: Math.max(0, Number($('appGiven').value)||0),
    lotsAllotted: Math.max(0, Number($('appAllotted').value)||0),
    amountUsed: Math.max(0, Number($('appUsed').value)||0),
    status: $('appStatus').value,
  };
  // An issue that hasn't closed yet cannot have an allotment result.
  const ipoNow = getIpo(data.ipoId);
  if(ipoNow && (ipoNow.status === 'Upcoming' || ipoNow.status === 'Open')){
    if(data.status !== 'Pending'){
      alert(`${ipoNow.name} is still ${ipoNow.status} — the allotment isn't declared until the issue closes, so this application stays Pending.`);
      return;
    }
    data.lotsAllotted = 0;
    data.amountUsed = 0;
  }
  // A listed issue's allotment is long settled — Pending is no longer a real state.
  if(ipoNow && ipoNow.status === 'Listed' && data.status === 'Pending'){
    alert(`${ipoNow.name} has already listed — record the outcome as Allotted or Not Allotted.`);
    return;
  }

  // Not allotted (or already refunded) → nothing was taken, so the full
  // blocked amount is refunded. Keeps the saved row internally consistent
  // even if the form was bypassed.
  if(data.status === 'Not Allotted' || data.status === 'Refunded'){
    data.lotsAllotted = 0;
    data.amountUsed = 0;
  }
  if(data.lotsAllotted === 0 && data.status === 'Allotted'){
    alert('Status is Allotted but no lots are allotted. Set the lots allotted, or pick Not Allotted.');
    return;
  }
  // Nothing is refunded while the result is pending — it's blocked, not returned.
  data.refund = data.status === 'Pending' ? 0 : Math.max(0, data.amountGiven - data.amountUsed);

  if(!data.ipoId || !data.accountId){ alert('Add an IPO and an account first.'); return; }
  if(data.lotsAllotted > data.lotsApplied){
    alert(`Lots allotted (${data.lotsAllotted}) cannot exceed lots applied (${data.lotsApplied}).`); return;
  }
  if(data.amountGiven && data.amountUsed > data.amountGiven){
    alert(`Amount used (${fmt(data.amountUsed)}) cannot exceed amount given (${fmt(data.amountGiven)}).`); return;
  }

  if(id) Object.assign(db.applications.find(x=>x.id===id), data);
  else db.applications.push({ id: uid(), ...data });
  saveData(); closeModal('appOverlay'); renderAll();
}

/* Wire the auto-calculation once, on load. */
['appIpo','appAccount','appLots','appAllotted'].forEach(id=>{
  $(id).addEventListener('input', recalcAppForm);
  $(id).addEventListener('change', recalcAppForm);
});
['appGiven','appUsed','appStatus'].forEach(id=>{
  $(id).addEventListener('input', e=>{ markTouched(e); recalcAppForm(); });
  $(id).addEventListener('change', e=>{ markTouched(e); recalcAppForm(); });
});
function deleteApplication(id){
  if(!confirm('Delete this application?')) return;
  db.applications = db.applications.filter(a=>a.id!==id);
  saveData(); renderAll();
}

