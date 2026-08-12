/* ============ Live IPO fetch ============ */
/* Details come from server.js (/api/ipos), which merges NSE India
   (price band, lot size, dates, status) with a GMP source. The page
   itself can't call those APIs — no CORS — so run `npm start` and
   open http://localhost:5173 instead of double-clicking this file. */

const AUTO_SYNC_KEY = 'ipoMonitorAutoSync';
const AUTO_SYNC_MS = 5 * 60 * 1000;
let autoSyncTimer = null;
let syncing = false;

function liveKeyOf(name){
  return String(name||'').toLowerCase()
    .replace(/\b(limited|ltd|private|pvt|india|ipo|sme)\b/g,'')
    .replace(/[^a-z0-9]/g,'');
}

function setSyncStatus(state, msg, sources){
  const dot = document.getElementById('syncDot');
  dot.className = 'sync-dot' + (state ? ' ' + state : '');
  document.getElementById('syncStatus').textContent = msg;
  document.getElementById('syncSources').textContent = sources || '';
  document.getElementById('syncBtn').disabled = state === 'busy';
}

async function syncLiveIpos({ force = false, quiet = false } = {}){
  if(syncing) return;
  syncing = true;
  if(!quiet) setSyncStatus('busy', 'Fetching live IPO details…');
  try{
    const res = await fetch('/api/ipos' + (force ? '?refresh=1' : ''), { cache:'no-store' });
    const payload = await res.json();
    if(!payload.ok || !Array.isArray(payload.ipos)) throw new Error(payload.error || 'Feed returned no IPOs');

    const { added, updated } = applyLiveIpos(payload.ipos);
    saveData();
    renderAll();

    const time = new Date(payload.fetchedAt).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
    const flags = [payload.cached ? 'cached' : null, payload.stale ? 'stale' : null].filter(Boolean);
    setSyncStatus('ok',
      `Live: ${payload.ipos.length} IPOs · ${added} new, ${updated} updated · ${time}${flags.length ? ' ('+flags.join(', ')+')' : ''}`,
      (payload.sources||[]).map(s => `${s.name}: ${s.ok ? s.count : 'failed'}`).join('  ·  '));
  }catch(err){
    const offline = location.protocol === 'file:';
    setSyncStatus('err', offline
      ? 'Open via the local server to fetch live data — run: npm start, then http://localhost:5173'
      : 'Live fetch failed: ' + err.message + ' — manual entry still works.');
  }finally{
    syncing = false;
  }
}

/* Fold fetched IPOs into the local db.
   - Live-sourced IPOs are refreshed in place (your currentPrice is kept).
   - Manually added IPOs only get their empty fields filled, plus GMP,
     so your own edits are never overwritten. */
function applyLiveIpos(list){
  let added = 0, updated = 0;
  for(const live of list){
    const key = live.key || liveKeyOf(live.name);
    if(!key) continue;
    const existing = db.ipos.find(i => (i.liveKey && i.liveKey === key) || liveKeyOf(i.name) === key);

    if(!existing){
      db.ipos.push({
        id: uid(), source:'live', liveKey:key,
        name: live.name,
        priceMin: live.priceMin || 0,
        priceMax: live.priceMax || live.priceMin || 0,
        lotSize: live.lotSize || 0,
        status: live.status || 'Upcoming',
        openDate: live.openDate || '',
        closeDate: live.closeDate || '',
        listingDate: live.listingDate || '',
        gmp: live.gmp || 0,
        currentPrice: 0,
        estListing: live.estListing || 0,
        exchange: live.exchange || '',
        symbol: live.symbol || '',
        subscription: live.subscription || 0,
        registrar: live.registrar || '',
      });
      added++;
      continue;
    }

    const before = JSON.stringify(existing);
    if(existing.source === 'live'){
      existing.liveKey = key;
      existing.name = live.name || existing.name;
      ['priceMin','priceMax','lotSize','gmp','estListing','subscription'].forEach(f=>{
        if(live[f]) existing[f] = live[f];
      });
      existing.symbol = live.symbol || existing.symbol;
      ['status','openDate','closeDate','listingDate','exchange','registrar'].forEach(f=>{
        if(live[f]) existing[f] = live[f];
      });
      // currentPrice stays whatever the user entered.
    } else {
      existing.liveKey = key;
      ['priceMin','priceMax','lotSize','openDate','closeDate','listingDate','status','exchange','registrar'].forEach(f=>{
        if(!existing[f] && live[f]) existing[f] = live[f];
      });
      if(live.gmp) existing.gmp = live.gmp;
    }
    if(JSON.stringify(existing) !== before) updated++;
  }
  return { added, updated };
}

function setAutoSync(on){
  localStorage.setItem(AUTO_SYNC_KEY, on ? '1' : '0');
  clearInterval(autoSyncTimer);
  autoSyncTimer = null;
  if(on){
    autoSyncTimer = setInterval(()=> syncLiveIpos({quiet:true}), AUTO_SYNC_MS);
    syncLiveIpos();
  }
}

