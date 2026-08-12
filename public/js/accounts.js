/* ============ Accounts ============ */
function renderAccounts(){
  const grid = document.getElementById('acctGrid');
  if(db.accounts.length===0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No accounts yet. <button class="btn" onclick="openAccountModal()">+ Add Account</button></div>`;
    return;
  }
  grid.innerHTML = db.accounts.map(a=>{
    const apps = db.applications.filter(x=>x.accountId===a.id);
    const given = apps.reduce((s,x)=>s+(Number(x.amountGiven)||0),0);
    const used = apps.reduce((s,x)=>s+(Number(x.amountUsed)||0),0);
    const refunded = apps.reduce((s,x)=>s+refundOf(x),0);
    const blocked = apps.reduce((s,x)=>s+blockedOf(x),0);
    return `<div class="acct-card">
      <div class="acct-top">
        <div><div class="acct-name">${escapeHtml(a.name)}</div><div class="acct-type">${a.type==='own'?'My account':'Friend'}</div></div>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" onclick="openAccountModal('${a.id}')">Edit</button>
          <button class="btn-icon btn-danger" onclick="deleteAccount('${a.id}')">Delete</button>
        </div>
      </div>
      <div class="acct-stats">
        <div><span>Given</span><b>${fmt(given)}</b></div>
        <div><span>Used</span><b>${fmt(used)}</b></div>
        <div><span>Refunded</span><b>${fmt(refunded)}</b></div>
        ${blocked ? `<div title="Blocked with the bank until the allotment is out"><span>Blocked</span><b style="color:var(--amber)">${fmt(blocked)}</b></div>` : ''}
      </div>
    </div>`;
  }).join('');
}
function openAccountModal(id){
  document.getElementById('acctForm').reset();
  document.getElementById('acctId').value = id || '';
  document.getElementById('acctModalTitle').textContent = id ? 'Edit Account' : 'Add Account';
  if(id){
    const a = getAccount(id);
    document.getElementById('acctName').value = a.name;
    document.getElementById('acctType').value = a.type;
  }
  openModal('acctOverlay');
}
function saveAccount(e){
  e.preventDefault();
  const id = document.getElementById('acctId').value;
  const data = { name: document.getElementById('acctName').value.trim(), type: document.getElementById('acctType').value };
  if(id) Object.assign(getAccount(id), data);
  else db.accounts.push({ id: uid(), ...data });
  saveData(); closeModal('acctOverlay'); renderAll();
}
function deleteAccount(id){
  if(db.applications.some(a=>a.accountId===id)){
    if(!confirm('This account has linked applications. Delete it and its applications?')) return;
    db.applications = db.applications.filter(a=>a.accountId!==id);
  } else if(!confirm('Delete this account?')) return;
  db.accounts = db.accounts.filter(a=>a.id!==id);
  saveData(); renderAll();
}

