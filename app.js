
const STORAGE_KEY = 'spese-casa-nuova-v1';
let items = loadItems();
let activeStatus = 'all';
let editingId = null;
const € = new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'});
const $ = s => document.querySelector(s);
const list = $('#list');
const categorySelect = $('#categorySelect');
const categoryField = $('#categoryField');

function loadItems(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || window.INITIAL_ITEMS; }
  catch { return window.INITIAL_ITEMS; }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
function allCategories(){ return [...new Set([...window.INITIAL_CATEGORIES, ...items.map(i=>i.category||'ALTRO')])].sort(); }
function total(i){ return (Number(i.qty)||1) * (Number(i.price)||0); }
function fmt(v){ return €.format(v || 0); }
function icon(cat){
  const c=(cat||'').toLowerCase();
  if(c.includes('bagno')) return '🚿'; if(c.includes('cucina')) return '🍳'; if(c.includes('bucato')) return '🧺';
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
function renderStats(filtered=items){
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
  list.innerHTML = data.map(i=>`<article class="item ${i.bought?'bought':''}" data-id="${i.id}">
    <button class="check" data-action="toggle" aria-label="Segna come comprato">${i.bought?'✓':''}</button>
    <div class="meta" data-action="edit"><div class="name">${escapeHtml(i.name)}</div><span class="cat">${icon(i.category)} ${escapeHtml(i.category||'ALTRO')}</span></div>
    <div class="price" data-action="edit">${fmt(total(i))}<span class="qty">x${i.qty||1}</span></div>
  </article>`).join('');
  $('#emptyState').classList.toggle('hidden', data.length>0);
}
function openForm(id=null){
  editingId=id; const item=items.find(i=>i.id===id) || {name:'',category:allCategories()[0]||'ALTRO',qty:1,price:'',notes:'',bought:false};
  $('#dialogTitle').textContent = id ? 'Modifica acquisto' : 'Nuovo acquisto';
  $('#nameField').value=item.name; categoryField.value=item.category || 'ALTRO'; $('#qtyField').value=item.qty||1; $('#priceField').value=item.price||''; $('#notesField').value=item.notes||''; $('#boughtField').checked=!!item.bought;
  $('#deleteBtn').classList.toggle('hidden', !id); $('#itemDialog').showModal(); setTimeout(()=>$('#nameField').focus(), 80);
}
function closeForm(){ $('#itemDialog').close(); editingId=null; }
function upsertFromForm(){
  const payload={ name:$('#nameField').value.trim(), category:categoryField.value||'ALTRO', qty:Number($('#qtyField').value)||1, price:Number($('#priceField').value)||0, notes:$('#notesField').value.trim(), bought:$('#boughtField').checked };
  if(!payload.name) return;
  if(editingId){ Object.assign(items.find(i=>i.id===editingId), payload); }
  else { items.unshift({id:Date.now(), ...payload}); sparkle(); }
  save(); closeForm(); render();
}
function sparkle(){
  for(let i=0;i<16;i++){ const s=document.createElement('i'); s.textContent=['✨','🏠','💸','🛒'][i%4]; s.style.cssText=`position:fixed;right:44px;bottom:76px;z-index:99;pointer-events:none;font-style:normal;font-size:22px;transition:transform .7s ease, opacity .7s ease;`; document.body.appendChild(s); requestAnimationFrame(()=>{s.style.transform=`translate(${(Math.random()-.5)*220}px,${-90-Math.random()*160}px) rotate(${Math.random()*180}deg)`; s.style.opacity=0;}); setTimeout(()=>s.remove(),760); }
}
function escapeHtml(str){ return String(str).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$('#addBtn').addEventListener('click',()=>openForm()); $('#cancelBtn').addEventListener('click',closeForm);
$('#itemForm').addEventListener('submit', e=>{ e.preventDefault(); upsertFromForm(); });
$('#deleteBtn').addEventListener('click',()=>{ if(editingId){ items=items.filter(i=>i.id!==editingId); save(); closeForm(); render(); } });
$('#searchInput').addEventListener('input',render); categorySelect.addEventListener('change',render);
$('#statusFilters').addEventListener('click',e=>{ const b=e.target.closest('button[data-status]'); if(!b) return; activeStatus=b.dataset.status; document.querySelectorAll('#statusFilters .chip').forEach(x=>x.classList.toggle('active',x===b)); render(); });
list.addEventListener('click',e=>{ const card=e.target.closest('.item'); if(!card) return; const id=Number(card.dataset.id); if(e.target.closest('[data-action="toggle"]')){ const item=items.find(i=>i.id===id); item.bought=!item.bought; if(item.bought) sparkle(); save(); render(); } else openForm(id); });
$('#resetBtn').addEventListener('click',()=>{ if(confirm('Vuoi ripristinare la lista iniziale? Le modifiche salvate su questo iPhone verranno cancellate.')){ localStorage.removeItem(STORAGE_KEY); items=window.INITIAL_ITEMS.map(i=>({...i})); render(); }});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
