let transactionReportState={orderId:null};
function transactionReportEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function openTransactionReportModal(orderId){
 transactionReportState.orderId=Number(orderId);const m=document.createElement('div');m.id='transactionReportModal';m.className='modal-overlay';m.style.display='flex';
 m.innerHTML=`<div class="modal-card transaction-report-modal"><div class="review-modal-header"><div><div class="review-modal-title">🚩 รายงานการทำรายการ</div><div class="review-modal-product">รายงานได้เฉพาะคู่กรณีที่ทำรายการนี้ร่วมกัน</div></div><button class="btn btn-ghost btn-sm" onclick="closeTransactionReportModal()">✕</button></div>
 <div class="review-label">เหตุผลในการรายงาน</div><div class="review-report-reasons">
 <label><input type="radio" name="transactionReportReason" value="SCAM"> หลอกลวง / พยายามโกง</label>
 <label><input type="radio" name="transactionReportReason" value="ITEM_NOT_AS_DESCRIBED"> สินค้าไม่ตรงตามรายละเอียด</label>
 <label><input type="radio" name="transactionReportReason" value="NO_DELIVERY"> ไม่ได้รับสินค้า / ไม่ส่งข้อมูล</label>
 <label><input type="radio" name="transactionReportReason" value="HARASSMENT"> คำหยาบ / การคุกคาม</label>
 <label><input type="radio" name="transactionReportReason" value="CHAT_ABUSE"> พฤติกรรมไม่เหมาะสมในการพูดคุย</label>
 <label><input type="radio" name="transactionReportReason" value="OTHER"> อื่น ๆ</label></div>`;
 document.body.appendChild(m);
}
function closeTransactionReportModal(){document.getElementById('transactionReportModal')?.remove();transactionReportState.orderId=null;}

function finishTransactionReportModal(){const m=document.getElementById('transactionReportModal');if(!m)return;const body=m.querySelector('.transaction-report-modal');body.insertAdjacentHTML('beforeend',`<div class="review-label">รายละเอียดเพิ่มเติม <span>(ไม่บังคับ)</span></div><textarea id="transactionReportDescription" maxlength="500" rows="4" placeholder="อธิบายเหตุการณ์เพิ่มเติม เช่น สิ่งที่เกิดขึ้นในการซื้อขายหรือแชท"></textarea><div id="transactionReportMessage" class="review-message"></div><div class="review-modal-actions"><button class="btn btn-secondary" onclick="closeTransactionReportModal()">ยกเลิก</button><button id="transactionReportSubmit" class="btn btn-danger" onclick="submitTransactionReport()">ส่งรายงาน</button></div>`);}

async function submitTransactionReport(){
 const message=document.getElementById('transactionReportMessage'),button=document.getElementById('transactionReportSubmit');
 const reason=document.querySelector('input[name="transactionReportReason"]:checked')?.value||'',description=document.getElementById('transactionReportDescription')?.value.trim()||'';
 const token=typeof csrfToken!=='undefined'?(csrfToken||getCookieValue('gm_csrf')):getCookieValue('gm_csrf');
 if(!transactionReportState.orderId)return;if(!reason){message.textContent='กรุณาเลือกเหตุผลในการรายงาน';return;}if(!token){message.textContent='ไม่พบข้อมูลความปลอดภัย กรุณารีเฟรชหน้าแล้วลองใหม่';return;}
 button.disabled=true;button.textContent='กำลังส่ง...';
 try{const r=await fetch('/api/v1/transaction-reports',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({orderId:transactionReportState.orderId,reason,description})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error?.message||'ส่งรายงานไม่สำเร็จ');closeTransactionReportModal();window.loadTradeHistory?.();if(typeof showToast==='function')showToast('ส่งรายงานการทำรายการแล้ว รอผู้ดูแลตรวจสอบ','success');}catch(e){message.textContent=e.message||'ส่งรายงานไม่สำเร็จ';}finally{button.disabled=false;button.textContent='ส่งรายงาน';}
}
window.openTransactionReportModal=openTransactionReportModal;window.closeTransactionReportModal=closeTransactionReportModal;
// Build the second half after the browser inserts the reason options.
document.addEventListener('change',e=>{if(e.target.name==='transactionReportReason'&&document.getElementById('transactionReportDescription')==null)finishTransactionReportModal();});
