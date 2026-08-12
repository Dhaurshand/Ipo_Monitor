/* ============ Storage ============ */
const STORAGE_KEY = 'ipoMonitorData';
let db = { ipos: [], accounts: [], applications: [] };

function uid(){
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}
/* localStorage is kept as an always-available mirror so the app still
   works offline and before Firebase connects; the cloud copy (if
   configured) is the shared source of truth across devices. */
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  if(window.cloudPush) window.cloudPush(db);
}
function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ db = JSON.parse(raw); return; }
    catch{ /* corrupt mirror — fall through and reseed */ }
  }
  seedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/* Called by the Firebase module when the cloud copy changes
   (another device, another tab, or the first load after sign-in). */
function applyRemoteDb(remote){
  if(!remote || typeof remote !== 'object') return;
  db = {
    ipos: Array.isArray(remote.ipos) ? remote.ipos : [],
    accounts: Array.isArray(remote.accounts) ? remote.accounts : [],
    applications: Array.isArray(remote.applications) ? remote.applications : [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  renderAll();
}
function localDbIsEmpty(){
  return !db.ipos.length && !db.accounts.length && !db.applications.length;
}

function seedData(){
  // Demo data mirroring the project report's example portfolio, so the
  // dashboard isn't empty on first run. Safe to delete from Accounts/IPOs.
  const own = uid(), arun = uid(), karthik = uid();
  db.accounts = [
    { id: own, name: 'My Account', type: 'own' },
    { id: arun, name: 'Arun', type: 'friend' },
    { id: karthik, name: 'Karthik', type: 'friend' },
  ];
  const i1 = uid(), i2 = uid(), i3 = uid();
  db.ipos = [
    { id:i1, name:'Nova Industries', priceMin:100, priceMax:100, lotSize:200, status:'Listed', openDate:'', closeDate:'', listingDate:'', gmp:10, currentPrice:110 },
    { id:i2, name:'Bright Textiles', priceMin:150, priceMax:150, lotSize:100, status:'Listed', openDate:'', closeDate:'', listingDate:'', gmp:30, currentPrice:180 },
    { id:i3, name:'Solaris Energy',  priceMin:300, priceMax:300, lotSize:100, status:'Listed', openDate:'', closeDate:'', listingDate:'', gmp:25, currentPrice:325 },
  ];
  db.applications = [
    { id:uid(), ipoId:i1, accountId:own,     lotsApplied:1, amountGiven:20000, lotsAllotted:1, amountUsed:20000, refund:0, status:'Allotted' },
    { id:uid(), ipoId:i2, accountId:arun,    lotsApplied:1, amountGiven:15000, lotsAllotted:1, amountUsed:15000, refund:0, status:'Allotted' },
    { id:uid(), ipoId:i3, accountId:karthik, lotsApplied:1, amountGiven:30000, lotsAllotted:1, amountUsed:30000, refund:0, status:'Allotted' },
  ];
}

