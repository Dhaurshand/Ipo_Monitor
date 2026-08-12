/* ============ Nav ============ */
document.getElementById('tabs').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-view]');
  if(!btn) return;
  switchView(btn.dataset.view);
});
function switchView(view){
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id === 'view-'+view));
}

/* ============ Modal generic ============ */
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

