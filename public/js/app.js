/* ============ Render all ============ */
function renderAll(){
  renderTicker();
  renderDashboard();
  renderIPOs();
  renderAccounts();
  renderApplications();
  renderPortfolio();
  renderCalendar();
}

/* ============ Init ============ */
loadData();
renderAll();

const autoOn = localStorage.getItem(AUTO_SYNC_KEY) !== '0'; // auto-refresh by default
document.getElementById('autoSyncToggle').checked = autoOn;
if(location.protocol === 'file:'){
  setSyncStatus('err', 'Opened as a local file — run `npm start` and use http://localhost:5173 to fetch live IPO details.');
} else {
  setAutoSync(autoOn);
  if(!autoOn) syncLiveIpos();
}
