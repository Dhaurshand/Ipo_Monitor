/* ============ Calendar ============
   Only about your applications — not a general IPO date board.

   Two lists:
     1. Needs your attention — applications whose IPO has moved on while the
        application still says Pending. Once an IPO closes the allotment is
        out; once it lists the outcome is certain. Either way the row needs
        updating, and each reminder opens that exact application.
     2. Waiting on the allotment — applications on issues that haven't closed
        yet, with the date the result is due. Nothing to do but wait. */

const CAL_MS_DAY = 24 * 60 * 60 * 1000;

/* Whole days from today; negative = past. Dates are plain yyyy-mm-dd, so
   compare at local midnight to avoid timezone drift. */
function daysFromToday(iso){
  if(!iso) return null;
  const [y,m,d] = String(iso).split('-').map(Number);
  if(!y || !m || !d) return null;
  const then = new Date(y, m-1, d).setHours(0,0,0,0);
  const now = new Date().setHours(0,0,0,0);
  return Math.round((then - now) / CAL_MS_DAY);
}
function relativeDay(iso){
  const n = daysFromToday(iso);
  if(n === null) return '';
  if(n === 0) return 'today';
  if(n === 1) return 'tomorrow';
  if(n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/* ---------- Reminders ---------- */

function calReminders(){
  const out = [];
  for(const app of db.applications){
    const ipo = getIpo(app.ipoId);
    const acct = getAccount(app.accountId);
    if(!ipo) continue;
    const who = acct ? acct.name : 'unknown account';

    if(app.status === 'Pending' && ipo.status === 'Listed'){
      out.push({
        level:'high', appId:app.id,
        text:`<b>${escapeHtml(ipo.name)}</b> has listed but ${escapeHtml(who)}'s application is still Pending.`,
        sub:`Record whether it was allotted${ipo.listingDate ? ` · listed ${ipo.listingDate} (${relativeDay(ipo.listingDate)})` : ''}`,
        action:'Update status',
      });
    } else if(app.status === 'Pending' && ipo.status === 'Closed'){
      out.push({
        level:'med', appId:app.id,
        text:`<b>${escapeHtml(ipo.name)}</b> has closed — the allotment should be out for ${escapeHtml(who)}.`,
        sub:`Check the registrar${ipo.registrar ? ` (${escapeHtml(ipo.registrar)})` : ''} and update the status`,
        action:'Update status',
      });
    } else if(app.status === 'Allotted' && ipo.status === 'Listed' && !Number(ipo.currentPrice)){
      out.push({
        level:'low', ipoId:app.ipoId,
        text:`<b>${escapeHtml(ipo.name)}</b> is listed but has no current price — P/L shows zero.`,
        sub:'Add the listing / current price to the IPO',
        action:'Edit IPO',
      });
    }
  }
  const rank = { high:0, med:1, low:2 };
  return out.sort((a,b)=> rank[a.level] - rank[b.level]);
}

function renderReminders(){
  const list = calReminders();
  const badge = $('calBadge');
  const actionable = list.filter(r=>r.level !== 'low').length;
  badge.textContent = actionable;
  badge.style.display = actionable ? '' : 'none';

  $('calReminders').innerHTML = list.length ? list.map(r=>`
    <div class="reminder ${r.level}">
      <span class="rem-icon">●</span>
      <div class="rem-text">${r.text}<div class="rem-sub">${r.sub}</div></div>
      <button class="btn-ghost" onclick="${r.appId ? `openAppModal('${r.appId}')` : `openIpoModal('${r.ipoId}')`}">${r.action}</button>
    </div>`).join('')
    : `<div class="empty-state">Nothing waiting on you — every application matches its IPO's stage.</div>`;
}

/* ---------- Month grid ---------- */

let calMonth = null;   // pinned to the 1st of the displayed month

function calDateKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* Only dates that belong to an IPO you actually applied to — the day the
   result is due (issue close) and the day it lists. One chip per IPO event,
   with the accounts involved in the tooltip. */
function calAppEvents(){
  const map = {};
  const add = (date, type, ipo, accounts) => {
    if(!date) return;
    const key = date;
    const bucket = (map[key] = map[key] || []);
    const existing = bucket.find(e => e.type === type && e.ipoId === ipo.id);
    if(existing){ existing.accounts.push(...accounts); return; }
    bucket.push({ type, ipoId: ipo.id, name: ipo.name, accounts: [...accounts] });
  };

  for(const ipo of db.ipos){
    const apps = db.applications.filter(a => a.ipoId === ipo.id);
    if(!apps.length) continue;                       // not your application — not your calendar
    const who = apps.map(a => (getAccount(a.accountId) || {}).name || '—');
    add(ipo.closeDate, 'close', ipo, who);
    add(ipo.listingDate, 'list', ipo, who);
  }
  return map;
}

function calShiftMonth(step){
  const now = new Date();
  const base = calMonth || new Date(now.getFullYear(), now.getMonth(), 1);
  calMonth = step === 0
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(base.getFullYear(), base.getMonth() + step, 1);
  renderMonthGrid();
}

function renderMonthGrid(){
  const now = new Date();
  if(!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const events = calAppEvents();
  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const today = calDateKey(now);

  $('calMonthLabel').textContent =
    calMonth.toLocaleDateString('en-IN', { month:'long', year:'numeric' });

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;           // grid starts on Monday
  const start = new Date(year, month, 1 - offset);
  const weeks = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7);

  const cells = [];
  for(let i = 0; i < weeks * 7; i++){
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = calDateKey(day);
    const evs = events[key] || [];
    const cls = ['cal-day',
      day.getMonth() !== month ? 'other-month' : '',
      key === today ? 'today' : ''].filter(Boolean).join(' ');
    cells.push(`<div class="${cls}">
      <div class="daynum">${day.getDate()}</div>
      ${evs.map(e=>{
        const verb = e.type === 'close' ? 'result due' : 'lists';
        const tip = `${e.name} — ${verb} · ${[...new Set(e.accounts)].join(', ')}`;
        return `<div class="cal-event ev-${e.type}" title="${escapeHtml(tip)}">${escapeHtml(e.name)}</div>`;
      }).join('')}
    </div>`);
  }
  $('calGrid').innerHTML = cells.join('');
}

/* ---------- Still waiting ---------- */

function renderWaiting(){
  const rows = db.applications
    .filter(app=>{
      const ipo = getIpo(app.ipoId);
      return app.status === 'Pending' && ipo && (ipo.status === 'Upcoming' || ipo.status === 'Open');
    })
    .map(app=>{
      const ipo = getIpo(app.ipoId), acct = getAccount(app.accountId);
      return { app, ipo, who: acct ? acct.name : '—', n: daysFromToday(ipo.closeDate) };
    })
    .sort((a,b)=> (a.n ?? 999) - (b.n ?? 999));

  $('calWaiting').innerHTML = rows.length ? rows.map(({app, ipo, who})=>`
    <div class="reminder low">
      <span class="rem-icon">○</span>
      <div class="rem-text">
        <b>${escapeHtml(ipo.name)}</b> · ${escapeHtml(who)} · ${fmt(app.amountGiven)} blocked
        <div class="rem-sub">${ipo.closeDate
          ? `closes ${ipo.closeDate} (${relativeDay(ipo.closeDate)}) — allotment a day or two later`
          : 'no close date on record'}</div>
      </div>
      <button class="btn-ghost" onclick="openAppModal('${app.id}')">Open</button>
    </div>`).join('')
    : `<div class="empty-state">No applications are waiting on a result.</div>`;
}

function renderCalendar(){
  renderReminders();
  renderMonthGrid();
  renderWaiting();
}
