function homeEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function homeGameIcon(game){const key=String(game.slug||game.name||'').toLowerCase();const map={valorant:'assets/images/Valorant.png',rov:'assets/images/Rov.png',pubg:'assets/images/Pubg.png','free-fire':'assets/images/FreeFire.jpg','freefire':'assets/images/FreeFire.jpg','genshin-impact':'assets/images/Genshin impact.jpg','genshin impact':'assets/images/Genshin impact.jpg','honkai-star-rail':'assets/images/Honkai Starrail.png','honkai: star rail':'assets/images/Honkai Starrail.png'};return game.imageUrl||map[key]||'';}
function homeProductCard(p,compact=false){const img=p.primaryImageUrl?`<img src="${homeEscape(p.primaryImageUrl)}" alt="${homeEscape(p.title)}" style="width:100%;height:${compact?150:180}px;object-fit:cover;border-radius:10px;margin-bottom:12px">`:`<div class="game-img" style="height:${compact?150:180}px;margin-bottom:12px;display:flex;align-items:center;justify-content:center">🎮</div>`;return `<div class="card card-hover" onclick="openProductDetail(${Number(p.id)})" style="cursor:pointer">${img}<span class="badge badge-gray" style="margin-bottom:8px">${homeEscape(p.game?.name||'-')}</span><div style="font-weight:600;font-size:14px;margin-bottom:4px">${homeEscape(p.title||'สินค้า')}</div><div style="color:var(--muted);font-size:12px;margin-bottom:10px">ผู้ขาย: ${homeEscape(p.seller?.username||'-')}</div><div class="flex-between"><span class="kanit" style="font-size:${compact?18:20}px;font-weight:800;color:var(--accent)">${Number(p.price||0).toLocaleString('th-TH')} ฿</span><span style="font-size:12px;color:var(--muted)">ดูรายละเอียด →</span></div></div>`;}
async function homeFetch(url){const r=await fetch(url,{credentials:'include'});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'โหลดข้อมูลหน้าแรกไม่สำเร็จ');return b.data||b;}
function renderRealGameFilters(games){
 const targets=[document.getElementById('guestGameFilter'),document.getElementById('userGameFilter')].filter(Boolean);
 const activeGames=(games||[]).filter(g=>g.status==='ACTIVE'||!g.status);
 const iconHtml=(g)=>{const icon=homeGameIcon(g);return icon?`<img src="${homeEscape(icon)}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:7px;flex:0 0 28px">`: '<span style="width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 28px">🎮</span>';};
 const html='<div class="filter-item active" onclick="filterGame(this)">ทุกเกม</div>'+activeGames.map(g=>`<div class="filter-item" onclick="filterGame(this)" data-game-slug="${homeEscape(g.slug||'')}" style="display:flex;align-items:center;gap:10px;min-height:42px">${iconHtml(g)}<span>${homeEscape(g.name)}</span></div>`).join('');
 targets.forEach(t=>{t.innerHTML=html||'<div class="report-empty">ยังไม่มีหมวดหมู่เกม</div>';});
}

async function loadRealHomeData(){
 const featured=document.getElementById('homeFeaturedGrid'),cats=document.getElementById('homeGameCategories'),userRec=document.getElementById('homeUserRecommendations');
 try{const [productsData,gamesData,statsData]=await Promise.all([homeFetch('/api/v1/products?page=1&pageSize=50&sort=newest'),homeFetch('/api/v1/games'),homeFetch('/api/v1/home/stats')]);
 const products=Array.isArray(productsData?.items)?productsData.items:[],games=Array.isArray(gamesData)?gamesData:(gamesData?.games||[]),stats=statsData?.data||statsData||{};
 if(featured)featured.innerHTML=products.slice(0,4).map(p=>homeProductCard(p,false)).join('')||'<div class="card" style="padding:28px;text-align:center;color:var(--muted);grid-column:1/-1">ยังไม่มีสินค้าที่เปิดขายในระบบ</div>';
 if(userRec)userRec.innerHTML=products.slice(0,3).map(p=>homeProductCard(p,true)).join('')||'<div class="card" style="padding:28px;text-align:center;color:var(--muted);grid-column:1/-1">ยังไม่มีสินค้าที่เปิดขายในระบบ</div>';
 if(cats)cats.innerHTML=games.filter(g=>g.status==='ACTIVE'||!g.status).slice(0,6).map(g=>{const icon=homeGameIcon(g);return `<div class="card card-hover" onclick="goPage('listings')" style="text-align:center;padding:20px 14px;cursor:pointer"><div style="height:72px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">${icon?`<img alt="${homeEscape(g.name)}" src="${homeEscape(icon)}" style="width:58px;height:58px;object-fit:cover;border-radius:14px">`:'🎮'}</div><div style="font-weight:700;font-size:14px">${homeEscape(g.name)}</div><div style="color:var(--muted);font-size:12px;margin-top:5px">ดูรายการสินค้า →</div></div>`}).join('')||'<div class="card" style="padding:28px;text-align:center;color:var(--muted);grid-column:1/-1">ยังไม่มีหมวดหมู่เกม</div>'; renderRealGameFilters(games);
 const setStat=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=Number(val||0).toLocaleString('th-TH');};setStat('homeStatProducts',stats.products);setStat('homeStatUsers',stats.users);setStat('homeStatSales',stats.successfulPurchases);
 }catch(e){console.error('loadRealHomeData failed:',e);[featured,userRec].forEach(el=>{if(el)el.innerHTML=`<div class="notice danger" style="grid-column:1/-1">${homeEscape(e.message)}</div>`;});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadRealHomeData);else loadRealHomeData();
window.loadRealHomeData=loadRealHomeData;

async function loadRealHomeUserData(){
  const box=document.getElementById('homeUserRecentMessages');
  try{
    const r=await fetch('/api/v1/home/me',{credentials:'include'}); const b=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(b.error?.message||'โหลดข้อมูลบัญชีไม่สำเร็จ');
    const d=b.data||{};
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=Number(v||0).toLocaleString('th-TH');};
    set('homeUserStatWallet',d.wallet);set('homeUserStatPurchases',d.purchases);set('homeUserStatListings',d.listings);set('homeUserStatMessages',d.messages);
    if(box)box.innerHTML=d.recentMessages?.length?d.recentMessages.map(m=>{const name=homeEscape(m.otherUsername||'ผู้ใช้');const initial=homeEscape((m.otherUsername||'?').charAt(0).toUpperCase());const text=homeEscape(m.lastMessage||'ยังไม่มีข้อความ');const time=m.lastMessageAt?new Date(m.lastMessageAt).toLocaleString('th-TH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'-';return `<div class="flex gap-10" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;align-items:center" onclick="goPage('chat')"><div class="avatar" style="width:34px;height:34px;background:var(--accent);font-size:14px">${initial}</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${name}</div><div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${text}</div></div><div style="font-size:11px;color:var(--dim)">${time}</div></div>`;}).join(''):'<div class="report-empty">ยังไม่มีการสนทนา</div>';
  }catch(e){console.error('loadRealHomeUserData failed:',e);if(r.status===401){return;}if(box)box.innerHTML='<div class="notice danger">'+homeEscape(e.message)+'</div>';}
}
function maybeLoadHomeUserData(){if(document.getElementById('pg-home-user'))loadRealHomeUserData();}
window.loadRealHomeUserData=loadRealHomeUserData;
// User-home data is loaded by script.js after authentication is restored.

