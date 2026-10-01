(function(){
  let conversations=[];
  let activeConversationId=null;
  let activeConversation=null;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  async function api(url,options={}){const r=await fetch(url,{credentials:'include',...options});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'เกิดข้อผิดพลาด');return b;}
  function csrf(){return typeof getCookieValue==='function'?getCookieValue('gm_csrf'):'';}
  function renderShell(){const root=document.getElementById('chatApp');if(!root)return;root.innerHTML=`<aside style="background:var(--card);border-right:1px solid var(--border);overflow-y:auto"><div style="padding:14px;border-bottom:1px solid var(--border)"><input id="chatSearch" class="inp" placeholder="🔍 ค้นหาแชท..." style="font-size:13px" oninput="window.filterChats()"></div><div id="chatConversationList"></div></aside><section style="display:flex;flex-direction:column;min-width:0"><div id="chatHeader"></div><div id="chatMessages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px"></div><div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:center"><input id="chatComposer" class="inp" placeholder="พิมพ์ข้อความ..." style="flex:1" onkeydown="if(event.key==='Enter')window.sendChatMessage()"><button
  class="btn btn-secondary btn-md"
  onclick="window.reportActiveChat()"
>
  🚨 รายงาน
</button><button class="btn btn-primary btn-md" onclick="window.sendChatMessage()">ส่ง 📤</button></div></section>`;}
  function renderList(){const list=document.getElementById('chatConversationList');if(!list)return;const q=(document.getElementById('chatSearch')?.value||'').toLowerCase();const rows=conversations.filter(c=>String(c.other_username||'').toLowerCase().includes(q));list.innerHTML=rows.length?rows.map(c=>`<div data-chat-id="${c.id}" onclick="window.openChat(${c.id})" style="padding:12px 16px;display:flex;gap:10px;align-items:center;cursor:pointer;border-left:3px solid ${Number(c.id)===Number(activeConversationId)?'var(--accent)':'transparent'};background:${Number(c.id)===Number(activeConversationId)?'rgba(59,130,246,0.1)':'transparent'}"><div class="avatar" style="width:38px;height:38px;background:var(--accent);font-size:16px">${esc(String(c.other_username||'?').charAt(0).toUpperCase())}</div><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${esc(c.other_username||'ผู้ใช้')}</div><div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.last_message||'ยังไม่มีข้อความ')}</div></div></div>`).join(''):'<div class="report-empty" style="margin:14px">ยังไม่มีการสนทนา</div>';}
  async function openChat(id){activeConversationId=Number(id);renderList();const box=document.getElementById('chatMessages');const header=document.getElementById('chatHeader');box.innerHTML='<div class="report-empty">กำลังโหลดข้อความ...</div>';try{const b=await api('/api/v1/chat/'+activeConversationId);const c=b.data.conversation,m=b.data.messages||[];activeConversation = c; header.innerHTML=`<div style="padding:13px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px"><div class="avatar" style="width:38px;height:38px;background:var(--accent);font-size:16px">${esc(String(c.buyer_username===c.seller_username?'?':c.buyer_username===window.currentUserUsername?c.seller_username:c.buyer_username).charAt(0).toUpperCase())}</div><div><div style="font-weight:700">${esc(c.product_title?c.product_title+' • ':'')}${esc(c.buyer_username)} ↔ ${esc(c.seller_username)}</div><div style="font-size:12px;color:var(--muted)">การสนทนา #${c.id}</div></div></div>`;box.innerHTML=m.length?m.map(x=>`<div style="display:flex;gap:8px;align-items:flex-end;justify-content:${Number(x.sender_id)===Number(window.currentUserId)?'flex-end':'flex-start'}"><div class="chat-bubble ${Number(x.sender_id)===Number(window.currentUserId)?'me':'them'}">${esc(x.body)}<div style="font-size:11px;color:var(--dim);margin-top:4px;text-align:right">${new Date(x.created_at).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit'})}</div></div></div>`).join(''):'<div class="report-empty">ยังไม่มีข้อความ เริ่มการสนทนาได้เลย</div>';box.scrollTop=box.scrollHeight;}catch(e){box.innerHTML=`<div class="notice danger">${esc(e.message)}</div>`;}}
  async function loadChats(){renderShell();try{const me=await api('/api/v1/auth/me');window.currentUserId=me.data?.user?.id;window.currentUserUsername=me.data?.user?.username;const b=await api('/api/v1/chat');conversations=b.data.conversations||[];renderList();if(conversations[0])await openChat(conversations[0].id);}catch(e){document.getElementById('chatConversationList').innerHTML=`<div class="notice danger" style="margin:12px">${esc(e.message)}</div>`;}}
  async function reportActiveChat() {
  if (!activeConversation) {
    alert('กรุณาเลือกห้องแชทก่อน');
    return;
  }

  const productId =
    Number(activeConversation.product_id || 0);

  if (!productId) {
    alert(
      'ห้องแชทนี้ไม่ได้เชื่อมกับสินค้าที่มีการทำรายการ'
    );
    return;
  }

  try {
    const result = await api('/api/v1/orders');

    const orders =
      result.data?.orders ||
      result.orders ||
      [];

    const order = orders.find((item) => {
      const sameProduct =
        Number(item.productId) === productId;

      const sameBuyer =
        Number(item.buyerId) ===
        Number(activeConversation.buyer_id);

      const sameSeller =
        Number(item.sellerId) ===
        Number(activeConversation.seller_id);

      const reportableStatus =
        !['PENDING', 'CANCELLED'].includes(
          item.status
        );

      return (
        sameProduct &&
        sameBuyer &&
        sameSeller &&
        reportableStatus
      );
    });

    if (!order) {
      alert(
        'ยังไม่มีรายการซื้อขายที่สามารถรายงานได้ในห้องแชทนี้'
      );
      return;
    }

    if (order.hasTransactionReport) {
      alert(
        'คุณได้รายงานรายการซื้อขายนี้ไปแล้ว'
      );
      return;
    }

    if (
      typeof window.openTransactionReportModal
      !== 'function'
    ) {
      alert(
        'ไม่สามารถเปิดหน้ารายงานได้ กรุณารีเฟรชหน้าแล้วลองใหม่'
      );
      return;
    }

    window.openTransactionReportModal(
      Number(order.id)
    );

  } catch (error) {
    alert(
      error.message ||
      'ไม่สามารถตรวจสอบรายการซื้อขายได้'
    );
  }
}
  async function sendChatMessage(){if(!activeConversationId)return alert('กรุณาเลือกการสนทนา');const input=document.getElementById('chatComposer'),body=input?.value.trim();if(!body)return;const token=csrf();if(!token)return alert('ไม่พบ CSRF Token กรุณารีเฟรชหน้า');try{await api('/api/v1/chat/'+activeConversationId+'/messages',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({body})});input.value='';await openChat(activeConversationId);const b=await api('/api/v1/chat');conversations=b.data.conversations||[];renderList();}catch(e){alert(e.message);}}
  window.filterChats=renderList;
  window.openChat=openChat;
  window.reportActiveChat=reportActiveChat;
  window.sendChatMessage=sendChatMessage;
  window.loadChatPage=loadChats;
})();
