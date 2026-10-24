/* MikroTools — ümumi köməkçi funksiyalar (bildiriş, kopyalama, endirmə) */
/* ---------- A) KÖMƏKÇİ FUNKSİYALAR ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Bildiriş (toast)
let toastTimer;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
// Kopyalama (köhnə brauzerlər üçün fallback ilə)
async function copyText(text){
  if(!text){ toast('Kopyalanacaq mətn yoxdur'); return; }
  try{ await navigator.clipboard.writeText(text); }
  catch(e){
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('✓ Kopyalandı');
}
// Blob / URL endirmə
function downloadURL(url, name){
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function downloadBlob(blob, name){
  const u = URL.createObjectURL(blob); downloadURL(u, name); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
function downloadText(text, name){
  if(!text){ toast('Endiriləcək məzmun yoxdur'); return; }
  downloadBlob(new Blob([text], {type:'text/plain;charset=utf-8'}), name);
}
const fmtBytes = b => b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(2) + ' MB';
const pad = n => String(n).padStart(2, '0');

