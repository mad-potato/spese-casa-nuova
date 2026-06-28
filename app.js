// Versione sincronizzata Google Sheets.
// Fix cache vecchia versione GitHub Pages / iPhone: pulisce service worker cache-first precedente.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(()=>{});
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(()=>{});
}

const API_URL = 'https://script.google.com/macros/s/AKfycbzy-NiuHzMaytAMAlom34G-2L5_u2sOhYLf4UQRH1fvj97UyQhE8lJNGggvO-3GXHD9aQ/exec';
const STORAGE_KEY = 'spese-casa-nuova-sheets-cache-v1';
let items = loadCache();
let activeStatus = 'all';
let editingId = null;
let isSyncing = false;
const moneyFormatter = new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'});
const $ = s => document.querySelector(s);
const list = $('#list');
const categorySelect = $('#categorySelect');
const categoryField = $('#categoryField');

function loadCache(){
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(cached) && cached.length ? cached : window.INITIAL_ITEMS.map(normalizeInitial);
  } catch {
    return window.INITIAL_ITEMS.map(normalizeInitial);
  }
}
function saveCache(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
function normalizeInitial(i){ return { id:String(i.id), name:i.name||'', category:i.category||'ALTRO', qty:Number(i.qty||1), price:Number(i.price||0), notes:i.notes||'', bought:!!i.bought }; }
function fromSheet(row){ return { id:String(row.id), name:row.descrizione||'', category:row.categoria||'ALTRO', qty:Number(row.quantita||1), price:Number(row.prezzo||0), notes:row.note||'', bought:!!row.comprato, data:row.data||'' }; }
function toSheet(item){ return { id:String(item.id||''), descrizione:item.name||'', categoria:item.category||'ALTRO', quantita:Number(item.qty||1), prezzo:Number(item.price||0), comprato:!!item.bought, data:item.data||new Date().toISOString(), note:item.notes||'' }; }
function setSyncStatus(text, ok=true){
  let el = $('#syncStatus');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('offline', !ok);
}
async function apiList(){
  const res = await fetch(`${API_URL}?action=list&t=${Date.now()}`, { method:'GET', cache:'no-store' });
  if (!res.ok) throw new Error(`Errore lettura ${res.status}`);
  return res.json();
}
async function apiPost(action, body){
  const res = await fetch(API_URL, {
    method:'POST',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...body })
  });
  if (!res.ok) throw new Error(`Errore salvataggio ${res.status}`);
  return res.json();
}
async function syncLoad(){
  try {
    setSyncStatus('☁️ Sincronizzazione…', true);
    const data = await apiList();
    if (!data.ok) throw new Error(data.error || 'Risposta non valida');
    items = (data.items || []).map(fromSheet);
    saveCache();
    render();
    setSyncStatus('☁️ Sincronizzato con Google Sheets', true);
  } catch (err) {
    console.error(err);
    setSyncStatus('⚠️ Offline o autorizzazione Google non completa', false);
  }
}
async function syncAdd(payload){
  const data = await apiPost('add', { item: toSheet(payload) });
  if (!data.ok) throw new Error(data.error || 'Aggiunta non riuscita');
  return fromSheet(data.item);
}
async function syncUpdate(payload){
  const data = await apiPost('update', { item: toSheet(payload) });
  if (!data.ok) throw new Error(data.error || 'Aggiornamento non riuscito');
  return payload;
}
async function syncDelete(id){
  const data = await apiPost('delete', { id:String(id) });
  if (!data.ok) throw new Error(data.error || 'Eliminazione non riuscita');
}
function allCategories(){ return [...new Set([...window.INITIAL_CATEGORIES, ...items.map(i=>i.category||'ALTRO')])].sort(); }
function total(i){ return (Number(i.qty)||1) * (Number(i.price)||0); }
function fmt(v){ return moneyFormatter.format(v || 0); }
function icon(cat){
  const c=(cat||'').toLowerCase();
  if(c.includes('supermercato')) return '🛒'; if(c.includes('bagno')) return '🚿'; if(c.includes('cucina')) return '🍳'; if(c.includes('bucato')) return '🧺';
  if(c.includes('pulizia')) return '🧽'; if(c.includes('personale')) return '🫧'; if(c.includes('camera')) return '🛏️';
  return '✨';
}
function renderFilters(){
  const cats = allCategories();
  const current = categorySelect.value || 'all';
  categorySelect.innerHTML = '<option value="all">Tutte le categorie</option>' + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  categorySelect.value = cats.includes(current) ? current : 'all';
  categoryField.innerHTML = cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}
function renderStats(){
  const all = items.reduce((s,i)=>s+total(i),0), bought=items.filter(i=>i.bought).reduce((s,i)=>s+total(i),0), todo=all-bought;
  $('#totalAll').textContent=fmt(all); $('#totalBought').textContent=fmt(bought); $('#totalTodo').textContent=fmt(todo);
  const pct = items.length ? Math.round(items.filter(i=>i.bought).length/items.length*100) : 0;
  $('#progressText').textContent = pct + '%'; $('#progressBar').style.width = pct + '%';
}
function filteredItems(){
  const q=$('#searchInput').value.trim().toLowerCase(); const cat=categorySelect.value;
  return items.filter(i => (activeStatus==='all' || (activeStatus==='todo'?!i.bought:i.bought))
    && (cat==='all' || i.category===cat)
    && (!q || `${i.name} ${i.category} ${i.notes||''}`.toLowerCase().includes(q)));
}
function render(){
  renderFilters(); renderStats(); const data=filteredItems();
  list.innerHTML = data.map(i=>`<article class="item ${i.bought?'bought':''}" data-id="${escapeHtml(i.id)}">
    <button class="check" data-action="toggle" aria-label="Segna come comprato">${i.bought?'✓':''}</button>
    <div class="meta" data-action="edit"><div class="name">${escapeHtml(i.name)}</div><span class="cat">${icon(i.category)} ${escapeHtml(i.category||'ALTRO')}</span></div>
    <div class="price" data-action="edit">${fmt(total(i))}<span class="qty">x${i.qty||1}</span></div>
  </article>`).join('');
  const empty = $('#emptyState');
  empty.classList.toggle('hidden', data.length>0);
  const q = $('#searchInput').value.trim();
  if (data.length === 0 && q) {
    empty.innerHTML = `Nessun acquisto trovato.<br><button type="button" class="quick-add" id="quickAddBtn">＋ Aggiungi “${escapeHtml(q)}”</button>`;
  } else {
    empty.textContent = 'Nessun acquisto trovato. Prova a cambiare filtro o aggiungine uno nuovo ✨';
  }
}
function openForm(id=null){
  editingId=id === null ? null : String(id);
  const typedName = $('#searchInput')?.value?.trim() || '';
  const item=items.find(i=>String(i.id)===editingId) || {name:typedName,category:'SUPERMERCATO',qty:1,price:'',notes:'',bought:false};
  $('#dialogTitle').textContent = id ? 'Modifica acquisto' : 'Nuovo acquisto';
  $('#nameField').value=item.name; categoryField.value=item.category || 'ALTRO'; $('#qtyField').value=item.qty||1; $('#priceField').value=item.price||''; $('#notesField').value=item.notes||''; $('#boughtField').checked=!!item.bought;
  $('#deleteBtn').classList.toggle('hidden', !id); $('#itemDialog').showModal(); setTimeout(()=>$('#nameField').focus(), 80);
}
function closeForm(){ $('#itemDialog').close(); editingId=null; }
async function upsertFromForm(){
  if (isSyncing) return;
  const payload={ id: editingId || '', name:$('#nameField').value.trim(), category:categoryField.value||'ALTRO', qty:Number($('#qtyField').value)||1, price:Number($('#priceField').value)||0, notes:$('#notesField').value.trim(), bought:$('#boughtField').checked, data:new Date().toISOString() };
  if(!payload.name) return;
  isSyncing = true;
  const saveBtn = $('.save');
  const oldText = saveBtn.textContent;
  saveBtn.textContent = 'Salvo…';
  try {
    if(editingId){
      await syncUpdate(payload);
      const target = items.find(i=>String(i.id)===String(editingId));
      Object.assign(target, payload);
    } else {
      const saved = await syncAdd(payload);
      items.unshift(saved);
      sparkle();
    }
    saveCache(); closeForm(); render(); setSyncStatus('☁️ Salvato e sincronizzato', true);
  } catch (err) {
    console.error(err);
    alert('Non sono riuscito a salvare su Google Sheets. Controlla il deploy Apps Script e i permessi.');
    setSyncStatus('⚠️ Salvataggio non riuscito', false);
  } finally {
    isSyncing = false;
    saveBtn.textContent = oldText;
  }
}
function sparkle(){
  for(let i=0;i<16;i++){ const s=document.createElement('i'); s.textContent=['✨','🏠','💸','🛒'][i%4]; s.style.cssText=`position:fixed;right:44px;bottom:76px;z-index:99;pointer-events:none;font-style:normal;font-size:22px;transition:transform .7s ease, opacity .7s ease;`; document.body.appendChild(s); requestAnimationFrame(()=>{s.style.transform=`translate(${(Math.random()-.5)*220}px,${-90-Math.random()*160}px) rotate(${Math.random()*180}deg)`; s.style.opacity=0;}); setTimeout(()=>s.remove(),760); }
}
function escapeHtml(str){ return String(str).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$('#addBtn').addEventListener('click',()=>openForm());
$('#addInlineBtn').addEventListener('click',()=>openForm());
$('#emptyState').addEventListener('click', e=>{ if(e.target.closest('#quickAddBtn')) openForm(); });
$('#cancelBtn').addEventListener('click',closeForm);
$('#itemForm').addEventListener('submit', e=>{ e.preventDefault(); upsertFromForm(); });
$('#deleteBtn').addEventListener('click',async()=>{
  if(!editingId || isSyncing) return;
  if(!confirm('Eliminare questo acquisto?')) return;
  isSyncing = true;
  try { await syncDelete(editingId); items=items.filter(i=>String(i.id)!==String(editingId)); saveCache(); closeForm(); render(); setSyncStatus('☁️ Eliminato e sincronizzato', true); }
  catch(err){ console.error(err); alert('Non sono riuscito a eliminare da Google Sheets.'); setSyncStatus('⚠️ Eliminazione non riuscita', false); }
  finally { isSyncing = false; }
});
$('#searchInput').addEventListener('input',render); categorySelect.addEventListener('change',render);
$('#statusFilters').addEventListener('click',e=>{ const b=e.target.closest('button[data-status]'); if(!b) return; activeStatus=b.dataset.status; document.querySelectorAll('#statusFilters .chip').forEach(x=>x.classList.toggle('active',x===b)); render(); });
list.addEventListener('click',async e=>{
  const card=e.target.closest('.item'); if(!card) return; const id=String(card.dataset.id);
  if(e.target.closest('[data-action="toggle"]')){
    const item=items.find(i=>String(i.id)===id); if(!item) return;
    const previous = item.bought; item.bought=!item.bought; if(item.bought) sparkle(); render(); saveCache();
    try { await syncUpdate(item); setSyncStatus('☁️ Salvato e sincronizzato', true); }
    catch(err){ console.error(err); item.bought=previous; render(); saveCache(); alert('Non sono riuscito a sincronizzare la modifica.'); setSyncStatus('⚠️ Sincronizzazione non riuscita', false); }
  } else openForm(id);
});
$('#resetBtn').addEventListener('click',()=>{ alert('In questa versione il ripristino locale è disattivato: i dati arrivano da Google Sheets. Modifica o svuota il foglio Google per resettare la lista condivisa.'); });
render();
syncLoad();
